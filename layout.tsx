import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DB Abfahrten Dashboard",
  description: "Deutsche Bahn Timetables + Supabase",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-zinc-100 text-zinc-900 antialiased">{children}</body>
    </html>
  );
}
