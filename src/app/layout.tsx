import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { AlertProvider } from "@/components/providers/AlertProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vuiga.com - Đấu Trí Trại Gà Vui Vẻ",
  description: "Hành trình từ Quả Trứng 🥚 đến Phượng Hoàng Lửa 🔥 - Hệ thống Tiến trình & Xếp hạng Boardgame Kê Vương.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="font-sans bg-[#141412] text-[#F3E5AB] min-h-full flex flex-col selection:bg-[#D4AF37] selection:text-black">
        <AlertProvider>
          <AuthProvider>{children}</AuthProvider>
        </AlertProvider>
      </body>
    </html>
  );
}
