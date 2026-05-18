"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { useCostiGaze } from "@/lib/costi-gaze";

export type CostiState =
  | "greeting"
  | "thinking"
  | "success"
  | "alert"
  | "error"
  | "working"
  | "celebrating"
  | "sleeping"
  | "teaching";

export type CostiReacting = "pop" | "nod" | "bounce" | null;
export type CostiLookAt = "off" | "cursor" | "user" | "down";
export type CostiMode = "full" | "bust" | "head";
export type CostiSurface = "light" | "dark";

interface CostiMascotProps {
  state?: CostiState;
  size?: number;
  className?: string;
  animated?: boolean;
  reacting?: CostiReacting;
  lookAt?: CostiLookAt;
  /** Crop level:
   *  - "full" (default): whole figure, viewBox 0 0 160 190
   *  - "bust": head + shoulders + a slice of the jacket (good for cards,
   *    headers, medium avatars).
   *  - "head": head only (good for chat bubbles, tiny avatars where face
   *    details would otherwise be unreadable).
   */
  mode?: CostiMode;
  /** The surface Costi is being placed ON, not the global theme. When
   *  "dark" we render a soft white halo behind the head so his hair
   *  doesn't dissolve into the background. Defaults to "light" (no halo). */
  surface?: CostiSurface;
}

const SKIN = "#D4A574";
const SKIN_DARK = "#C4956A";
const BEARD = "#3E2723";
const HAIR = "#2C1F1A";
const GLASSES = "#37474F";
const JACKET = "#2D2D4E";
const JACKET_SHADOW = "#1A1A2E";
const COLLAR = "#F0F6FC";
const DARK_3 = "#21262D";
const DARK = "#0D1117";
const PRIMARY = "#6C5CE7";
const ACCENT = "#00B894";
const WARN = "#FDCB6E";
const GRAY = "#8B949E";
const WHITE = "#F0F6FC";
const MOUTH = "#A0522D";

const EYE_PUPIL = "#1A1A1A";
const LEFT_EYE_CX = 68;
const RIGHT_EYE_CX = 92;
const DEFAULT_EYE_CY = 57;

// Teaching has only one open eye (the other winks). A single eye
// flicking horizontally reads as a twitch without a partner eye doing
// the same motion. Blink + cursor gaze stay; autonomous saccades off.
const NO_SACCADE_STATES: CostiState[] = ["thinking", "working", "alert", "sleeping", "teaching"];
const SACCADE_DUR = "6.4s";
const SACCADE_KEYTIMES = "0;0.18;0.19;0.36;0.5;0.51;0.7;0.71;0.87;0.88;1";

function getBlinkDur(state: CostiState): string {
  if (state === "alert" || state === "error") return "5.4s";
  return "4.2s";
}

function getBlinkBegin(state: CostiState): string {
  const offsets: Partial<Record<CostiState, string>> = {
    greeting: "1.3s",
    thinking: "0.7s",
    success: "1.9s",
    alert: "4s",
    error: "2.1s",
    working: "1.5s",
    celebrating: "2.4s",
    teaching: "1.1s",
  };
  return offsets[state] ?? "1s";
}

function computeGazeOffset(lookAt: CostiLookAt, cursorX: number, cursorY: number): { x: number; y: number } {
  switch (lookAt) {
    case "user":
      return { x: 0, y: 0.3 };
    case "down":
      return { x: 0, y: 1.4 };
    case "cursor":
      return { x: cursorX * 1.6, y: cursorY * 1.2 };
    case "off":
    default:
      return { x: 0, y: 0 };
  }
}

interface AnimEyeProps {
  cx: number;
  cy?: number;
  rx?: number;
  ry?: number;
  state: CostiState;
  animated: boolean;
  reducedMotion: boolean;
  /** Direction the saccade flicks horizontally. +1 = both eyes drift right
   *  together (paired saccade — what real eyes do). */
  saccadeDir?: 1 | -1;
}

function AnimEye({ cx, cy = DEFAULT_EYE_CY, rx = 3, ry = 3.5, state, animated, reducedMotion, saccadeDir = 1 }: AnimEyeProps) {
  const live = animated && !reducedMotion;
  const saccade = live && !NO_SACCADE_STATES.includes(state);
  const flick = saccadeDir === 1 ? 1.4 : -1.4;
  const a = cx;
  const b = cx + flick;
  const c = cx - flick;
  const saccadeValues = `${a};${a};${b};${b};${b};${a};${a};${c};${c};${a};${a}`;

  return (
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={EYE_PUPIL}>
      {live && (
        <animate
          attributeName="ry"
          values={`${ry};${ry};0.2;${ry};${ry};${ry};0.2;0.2;${ry};${ry}`}
          dur={getBlinkDur(state)}
          begin={getBlinkBegin(state)}
          keyTimes="0;0.32;0.35;0.38;0.62;0.71;0.735;0.755;0.78;1"
          repeatCount="indefinite"
        />
      )}
      {saccade && (
        <animate
          attributeName="cx"
          values={saccadeValues}
          dur={SACCADE_DUR}
          keyTimes={SACCADE_KEYTIMES}
          repeatCount="indefinite"
        />
      )}
    </ellipse>
  );
}

