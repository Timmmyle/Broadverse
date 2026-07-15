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

    const isBauCua = room.gameType === "BAU_CUA";

    // Kiểm tra xem đã có trong phòng chưa
    if (isBauCua) {
      if (room.playerOId === playerId || room.player3Id === playerId || room.player4Id === playerId) {
        return NextResponse.json(room);
      }
      // Nếu phòng đã đầy hoặc không ở trạng thái WAITING
      const isFull = room.playerOId && room.player3Id && room.player4Id;
      if (room.status !== "WAITING" || isFull) {
        return NextResponse.json({ error: "Phòng game này đã đầy hoặc không còn khả dụng" }, { status: 400 });
      }
    } else {
      // Nếu phòng đã đầy hoặc đã kết thúc
      if (room.status !== "WAITING" || room.playerOId) {
        return NextResponse.json({ error: "Phòng game này đã đầy hoặc không còn khả dụng" }, { status: 400 });
      }
    }

    // Kiểm tra số dư coin của người tham gia
    const profile = await prisma.user.findUnique({
      where: { id: playerId },
    });

    if (!profile) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ người chơi" }, { status: 404 });
    }

    if (!isBauCua && profile.eggs < room.wager) {
      return NextResponse.json({ error: "Bạn không đủ Trứng để tham gia mức cược của phòng này" }, { status: 400 });
    }
    if (isBauCua && profile.eggs < 1) {
      return NextResponse.json({ error: "Bạn cần ít nhất 1 Coin để tham gia phòng Bầu Cua" }, { status: 400 });
    }

    // Thực hiện transaction: Khóa eggs người tham gia, gán vào playerO, đổi status thành PLAYING và random lượt đi đầu (nếu không phải Bầu Cua)
    const updatedRoom = await prisma.$transaction(async (tx) => {
      if (!isBauCua && room.wager > 0) {
        await tx.user.update({
          where: { id: playerId },
          data: { eggs: { decrement: room.wager } },
        });
      }

      if (isBauCua) {
        let joinField: "playerOId" | "player3Id" | "player4Id" | null = null;
        if (!room.playerOId) joinField = "playerOId";
        else if (!room.player3Id) joinField = "player3Id";
        else if (!room.player4Id) joinField = "player4Id";

        if (!joinField) {
          throw new Error("ROOM_FULL");
        }

        let boardObj: any = { players: [], status: "WAITING", betLimit: room.wager, bets: {}, dice: [], history: [] };
        try {
          boardObj = JSON.parse(room.board);
        } catch (e) {}

        if (!boardObj.players.some((p: any) => p.id === playerId)) {
          boardObj.players.push({
            id: playerId,
            username: profile.username,
            avatarUrl: profile.avatarUrl,
            ready: false
          });
        }

        return await tx.gameRoom.update({
          where: { id: roomId },
          data: {
            [joinField]: playerId,
            board: JSON.stringify(boardObj)
          },
        });
      } else {
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
      }
    });

    return NextResponse.json(updatedRoom);
  } catch (error: any) {
    console.error("Lỗi tham gia phòng bạn bè:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
