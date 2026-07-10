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

    // Query finished game rooms where user was playerX or playerO
    const matches = await prisma.gameRoom.findMany({
      where: {
        status: "FINISHED",
        OR: [
          { playerXId: user.id },
          { playerOId: user.id }
        ]
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 10,
      include: {
        playerX: {
          select: { username: true, id: true }
        },
        playerO: {
          select: { username: true, id: true }
        }
      }
    });

    return NextResponse.json({ matches });
  } catch (error: any) {
    console.error("Lỗi lấy lịch sử đấu:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
