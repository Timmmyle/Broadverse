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

    const creatorId = user.id;
    const { gameType, wager } = await req.json();

    if (!["TIC_TAC_TOE", "CARO", "BATTLESHIP"].includes(gameType)) {
      return NextResponse.json({ error: "Loại game không hợp lệ" }, { status: 400 });
    }

    const numericWager = Number(wager) || 0;

    // Kiểm tra số dư coin của người tạo phòng
    const profile = await prisma.user.findUnique({
      where: { id: creatorId },
    });

    if (!profile || profile.eggs < numericWager) {
      return NextResponse.json({ error: "Bạn không đủ Trứng để thiết lập mức cược này" }, { status: 400 });
    }

    let initialBoard = "";
    if (gameType === "BATTLESHIP") {
      initialBoard = JSON.stringify({
        phase: "PLACEMENT",
        shipsX: "",
        shipsO: "",
        readyX: false,
        readyO: false,
        shotsX: [],
        shotsO: [],
        sunkX: [],
        sunkO: [],
        clusterChargeX: 0,
        clusterChargeO: 0,
        crossChargeX: 0,
        crossChargeO: 0,
        radarX: 1,
        radarO: 1,
        radarResultsX: [],
        radarResultsO: []
      });
    } else {
      const boardSize = gameType === "TIC_TAC_TOE" ? 9 : 144;
      initialBoard = JSON.stringify(Array(boardSize).fill(""));
    }

    // Thực hiện trong Transaction: Khóa eggs và tạo phòng
    const room = await prisma.$transaction(async (tx) => {
      if (numericWager > 0) {
        await tx.user.update({
          where: { id: creatorId },
          data: { eggs: { decrement: numericWager } },
        });
      }

      return await tx.gameRoom.create({
        data: {
          gameType,
          status: "WAITING",
          playerXId: creatorId,
          playerOId: null, // Sẽ điền khi bạn bè join vào
          board: initialBoard,
          wager: numericWager,
          turnPlayerId: null, // Chưa quyết định ai đi trước
        },
      });
    });

    return NextResponse.json(room);
  } catch (error: any) {
    console.error("Lỗi tạo phòng đấu với bạn bè:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
