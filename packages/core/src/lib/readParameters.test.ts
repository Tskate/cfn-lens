import { describe, expect, it } from 'vitest';

import { runReader } from '../fixtures/runReader.ts';
import { readParameters } from './readParameters.ts';

// Section shape (missing, empty, logical IDs, non-mapping entries) is covered in readSection.test.ts.
describe('readParameters', () => {
  it('reads every property', () => {
    const { value, diagnostics } = runReader(
      readParameters,
      `Parameters:
  DbPassword:
    Type: String
    Default: changeme
    AllowedValues: [changeme, secret]
    AllowedPattern: '[a-z]+'
    ConstraintDescription: lowercase letters only
    Description: Database password
    MinLength: 8
    MaxLength: 64
    NoEcho: true
  Port:
    Type: Number
    MinValue: 1024
    MaxValue: 65535`,
    );

    expect(value.get('DbPassword')).toMatchObject({
      name: 'DbPassword',
      type: 'String',
      default: 'changeme',
      allowedValues: ['changeme', 'secret'],
      allowedPattern: '[a-z]+',
      constraintDescription: 'lowercase letters only',
      description: 'Database password',
      minLength: 8,
      maxLength: 64,
      noEcho: true,
    });
    expect(value.get('Port')).toMatchObject({ type: 'Number', minValue: 1024, maxValue: 65535 });
    expect(diagnostics).toEqual([]);
  });

  it('fills defaults for absent optional properties', () => {
    const { value } = runReader(readParameters, `Parameters:\n  Env:\n    Type: String`);

    expect(value.get('Env')).toEqual({
      name: 'Env',
      type: 'String',
      allowedValues: [],
      noEcho: false,
      nameRange: expect.objectContaining({ start: expect.objectContaining({ line: 2, column: 3 }) }),
      range: expect.objectContaining({ end: expect.objectContaining({ line: 3, column: 17 }) }),
      propertyRanges: { Type: expect.objectContaining({ start: expect.objectContaining({ line: 3, column: 11 }) }) },
    });
  });

  // Unquoted numbers are idiomatic in parameters; CloudFormation treats all values as strings
  it('reads numeric Default and AllowedValues as strings without warnings', () => {
    const { value, diagnostics } = runReader(
      readParameters,
      `Parameters:\n  Port:\n    Type: Number\n    Default: 8080\n    AllowedValues: [80, 8080]`,
    );

    expect(value.get('Port')).toMatchObject({ default: '8080', allowedValues: ['80', '8080'] });
    expect(diagnostics).toEqual([]);
  });

  it('accepts JSON-style string numbers and booleans', () => {
    const { value, diagnostics } = runReader(
      readParameters,
      `{ "Parameters": { "Name": { "Type": "String", "MaxLength": "64", "NoEcho": "true" } } }`,
    );

    expect(value.get('Name')).toMatchObject({ maxLength: 64, noEcho: true });
    expect(diagnostics).toEqual([]);
  });

  it.each([
    ['missing', `Parameters:\n  Env:\n    Default: dev`],
    ['empty', `Parameters:\n  Env:\n    Type:`],
  ])('skips a parameter whose Type is %s and reports it at the name', (_label, source) => {
    const { value, diagnostics } = runReader(readParameters, source);

    expect(value.has('Env')).toBe(false);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: 'error',
        code: 'missing-required-property',
        range: expect.objectContaining({ start: expect.objectContaining({ line: 2, column: 3 }) }),
      }),
    ]);
  });

  // One diagnostic per problem: the shape warning, not also "missing Type"
  it('skips a parameter whose Type is not a string with a single diagnostic', () => {
    const { value, diagnostics } = runReader(readParameters, `Parameters:\n  Env:\n    Type: [String]`);

    expect(value.has('Env')).toBe(false);
    expect(diagnostics.map((d) => d.code)).toEqual(['expected-string']);
  });

  it('reports an unknown property at its key and keeps the parameter', () => {
    const { value, diagnostics } = runReader(readParameters, `Parameters:\n  Env:\n    Type: String\n    Defualt: dev`);

    expect(value.has('Env')).toBe(true);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: 'error',
        code: 'unknown-property',
        range: expect.objectContaining({ start: expect.objectContaining({ line: 4, column: 5 }) }),
      }),
    ]);
  });

  it('reports wrongly shaped properties and keeps the parameter', () => {
    const { value, diagnostics } = runReader(
      readParameters,
      `Parameters:\n  Env:\n    Type: String\n    AllowedValues: dev\n    MinLength: short\n    NoEcho: maybe`,
    );

    expect(value.get('Env')).toMatchObject({ allowedValues: [], minLength: undefined, noEcho: false });
    expect(diagnostics.map((d) => d.code)).toEqual(['expected-list', 'expected-number', 'expected-boolean']);
  });
});
