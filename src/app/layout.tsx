import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { isPilot, PILOT_BRAND } from "@/lib/pilot";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const brandName = isPilot ? PILOT_BRAND : "Scheduling Engine";
const brandDescription = isPilot
  ? "A measured, transparent way to share faculty office space"
  : "Modern AI-native scheduling and room booking platform";

export const metadata: Metadata = {
  title: {
    default: brandName,
    template: `%s — ${brandName}`,
  },
  description: brandDescription,
  metadataBase: new URL("https://scheduling-engine-next.vercel.app"),
  openGraph: {
    title: brandName,
    description: brandDescription,
    siteName: brandName,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: brandName,
    description: brandDescription,
  },
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="h-full bg-slate-50 text-slate-900 font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
