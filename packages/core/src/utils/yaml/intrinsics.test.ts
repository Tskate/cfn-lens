import { describe, expect, it } from 'vitest';
import type { ParsedNode } from 'yaml';

import { parseYaml } from './parseYaml.ts';
import { isIntrinsic, readIntrinsicCall } from './intrinsics.ts';

const valueOf = (source: string) => {
  const { doc } = parseYaml(`Key: ${source}`);
  return (doc.contents as { get: (key: string, keepNode: true) => ParsedNode }).get('Key', true);
};

describe('isIntrinsic', () => {
  it.each([
    ['short-form scalar', '!Ref Bucket'],
    ['short-form list', '!Sub [a, b]'],
    ['short-form mapping', '!FindInMap { a: b }'],
    ['long-form Ref', '{ Ref: Bucket }'],
    ['long-form Fn::', '{ "Fn::GetAtt": [Bucket, Arn] }'],
  ])('detects a %s', (_label, source) => {
    expect(isIntrinsic(valueOf(source))).toBe(true);
  });

  it.each([
    ['a plain string', 'Bucket'],
    ['a quoted tag-like string', "'!Ref Bucket'"],
    ['a list', '[a, b]'],
    ['a mapping with Ref and another key', '{ Ref: Bucket, Other: x }'],
    ['a mapping with a Fn-like but different key', '{ FnGetAtt: x }'],
  ])('ignores %s', (_label, source) => {
    expect(isIntrinsic(valueOf(source))).toBe(false);
  });
});

describe('readIntrinsicCall', () => {
  it.each([
    ['!Equals [a, b]', 'Fn::Equals', ['a', 'b']],
    ['{ "Fn::Equals": [a, b] }', 'Fn::Equals', ['a', 'b']],
    ['!Ref Env', 'Ref', 'Env'],
    ['{ Ref: Env }', 'Ref', 'Env'],
    ['!GetAtt Bucket.Arn', 'Fn::GetAtt', 'Bucket.Arn'],
    ['!Not [x]', 'Fn::Not', ['x']],
  ])('reads %s as %s', (source, fn, arg) => {
    const call = readIntrinsicCall(valueOf(source));

    expect(call?.fn).toBe(fn);
    expect(call?.arg?.toJSON()).toEqual(arg);
  });

  // `Condition` is only a function inside condition expressions; elsewhere it can be a plain key
  it('reads Condition only when asked to', () => {
    expect(readIntrinsicCall(valueOf('{ Condition: IsProd }'))).toBeUndefined();
    expect(readIntrinsicCall(valueOf('{ Condition: IsProd }'), { condition: true })?.fn).toBe('Condition');
    expect(readIntrinsicCall(valueOf('!Condition IsProd'))?.fn).toBe('Condition');
  });

  it('returns a null arg for a long form without a value', () => {
    expect(readIntrinsicCall(valueOf('{ Ref: }'))).toMatchObject({ fn: 'Ref', arg: null });
  });

  it('returns undefined for a plain value', () => {
    expect(readIntrinsicCall(valueOf('[a, b]'))).toBeUndefined();
  });
});