/** Animated catch-light highlights that ride along with the pupil
 *  saccades, so eyes never look disconnected from their highlights. */
function EyeHighlight({ pupilCx, cy = 56, state, animated, reducedMotion, saccadeDir = 1 }: {
  pupilCx: number; cy?: number; state: CostiState; animated: boolean; reducedMotion: boolean; saccadeDir?: 1 | -1;
}) {
  const live = animated && !reducedMotion;
  const saccade = live && !NO_SACCADE_STATES.includes(state);
  const flick = saccadeDir === 1 ? 1.4 : -1.4;
  const baseHx = pupilCx + 1.5;
  const a = baseHx;
  const b = baseHx + flick;
  const c = baseHx - flick;
  const values = `${a};${a};${b};${b};${b};${a};${a};${c};${c};${a};${a}`;
  return (
    <circle cx={baseHx} cy={cy} r={1.2} fill="white">
      {saccade && (
        <animate attributeName="cx" values={values} dur={SACCADE_DUR} keyTimes={SACCADE_KEYTIMES} repeatCount="indefinite" />
      )}
    </circle>
  );
}

interface EyesProps {
  state: CostiState;
  animated: boolean;
  reducedMotion: boolean;
  gazeX: number;
  gazeY: number;
  /** Override per-pose eye geometry. Working has slightly lower eyes; alert
   *  has a wider left eye. Pass overrides where needed. */
  leftCx?: number;
  rightCx?: number;
  cy?: number;
  leftRx?: number;
  leftRy?: number;
  rightRx?: number;
  rightRy?: number;
  withHighlight?: boolean;
}

function Eyes({
  state,
  animated,
  reducedMotion,
  gazeX,
  gazeY,
  leftCx = LEFT_EYE_CX,
  rightCx = RIGHT_EYE_CX,
  cy = DEFAULT_EYE_CY,
  leftRx = 3,
  leftRy = 3.5,
  rightRx = 3,
  rightRy = 3.5,
  withHighlight = true,
}: EyesProps) {
  const pupilShift = `translate(${gazeX.toFixed(2)} ${gazeY.toFixed(2)})`;
  return (
    <g transform={pupilShift} style={{ transition: "transform 90ms cubic-bezier(0.2, 0, 0.1, 1)" }}>
      <AnimEye cx={leftCx} cy={cy} rx={leftRx} ry={leftRy} state={state} animated={animated} reducedMotion={reducedMotion} saccadeDir={1} />
      <AnimEye cx={rightCx} cy={cy} rx={rightRx} ry={rightRy} state={state} animated={animated} reducedMotion={reducedMotion} saccadeDir={1} />
      {withHighlight && (
        <>
          <EyeHighlight pupilCx={leftCx} cy={cy - 1} state={state} animated={animated} reducedMotion={reducedMotion} saccadeDir={1} />
          <EyeHighlight pupilCx={rightCx} cy={cy - 1} state={state} animated={animated} reducedMotion={reducedMotion} saccadeDir={1} />
        </>
      )}
    </g>
  );
}

/** Relaxed arm hanging at the side. Used wherever a pose has one arm
 *  doing the work (waving, pointing, holding a cup) and the other arm
 *  simply rests. Anatomically proportioned: shoulder -> elbow -> wrist
 *  -> hand with visible fingers, matching the length of the working
 *  arm on the opposite side (~60 SVG units total). The previous stub
 *  (flat rect ending at y=150) read as a stump. */
function Base({ children, breathe }: { children: React.ReactNode; breathe: boolean }) {
  return (
    <g className={breathe ? "costi-body" : undefined}>
      {breathe && (
        <animateTransform
          attributeName="transform"
          type="scale"
          values="1 1;1 1.012;1 1"
          dur="4.3s"
          repeatCount="indefinite"
          additive="sum"
        />
      )}
      {/* Jacket */}
      <path d="M50 105 Q50 95 60 95 L100 95 Q110 95 110 105 L112 155 Q112 160 107 160 L53 160 Q48 160 48 155 Z" fill={JACKET} stroke={JACKET_SHADOW} strokeWidth={1} />
      {/* Collar */}
      <polygon points="70,95 80,110 90,95" fill={COLLAR} opacity={0.9} />
      {/* Neck */}
      <rect x={72} y={86} width={16} height={14} rx={3} fill={SKIN} />
      {children}
    </g>
  );
}

interface HeadProps {
  children?: React.ReactNode;
  drift: boolean;
  /** On "dark" surfaces, add a thin white rim-light stroke to the hair
   *  so it doesn't dissolve into the background. */
  surface: CostiSurface;
}

const HAIR_RIM_STROKE = "#FFFFFF";
const HAIR_RIM_OPACITY = 0.32;
const HAIR_RIM_WIDTH = 0.8;

