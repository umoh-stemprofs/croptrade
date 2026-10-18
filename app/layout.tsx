import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CropTrade",
  description: "What is my crop worth abroad?",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
