import { Space_Grotesk, Sora } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const metadata = {
  title: "Nudge | Disaster Intelligence Ingestion",
  description: "Pseudo social media ingestion layer for disaster intelligence workflows.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full font-[family-name:var(--font-space-grotesk)]">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
