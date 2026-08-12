import type { Metadata } from "next";
import "./globals.css";

import { Inter, Space_Grotesk, Geist_Mono } from "next/font/google";

import { FormValidationLocale } from "../components/FormValidationLocale";
import { AuthProvider } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { TrackingProvider } from "@/components/TrackingProvider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Portal Geolog | Gestão Logística Inteligente",
  description:
    "Software on-demand para a Transportadora Geolog - Controle de Frota, CRM e OS.",
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} antialiased`}
    >
      <body className="font-sans">
        <AuthProvider>
          <DataProvider>
            <TrackingProvider>
              <FormValidationLocale />
              {children}
              <Toaster position="top-right" richColors />
            </TrackingProvider>
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
