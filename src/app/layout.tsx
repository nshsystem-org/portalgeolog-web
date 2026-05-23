import type { Metadata } from "next";
import { Sora, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";

import { FormValidationLocale } from "../components/FormValidationLocale";
import { AuthProvider } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { TrackingProvider } from "@/components/TrackingProvider";
import { Toaster } from "sonner";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portal Geolog | Gestão Logística Inteligente",
  description:
    "Software on-demand para a Transportadora Geolog - Controle de Frota, CRM e OS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="antialiased">
      <body
        className={`${sora.variable} ${spaceGrotesk.variable} ${geistMono.variable} font-sans`}
      >
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
