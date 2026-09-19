import type { Metadata } from "next";
import { Crimson_Text, Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { TopBar, BottomNav } from "@/components/shell/top-bar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const crimson = Crimson_Text({
  variable: "--font-crimson",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hedge Vault",
  description: "Managed hedge vaults on Solana",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${crimson.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans pb-20 sm:pb-0">
        <Providers>
          <TopBar />
          {children}
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
