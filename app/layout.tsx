import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CropTrade",
  description: "What is my crop worth abroad?",
};

/**
 * Applied before first paint so a dark-mode user never sees a white flash.
 * Mirrors components/ThemeToggle.tsx: an explicit choice wins, otherwise the OS
 * preference decides. Kept inline (not a module) because it must run in <head>.
 */
const themeScript = `(function(){try{var s=localStorage.getItem("croptrade-theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