/** Head wrapper carries the layered drift (rotation + translate) that
 *  makes Costi feel alive at rest. The transform-origin is set via the
 *  animateTransform rotation pivot (50 50 in head-local SVG coords). */
function Head({ children, drift, surface }: HeadProps) {
  const rim = surface === "dark";
  return (
    <g className="costi-head">
      {drift && (
        <>
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 80 55;1.8 80 55;0 80 55;-1.4 80 55;0 80 55"
            keyTimes="0;0.27;0.52;0.81;1"
            dur="11s"
            repeatCount="indefinite"
            additive="sum"
          />
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;0.4 -0.5;-0.3 0.3;0 0"
            keyTimes="0;0.33;0.71;1"
            dur="7.3s"
            repeatCount="indefinite"
            additive="sum"
          />
        </>
      )}
      <path d="M50 55 Q50 25 80 22 Q110 25 110 55 L108 72 Q105 88 80 90 Q55 88 52 72 Z" fill={SKIN} />
      <path d="M58 68 Q58 88 80 90 Q102 88 102 68 L100 75 Q98 85 80 87 Q62 85 60 75 Z" fill={BEARD} opacity={0.85} />
      <path d="M68 68 Q74 72 80 68 Q86 72 92 68" stroke={BEARD} strokeWidth={3} fill="none" strokeLinecap="round" />
      <path
        d="M52 45 Q50 22 80 18 Q110 22 108 45 L105 38 Q103 26 80 24 Q57 26 55 38 Z"
        fill={HAIR}
        stroke={rim ? HAIR_RIM_STROKE : undefined}
        strokeWidth={rim ? HAIR_RIM_WIDTH : undefined}
        strokeOpacity={rim ? HAIR_RIM_OPACITY : undefined}
      />
      <rect
        x={51} y={48} width={5} height={14} rx={2}
        fill={HAIR}
        stroke={rim ? HAIR_RIM_STROKE : undefined}
        strokeWidth={rim ? HAIR_RIM_WIDTH : undefined}
        strokeOpacity={rim ? HAIR_RIM_OPACITY : undefined}
      />
      <rect
        x={104} y={48} width={5} height={14} rx={2}
        fill={HAIR}
        stroke={rim ? HAIR_RIM_STROKE : undefined}
        strokeWidth={rim ? HAIR_RIM_WIDTH : undefined}
        strokeOpacity={rim ? HAIR_RIM_OPACITY : undefined}
      />
      {children}
    </g>
  );
}

function Glasses({ y = 50 }: { y?: number }) {
  return (
    <>
      <rect x={58} y={y} width={20} height={14} rx={3} stroke={GLASSES} strokeWidth={2.5} fill="none" />
      <rect x={82} y={y} width={20} height={14} rx={3} stroke={GLASSES} strokeWidth={2.5} fill="none" />
      <line x1={78} y1={y + 6} x2={82} y2={y + 6} stroke={GLASSES} strokeWidth={2.5} />
      <line x1={58} y1={y + 4} x2={53} y2={y} stroke={GLASSES} strokeWidth={2} />
      <line x1={102} y1={y + 4} x2={107} y2={y} stroke={GLASSES} strokeWidth={2} />
    </>
  );
}

function Brows() {
  return (
    <>
      <path d="M59 46 Q64 43 77 46" stroke={HAIR} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <path d="M83 46 Q96 43 101 46" stroke={HAIR} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </>
  );
}

/** Relaxed arm hanging straight at the side. Long sleeve from shoulder
 *  to wrist (single straight rect — no elbow joint), small skin wrist
 *  gap, closed-fist hand seen from the side with thumb bump on the
 *  outer (forward) edge plus two knuckle shadow lines for volume.
 *  Bottoms out at y=160, matching the jacket hem. */
function RelaxedArm({ side }: { side: "left" | "right" }) {
  // side="left" = his right arm = on our left = sleeve at x=36-48
  // side="right" = his left arm = on our right = sleeve at x=112-124
  if (side === "left") {
    return (
      <g>
        <rect x={36} y={100} width={12} height={48} rx={6} fill={JACKET} />
        <rect x={38} y={148} width={8} height={4} rx={2} fill={SKIN} />
        <ellipse cx={42} cy={155} rx={5.5} ry={5} fill={SKIN} />
        <ellipse cx={47} cy={154} rx={2.2} ry={2.6} fill={SKIN} />
        <path d="M39 154 Q42 154.5 45 154" stroke={SKIN_DARK} strokeWidth={0.5} fill="none" opacity={0.45} />
        <path d="M39 157 Q42 157.5 45 157" stroke={SKIN_DARK} strokeWidth={0.5} fill="none" opacity={0.45} />
      </g>
    );
  }
  return (
    <g>
      <rect x={112} y={100} width={12} height={48} rx={6} fill={JACKET} />
      <rect x={114} y={148} width={8} height={4} rx={2} fill={SKIN} />
      <ellipse cx={118} cy={155} rx={5.5} ry={5} fill={SKIN} />
      <ellipse cx={113} cy={154} rx={2.2} ry={2.6} fill={SKIN} />
      <path d="M115 154 Q118 154.5 121 154" stroke={SKIN_DARK} strokeWidth={0.5} fill="none" opacity={0.45} />
      <path d="M115 157 Q118 157.5 121 157" stroke={SKIN_DARK} strokeWidth={0.5} fill="none" opacity={0.45} />
    </g>
  );
}

