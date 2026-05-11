"use client";

/**
 * Motion primitives for /pltn — narrative orchestration in a prospectus key.
 *
 * The story: the page composes itself like a document being typeset. Hairlines
 * draw left-to-right, type rises into place, numerals tick from zero. One
 * shared timeline, 120ms cadence, easing curve borrowed from a slow press.
 *
 * Respects prefers-reduced-motion via MotionConfig at the page root.
 */

import { ReactNode, useEffect, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const; // expo-out — measured deceleration
const STEP = 0.12; // 120ms between bars in the orchestration
const REVEAL_DURATION = 0.6;
const RULE_DURATION = 0.75;
const NUMBER_DURATION = 1.2;

/** Fade-and-rise wrapper for a section. `step` indexes into the timeline. */
export function Reveal({
  step = 0,
  children,
  as = "section",
  className,
  delay = 0,
}: {
  step?: number;
  children: ReactNode;
  as?: "section" | "div" | "header" | "footer";
  className?: string;
  delay?: number;
}) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: REVEAL_DURATION,
        delay: step * STEP + delay,
        ease: EASE,
      }}
    >
      {children}
    </Tag>
  );
}

/** A 1px hairline that draws from left to right. */
export function Rule({
  step = 0,
  weight = 1,
  color = "var(--rule)",
  className,
  origin = "left",
}: {
  step?: number;
  weight?: number;
  color?: string;
  className?: string;
  origin?: "left" | "right";
}) {
  return (
    <motion.span
      aria-hidden
      className={className}
      style={{
        display: "block",
        width: "100%",
        height: weight,
        background: color,
        transformOrigin: origin,
      }}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: RULE_DURATION, delay: step * STEP, ease: EASE }}
    />
  );
}

/** Type rises and fades — used inside Reveal to stagger child phrases. */
export function Phrase({
  step = 0,
  delay = 0,
  children,
  as: Tag = "span",
}: {
  step?: number;
  delay?: number;
  children: ReactNode;
  as?: keyof typeof motion;
}) {
  // Allow string tag or motion[tag] — defaults to span.
  const M = (motion as Record<string, typeof motion.span>)[Tag as string] ?? motion.span;
  return (
    <M
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: REVEAL_DURATION, delay: step * STEP + delay, ease: EASE }}
      style={{ display: "inline-block" }}
    >
      {children}
    </M>
  );
}

/**
 * Tick a numeric value from 0 to `value` and render it via `format`. When the
 * target value updates (live polling) the ticker tweens to the new value.
 *
 * `step` provides an initial-load delay so the count-up syncs with the section's
 * own fade-up. After the first paint, updates animate immediately.
 */
export function Ticker({
  value,
  format,
  step = 0,
  duration = NUMBER_DURATION,
}: {
  value: number;
  format: (n: number) => string;
  step?: number;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(0);
  const display = useTransform(mv, (n) => format(n));
  const [firstPaint, setFirstPaint] = useState(true);

  useEffect(() => {
    if (reduced) {
      mv.set(value);
      setFirstPaint(false);
      return;
    }
    const controls = animate(mv, value, {
      duration: firstPaint ? duration : duration * 0.4,
      delay: firstPaint ? step * STEP : 0,
      ease: EASE,
    });
    setFirstPaint(false);
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <motion.span>{display}</motion.span>;
}
