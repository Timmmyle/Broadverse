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

    const userId = user.id;
    const { gameType, wager } = await req.json(); // gameType: "TIC_TAC_TOE", "CARO" hoặc "BATTLESHIP", wager: 0, 10, 50, 100

    if (!["TIC_TAC_TOE", "CARO", "BATTLESHIP"].includes(gameType)) {
      return NextResponse.json({ error: "Loại game không hợp lệ" }, { status: 400 });
    }

    const numericWager = Number(wager) || 0;

    // Lấy thông tin user hiện tại để kiểm tra coin và level
    const profile = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ người chơi" }, { status: 404 });
    }

    if (profile.coins < numericWager) {
      return NextResponse.json({ error: "Bạn không đủ Coin để tham gia mức cược này" }, { status: 400 });
    }

    const userLevel = profile.level;

    // Chạy Transaction để tránh race condition khi hai người cùng ghép trận một lúc
    const result = await prisma.$transaction(async (tx) => {
      // Tìm đối thủ trong hàng chờ thỏa mãn điều kiện
      // - Cùng loại game
      // - Cùng mức cược
      // - Không phải bản thân
      // - Chênh lệch level tối đa 3 cấp
      const opponent = await tx.matchmakingQueue.findFirst({
        where: {
          gameType,
          wager: numericWager,
          playerId: { not: userId },
          level: {
            gte: userLevel - 3,
            lte: userLevel + 3,
          },
        },
        orderBy: { createdAt: "asc" }, // Ưu tiên người chờ lâu nhất
      });

      if (opponent) {
        // Kiểm tra xem đối thủ còn đủ tiền cược không (đề phòng trường hợp tiêu hết coin khi đang chờ)
        const opponentProfile = await tx.user.findUnique({
          where: { id: opponent.playerId },
        });

        if (!opponentProfile || opponentProfile.coins < numericWager) {
          // Đối thủ không đủ điều kiện cược nữa, xóa hàng chờ của họ và tìm tiếp
          await tx.matchmakingQueue.delete({
            where: { id: opponent.id },
          });
          throw new Error("RETRY_MATCHMAKING"); // Ném lỗi để rollback và client có thể thử lại
        }

        // Xóa đối thủ khỏi hàng chờ
        await tx.matchmakingQueue.delete({
          where: { id: opponent.id },
        });

        // Khóa tiền cược của cả hai người chơi
        if (numericWager > 0) {
          await tx.user.update({
            where: { id: userId },
            data: { coins: { decrement: numericWager } },
          });
          await tx.user.update({
            where: { id: opponent.playerId },
            data: { coins: { decrement: numericWager } },
          });
        }

        // Quyết định ngẫu nhiên ai đi trước (X đi trước, O đi sau)
        const isXFirst = Math.random() > 0.5;
        const playerXId = isXFirst ? opponent.playerId : userId;
        const playerOId = isXFirst ? userId : opponent.playerId;

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

        // Tạo phòng game đấu trực tuyến
        const room = await tx.gameRoom.create({
          data: {
            gameType,
            status: gameType === "BATTLESHIP" ? "WAITING" : "PLAYING",
            playerXId,
            playerOId,
            turnPlayerId: gameType === "BATTLESHIP" ? null : playerXId,
            board: initialBoard,
            wager: numericWager,
          },
        });

        return { matched: true, room };
      } else {
        // Không tìm thấy đối thủ, đưa mình vào hàng chờ
        const queueEntry = await tx.matchmakingQueue.upsert({
          where: { playerId: userId },
          update: {
            gameType,
            level: userLevel,
            wager: numericWager,
            createdAt: new Date(),
          },
          create: {
            playerId: userId,
            gameType,
            level: userLevel,
            wager: numericWager,
          },
        });

        return { matched: false, queueEntry };
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "RETRY_MATCHMAKING") {
      // Gợi ý gọi ghép trận lại (client tự động gọi lại)
      return NextResponse.json({ matched: false, retry: true });
    }
    console.error("Lỗi ghép trận:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