interface SceneProps {
  animated: boolean;
  reducedMotion: boolean;
  gazeX: number;
  gazeY: number;
  surface: CostiSurface;
}

function Greeting({ animated, reducedMotion, gazeX, gazeY, surface }: SceneProps) {
  const drift = animated && !reducedMotion;
  return (
    <Base breathe={drift}>
      <Head drift={drift} surface={surface}>
        <Glasses />
        <Eyes state="greeting" animated={animated} reducedMotion={reducedMotion} gazeX={gazeX} gazeY={gazeY} />
        <Brows />
        <path d="M72 76 Q80 80 90 76" stroke={MOUTH} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      </Head>
      {/* Left arm waving (his left, our right) */}
      <g className={drift ? "costi-wave" : undefined} style={{ transformOrigin: "110px 100px" }}>
        <path d="M110 100 Q122 105 128 92" stroke={JACKET} strokeWidth={13} fill="none" strokeLinecap="round" />
        <path d="M128 92 Q134 78 130 56" stroke={SKIN} strokeWidth={9} fill="none" strokeLinecap="round" />
        <g transform="rotate(-20, 130, 52)">
          <rect x={122} y={44} width={14} height={11} rx={4} fill={SKIN} />
          <rect x={121} y={36} width={3.2} height={10} rx={1.6} fill={SKIN} />
          <rect x={125} y={34} width={3.2} height={12} rx={1.6} fill={SKIN} />
          <rect x={129} y={34} width={3.2} height={12} rx={1.6} fill={SKIN} />
          <rect x={133} y={36} width={3.2} height={10} rx={1.6} fill={SKIN} />
          <rect x={117} y={47} width={7} height={3.2} rx={1.6} fill={SKIN} />
        </g>
      </g>
      <RelaxedArm side="left" />
    </Base>
  );
}

function Thinking({ animated, reducedMotion, gazeX, gazeY, surface }: SceneProps) {
  const drift = animated && !reducedMotion;
  return (
    <Base breathe={drift}>
      <Head drift={drift} surface={surface}>
        <Glasses />
        <Eyes state="thinking" animated={animated} reducedMotion={reducedMotion} gazeX={gazeX} gazeY={gazeY} leftCx={70} rightCx={94} />
        <Brows />
        <line x1={74} y1={77} x2={86} y2={77} stroke={MOUTH} strokeWidth={1.5} strokeLinecap="round" />
      </Head>
      {/* Both arms relaxed at the sides. Thinking is signalled by the
          three pulsing thought dots above the head + the eye sway. */}
      <RelaxedArm side="left" />
      <RelaxedArm side="right" />
      {/* Thought dots — pulse to suggest active thought */}
      <g className={drift ? "costi-thought" : undefined}>
        <circle cx={128} cy={38} r={3} fill={DARK_3}>
          {drift && <animate attributeName="opacity" values="0.3;1;0.3" dur="2.4s" keyTimes="0;0.33;1" repeatCount="indefinite" />}
        </circle>
        <circle cx={136} cy={26} r={4.5} fill={DARK_3}>
          {drift && <animate attributeName="opacity" values="0.3;0.3;1;0.3" dur="2.4s" keyTimes="0;0.33;0.66;1" repeatCount="indefinite" />}
        </circle>
        <circle cx={140} cy={12} r={2.5} fill={DARK_3}>
          {drift && <animate attributeName="opacity" values="0.3;0.3;0.3;1;0.3" dur="2.4s" keyTimes="0;0.33;0.66;0.85;1" repeatCount="indefinite" />}
        </circle>
      </g>
    </Base>
  );
}

