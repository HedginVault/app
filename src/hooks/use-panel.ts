"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { parsePanel, serializePanel, type PanelState } from "@/lib/panel-params";

/** The manager action panel's state, stored in the URL so it survives refresh and can be shared. */
export function usePanel() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = search.toString();
  const state = useMemo(() => parsePanel(new URLSearchParams(query)), [query]);
  const replace = useCallback(
    (s: PanelState) => router.replace(`${pathname}?${serializePanel(s, new URLSearchParams(query))}`, { scroll: false }),
    [router, pathname, query],
  );
  return { state, replace };
}
