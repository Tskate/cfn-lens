import { describe, expect, it } from 'vitest';

import { runReader } from '../fixtures/runReader.ts';
import { readMappings } from './readMappings.ts';

// Section shape (missing, empty, logical IDs, non-mapping entries) is covered in readSection.test.ts.
describe('readMappings', () => {
  it('reads string and list values under each top-level key', () => {
    const { value, diagnostics } = runReader(
      readMappings,
      `Mappings:
  RegionMap:
    us-east-1:
      Ami: ami-111
      Azs: [us-east-1a, us-east-1b]
    eu-west-1:
      Ami: ami-222
      Azs: []`,
    );

    expect(value.get('RegionMap')).toMatchObject({
      name: 'RegionMap',
      entries: new Map([
        [
          'us-east-1',
          new Map<string, string | string[]>([
            ['Ami', 'ami-111'],
            ['Azs', ['us-east-1a', 'us-east-1b']],
          ]),
        ],
        [
          'eu-west-1',
          new Map<string, string | string[]>([
            ['Ami', 'ami-222'],
            ['Azs', []],
          ]),
        ],
      ]),
      nameRange: expect.objectContaining({ start: expect.objectContaining({ line: 2, column: 3 }) }),
    });
    expect(diagnostics).toEqual([]);
  });

  // Account IDs and sizes are commonly unquoted; keys and values are strings in CloudFormation
  it('reads unquoted numbers and booleans as strings without warnings', () => {
    const { value, diagnostics } = runReader(
      readMappings,
      `Mappings:\n  Accounts:\n    123456789012:\n      Size: 3\n      Ports: [80, 443]\n      Public: true`,
    );

    expect(value.get('Accounts')?.entries.get('123456789012')).toEqual(
      new Map<string, string | string[]>([
        ['Size', '3'],
        ['Ports', ['80', '443']],
        ['Public', 'true'],
      ]),
    );
    expect(diagnostics).toEqual([]);
  });

  it('reports a top-level key that is not a mapping and keeps the others', () => {
    const { value, diagnostics } = runReader(
      readMappings,
      `Mappings:\n  RegionMap:\n    us-east-1: ami-111\n    eu-west-1:\n      Ami: ami-222`,
    );

    expect([...(value.get('RegionMap')?.entries.keys() ?? [])]).toEqual(['eu-west-1']);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: 'error',
        code: 'expected-mapping',
        range: expect.objectContaining({ start: expect.objectContaining({ line: 3 }) }),
      }),
    ]);
  });

  it.each([
    ['a mapping', `Ami: { a: b }`],
    ['empty', `Ami:`],
    ['a list containing a mapping', `Ami: [a, { b: c }]`],
  ])('reports a value that is %s', (_label, attribute) => {
    const { diagnostics } = runReader(readMappings, `Mappings:\n  RegionMap:\n    us-east-1:\n      ${attribute}`);

    expect(diagnostics).toEqual([expect.objectContaining({ severity: 'error', code: 'expected-string' })]);
  });

  // Without this check, `!Ref X` would silently be read as the string 'X'
  it.each([
    ['short form', `Ami: !Ref ImageParam`],
    ['long form', `Ami: { Ref: ImageParam }`],
    ['Fn:: long form', `Ami: { "Fn::Sub": "ami-\${Suffix}" }`],
    ['a list item', `Ami: [ami-111, !GetAtt Image.Id]`],
  ])('reports an intrinsic function (%s) and skips the value', (_label, attribute) => {
    const { value, diagnostics } = runReader(readMappings, `Mappings:\n  RegionMap:\n    us-east-1:\n      ${attribute}\n      Other: x`);

    expect(value.get('RegionMap')?.entries.get('us-east-1')).toEqual(new Map([['Other', 'x']]));
    expect(diagnostics).toEqual([expect.objectContaining({ severity: 'error', code: 'intrinsic-not-allowed' })]);
  });

  it('underlines a short-form intrinsic from its tag', () => {
    const { diagnostics } = runReader(readMappings, `Mappings:\n  RegionMap:\n    us-east-1:\n      Ami: !Ref ImageParam`);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: 'intrinsic-not-allowed',
        range: expect.objectContaining({ start: expect.objectContaining({ line: 4, column: 12 }) }),
      }),
    ]);
  });

  it('reports an attribute name longer than 255 characters', () => {
    const { diagnostics } = runReader(readMappings, `Mappings:\n  RegionMap:\n    us-east-1:\n      ${'a'.repeat(256)}: x`);

    expect(diagnostics).toEqual([expect.objectContaining({ severity: 'error', code: 'name-too-long' })]);
  });
});
