import { cn } from "@/lib/utils";

type Variant = "high" | "medium" | "low" | "elevated" | "moderate" | "minimal" | "neutral";

const styles: Record<Variant, string> = {
  high: "bg-alert-soft text-alert border border-alert-soft-border",
  medium: "bg-warning-soft text-[hsl(30_70%_35%)] border border-warning-soft-border",
  low: "bg-secondary text-muted-foreground border border-border",
  elevated: "text-alert",
  moderate: "text-[hsl(30_70%_40%)]",
  minimal: "text-success",
  neutral: "bg-secondary text-foreground border border-border",
};

export const Chip = ({
  children,
  variant = "neutral",
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium",
      styles[variant],
      className
    )}
  >
    {children}
  </span>
);
