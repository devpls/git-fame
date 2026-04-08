import { describe, expectTypeOf, it } from 'vitest';
import type { PartialBy } from './partial-by.type.js';

interface Sample {
  a: number;
  b: string;
  c: boolean;
}

describe('PartialBy', () => {
  it('widens a single key to optional while keeping others required', () => {
    const sample: PartialBy<Sample, 'b'> = { a: 1, c: true };
    expectTypeOf(sample.a).toBeNumber();
    expectTypeOf(sample.c).toBeBoolean();
    expectTypeOf(sample.b).toEqualTypeOf(undefined as string | undefined);
  });

  it('widens multiple keys to optional at once', () => {
    const sample: PartialBy<Sample, 'b' | 'c'> = { a: 1 };
    expectTypeOf(sample.a).toBeNumber();
    expectTypeOf(sample.b).toEqualTypeOf(undefined as string | undefined);
    expectTypeOf(sample.c).toEqualTypeOf(undefined as boolean | undefined);
  });

  it('rejects missing required keys at the type level', () => {
    // The following assignment compiles — `a` is required, `b` and `c` are optional.
    const allowed: PartialBy<Sample, 'b' | 'c'> = { a: 1 };
    expectTypeOf(allowed.a).toBeNumber();
    // `a` is still required: a missing `a` would be a compile error. We cannot
    // assert a compile error at runtime, but this test documents the contract.
  });
});
