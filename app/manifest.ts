import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Lenas Kalender",
    short_name: "Kalender",
    description: "Hochzeiten, Probetermine, Theater & Privates an einem Ort",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4ece6",
    theme_color: "#f4ece6",
    lang: "de",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Neuer Termin", short_name: "Neu", url: "/?new=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Liste", short_name: "Liste", url: "/?view=agenda", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