function Success({ animated, reducedMotion, surface }: SceneProps) {
  const drift = animated && !reducedMotion;
  return (
    <Base breathe={drift}>
      <Head drift={drift} surface={surface}>
        <Glasses />
        {/* Closed crescent eyes for the happy smile — no pupils here,
            no gaze; the smile is the signal. */}
        <path d="M62 57 Q68 52 74 57" stroke={EYE_PUPIL} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <path d="M86 57 Q92 52 98 57" stroke={EYE_PUPIL} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Brows />
        <path d="M72 76 Q80 82 90 76" stroke={MOUTH} strokeWidth={2} fill="none" strokeLinecap="round" />
      </Head>
      <rect x={36} y={98} width={14} height={28} rx={6} fill={JACKET} />
      <rect x={110} y={98} width={14} height={28} rx={6} fill={JACKET} />
      <path d="M50 110 Q58 106 80 108 Q95 110 105 118" stroke={JACKET} strokeWidth={13} fill="none" strokeLinecap="round" />
      <path d="M110 110 Q100 106 80 108 Q62 110 52 118" stroke={JACKET} strokeWidth={13} fill="none" strokeLinecap="round" />
      <ellipse cx={105} cy={118} rx={7} ry={5} fill={SKIN} />
      <ellipse cx={108} cy={116} rx={3} ry={4} fill={SKIN} />
      <ellipse cx={55} cy={118} rx={7} ry={5} fill={SKIN} />
      <ellipse cx={52} cy={116} rx={3} ry={4} fill={SKIN} />
      <g transform="translate(125, 75)" className={drift ? "costi-check-pulse" : undefined}>
        <circle cx={12} cy={12} r={12} fill={ACCENT} opacity={0.2} />
        <path d="M7 12 L10.5 15.5 L17 9" stroke={ACCENT} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </Base>
  );
}

function Alert({ animated, reducedMotion, gazeX, gazeY, surface }: SceneProps) {
  const drift = animated && !reducedMotion;
  return (
    <Base breathe={drift}>
      <Head drift={drift} surface={surface}>
        <Glasses />
        {/* Raised left eyebrow */}
        <path d="M59 44 Q64 41 77 45" stroke={HAIR} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <path d="M83 46 Q96 43 101 46" stroke={HAIR} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Eyes state="alert" animated={animated} reducedMotion={reducedMotion} gazeX={gazeX} gazeY={gazeY} leftRx={3.5} leftRy={4} />
        <line x1={74} y1={77} x2={86} y2={77} stroke={MOUTH} strokeWidth={2} strokeLinecap="round" />
      </Head>
      <rect x={112} y={92} width={12} height={30} rx={6} fill={JACKET} />
      <rect x={114} y={85} width={10} height={11} rx={5} fill={SKIN} />
      <rect x={122} y={84} width={14} height={4} rx={2} fill={SKIN} />
      <circle cx={136} cy={86} r={2.2} fill={SKIN} />
      <RelaxedArm side="left" />
      <g transform="translate(120, 60)" className={drift ? "costi-warn-pulse" : undefined}>
        <polygon points="12,0 24,22 0,22" fill={WARN} stroke={DARK} strokeWidth={1} />
        <line x1={12} y1={6} x2={12} y2={13} stroke={DARK} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={12} cy={18} r={1.5} fill={DARK} />
      </g>
    </Base>
  );
}

function Error({ animated, reducedMotion, surface }: SceneProps) {
  const drift = animated && !reducedMotion;
  return (
    <Base breathe={drift}>
      <Head drift={drift} surface={surface}>
        <Glasses y={38} />
        <line x1={62} y1={57} x2={75} y2={57} stroke={EYE_PUPIL} strokeWidth={2.5} strokeLinecap="round" />
        <line x1={85} y1={57} x2={98} y2={57} stroke={EYE_PUPIL} strokeWidth={2.5} strokeLinecap="round" />
        <path d="M61 50 Q68 47 75 51" stroke={HAIR} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <path d="M85 51 Q92 47 99 50" stroke={HAIR} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <path d="M74 77 Q80 74 86 77" stroke={MOUTH} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      </Head>
      {/* Pinching-nose arm (his right). Long sleeve covers BOTH upper
          arm and forearm — only the wrist + fingers are skin. */}
      <g>
        <path d="M50 100 Q42 98 38 90" stroke={JACKET} strokeWidth={13} fill="none" strokeLinecap="round" />
        <path d="M38 90 Q36 78 42 64" stroke={JACKET} strokeWidth={11} fill="none" strokeLinecap="round" />
        {/* Skin wrist + hand pinching nose bridge */}
        <ellipse cx={54} cy={54} rx={3} ry={2.2} fill={SKIN} />
        <ellipse cx={60} cy={52} rx={2.2} ry={3} fill={SKIN} />
        <circle cx={50} cy={56} r={3.5} fill={SKIN} />
      </g>
      <RelaxedArm side="right" />
    </Base>
  );
}

