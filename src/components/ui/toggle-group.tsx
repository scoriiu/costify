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

interface ToggleOption<T extends string> {
  value: T;
  label: string;
  /** Optional small count badge rendered to the right of the label. */
  count?: number;
  /** Tone for the count badge. Defaults to 'neutral'. */
  countTone?: "neutral" | "danger";
}

interface ToggleGroupProps<T extends string> {
  value: T;
  options: ToggleOption<T>[];
  onChange: (value: T) => void;
}

export function ToggleGroup<T extends string>({ value, options, onChange }: ToggleGroupProps<T>) {
  return (
    <div className="flex gap-1 rounded-[10px] bg-dark-2 p-1">
      {options.map((opt) => {
        const active = value === opt.value;
        const countTone = opt.countTone ?? "neutral";
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
            className={`flex h-8 items-center gap-2 rounded-lg px-4 font-mono text-sm font-medium transition-colors ${
              active ? "bg-primary text-[#E9E8E3]" : "text-gray hover:text-white"
            }`}
          >
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
