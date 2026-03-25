import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Scheduling Engine",
    template: "%s — Scheduling Engine",
  },
  description: "Modern AI-native scheduling and room booking platform",
  metadataBase: new URL("https://scheduling-engine-next.vercel.app"),
  openGraph: {
    title: "Scheduling Engine",
    description: "Modern AI-native scheduling and room booking platform",
    siteName: "Scheduling Engine",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Scheduling Engine",
    description: "Modern AI-native scheduling and room booking platform",
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
