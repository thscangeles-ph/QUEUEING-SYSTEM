import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "THSC Patient Queue",
  description: "Patient queuing for Clinic 1, Clinic 2 and Clinic 3 at The Heart Specialists Clinic, with a waiting-room display.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-PH">
      <body className="antialiased">{children}</body>
    </html>
  );
}
