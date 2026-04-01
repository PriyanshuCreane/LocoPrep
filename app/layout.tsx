import type { Metadata } from "next";
import { Caveat, IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const geistSans = Space_Grotesk({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = IBM_Plex_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const accentScript = Caveat({
  variable: "--font-accent",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "LocoPrep",
  description: "A modern language learning cockpit for local video courses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${accentScript.variable} min-h-screen antialiased`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

