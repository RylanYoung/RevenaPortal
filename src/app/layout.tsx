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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sora.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
