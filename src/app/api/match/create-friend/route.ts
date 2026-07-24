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

    if (!["TIC_TAC_TOE", "CARO", "BATTLESHIP", "BAU_CUA", "O_AN_QUAN"].includes(gameType)) {
      return NextResponse.json({ error: "Loại game không hợp lệ" }, { status: 400 });
    }

    const numericWager = Number(wager) || 0;

    // Kiểm tra số dư coin của người tạo phòng
    const profile = await prisma.user.findUnique({
      where: { id: creatorId },
    });

    if (!profile || (gameType !== "BAU_CUA" && profile.eggs < numericWager)) {
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
    } else if (gameType === "BAU_CUA") {
      initialBoard = JSON.stringify({
        players: [
          {
            id: creatorId,
            username: profile.username,
            avatarUrl: profile.avatarUrl,
            ready: false
          }
        ],
        status: "WAITING",
        betLimit: numericWager,
        bets: {},
        dice: [],
        history: []
      });
    } else if (gameType === "O_AN_QUAN") {
      const { createInitialGameState } = await import("@/lib/oAnQuanEngine");
      initialBoard = JSON.stringify(createInitialGameState());
    } else {
      const boardSize = gameType === "TIC_TAC_TOE" ? 9 : 144;
      initialBoard = JSON.stringify(Array(boardSize).fill(""));
    }

    // Thực hiện trong Transaction: Khóa eggs (nếu không phải Bầu Cua) và tạo phòng
    const room = await prisma.$transaction(async (tx) => {
      if (numericWager > 0 && gameType !== "BAU_CUA") {
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
