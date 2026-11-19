import { cn } from "@/lib/cn";

export function placementClass(placement: number): string {
  if (placement === 1) {
    return "border-placement-win text-placement-win";
  }
  if (placement <= 4) {
    return "border-placement-top text-placement-top";
  }
  return "border-placement-bottom text-placement-bottom";
}

export function PlacementBadge({
  placement,
  label,
}: Readonly<{ placement: number; label: string }>) {
  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-lg border-2 text-lg font-bold",
        placementClass(placement),
      )}
    >
      {placement}
    </span>
  );
}
