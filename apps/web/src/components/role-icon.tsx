import { roleIconUrl } from "@tftvn/core";
import Image from "next/image";
import { cn } from "@/lib/cn";

export function RoleIcon({
  roleApiName,
  label,
  size = 24,
  className,
}: Readonly<{ roleApiName: string; label: string; size?: number; className?: string }>) {
  const src = roleIconUrl(roleApiName);
  if (!src) {
    return null;
  }
  return (
    <Image
      src={src}
      alt={label}
      title={label}
      width={size}
      height={size}
      unoptimized
      className={cn("inline-block shrink-0", className)}
    />
  );
}
