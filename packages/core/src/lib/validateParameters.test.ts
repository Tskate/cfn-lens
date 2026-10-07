import { describe, expect, it } from 'vitest';

import type { SourceRange } from '../types';
import type { Parameter, ParameterProperty } from '../types/template';
import { validateParameter, validateParameters } from './validateParameters.ts';

// Every property gets its own line, so tests can check which property a diagnostic points at.
const LINES: Record<ParameterProperty, number> = {
  Type: 2,
  Default: 3,
  AllowedValues: 4,
  AllowedPattern: 5,
  ConstraintDescription: 6,
  Description: 7,
  MinLength: 8,
  MaxLength: 9,
  MinValue: 10,
  MaxValue: 11,
  NoEcho: 12,
};
const rangeAt = (line: number): SourceRange => ({ start: { offset: 0, line, column: 1 }, end: { offset: 0, line, column: 2 } });
const at = (property: ParameterProperty) => ({ range: rangeAt(LINES[property]) });

// Validation is a pure function over the parsed model: no YAML needed to build its input.
const parameter = (overrides: Partial<Parameter> = {}): Parameter => ({
  name: 'Param',
  type: 'String',
  allowedValues: [],
  noEcho: false,
  nameRange: rangeAt(1),
  range: rangeAt(1),
  propertyRanges: Object.fromEntries(Object.entries(LINES).map(([property, line]) => [property, rangeAt(line)])),
  ...overrides,
});
const codes = (p: Parameter) => validateParameter(p).map((d) => d.code);

