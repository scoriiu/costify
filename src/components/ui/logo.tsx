import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "text-[16px]",
  md: "text-[20px]",
  lg: "text-[28px]",
};

export function Logo({ size = "md", className }: LogoProps) {
  return (
    <span
      className={cn("font-bold text-white", sizes[size], className)}
      style={{ letterSpacing: "-0.04em" }}
    >
      costify.
    </span>
  );
}