function Working({ animated, reducedMotion, gazeX, gazeY, surface }: SceneProps) {
  const drift = animated && !reducedMotion;
  return (
    <Base breathe={drift}>
      <Head drift={drift} surface={surface}>
        <Glasses />
        <Eyes state="working" animated={animated} reducedMotion={reducedMotion} gazeX={gazeX} gazeY={gazeY} cy={59} leftRy={2.5} rightRy={2.5} withHighlight={false} />
        <Brows />
        <line x1={74} y1={77} x2={86} y2={76} stroke={MOUTH} strokeWidth={1.5} strokeLinecap="round" />
      </Head>
      <rect x={52} y={135} width={56} height={32} rx={3} fill={DARK_3} />
      <rect x={55} y={138} width={50} height={24} rx={2} fill={DARK} />
      {/* Screen scanlines pulse subtly */}
      <g className={drift ? "costi-screen" : undefined}>
        <rect x={60} y={143} width={20} height={2.5} rx={1} fill={PRIMARY} opacity={0.5}>
          {drift && <animate attributeName="opacity" values="0.5;0.8;0.5" dur="2.1s" repeatCount="indefinite" />}
        </rect>
        <rect x={60} y={148} width={15} height={2.5} rx={1} fill={ACCENT} opacity={0.4}>
          {drift && <animate attributeName="width" values="15;22;15" dur="3.7s" repeatCount="indefinite" />}
        </rect>
        <rect x={60} y={153} width={25} height={2.5} rx={1} fill={PRIMARY} opacity={0.3}>
          {drift && <animate attributeName="width" values="25;18;25" dur="2.9s" repeatCount="indefinite" />}
        </rect>
      </g>
      <rect x={42} y={165} width={76} height={5} rx={2} fill={DARK_3} />
      <rect x={38} y={100} width={12} height={30} rx={6} fill={JACKET} />
      <rect x={42} y={128} width={14} height={10} rx={5} fill={SKIN} />
      <rect x={110} y={100} width={12} height={30} rx={6} fill={JACKET} />
      <rect x={104} y={128} width={14} height={10} rx={5} fill={SKIN} />
    </Base>
  );
}

function Celebrating({ animated, reducedMotion, surface }: SceneProps) {
  const drift = animated && !reducedMotion;
  return (
    <Base breathe={drift}>
      <Head drift={drift} surface={surface}>
        <Glasses />
        <path d="M62 57 Q68 52 74 57" stroke={EYE_PUPIL} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <path d="M86 57 Q92 52 98 57" stroke={EYE_PUPIL} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Brows />
        <path d="M70 76 Q80 84 90 76" stroke={MOUTH} strokeWidth={2} fill="none" strokeLinecap="round" />
      </Head>
      <RelaxedArm side="left" />
      {/* Coffee-cup arm (his left). Long sleeve covers upper arm AND
          forearm — only the wrist + hand gripping the cup are skin. */}
      <path d="M110 100 Q120 106 124 96" stroke={JACKET} strokeWidth={13} fill="none" strokeLinecap="round" />
      <path d="M124 96 Q128 88 126 80" stroke={JACKET} strokeWidth={11} fill="none" strokeLinecap="round" />
      <rect x={116} y={68} width={18} height={22} rx={4} fill={WHITE} opacity={0.9} />
      <rect x={116} y={66} width={18} height={4} rx={2} fill={GRAY} opacity={0.3} />
      <path d="M134 74 Q141 74 141 81 Q141 88 134 88" stroke={WHITE} strokeWidth={2} fill="none" opacity={0.6} />
      <rect x={114} y={74} width={5} height={14} rx={2.5} fill={SKIN} />
      <circle cx={118} cy={76} r={2.2} fill={SKIN} />
      <circle cx={118} cy={80} r={2.2} fill={SKIN} />
      <circle cx={118} cy={84} r={2.2} fill={SKIN} />
      <ellipse cx={132} cy={78} rx={2.5} ry={4} fill={SKIN} />
      {/* Steam — gently drifts upward */}
      <g className={drift ? "costi-steam" : undefined}>
        <path d="M122 62 Q124 56 122 50" stroke={GRAY} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.3}>
          {drift && <animate attributeName="opacity" values="0.05;0.4;0.05" dur="3.2s" repeatCount="indefinite" />}
        </path>
        <path d="M128 64 Q130 58 128 52" stroke={GRAY} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.2}>
          {drift && <animate attributeName="opacity" values="0.05;0.3;0.05" dur="3.2s" begin="0.6s" repeatCount="indefinite" />}
        </path>
      </g>
      {/* Confetti — gently shimmer */}
      <g className={drift ? "costi-confetti" : undefined}>
        <rect x={28} y={18} width={5} height={5} rx={1} fill={PRIMARY} opacity={0.6} transform="rotate(20, 30, 20)" />
        <rect x={48} y={8} width={4} height={4} rx={1} fill={ACCENT} opacity={0.5} transform="rotate(-15, 50, 10)" />
        <rect x={105} y={12} width={5} height={5} rx={1} fill={WARN} opacity={0.6} transform="rotate(35, 107, 14)" />
        <rect x={130} y={30} width={4} height={4} rx={1} fill="#E63946" opacity={0.5} transform="rotate(-25, 132, 32)" />
        <circle cx={40} cy={30} r={2.5} fill={WARN} opacity={0.4} />
        <circle cx={118} cy={20} r={2} fill={PRIMARY} opacity={0.45} />
      </g>
    </Base>
  );
}

