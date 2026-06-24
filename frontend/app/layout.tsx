import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Space_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";

// Tipografia do tema místico:
// - Bricolage Grotesque: títulos e números de destaque (display).
// - Space Grotesk: corpo e interface.
// - Newsreader (itálico): frases da Madame Placar, com ar de oráculo.
const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["italic"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Chute do Vidente 🔮",
  description: "Bolão de palpites da Copa do Mundo 2026 — guiado pela Madame Placar",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0e24",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${bricolage.variable} ${spaceGrotesk.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
