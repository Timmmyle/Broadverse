import type { Metadata } from "next";
import { Quicksand } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";

const quicksand = Quicksand({
  weight: ["400", "500", "600", "700"],
  variable: "--font-quicksand",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "Boardverse - Play Tic-Tac-Toe & Caro Online",
  description: "Trải nghiệm Tic-Tac-Toe và Caro trực tuyến với giao diện hiện đại, mượt mà!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${quicksand.variable} h-full antialiased`}>
      <body className="font-quicksand bg-[#0c0c0e] text-white min-h-full flex flex-col selection:bg-yellow-400 selection:text-black">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
