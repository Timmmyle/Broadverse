import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Lấy top 10 người chơi có cấp độ cao nhất
    const topPlayers = await prisma.user.findMany({
      take: 10,
      orderBy: [
        { level: "desc" },
        { exp: "desc" },
        { coins: "desc" }
      ],
      select: {
        id: true,
        username: true,
        level: true,
        exp: true,
        coins: true,
        avatarFrame: true,
        isGuest: true,
        isPremium: true
      }
    });

    return NextResponse.json({ leaderboard: topPlayers });
  } catch (error: any) {
    console.error("Lỗi lấy bảng xếp hạng:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
