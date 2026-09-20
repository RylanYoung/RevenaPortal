import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";

// Sora is the marketing site's typeface, loaded at the same weights it uses.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Revena Portal",
  description: "Lead delivery and quality tracking for Revena Media clients.",
};

/**
 * Sets the theme before the browser paints. Without this the page renders
 * light, then snaps to dark once React hydrates — a visible white flash on
 * every single navigation for anyone using dark mode.
 *
 * Mirrors applyTheme() in components/theme-toggle.tsx; keep them in step.
 */
const NO_FLASH = `(function(){try{
var c=localStorage.getItem('revena-theme')||'light';
var d=c==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):c;
document.documentElement.setAttribute('data-theme',d);
}catch(e){document.documentElement.setAttribute('data-theme','light')}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${sora.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
