import { n as Plural, t as Locale } from "./types-BcbaKTNY.js";
import { t as OpenSlideConfig } from "./config-GMR1QUlM.js";
import { CSSProperties, ComponentType, HTMLAttributes, PropsWithChildren, ReactNode } from "react";
//#region src/app/components/image-placeholder.d.ts
type ImagePlaceholderProps = {
  hint: string;
  width?: number;
  height?: number;
  style?: CSSProperties;
  className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'style' | 'className'>;
declare function ImagePlaceholder({ hint, width, height, style, className, ...rest }: ImagePlaceholderProps): import("react").JSX.Element;
//#endregion
//#region src/app/components/morph-element.d.ts
type MorphElementProps = {
  id: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};
declare function MorphElement({ id, children, className, style }: MorphElementProps): import("react").JSX.Element;
//#endregion
//#region src/app/lib/design.d.ts
type DesignPalette = {
  bg: string;
  text: string;
  accent: string;
};
type DesignFonts = {
  display: string;
  body: string;
};
type DesignTypeScale = {
  hero: number;
  body: number;
};
type DesignSystem = {
  palette: DesignPalette;
  fonts: DesignFonts;
  typeScale: DesignTypeScale;
  radius: number;
};
declare function designToCssVars(d: DesignSystem): Record<string, string>;
declare function cssVarsToString(vars: Record<string, string>): string;
declare const defaultDesign: DesignSystem;
//#endregion
//#region src/app/lib/page-context.d.ts
declare function useSlidePageNumber(): {
  current: number;
  total: number;
};
//#endregion
//#region src/app/lib/transition.d.ts
type TransitionPhase = {
  keyframes: Keyframe[] | PropertyIndexedKeyframes;
  easing?: string;
  duration?: number;
  delay?: number;
};
type SlideTransition = {
  duration: number;
  easing?: string;
  enter?: TransitionPhase;
  exit?: TransitionPhase;
  morph?: boolean | MorphTransition;
  throughBackground?: boolean;
};
type MorphTransition = {
  duration?: number;
  easing?: string;
  delay?: number;
};
//#endregion
//#region src/app/lib/sdk.d.ts
type Page = ComponentType & {
  transition?: SlideTransition;
};
type SlideMeta = {
  title?: string;
  theme?: string;
  /** ISO 8601 timestamp. Set once at scaffold time; used to sort the slide list. */
  createdAt?: string;
};
type SlideModule = {
  default: Page[];
  meta?: SlideMeta;
  design?: DesignSystem;
  transition?: SlideTransition;
};
declare const CANVAS_WIDTH = 794;
declare const CANVAS_HEIGHT = 1123;
//#endregion
//#region src/app/lib/step-context.d.ts
declare function useIsActivePage(): boolean;
type StepsProps = PropsWithChildren;
declare function Steps({ children }: StepsProps): import("react").JSX.Element;
type StepProps = PropsWithChildren<{
  duration?: number;
}>;
type InternalStepProps = StepProps & {
  _revealed?: boolean;
};
declare function Step({ children, duration, _revealed }: InternalStepProps): import("react").JSX.Element;
//#endregion
export { CANVAS_HEIGHT, CANVAS_WIDTH, type DesignFonts, type DesignPalette, type DesignSystem, type DesignTypeScale, ImagePlaceholder, type ImagePlaceholderProps, type Locale, MorphElement, type MorphElementProps, type MorphTransition, type OpenSlideConfig, type Page, type Plural, type SlideMeta, type SlideModule, type SlideTransition, Step, type StepProps, Steps, type StepsProps, type TransitionPhase, cssVarsToString, defaultDesign, designToCssVars, useIsActivePage, useSlidePageNumber };