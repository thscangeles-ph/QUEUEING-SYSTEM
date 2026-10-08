import type { Metadata, Viewport } from "next";
import { RegisterServiceWorker } from "@/components/pwa";
import "./globals.css";

export const metadata: Metadata = {
  title: "THSC Queue Board",
  description: "Patient queuing for The Heart Specialists Clinic: front desk, stations, lobby TV and patient check-in.",
  manifest: "/staff.webmanifest",
  appleWebApp: { capable: true, title: "THSC Queue", statusBarStyle: "black" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = { themeColor: "#2f281c" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-PH">
      <body className="antialiased">{children}<RegisterServiceWorker /></body>
    </html>
  );
}
