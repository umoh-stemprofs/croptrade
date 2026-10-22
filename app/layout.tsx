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
        {/* Fonts + icons exactly as every Stitch prototype page loads them. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-surface text-on-surface font-body-md text-body-md antialiased selection:bg-primary selection:text-on-primary">
        {children}
      </body>
    </html>
  );
}
