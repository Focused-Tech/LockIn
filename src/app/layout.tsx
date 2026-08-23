import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaSetup } from "@/components/pwa/PwaSetup";
import { BootSplash } from "@/components/splash/BootSplash";
import { ACCENT_VARIANT } from "@/lib/theme";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: "LockIn — Your call. Your cash.",
  description:
    "Here you play against people, not a house. Being right gets you paid. Being fast decides how much.",
  applicationName: "LockIn",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LockIn",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0D12",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-accent={ACCENT_VARIANT}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <BootSplash />
        <PwaSetup />
      </body>
    </html>
  );
}
