import { assetUrl } from "@tftvn/core";
import Image from "next/image";
import { cn } from "@/lib/cn";

interface GameIconProps {
  path: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
  eager?: boolean;
}

export function GameIcon({ path, alt, size = 48, className, eager = false }: GameIconProps) {
  const src = assetUrl(path);
  if (!src) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className={cn("inline-block rounded-md bg-surface/10", className)}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      loading={eager ? "eager" : "lazy"}
      className={cn("rounded-md object-cover", className)}
    />
  );
}
