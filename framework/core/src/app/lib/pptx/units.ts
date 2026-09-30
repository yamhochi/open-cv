import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../sdk';

export const EMU_PER_PX = 9525;
export const SLIDE_EMU_W = CANVAS_WIDTH * EMU_PER_PX;
export const SLIDE_EMU_H = CANVAS_HEIGHT * EMU_PER_PX;

export function px(value: number): number {
  return Math.round(value * EMU_PER_PX);
}

// One canvas px is 1/96in (0.75pt), so a px is 75 hundredths of a point at any canvas size.
export function pxToHundredthsPt(value: number): number {
  return Math.round(value * 75);
}

export function degrees(value: number): number {
  return Math.round((((value % 360) + 360) % 360) * 60000);
}

export function percent(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 100000);
}
