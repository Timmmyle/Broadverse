import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { decryptShips } from "@/lib/gameLogic";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json({ error: "Thiếu roomId" }, { status: 400 });
    }

    const room = await prisma.gameRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return NextResponse.json({ error: "Không tìm thấy phòng" }, { status: 404 });
    }

    const isPlayerX = user.id === room.playerXId;
    const isPlayerO = user.id === room.playerOId;

    if (!isPlayerX && !isPlayerO) {
      return NextResponse.json({ error: "Bạn không tham gia phòng này" }, { status: 403 });
    }

    const boardObj = JSON.parse(room.board);
    const encryptedShips = isPlayerX ? boardObj.shipsX : boardObj.shipsO;

    if (!encryptedShips) {
      return NextResponse.json({ ships: null });
    }

    const ships = decryptShips(encryptedShips);
    return NextResponse.json({ ships });
  } catch (error: any) {
    console.error("Lỗi lấy thông tin tàu:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
