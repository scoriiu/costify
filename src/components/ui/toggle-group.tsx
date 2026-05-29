"use client";

// IMPORTANT — color rule on `bg-primary` (Evergreen Teal):
// Never use `text-white` on top of `bg-primary`. In light theme our token
// `--color-white` resolves to `#1A1918` (near-black) because the design
// system inverts text tokens per theme. The result is unreadable black
// text on the teal pill. Always use the literal `text-[#E9E8E3]` (warm
// off-white) when sitting on `bg-primary` — same as the Button primitive
// and exactly what AGENTS.md prescribes for "text on light primary
// buttons". This applies to ANY child of a primary-colored surface,
// including count badges, icons rendered via `currentColor`, etc.

import type { LucideIcon } from "lucide-react";

interface ToggleOption<T extends string> {
  value: T;
  label: string;
  /** Optional small count badge rendered to the right of the label. */
  count?: number;
  /** Tone for the count badge. Defaults to 'neutral'. */
  countTone?: "neutral" | "danger";
  /** Optional leading icon. Used by the large "view switcher" variant to
   *  give each primary view a glanceable glyph. */
  icon?: LucideIcon;
}

/** Visual weight. `default` is the small filter pill (32px). `lg` is the
 *  primary view-switcher (40px, larger text, more padding) so a top-level
 *  mode switch outranks the secondary filters sharing the same toolbar. */
type ToggleSize = "default" | "lg";

interface ToggleGroupProps<T extends string> {
  value: T;
  options: ToggleOption<T>[];
  onChange: (value: T) => void;
  size?: ToggleSize;
  /** Accessible name for the group (e.g. "Schimba vizualizarea"). */
  ariaLabel?: string;
}

const SIZE: Record<ToggleSize, { track: string; button: string; icon: number }> = {
  default: { track: "p-1", button: "h-8 px-4 text-sm gap-2", icon: 14 },
  lg: { track: "p-1.5", button: "h-10 px-5 text-[15px] gap-2.5", icon: 16 },
};

export function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
  size = "default",
  ariaLabel,
}: ToggleGroupProps<T>) {
  const s = SIZE[size];
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex gap-1 rounded-[10px] bg-dark-2 ${s.track}`}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        const countTone = opt.countTone ?? "neutral";
        const Icon = opt.icon;
        // On the active pill the badge sits on top of `bg-primary`, so it
        // MUST use the warm off-white literal (`text-[#E9E8E3]`) — never
        // the `text-white` token (becomes black in light theme).
        const countClass =
          countTone === "danger"
            ? "bg-danger/20 text-danger"
            : active
              ? "bg-[#E9E8E3]/20 text-[#E9E8E3]"
              : "bg-dark-3 text-gray-light";
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            data-state={active ? "active" : "inactive"}
            aria-pressed={active}
            className={`flex items-center justify-center rounded-lg font-mono font-medium transition-colors ${s.button} ${
              active ? "bg-primary text-[#E9E8E3]" : "text-gray hover:text-white"
            }`}
          >
            {Icon && <Icon size={s.icon} aria-hidden className="shrink-0" />}
            <span>{opt.label}</span>
            {opt.count !== undefined && opt.count > 0 && (
              <span
                className={`flex min-w-[1.25rem] items-center justify-center rounded px-1 text-[0.65rem] ${countClass}`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