function Sleeping({ animated, reducedMotion, surface }: SceneProps) {
  const drift = animated && !reducedMotion;
  const rim = surface === "dark";
  return (
    <Base breathe={drift}>
      {/* Sleeping head is tilted; no idle drift on top — gentle breath
          comes from the body. The Zzz's drift instead. */}
      <g transform="rotate(10, 80, 60)">
        <path d="M50 55 Q50 25 80 22 Q110 25 110 55 L108 72 Q105 88 80 90 Q55 88 52 72 Z" fill={SKIN} />
        <path d="M58 68 Q58 88 80 90 Q102 88 102 68 L100 75 Q98 85 80 87 Q62 85 60 75 Z" fill={BEARD} opacity={0.85} />
        <path d="M68 68 Q74 72 80 68 Q86 72 92 68" stroke={BEARD} strokeWidth={3} fill="none" strokeLinecap="round" />
        <path
          d="M52 45 Q50 22 80 18 Q110 22 108 45 L105 38 Q103 26 80 24 Q57 26 55 38 Z"
          fill={HAIR}
          stroke={rim ? HAIR_RIM_STROKE : undefined}
          strokeWidth={rim ? HAIR_RIM_WIDTH : undefined}
          strokeOpacity={rim ? HAIR_RIM_OPACITY : undefined}
        />
        <rect
          x={51} y={48} width={5} height={14} rx={2}
          fill={HAIR}
          stroke={rim ? HAIR_RIM_STROKE : undefined}
          strokeWidth={rim ? HAIR_RIM_WIDTH : undefined}
          strokeOpacity={rim ? HAIR_RIM_OPACITY : undefined}
        />
        <rect
          x={104} y={48} width={5} height={14} rx={2}
          fill={HAIR}
          stroke={rim ? HAIR_RIM_STROKE : undefined}
          strokeWidth={rim ? HAIR_RIM_WIDTH : undefined}
          strokeOpacity={rim ? HAIR_RIM_OPACITY : undefined}
        />
        <Glasses />
        <line x1={62} y1={57} x2={74} y2={57} stroke={EYE_PUPIL} strokeWidth={2} strokeLinecap="round" />
        <line x1={86} y1={57} x2={98} y2={57} stroke={EYE_PUPIL} strokeWidth={2} strokeLinecap="round" />
        <path d="M74 76 Q80 78 86 76" stroke={MOUTH} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      </g>
      <RelaxedArm side="left" />
      <RelaxedArm side="right" />
      <g className={drift ? "costi-zzz" : undefined}>
        <text x={118} y={35} fontSize={16} fill={GRAY} fontWeight={800} fontFamily="Inter" opacity={0.5}>
          Z
          {drift && <animate attributeName="opacity" values="0.5;0.2;0.5" dur="3.6s" repeatCount="indefinite" />}
          {drift && <animate attributeName="y" values="35;31;35" dur="3.6s" repeatCount="indefinite" />}
        </text>
        <text x={130} y={22} fontSize={12} fill={GRAY} fontWeight={800} fontFamily="Inter" opacity={0.35}>
          z
          {drift && <animate attributeName="opacity" values="0.35;0.1;0.35" dur="3.6s" begin="0.4s" repeatCount="indefinite" />}
          {drift && <animate attributeName="y" values="22;18;22" dur="3.6s" begin="0.4s" repeatCount="indefinite" />}
        </text>
        <text x={138} y={12} fontSize={9} fill={GRAY} fontWeight={800} fontFamily="Inter" opacity={0.2}>
          z
          {drift && <animate attributeName="opacity" values="0.2;0.05;0.2" dur="3.6s" begin="0.8s" repeatCount="indefinite" />}
        </text>
      </g>
    </Base>
  );
}

