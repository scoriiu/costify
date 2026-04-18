"use client";

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
        const countClass =
          countTone === "danger"
            ? "bg-danger/20 text-danger"
            : active
              ? "bg-white/15 text-white"
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
