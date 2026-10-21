import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const timeless = localFont({
  variable: "--font-timeless",
  src: [
    { path: "./fonts/TimelessSans-GroteskRegular.woff2", weight: "400" },
    { path: "./fonts/TimelessSans-GroteskMedium.woff2", weight: "500" },
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flowdocs",
  description: "Documents that keep themselves current.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${timeless.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
