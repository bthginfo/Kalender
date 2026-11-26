"use client";

import { useSyncExternalStore } from "react";
import { getThemePref, THEME_EVENT, type ThemePref } from "@/lib/theme";

const query = "(prefers-color-scheme: dark)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", cb);
  window.addEventListener(THEME_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener(THEME_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Ist gerade die dunkle Darstellung aktiv? (eigene Wahl oder iPhone-Einstellung) */
export function useDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      const pref = getThemePref();
      return pref === "dark" || (pref === "system" && window.matchMedia(query).matches);
    },
    () => false,
  );
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, getThemePref, () => "system" as ThemePref);
}

export function useMedia(q: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(q);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(q).matches,
    () => false,
  );
}
