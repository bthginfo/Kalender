// Darstellung: "system" folgt dem iPhone (Hell/Dunkel bzw. "Automatisch" nach Tageszeit),
// "light"/"dark" erzwingen eine Variante. Gespeichert pro Gerät.

export type ThemePref = "system" | "light" | "dark";

export const THEME_KEY = "mk_theme";
export const THEME_EVENT = "mk-theme";
export const THEME_COLORS = { light: "#f4ece6", dark: "#0e0b10" } as const;

/** Wird im <head> vor dem ersten Rendern ausgeführt (kein Aufblitzen der falschen Farben) */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.content=t==="dark"?"${THEME_COLORS.dark}":"${THEME_COLORS.light}"})}}catch(e){}`;

export function getThemePref(): ThemePref {
  if (typeof window === "undefined") return "system";
  const t = localStorage.getItem(THEME_KEY);
  return t === "light" || t === "dark" ? t : "system";
}

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") delete root.dataset.theme;
  else root.dataset.theme = pref;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const media = m.getAttribute("media") ?? "";
    m.content = pref === "system"
      ? (media.includes("dark") ? THEME_COLORS.dark : THEME_COLORS.light)
      : THEME_COLORS[pref];
  });
}

export function setThemePref(pref: ThemePref) {
  if (pref === "system") localStorage.removeItem(THEME_KEY);
  else localStorage.setItem(THEME_KEY, pref);
  applyTheme(pref);
  window.dispatchEvent(new Event(THEME_EVENT));
}
