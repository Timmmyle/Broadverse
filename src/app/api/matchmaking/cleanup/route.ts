import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  // Bảo mật cron-job bằng CRON_SECRET nếu được cấu hình
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Xóa các hàng chờ ghép trận có tuổi thọ lớn hơn 2 phút
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    
    const result = await prisma.matchmakingQueue.deleteMany({
      where: {
        createdAt: {
          lt: twoMinutesAgo,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã dọn dẹp ${result.count} hàng chờ ghép trận hết hạn.`,
    });
  } catch (error: any) {
    console.error("Lỗi dọn dẹp hàng chờ matchmaking:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
