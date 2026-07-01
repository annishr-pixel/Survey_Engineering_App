import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Treadlight Solar Survey",
  description: "On-site solar survey capture for TreadLighter survey engineers.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Survey engineers work on phones/tablets on a roof; allow zoom.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
