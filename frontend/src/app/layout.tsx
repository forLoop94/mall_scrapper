import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Promotions Aggregator",
  description: "Browse promotions from The Promenade Shops at Briargate",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
