export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Lesbare Schriftfarbe auf einer vollen Kalenderfarbe */
export function textOn(hex: string): string {
  return luminance(hex) > 0.42 ? "#2a1a14" : "#ffffff";
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Mischt eine Farbe mit Schwarz (amount > 0) oder Weiß (amount < 0) */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amount < 0 ? 255 : 0;
  const p = Math.abs(amount);
  const mix = (c: number) => Math.round((t - c) * p + c);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/** Sehr helle Kalenderfarben (z. B. Creme) brauchen einen sichtbaren Rand */
export function needsOutline(hex: string): boolean {
  return luminance(hex) > 0.8;
}

/** Kräftigere Variante für Text/Punkte auf Glas – helle Farben werden abgedunkelt */
export function strong(hex: string, dark = false): string {
  const l = luminance(hex);
  if (dark) return l < 0.12 ? shade(hex, -0.45) : hex;
  if (l > 0.8) return shade(hex, 0.55);
  if (l > 0.45) return shade(hex, 0.3);
  return hex;
}

export const PALETTE = [
  "#D9A282", "#FF9966", "#E46F6F", "#C2477A", "#7F2E2C", "#8064A2", "#5B6CC9",
  "#3D7EBF", "#2E9C8F", "#76923C", "#B8A040", "#E0B040", "#9C7A5B", "#6B7280",
];
