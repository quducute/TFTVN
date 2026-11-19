"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { LIBRARY_SECTIONS, libraryPath } from "@/lib/library-paths";

export function LibraryNav({ set }: { set: number }) {
  const t = useTranslations("library.sections");
  const active = useSelectedLayoutSegment();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line/10">
      {LIBRARY_SECTIONS.map((section) => (
        <Link
          key={section}
          href={libraryPath.section(set, section)}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap",
            active === section
              ? "border-primary font-semibold text-primary"
              : "border-transparent text-muted hover:text-text",
          )}
        >
          {t(section)}
        </Link>
      ))}
    </nav>
  );
}
