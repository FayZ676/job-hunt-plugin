import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import Toaster from "@/components/Toaster";
import { DB } from "@/lib/db";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Job",
  description: "Your profile, and every job it is being matched against.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-base-200 md:flex">
        <Nav db={DB} />
        <main className="min-w-0 flex-1 px-5 py-8 pb-24 md:px-10">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
