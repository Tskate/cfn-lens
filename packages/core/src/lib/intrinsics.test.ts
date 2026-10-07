import { describe, expect, it } from 'vitest';
import type { ParsedNode } from 'yaml';

import { parseYaml } from './parseYaml.ts';
import { isIntrinsic } from './intrinsics.ts';

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
