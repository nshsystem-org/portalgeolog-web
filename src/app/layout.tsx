import type { Metadata } from "next";
import "./globals.css";

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

const fontLink =
  "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=Geist+Mono:wght@100..900&display=swap";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={fontLink} />
      </head>
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
