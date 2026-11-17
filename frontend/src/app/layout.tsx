import type { Metadata } from "next";
import { Fraunces, Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { Providers } from "@/components/providers";
import { themeScript } from "@/lib/theme";
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

const description =
  "Les pensum kapittel for kapittel, marker det viktige, skriv notater og øv med quiz, flashcards og gjenkalling.";

export const metadata: Metadata = {
  // Absolute links for the share image, so previews work in chats and social media
  metadataBase: new URL("https://exam-practice.tobiashammer.dev"),
  title: "Lær for eksamen",
  description,
  openGraph: {
    title: "Øv til eksamen",
    description,
    siteName: "Lær for eksamen",
    locale: "nb_NO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Øv til eksamen",
    description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="nb"
      className={`${brand.variable} ${sans.variable} ${reading.variable} h-full antialiased`}
      // The theme script sets the dark class before React loads
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
