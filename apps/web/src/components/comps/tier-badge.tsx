import type { MetaTier } from "@tftvn/core";
import { cn } from "@/lib/cn";

const TIER_CLASS: Record<MetaTier, string> = {
  S: "bg-tier-s",
  A: "bg-tier-a",
  B: "bg-tier-b",
  C: "bg-tier-c",
  X: "bg-tier-x",
};

export function TierBadge({ tier, className }: Readonly<{ tier: MetaTier; className?: string }>) {
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-lg font-bold text-on-primary",
        TIER_CLASS[tier],
        className,
      )}
    >
      {tier}
    </span>
  );
}