function Teaching({ animated, reducedMotion, gazeX, gazeY, surface }: SceneProps) {
  const drift = animated && !reducedMotion;
  const live = drift;
  return (
    <Base breathe={drift}>
      <Head drift={drift} surface={surface}>
        <Glasses />
        {/* Only one open eye to animate (the right is winking). The left
            pupil still gets blink + saccade + gaze translation. */}
        <g transform={`translate(${gazeX.toFixed(2)} ${gazeY.toFixed(2)})`} style={{ transition: "transform 90ms cubic-bezier(0.2, 0, 0.1, 1)" }}>
          <AnimEye cx={68} cy={57} state="teaching" animated={animated} reducedMotion={reducedMotion} />
          {live && (
            <circle cx={69.5} cy={56} r={1.2} fill="white" />
          )}
        </g>
        {/* Wink line */}
        <line x1={86} y1={57} x2={98} y2={55} stroke={EYE_PUPIL} strokeWidth={2.5} strokeLinecap="round" />
        <Brows />
        <path d="M72 76 Q80 80 90 76" stroke={MOUTH} strokeWidth={2} fill="none" strokeLinecap="round" />
      </Head>
      <g>
        <path d="M110 100 Q122 105 128 92" stroke={JACKET} strokeWidth={13} fill="none" strokeLinecap="round" />
        <path d="M128 92 Q134 78 130 60" stroke={SKIN} strokeWidth={9} fill="none" strokeLinecap="round" />
        <g transform="rotate(-10, 130, 56)">
          <rect x={123} y={50} width={14} height={11} rx={5} fill={SKIN} />
          <rect x={123} y={56} width={3.2} height={5} rx={1.6} fill={SKIN_DARK} opacity={0.25} />
          <rect x={127} y={57} width={3.2} height={5} rx={1.6} fill={SKIN_DARK} opacity={0.25} />
          <rect x={131} y={57} width={3.2} height={5} rx={1.6} fill={SKIN_DARK} opacity={0.25} />
          <rect x={135} y={56} width={3.2} height={4} rx={1.6} fill={SKIN_DARK} opacity={0.25} />
          <rect x={124} y={46} width={5} height={8} rx={2.5} fill={SKIN} />
          <ellipse cx={126.5} cy={46} rx={3} ry={2.2} fill={SKIN} />
        </g>
      </g>
      <path d="M50 100 Q46 110 38 118" stroke={JACKET} strokeWidth={13} fill="none" strokeLinecap="round" />
      <path d="M38 118 Q34 124 30 128" stroke={SKIN} strokeWidth={9} fill="none" strokeLinecap="round" />
      <rect x={10} y={106} width={26} height={34} rx={3} fill={WHITE} opacity={0.9} />
      <rect x={12} y={110} width={16} height={2} rx={1} fill={PRIMARY} opacity={0.5} />
      <rect x={12} y={115} width={12} height={2} rx={1} fill={PRIMARY} opacity={0.3} />
      <rect x={12} y={120} width={14} height={2} rx={1} fill={ACCENT} opacity={0.4} />
      <rect x={12} y={125} width={10} height={2} rx={1} fill={PRIMARY} opacity={0.2} />
      <rect x={12} y={130} width={16} height={2} rx={1} fill={PRIMARY} opacity={0.15} />
      <rect x={34} y={114} width={5} height={14} rx={2.5} fill={SKIN} />
      <circle cx={11} cy={116} r={2.2} fill={SKIN} />
      <circle cx={11} cy={121} r={2.2} fill={SKIN} />
      <circle cx={11} cy={126} r={2.2} fill={SKIN} />
      <ellipse cx={32} cy={118} rx={2.5} ry={4} fill={SKIN} />
    </Base>
  );
}

const STATE_MAP: Record<CostiState, (p: SceneProps) => React.ReactElement> = {
  greeting: Greeting,
  thinking: Thinking,
  success: Success,
  alert: Alert,
  error: Error,
  working: Working,
  celebrating: Celebrating,
  sleeping: Sleeping,
  teaching: Teaching,
};

export function CostiMascot({
  state = "greeting",
  size = 120,
  className,
  animated = true,
  reacting = null,
  lookAt = "off",
  mode = "full",
  surface = "light",
}: CostiMascotProps) {
  const reducedMotion = usePrefersReducedMotion();
  const trackCursor = lookAt === "cursor" && animated && !reducedMotion;
  const cursor = useCostiGaze(trackCursor);
  const gaze = computeGazeOffset(lookAt, cursor.x, cursor.y);

  // One-shot reaction. Re-keyed every time `reacting` toggles on so the
  // CSS animation restarts. Emotion changes also bump the key so we get
  // a tiny "snap to new state" pop on every state change.
  const reactKey = useRef(0);
  const [prevState, setPrevState] = useState(state);
  if (prevState !== state) {
    reactKey.current += 1;
    setPrevState(state);
  }
  const [prevReacting, setPrevReacting] = useState<CostiReacting>(reacting);
  const [reactPulse, setReactPulse] = useState(0);
  useEffect(() => {
    if (prevReacting !== reacting) {
      setPrevReacting(reacting);
      if (reacting) setReactPulse((k) => k + 1);
    }
  }, [reacting, prevReacting]);

  const stateClass = animated && !reducedMotion ? `costi-state-${state}` : "";
  const reactClass = animated && !reducedMotion && reacting ? `costi-react-${reacting}` : "";

  const Scene = STATE_MAP[state];

  return (
    <div
      className={`costi-root ${className ?? ""}`}
      style={{ display: "inline-block", lineHeight: 0, position: "relative" }}
    >
      <div
        key={`state-${reactKey.current}`}
        className={`${stateClass} costi-state-bounce`}
        style={{ display: "inline-block", lineHeight: 0 }}
      >
        <div
          key={`react-${reactPulse}`}
          className={reactClass}
          style={{ display: "inline-block", lineHeight: 0 }}
        >
          <svg
            width={size}
            height={
              mode === "head" ? size
              : mode === "bust" ? size * 0.72
              : size * 1.1875
            }
            viewBox={
              mode === "head" ? "40 12 80 80"
              // Bust = head + neck + shoulders + top of jacket. Width
              // is wide enough to contain the greeting wave hand even
              // mid-swing. Aspect ratio ~145/105.
              : mode === "bust" ? "5 12 145 105"
              : "0 0 160 190"
            }
            fill="none"
            className={className}
            aria-hidden
          >
            <Scene
              animated={animated}
              reducedMotion={reducedMotion}
              gazeX={gaze.x}
              gazeY={gaze.y}
              surface={surface}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
