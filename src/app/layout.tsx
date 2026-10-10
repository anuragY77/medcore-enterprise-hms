// Phase 28: must precede every other import (incl. next-auth client) so Zod's
// eval-based JIT probe is skipped under the no-unsafe-eval CSP.
import "@/lib/zod-csp";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "MedCore Premium - Hospital Management System",
  description:
    "Enterprise-grade hospital management system for clinical environments",
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
