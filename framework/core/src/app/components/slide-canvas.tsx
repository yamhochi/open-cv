import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { isTypingTarget } from '@/lib/keys';
import { cn } from '@/lib/utils';
import { type DesignSystem, designToCssVars } from '../lib/design';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../lib/sdk';

type Props = {
  children: ReactNode;
  /** If set, use this scale directly. Otherwise fit to container. */
  scale?: number;
  center?: boolean;
  flat?: boolean;
  freezeMotion?: boolean;
  design?: DesignSystem;
  /**
   * 'contain' (default) shrinks the canvas to fit both width and height.
   * 'actual' renders it at 100% (1 canvas px = 1 screen px), centered
   * horizontally, and lets the container scroll when the page is larger than it.
   */
  fit?: 'contain' | 'actual';
  /** In 'actual' mode, scroll back to the top whenever this value changes (e.g. the page index). */
  scrollKey?: unknown;
};

export function SlideCanvas({
  children,
  scale,
  center = true,
  flat = false,
  freezeMotion = false,
  design,
  fit = 'contain',
  scrollKey,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState<number | null>(null);

  const actual = fit === 'actual' && scale === undefined;

  useLayoutEffect(() => {
    if (scale !== undefined) return;
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      setFitScale(fit === 'actual' ? 1 : Math.min(width / CANVAS_WIDTH, height / CANVAS_HEIGHT));
    };
    // Measure synchronously before paint so the fitted scale is applied on the
    // first visible frame — otherwise the canvas flashes at full size.
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scale, fit]);

  useLayoutEffect(() => {
    if (actual) containerRef.current?.scrollTo({ top: 0 });
  }, [actual, scrollKey]);

  // The scroller is never focused in present mode, so the browser won't scroll it from the
  // keyboard on its own. Left/right (and Home/End) stay reserved for page navigation.
  useEffect(() => {
    if (!actual) return;
    const onKey = (e: KeyboardEvent) => {
      const el = containerRef.current;
      if (!el || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) return;
      const page = el.clientHeight * 0.9;
      const dir = e.shiftKey ? -1 : 1;
      const top =
        e.key === 'ArrowDown'
          ? 60
          : e.key === 'ArrowUp'
            ? -60
            : e.key === 'PageDown'
              ? page
              : e.key === 'PageUp'
                ? -page
                : e.key === ' '
                  ? dir * page
                  : null;
      if (top === null) return;
      e.preventDefault();
      el.scrollBy({ top });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actual]);

  const measured = scale ?? fitScale;
  const s = measured ?? 1;
  const scaledW = CANVAS_WIDTH * s;
  const scaledH = CANVAS_HEIGHT * s;
  const designVars = design ? designToCssVars(design) : undefined;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-full w-full',
        flat && !actual && 'overflow-hidden',
        actual && 'overflow-auto [scrollbar-width:none]',
      )}
    >
      <div
        className={cn(
          'overflow-hidden bg-white text-black',
          !flat && 'rounded-[6px] shadow-floating',
        )}
        style={
          {
            width: scaledW,
            height: scaledH,
            visibility: measured === null ? 'hidden' : undefined,
            ...(designVars
              ? {
                  ...designVars,
                  background: 'var(--osd-bg)',
                }
              : {}),
            ...(actual ? { margin: '0 auto' } : {}),
            ...(center && !actual
              ? {
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: `translate(-50%, -50%)`,
                }
              : {}),
          } as CSSProperties
        }
      >
        <div
          data-osd-canvas
          data-osd-freeze-motion={freezeMotion ? '' : undefined}
          style={
            {
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              transform: `scale(${s})`,
              transformOrigin: 'top left',
              ...(designVars ?? {}),
            } as CSSProperties
          }
        >
          {children}
        </div>
      </div>
      {freezeMotion && <div aria-hidden className="absolute inset-0 z-10" />}
    </div>
  );
}
