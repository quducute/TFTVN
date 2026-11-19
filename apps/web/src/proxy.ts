import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { isInvalidAppPath, localeOfPath, stripLocale } from "./lib/route-guard";

const intl = createMiddleware(routing);

const NOT_FOUND_SEGMENT = "__not_found__";

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isInvalidAppPath(stripLocale(pathname, routing.locales))) {
    const locale = localeOfPath(pathname, routing.locales, routing.defaultLocale);
    return NextResponse.rewrite(new URL(`/${locale}/${NOT_FOUND_SEGMENT}`, request.url));
  }
  return intl(request);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\.(?:ico|png|jpg|jpeg|svg|webp|txt|xml|json|webmanifest)$).*)",
};
