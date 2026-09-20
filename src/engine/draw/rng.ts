/**
 * A source of random numbers in [0, 1). Injected into the draw so that production uses
 * cryptographic randomness and tests use a fixed sequence — the draw itself stays pure.
 */
export type Rng = () => number;

const UINT32_RANGE = 2 ** 32;

/** Cryptographically secure; available in Node 20+ and every modern browser without imports. */
export const secureRng: Rng = () => {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] / UINT32_RANGE;
};

/** Replays `values` in order; throws if a caller draws more randomness than the test provided. */
export function sequenceRng(values: readonly number[]): Rng {
  let index = 0;
  return () => {
    if (index >= values.length) {
      throw new Error(`sequenceRng exhausted after ${values.length} value(s)`);
    }
    return values[index++];
  };
}
