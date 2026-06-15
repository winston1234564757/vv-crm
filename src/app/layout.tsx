import type { Metadata, Viewport } from "next";
import { Readex_Pro } from "next/font/google";
import "./globals.css";

const readex = Readex_Pro({
  variable: "--font-readex",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className={`${readex.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
