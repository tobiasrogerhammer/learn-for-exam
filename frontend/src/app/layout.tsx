import type { Metadata } from "next";
import { Fraunces, Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const brand = Fraunces({
  variable: "--font-brand",
  subsets: ["latin"],
  display: "swap",
});

const sans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const reading = Source_Serif_4({
  variable: "--font-reading",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lær for eksamen",
  description:
    "Øv til eksamen per emne: lytt til pensum med norsk tale, og øv med flashcards, quiz og gjenkalling.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="nb"
      className={`${brand.variable} ${sans.variable} ${reading.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
