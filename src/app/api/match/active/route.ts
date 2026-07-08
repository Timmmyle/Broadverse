import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Tìm kiếm phòng game đang chơi (PLAYING) của người dùng hiện tại
    const activeRoom = await prisma.gameRoom.findFirst({
      where: {
        status: "PLAYING",
        OR: [
          { playerXId: user.id },
          { playerOId: user.id }
        ]
      },
      orderBy: { updatedAt: "desc" } // Lấy phòng cờ mới nhất nếu có nhiều phòng
    });

    return NextResponse.json({ room: activeRoom });
  } catch (error: any) {
    console.error("Lỗi lấy trận đấu đang hoạt động:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
