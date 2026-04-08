import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-primary text-[#E9E8E3] hover:bg-primary-dark shadow-[0_4px_20px_rgba(13,107,94,0.25)] hover:shadow-[0_8px_30px_rgba(13,107,94,0.35)]",
  ghost:
    "bg-transparent text-gray-light border border-dark-3 hover:border-primary hover:text-white",
  danger:
    "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[10px] px-5 py-2.5 text-[14px] font-semibold transition-all duration-200 cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
        "active:scale-[0.98]",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
);

Button.displayName = "Button";
