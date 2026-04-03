import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--panel)] text-[var(--text)]",
        accent: "border-transparent bg-[var(--accent)]/15 text-[var(--accent-strong)]",
        urgent: "border-transparent bg-[var(--danger)]/15 text-[var(--danger)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
