import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";
import Nav from "@/components/Nav";
import Toaster from "@/components/Toaster";
import { DB } from "@/lib/core/db";
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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexCondensed.variable} ${plexMono.variable}
            h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t==="readout"||t==="night")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full bg-base-200 text-base-content">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50
             focus:rounded-box focus:bg-base-100 focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <Nav db={DB} />
        <main id="content" className="mx-auto min-w-0 max-w-[104rem] px-4 py-7 pb-24 md:px-6">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
