import { describe, expect, it } from 'vitest';

import { parseTemplate } from './parser.ts';

describe('parseTemplate', () => {
  describe('AWSTemplateFormatVersion', () => {
    // 1. Happy path, YAML
    it('reads the format version from YAML', () => {
      const result = parseTemplate(`AWSTemplateFormatVersion: '2010-09-09'`);

      expect(result.template?.formatVersion).toBe('2010-09-09');
      expect(result.diagnostics).toEqual([]);
      expect(result.format).toBe('yaml');
    });

    // 2. Same input as JSON: proves one parser handles both
    it('reads the format version from JSON', () => {
      const result = parseTemplate(`{ "AWSTemplateFormatVersion": "2010-09-09" }`);

      expect(result.template?.formatVersion).toBe('2010-09-09');
      expect(result.diagnostics).toEqual([]);
      expect(result.format).toBe('json');
    });

    // 3. Unquoted date: YAML 1.1 would produce a Date, we require a string
    it('keeps an unquoted 2010-09-09 as a string', () => {
      const result = parseTemplate(`AWSTemplateFormatVersion: 2010-09-09`);

      expect(result.template?.formatVersion).toBe('2010-09-09');
      expect(result.diagnostics).toEqual([]);
    });

    // 4. Key is optional in CloudFormation: absence is not a problem
    it('leaves formatVersion undefined when the key is missing', () => {
      const result = parseTemplate(`Description: no version here`);

      expect(result.template).not.toBeNull();
      expect(result.template?.formatVersion).toBeUndefined();
      expect(result.diagnostics).toEqual([]);
    });

    // 5. Unknown version: keep the value, warn, and point at it
    it('warns about an unsupported version and points at the value', () => {
      const result = parseTemplate(`AWSTemplateFormatVersion: '2024-01-01'`);

      expect(result.template?.formatVersion).toBe('2024-01-01');
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: 'warning',
        code: 'unsupported-format-version',
        range: { start: { line: 1, column: 27 } },
      });
    });

    // 6. Unquoted number: convert to string from the source text, warn once
    it.each(['2010', '2010.10'])('converts the number %s to a string and warns', (version) => {
      const result = parseTemplate(`AWSTemplateFormatVersion: ${version}`);

      expect(result.template?.formatVersion).toBe(version);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: 'warning',
        code: 'string-not-quoted',
        range: { start: { line: 1, column: 27 } },
      });
    });

    // Optional fields: an empty value is the same as a missing key
    it('treats an empty value as missing', () => {
      const result = parseTemplate(`AWSTemplateFormatVersion:`);

      expect(result.template?.formatVersion).toBeUndefined();
      expect(result.diagnostics).toEqual([]);
    });

    it('warns when the value is not a scalar', () => {
      const result = parseTemplate(`AWSTemplateFormatVersion: [2010-09-09]`);

      expect(result.template?.formatVersion).toBeUndefined();
      expect(result.diagnostics).toEqual([expect.objectContaining({ severity: 'warning', code: 'expected-string' })]);
    });
  });

  describe('Description', () => {
    it('reads a plain string', () => {
      const result = parseTemplate(`Description: My stack`);

      expect(result.template?.description).toBe('My stack');
      expect(result.diagnostics).toEqual([]);
    });

    // Block scalars: we return the parsed value, not the raw source
    it.each([
      ['literal |', 'Description: |\n  Line one\n  Line two\n', 'Line one\nLine two\n'],
      ['folded >', 'Description: >\n  One long\n  sentence\n', 'One long sentence\n'],
    ])('reads a %s block', (_label, source, expected) => {
      const result = parseTemplate(source);

      expect(result.template?.description).toBe(expected);
      expect(result.diagnostics).toEqual([]);
    });

    it.each([
      ['missing', `AWSTemplateFormatVersion: '2010-09-09'`],
      ['empty', `Description:`],
    ])('is undefined without a diagnostic when %s', (_label, source) => {
      const result = parseTemplate(source);

      expect(result.template?.description).toBeUndefined();
      expect(result.diagnostics).toEqual([]);
    });

    it('converts a number to a string and warns', () => {
      const result = parseTemplate(`Description: 42`);

      expect(result.template?.description).toBe('42');
      expect(result.diagnostics).toEqual([expect.objectContaining({ severity: 'warning', code: 'string-not-quoted' })]);
    });

    it('warns when the value is not a scalar', () => {
      const result = parseTemplate(`Description: [a, b]`);

      expect(result.template?.description).toBeUndefined();
      expect(result.diagnostics).toEqual([expect.objectContaining({ severity: 'warning', code: 'expected-string' })]);
    });

    it('accepts exactly 1024 bytes', () => {
      const result = parseTemplate(`Description: ${'a'.repeat(1024)}`);

      expect(result.diagnostics).toEqual([]);
    });

    // The limit is in UTF-8 bytes: 513 × 'é' is 513 characters but 1026 bytes
    it.each([
      ['1025 ASCII characters', 'a'.repeat(1025)],
      ['513 two-byte characters', 'é'.repeat(513)],
    ])('keeps but warns about a description over 1024 bytes (%s)', (_label, description) => {
      const result = parseTemplate(`Description: ${description}`);

      expect(result.template?.description).toBe(description);
      expect(result.diagnostics).toEqual([
        expect.objectContaining({
          severity: 'warning',
          code: 'description-too-long',
          range: expect.objectContaining({ start: expect.objectContaining({ line: 1, column: 14 }) }),
        }),
      ]);
    });
  });

  describe('invalid input', () => {
    // 7. Broken YAML must become a diagnostic, never an exception
    it('reports a YAML syntax error instead of throwing', () => {
      const result = parseTemplate(`AWSTemplateFormatVersion: "2010-09-09`);

      expect(result.diagnostics).toContainEqual(expect.objectContaining({ severity: 'error', code: 'yaml-syntax' }));
    });

    // 8. Nothing to parse yet: not an error, the UI shows a "paste a template" hint
    it.each([
      ['empty input', ''],
      ['only whitespace', '  \n\n  '],
      ['only a comment', '# TODO: write template'],
    ])('reports an empty template for %s', (_label, source) => {
      const result = parseTemplate(source);

      expect(result.template).toBeNull();
      expect(result.diagnostics).toEqual([expect.objectContaining({ severity: 'warning', code: 'empty-template' })]);
    });

    // 9. Valid YAML, but not a template: the root must be a mapping
    it.each([
      ['a plain string', 'hello'],
      ['a list', '- a\n- b'],
    ])('returns no template for %s', (_label, source) => {
      const result = parseTemplate(source);

      expect(result.template).toBeNull();
      expect(result.diagnostics).toContainEqual(expect.objectContaining({ severity: 'error', code: 'root-not-object' }));
    });
  });
});
