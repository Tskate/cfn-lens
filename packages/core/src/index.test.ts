import { describe, expect, it } from 'vitest';

import * as core from './index.ts';

// Smoke test for the toolchain; replace once the parser lands.
describe('@cfn-lens/core', () => {
  it('loads the public entry point', () => {
    expect(core).toBeDefined();
  });
});
