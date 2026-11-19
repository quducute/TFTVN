import { textIconUrl } from "@tftvn/core";
import Image from "next/image";
import { cn } from "@/lib/cn";

interface TextIconProps {
  name: string;
  label: string;
  size?: number;
  className?: string;
}

export function TextIcon({ name, label, size = 16, className }: TextIconProps) {
  const src = textIconUrl(name);
  if (!src) {
    return (
      <span className={cn("mx-0.5 rounded bg-surface/10 px-1 text-xs text-muted", className)}>
        {label}
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt={label}
      title={label}
      width={size}
      height={size}
      unoptimized
      className={cn("mx-0.5 inline-block align-text-bottom", className)}
    />
  );
}
