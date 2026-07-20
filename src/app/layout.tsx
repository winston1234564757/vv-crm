import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

// Body / UI — humanist-neutral grotesk, carries labels, tables, forms, data
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

// Display — geometric grotesk for headings and KPI numbers only
const space = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  themeColor: "#fafbfc",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "VV CRM — Майстерня",
  description: "Внутрішня система продажу електроніки та управління ремонтами",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VV CRM",
  },
  formatDetection: {
    telephone: false,
  },
};

import { QueryProvider } from "@/providers/QueryProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className={`${hanken.variable} ${space.variable} h-full antialiased`}>
      <body className="min-h-full">
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
