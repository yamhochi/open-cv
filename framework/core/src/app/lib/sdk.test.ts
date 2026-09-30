import { describe, expect, it } from 'vitest';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './sdk.ts';

describe('canvas constants', () => {
  it('targets a 794x1123 (A4) canvas', () => {
    expect(CANVAS_WIDTH).toBe(794);
    expect(CANVAS_HEIGHT).toBe(1123);
  });

  it('preserves an A4 portrait aspect ratio', () => {
    expect(CANVAS_WIDTH / CANVAS_HEIGHT).toBeCloseTo(1 / Math.SQRT2, 2);
  });
});