describe('validateParameter', () => {
  describe('Type', () => {
    it.each([
      'String',
      'Number',
      'List<Number>',
      'CommaDelimitedList',
      'AWS::EC2::VPC::Id',
      'List<AWS::EC2::Subnet::Id>',
      'AWS::Route53::HostedZone::Id',
      'AWS::SSM::Parameter::Name',
      'AWS::SSM::Parameter::Value<String>',
      'AWS::SSM::Parameter::Value<List<String>>',
      'AWS::SSM::Parameter::Value<CommaDelimitedList>',
      'AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>',
      'AWS::SSM::Parameter::Value<List<AWS::EC2::KeyPair::KeyName>>',
    ])('accepts %s', (type) => {
      expect(validateParameter(parameter({ type }))).toEqual([]);
    });

    it.each([
      'string',
      'Integer',
      'List<String>',
      'AWS::EC2::Bucket::Id',
      'List<AWS::SSM::Parameter::Value<String>>',
      'AWS::SSM::Parameter::Value<Number>',
    ])('reports %s as unsupported at Type', (type) => {
      expect(validateParameter(parameter({ type, default: 'x', minValue: 1 }))).toEqual([
        expect.objectContaining({ severity: 'error', code: 'unsupported-parameter-type', ...at('Type') }),
      ]);
    });
  });

  describe('constraints', () => {
    it.each([
      ['MinLength on a Number', { type: 'Number', minLength: 1 }, 'MinLength'],
      ['MaxLength on a CommaDelimitedList', { type: 'CommaDelimitedList', maxLength: 5 }, 'MaxLength'],
      ['MinValue on a String', { type: 'String', minValue: 1 }, 'MinValue'],
      ['AllowedPattern on a Number', { type: 'Number', allowedPattern: '[0-9]+' }, 'AllowedPattern'],
    ] as const)('warns about %s', (_label, overrides, property) => {
      expect(validateParameter(parameter(overrides))).toEqual([
        expect.objectContaining({ severity: 'warning', code: 'constraint-not-applicable', ...at(property) }),
      ]);
    });

    it.each([
      ['MinLength > MaxLength', { minLength: 10, maxLength: 5 }, 'MinLength'],
      ['MinValue > MaxValue', { type: 'Number', minValue: 10, maxValue: 5 }, 'MinValue'],
    ] as const)('reports %s', (_label, overrides, property) => {
      expect(validateParameter(parameter(overrides))).toEqual([
        expect.objectContaining({ severity: 'error', code: 'invalid-constraint-range', ...at(property) }),
      ]);
    });

    // CloudFormation uses Java regexes; a pattern JavaScript can't compile may still be valid there
    it('warns when AllowedPattern cannot be checked, and skips the match', () => {
      expect(validateParameter(parameter({ allowedPattern: '(', default: 'anything' }))).toEqual([
        expect.objectContaining({ severity: 'warning', code: 'invalid-allowed-pattern', ...at('AllowedPattern') }),
      ]);
    });

    it('reports a Description over 4000 characters', () => {
      expect(validateParameter(parameter({ description: 'a'.repeat(4000) }))).toEqual([]);
      expect(validateParameter(parameter({ description: 'a'.repeat(4001) }))).toEqual([
        expect.objectContaining({ severity: 'error', code: 'description-too-long', ...at('Description') }),
      ]);
    });
  });

  describe('Default', () => {
    it.each([
      ['in AllowedValues', { default: 'dev', allowedValues: ['dev', 'prod'] }],
      ['matching the whole AllowedPattern', { default: 'abc', allowedPattern: '[a-z]+' }],
      ['within MinLength/MaxLength', { default: 'abcd', minLength: 4, maxLength: 4 }],
      ['a number within MinValue/MaxValue', { type: 'Number', default: '8080', minValue: 1024, maxValue: 65535 }],
      ['a number equal to an AllowedValue written differently', { type: 'Number', default: '8080', allowedValues: ['8080.0'] }],
      ['list items in AllowedValues, spaces trimmed', { type: 'CommaDelimitedList', default: 'a, b', allowedValues: ['a', 'b'] }],
      ['list items each matching AllowedPattern', { type: 'CommaDelimitedList', default: 'ab, cd', allowedPattern: '[a-z]{2}' }],
      ['List<Number> items within MaxValue', { type: 'List<Number>', default: '1, 99', maxValue: 100 }],
      [
        'an SSM key, not its value, in AllowedValues',
        { type: 'AWS::SSM::Parameter::Value<String>', default: '/my/key', allowedValues: ['/my/key'] },
      ],
    ] as const)('accepts a default %s', (_label, overrides) => {
      expect(validateParameter(parameter(overrides))).toEqual([]);
    });

    it.each([
      ['not in AllowedValues', { default: 'test', allowedValues: ['dev', 'prod'] }],
      ['matching only part of AllowedPattern', { default: 'abc1', allowedPattern: '[a-z]+' }],
      ['shorter than MinLength', { default: 'abc', minLength: 4 }],
      ['longer than MaxLength', { default: 'abcde', maxLength: 4 }],
      ['that is not a number for a Number', { type: 'Number', default: 'abc' }],
      ['below MinValue', { type: 'Number', default: '80', minValue: 1024 }],
      ['with a list item not in AllowedValues', { type: 'CommaDelimitedList', default: 'a, c', allowedValues: ['a', 'b'] }],
      ['with a List<Number> item above MaxValue', { type: 'List<Number>', default: '1, 200', maxValue: 100 }],
    ] as const)('reports a default %s at Default', (_label, overrides) => {
      expect(validateParameter(parameter(overrides))).toEqual([
        expect.objectContaining({ severity: 'error', code: 'default-violates-constraint', ...at('Default') }),
      ]);
    });

    it('reports each violated constraint once', () => {
      expect(codes(parameter({ default: 'x', allowedValues: ['dev'], minLength: 3 }))).toEqual([
        'default-violates-constraint',
        'default-violates-constraint',
      ]);
    });
  });
});

describe('validateParameters', () => {
  it('validates every parameter', () => {
    const parameters = new Map([
      ['A', parameter({ name: 'A', type: 'Bad' })],
      ['B', parameter({ name: 'B', default: 'x', allowedValues: ['y'] })],
    ]);

    expect(validateParameters(parameters).map((d) => d.code)).toEqual(['unsupported-parameter-type', 'default-violates-constraint']);
  });

  it('reports more than 200 parameters', () => {
    const make = (count: number) => new Map(Array.from({ length: count }, (_, i) => [`P${i}`, parameter({ name: `P${i}` })]));

    expect(validateParameters(make(200))).toEqual([]);
    expect(validateParameters(make(201))).toEqual([expect.objectContaining({ severity: 'error', code: 'too-many-parameters' })]);
  });
});
