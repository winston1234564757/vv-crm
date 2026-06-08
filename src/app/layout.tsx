import type { Metadata } from "next";
import { Readex_Pro } from "next/font/google";
import "./globals.css";

const readex = Readex_Pro({
  variable: "--font-readex",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "VV CRM — Майстерня",
  description: "Внутрішня система продажу електроніки та управління ремонтами",
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
