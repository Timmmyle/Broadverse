import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameType, wager } = await req.json();
    const userId = user.id;

    // Tìm tổ đội mà user làm Leader
    const party = await prisma.party.findUnique({
      where: { leaderId: userId }
    });

    if (!party) {
      return NextResponse.json({ error: "Chỉ trưởng nhóm mới có quyền thay đổi cấu hình tổ đội" }, { status: 403 });
    }

    const updated = await prisma.party.update({
      where: { id: party.id },
      data: {
        gameType: gameType !== undefined ? gameType : party.gameType,
        wager: wager !== undefined ? Number(wager) : party.wager
      }
    });

    return NextResponse.json({ success: true, party: updated });
  } catch (error: any) {
    console.error("Lỗi thay đổi cấu hình tổ đội:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
