// Erzeugt die App-Icons aus einem SVG.  Aufruf: node scripts/icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const svg = (pad = 0, rounded = true) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7b79d"/>
      <stop offset="0.55" stop-color="#d9775c"/>
      <stop offset="1" stop-color="#9c4a6e"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.25" cy="0.15" r="0.9">
      <stop offset="0" stop-color="#fff" stop-opacity="0.55"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.96"/>
      <stop offset="1" stop-color="#fff6f1" stop-opacity="0.88"/>
    </linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#6b2133" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 114 : 0}" fill="url(#bg)"/>
  <rect width="512" height="512" rx="${rounded ? 114 : 0}" fill="url(#glow)"/>
  <g transform="translate(${256 - (256 - pad) * 0.62} ${256 - (256 - pad) * 0.58}) scale(${((256 - pad) / 256) * 0.62})" filter="url(#sh)">
    <rect x="0" y="40" width="512" height="440" rx="88" fill="url(#card)"/>
    <path d="M0 128a88 88 0 0 1 88-88h336a88 88 0 0 1 88 88v28H0z" fill="#c0654b"/>
    <rect x="118" y="0" width="40" height="96" rx="20" fill="#fff"/>
    <rect x="354" y="0" width="40" height="96" rx="20" fill="#fff"/>
    <g fill="#e3a58e">
      <circle cx="112" cy="236" r="26"/><circle cx="212" cy="236" r="26"/><circle cx="312" cy="236" r="26"/><circle cx="412" cy="236" r="26"/>
      <circle cx="112" cy="332" r="26"/><circle cx="212" cy="332" r="26"/><circle cx="412" cy="332" r="26"/>
      <circle cx="112" cy="420" r="26"/><circle cx="212" cy="420" r="26"/><circle cx="312" cy="420" r="26"/>
    </g>
    <path d="M312 374c-30-20-52-38-52-62 0-16 12-28 27-28 11 0 20 6 25 15 5-9 14-15 25-15 15 0 27 12 27 28 0 24-22 42-52 62z" fill="#c0654b"/>
  </g>
</svg>`;

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon.svg", svg());
const out = [
  ["icon-192.png", 192, svg()],
  ["icon-512.png", 512, svg()],
  ["apple-touch-icon.png", 180, svg(0, false)],
  ["icon-maskable-512.png", 512, svg(70, false)],
];
for (const [name, size, src] of out) {
  await sharp(Buffer.from(src)).resize(size, size).png().toFile(`public/icons/${name}`);
}
await sharp(Buffer.from(svg())).resize(48, 48).png().toFile("app/icon.png");
console.log("Icons erzeugt");
