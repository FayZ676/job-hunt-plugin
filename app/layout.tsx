import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";
import Nav from "@/components/Nav";
import Toaster from "@/components/Toaster";
import { DB } from "@/lib/db";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexCondensed = IBM_Plex_Sans_Condensed({
  variable: "--font-plex-condensed",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Job",
  description: "Your profile, and every job it is being matched against.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en"
          className={`${plexSans.variable} ${plexCondensed.variable} ${plexMono.variable}
            h-full antialiased`}>
      <body className="min-h-full bg-base-200 text-base-content md:flex">
        <a href="#content"
           className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50
             focus:rounded-box focus:bg-base-100 focus:px-3 focus:py-2 focus:text-sm">
          Skip to content
        </a>
        <Nav db={DB} />
        <main id="content" className="min-w-0 flex-1 px-5 py-7 pb-24 md:px-9 md:py-9">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
        <Toaster />
      </body>
    </html>
  );
}
