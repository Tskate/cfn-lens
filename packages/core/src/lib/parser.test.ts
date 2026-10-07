import { describe, expect, it } from 'vitest';

import { parseTemplate } from './parser.ts';

// Orchestration only: each section reader has its own test file with the field rules.
describe('parseTemplate', () => {
  describe('format', () => {
    it.each([
      ['yaml', `Description: x`],
      ['json', `  { "Description": "x" }`],
      ['unknown', ``],
    ])('detects %s', (format, source) => {
      expect(parseTemplate(source).format).toBe(format);
    });
  });

  describe('sections', () => {
    // One parser for both formats: the same template as YAML and JSON gives the same result
    it.each([
      ['YAML', `AWSTemplateFormatVersion: '2010-09-09'\nDescription: My stack`],
      ['JSON', `{ "AWSTemplateFormatVersion": "2010-09-09", "Description": "My stack" }`],
    ])('reads every section from %s', (_label, source) => {
      const result = parseTemplate(source);

      expect(result.template).toMatchObject({ formatVersion: '2010-09-09', description: 'My stack' });
      expect(result.diagnostics).toEqual([]);
    });

    it('returns a template without optional sections when they are missing', () => {
      const result = parseTemplate(`Resources: {}`);

      expect(result.template).toMatchObject({ formatVersion: undefined, description: undefined });
      expect(result.diagnostics).toEqual([]);
    });

    it('collects diagnostics from every reader', () => {
      const result = parseTemplate(`AWSTemplateFormatVersion: '2024-01-01'\nDescription: [a]`);

      expect(result.diagnostics.map((d) => d.code)).toEqual(['unsupported-format-version', 'expected-string']);
    });
  });

  describe('invalid input', () => {
    // Broken YAML must become a diagnostic, never an exception
    it('reports a YAML syntax error with its location', () => {
      const result = parseTemplate(`Description: "unclosed`);

      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          code: 'yaml-syntax',
          range: expect.objectContaining({ start: expect.objectContaining({ line: 1 }) }),
        }),
      );
    });

    // Nothing to parse yet: not an error, the UI shows a "paste a template" hint
    it.each([
      ['empty input', ''],
      ['only whitespace', '  \n\n  '],
      ['only a comment', '# TODO: write template'],
    ])('reports an empty template for %s', (_label, source) => {
      const result = parseTemplate(source);

      expect(result.template).toBeNull();
      expect(result.diagnostics).toEqual([expect.objectContaining({ severity: 'warning', code: 'empty-template' })]);
    });

    // Valid YAML, but not a template: the root must be a mapping
    it.each([
      ['a plain string', 'hello'],
      ['a list', '- a\n- b'],
    ])('returns no template for %s', (_label, source) => {
      const result = parseTemplate(source);

      expect(result.template).toBeNull();
      expect(result.diagnostics).toEqual([expect.objectContaining({ severity: 'error', code: 'root-not-object' })]);
    });
  });
});
