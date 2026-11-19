"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "./auth-provider";

export function ViewerSync({ serverUserId }: Readonly<{ serverUserId: number | null }>) {
  const { user, status } = useAuth();
  const router = useRouter();
  const refreshedFor = useRef<string | null>(null);

  useEffect(() => {
    if (status === "loading") {
      return;
    }
    const clientUserId = user?.id ?? null;
    const key = `${serverUserId}:${clientUserId}`;
    if (clientUserId !== serverUserId && refreshedFor.current !== key) {
      refreshedFor.current = key;
      router.refresh();
    }
  }, [router, serverUserId, status, user]);

  return null;
}
