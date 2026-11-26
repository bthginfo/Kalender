import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "Kalender",
  description: "Lenas Kalender – Hochzeiten, Probetermine, Theater & Privates an einem Ort",
  applicationName: "Kalender",
  appleWebApp: { capable: true, title: "Kalender", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4ece6" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0b10" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de">
      <body>
        <div className="backdrop" aria-hidden="true">
          <i /><i /><i /><i />
        </div>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
