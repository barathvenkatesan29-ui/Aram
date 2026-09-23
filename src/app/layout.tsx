import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Aram — Legal information for India",
    template: "%s · Aram",
  },
  description:
    "Aram helps people in India understand a legal problem in plain language and find a safer path toward resolution. Aram provides legal information, not legal representation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-dvh flex-col overflow-hidden bg-stone-50 text-stone-900">
        <SiteHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
