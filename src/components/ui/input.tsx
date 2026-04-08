import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={id}
          className="block font-mono text-[11px] font-medium uppercase text-gray"
          style={{ letterSpacing: "-0.04em" }}
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          "w-full rounded-lg border bg-dark-2 px-3.5 py-2.5 text-[14px] text-gray-light",
          "placeholder:text-gray/60 outline-none transition-colors duration-150",
          "focus:border-primary focus:ring-1 focus:ring-primary/30",
          error ? "border-danger/50" : "border-dark-3",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
);

Input.displayName = "Input";
