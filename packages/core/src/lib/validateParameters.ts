import type { Diagnostic, DiagnosticCode, DiagnosticSeverity, Parameter, ParameterProperty } from '../types';
import { checkEntryLimit } from './checkEntryLimit';
import { parseParameterType } from './parameterTypes';

// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html
const MAX_PARAMETERS = 200;
const MAX_DESCRIPTION_CHARACTERS = 4000;

export function validateParameters(parameters: ReadonlyMap<string, Parameter>): Diagnostic[] {
  return [...[...parameters.values()].flatMap(validateParameter), ...checkEntryLimit('Parameters', parameters, MAX_PARAMETERS)];
}

// Pure: checks relationships between already-parsed fields and returns the problems found.
export function validateParameter(parameter: Parameter): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const report = (severity: DiagnosticSeverity, code: DiagnosticCode, message: string, property: ParameterProperty) => {
    diagnostics.push({ severity, code, message, range: parameter.propertyRanges[property] ?? parameter.nameRange });
  };
  const { name } = parameter;

  const typeInfo = parseParameterType(parameter.type);
  if (!typeInfo) {
    // Every other check depends on the type, so stop here.
    report('error', 'unsupported-parameter-type', `Parameter ${name} has unsupported Type '${parameter.type}'.`, 'Type');
    return diagnostics;
  }

  const isString = typeInfo.base === 'String';
  const isNumber = typeInfo.base === 'Number';
  const hasLength = isString && !typeInfo.list;

  const constraints = [
    ['AllowedPattern', parameter.allowedPattern, isString],
    ['MinLength', parameter.minLength, hasLength],
    ['MaxLength', parameter.maxLength, hasLength],
    ['MinValue', parameter.minValue, isNumber],
    ['MaxValue', parameter.maxValue, isNumber],
  ] as const;
  for (const [property, value, applies] of constraints) {
    if (value !== undefined && !applies) {
      report('warning', 'constraint-not-applicable', `${property} has no effect on ${parameter.type} parameter ${name}.`, property);
    }
  }

  const { minLength, maxLength, minValue, maxValue } = parameter;
  if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
    report(
      'error',
      'invalid-constraint-range',
      `MinLength (${minLength}) is greater than MaxLength (${maxLength}) in ${name}.`,
      'MinLength',
    );
  }
  if (minValue !== undefined && maxValue !== undefined && minValue > maxValue) {
    report('error', 'invalid-constraint-range', `MinValue (${minValue}) is greater than MaxValue (${maxValue}) in ${name}.`, 'MinValue');
  }

  let pattern: RegExp | undefined;
  if (parameter.allowedPattern !== undefined && isString) {
    try {
      // The pattern must match the entire value.
      pattern = new RegExp(`^(?:${parameter.allowedPattern})$`);
    } catch {
      report(
        'warning',
        'invalid-allowed-pattern',
        `AllowedPattern of ${name} can't be checked here (CloudFormation uses Java regular expressions).`,
        'AllowedPattern',
      );
    }
  }

  if (parameter.description !== undefined && parameter.description.length > MAX_DESCRIPTION_CHARACTERS) {
    report(
      'error',
      'description-too-long',
      `Description of ${name} is ${parameter.description.length} characters; CloudFormation allows at most ${MAX_DESCRIPTION_CHARACTERS}.`,
      'Description',
    );
  }

  if (parameter.default === undefined) {
    return diagnostics;
  }

  const fail = (message: string) => report('error', 'default-violates-constraint', `Default of ${name} ${message}.`, 'Default');
  // SSM constraints apply to the parameter key itself, so its default is never split.
  const values = typeInfo.list && typeInfo.base !== 'SSM' ? parameter.default.split(',').map((value) => value.trim()) : [parameter.default];

  if (isNumber) {
    const notNumber = values.find((value) => value === '' || !Number.isFinite(Number(value)));
    if (notNumber !== undefined) {
      fail(`'${notNumber}' is not a number`);
      return diagnostics;
    }
  }

  if (parameter.allowedValues.length > 0) {
    const isAllowed = (value: string) =>
      parameter.allowedValues.some((allowed) => (isNumber ? Number(allowed) === Number(value) : allowed === value));
    const notAllowed = values.find((value) => !isAllowed(value));
    if (notAllowed !== undefined) {
      fail(`'${notAllowed}' is not in AllowedValues`);
    }
  }

  const notMatching = pattern && values.find((value) => !pattern.test(value));
  if (notMatching !== undefined) {
    fail(`'${notMatching}' does not match AllowedPattern`);
  }

  if (hasLength) {
    const { length } = parameter.default;
    if ((minLength !== undefined && length < minLength) || (maxLength !== undefined && length > maxLength)) {
      fail(`has ${length} characters, outside MinLength/MaxLength`);
    }
  }

  if (isNumber) {
    const outOfRange = values.find(
      (value) => (minValue !== undefined && Number(value) < minValue) || (maxValue !== undefined && Number(value) > maxValue),
    );
    if (outOfRange !== undefined) {
      fail(`'${outOfRange}' is outside MinValue/MaxValue`);
    }
  }

  return diagnostics;
}
