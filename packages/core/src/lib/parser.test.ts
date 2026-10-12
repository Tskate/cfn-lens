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
      [
        'YAML',
        `AWSTemplateFormatVersion: '2010-09-09'\nDescription: My stack\nTransform: AWS::Serverless-2016-10-31\nParameters:\n  Env:\n    Type: String\nMappings:\n  RegionMap:\n    us-east-1:\n      Ami: ami-111\nConditions:\n  IsDev: !Equals [!Ref Env, dev]`,
      ],
      [
        'JSON',
        `{ "AWSTemplateFormatVersion": "2010-09-09", "Description": "My stack", "Transform": "AWS::Serverless-2016-10-31", "Parameters": { "Env": { "Type": "String" } }, "Mappings": { "RegionMap": { "us-east-1": { "Ami": "ami-111" } } }, "Conditions": { "IsDev": { "Fn::Equals": [{ "Ref": "Env" }, "dev"] } } }`,
      ],
    ])('reads every section from %s', (_label, source) => {
      const result = parseTemplate(source);

      expect(result.template).toMatchObject({
        formatVersion: '2010-09-09',
        description: 'My stack',
        transforms: ['AWS::Serverless-2016-10-31'],
      });
      expect(result.template?.parameters.get('Env')?.type).toBe('String');
      expect(result.template?.mappings.get('RegionMap')?.entries.get('us-east-1')?.get('Ami')).toBe('ami-111');
      expect(result.template?.conditions.get('IsDev')?.expression).toMatchObject({ kind: 'equals', left: { kind: 'ref', target: 'Env' } });
      expect(result.diagnostics).toEqual([]);
    });

    it('returns a template without optional sections when they are missing', () => {
      const result = parseTemplate(`Resources: {}`);

      expect(result.template).toMatchObject({ formatVersion: undefined, description: undefined, transforms: [] });
      expect(result.template?.parameters.size).toBe(0);
      expect(result.template?.mappings.size).toBe(0);
      expect(result.template?.conditions.size).toBe(0);
      expect(result.diagnostics).toEqual([]);
    });

    it('validates parameters after reading them', () => {
      const result = parseTemplate(`Parameters:\n  Env:\n    Type: String\n    Default: test\n    AllowedValues: [dev, prod]`);

      expect(result.template?.parameters.has('Env')).toBe(true);
      expect(result.diagnostics.map((d) => d.code)).toEqual(['default-violates-constraint']);
    });

    it('validates conditions against parameters after reading them', () => {
      const result = parseTemplate(`Parameters:\n  Env: { Type: String }\nConditions:\n  IsDev: !Equals [!Ref Stage, dev]`);

      expect(result.diagnostics.map((d) => d.code)).toEqual(['invalid-ref']);
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

    it('reports duplicate logical IDs as a YAML error', () => {
      const result = parseTemplate(`Parameters:\n  Env: { Type: String }\n  Env: { Type: Number }`);

      expect(result.diagnostics).toContainEqual(expect.objectContaining({ severity: 'error', code: 'yaml-syntax' }));
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
