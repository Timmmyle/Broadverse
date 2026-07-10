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

    const playerId = user.id;
    const { roomId } = await req.json();

    const room = await prisma.gameRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return NextResponse.json({ error: "Không tìm thấy phòng game này" }, { status: 404 });
    }

    // Nếu người chơi chính là người tạo phòng, trả về phòng luôn
    if (room.playerXId === playerId) {
      return NextResponse.json(room);
    }

    // Nếu phòng đã đầy hoặc đã kết thúc
    if (room.status !== "WAITING" || room.playerOId) {
      return NextResponse.json({ error: "Phòng game này đã đầy hoặc không còn khả dụng" }, { status: 400 });
    }

    // Kiểm tra số dư coin của người tham gia
    const profile = await prisma.user.findUnique({
      where: { id: playerId },
    });

    if (!profile || profile.eggs < room.wager) {
      return NextResponse.json({ error: "Bạn không đủ Trứng để tham gia mức cược của phòng này" }, { status: 400 });
    }

    // Thực hiện transaction: Khóa eggs người tham gia, gán vào playerO, đổi status thành PLAYING và random lượt đi đầu
    const updatedRoom = await prisma.$transaction(async (tx) => {
      if (room.wager > 0) {
        await tx.user.update({
          where: { id: playerId },
          data: { eggs: { decrement: room.wager } },
        });
      }

      const isXFirst = Math.random() > 0.5;
      const startingPlayerId = isXFirst ? room.playerXId : playerId;

      return await tx.gameRoom.update({
        where: { id: roomId },
        data: {
          playerOId: playerId,
          status: "PLAYING",
          turnPlayerId: startingPlayerId,
        },
      });
    });

    return NextResponse.json(updatedRoom);
  } catch (error: any) {
    console.error("Lỗi tham gia phòng bạn bè:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
