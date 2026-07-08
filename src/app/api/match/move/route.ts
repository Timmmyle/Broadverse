import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { checkTicTacToeWin, checkCaroWin } from "@/lib/gameLogic";

// Công thức tính thưởng
function calculateReward(outcome: "WIN" | "LOSE" | "DRAW", level: number) {
  if (outcome === "WIN") {
    return {
      coins: 10 + 2 * level,
      exp: 5 + Math.round(level * 0.20),
    };
  } else {
    // LOSE hoặc DRAW
    return {
      coins: Math.round(5 + 1.5 * level),
      exp: 2,
    };
  }
}

// Logic nâng cấp độ (Level up)
function addExpAndCalculateLevel(currentLevel: number, currentExp: number, expGained: number) {
  let level = currentLevel;
  let exp = currentExp + expGained;

  while (exp >= 100 + level * 5) {
    exp -= (100 + level * 5);
    level += 1;
  }

  return { level, exp };
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const playerId = user.id;
    const { roomId, position } = await req.json();

    if (position === undefined || position === null) {
      return NextResponse.json({ error: "Vị trí đánh cờ không được để trống" }, { status: 400 });
    }

    const pos = Number(position);

    // Chạy Transaction để khóa phòng và cập nhật nước đi
    const result = await prisma.$transaction(async (tx) => {
      const room = await tx.gameRoom.findUnique({
        where: { id: roomId },
        include: {
          playerX: true,
          playerO: true,
        }
      });

      if (!room) {
        throw new Error("Phòng game không tồn tại");
      }

      if (room.status !== "PLAYING") {
        throw new Error("Trận đấu đã kết thúc hoặc chưa sẵn sàng");
      }

      if (room.turnPlayerId !== playerId) {
        throw new Error("Chưa đến lượt đi của bạn");
      }

      const board: string[] = JSON.parse(room.board);
      const boardSize = room.gameType === "TIC_TAC_TOE" ? 9 : 144;

      if (pos < 0 || pos >= boardSize) {
        throw new Error("Vị trí đánh cờ vượt quá giới hạn bàn cờ");
      }

      if (board[pos] !== "") {
        throw new Error("Vị trí này đã được đánh trước đó");
      }

      // Xác định quân cờ (X hay O) của người chơi hiện tại
      const symbol = playerId === room.playerXId ? "X" : "O";
      board[pos] = symbol;

      // Kiểm tra thắng cuộc
      let hasWon = false;
      if (room.gameType === "TIC_TAC_TOE") {
        hasWon = checkTicTacToeWin(board);
      } else {
        hasWon = checkCaroWin(board, pos, symbol);
      }

      // Kiểm tra hòa cuộc (Draw - hết ô trống)
      const isDraw = !hasWon && board.every((cell) => cell !== "");

      // Cập nhật trạng thái bàn cờ
      const updatedBoardStr = JSON.stringify(board);

      if (hasWon) {
        // --- Xử lý người chơi thắng cuộc và thua cuộc ---
        const winner = playerId === room.playerXId ? room.playerX : room.playerO!;
        const loser = playerId === room.playerXId ? room.playerO! : room.playerX;

        // Tính toán thưởng
        const winnerRewards = calculateReward("WIN", winner.level);
        const loserRewards = calculateReward("LOSE", loser.level);

        // Cộng cược cho người thắng (nhận lại cược của mình + cược đối thủ)
        const winnerCoinsGained = winnerRewards.coins + room.wager * 2;
        const loserCoinsGained = loserRewards.coins; // Thua chỉ nhận coin cơ bản, mất cược đã trừ trước đó

        // Nâng cấp level
        const winnerNewStats = addExpAndCalculateLevel(winner.level, winner.exp, winnerRewards.exp);
        const loserNewStats = addExpAndCalculateLevel(loser.level, loser.exp, loserRewards.exp);

        // Cập nhật Database cho người thắng
        await tx.user.update({
          where: { id: winner.id },
          data: {
            coins: { increment: winnerCoinsGained },
            level: winnerNewStats.level,
            exp: winnerNewStats.exp,
          }
        });

        // Cập nhật Database cho người thua
        await tx.user.update({
          where: { id: loser.id },
          data: {
            coins: { increment: loserCoinsGained },
            level: loserNewStats.level,
            exp: loserNewStats.exp,
          }
        });

        // Cập nhật phòng đấu thành kết thúc
        const updatedRoom = await tx.gameRoom.update({
          where: { id: roomId },
          data: {
            board: updatedBoardStr,
            status: "FINISHED",
            winnerId: winner.id,
            turnPlayerId: null,
          }
        });

        return {
          room: updatedRoom,
          finished: true,
          winnerId: winner.id,
          wager: room.wager,
          rewards: {
            [winner.id]: { outcome: "WIN", coins: winnerCoinsGained, exp: winnerRewards.exp, levelUp: winnerNewStats.level > winner.level },
            [loser.id]: { outcome: "LOSE", coins: loserCoinsGained, exp: loserRewards.exp, levelUp: loserNewStats.level > loser.level },
          }
        };

      } else if (isDraw) {
        // --- Xử lý hòa cuộc ---
        const playerX = room.playerX;
        const playerO = room.playerO!;

        const rewardsX = calculateReward("DRAW", playerX.level);
        const rewardsO = calculateReward("DRAW", playerO.level);

        // Trả lại cược
        const coinsGainedX = rewardsX.coins + room.wager;
        const coinsGainedO = rewardsO.coins + room.wager;

        const newStatsX = addExpAndCalculateLevel(playerX.level, playerX.exp, rewardsX.exp);
        const newStatsO = addExpAndCalculateLevel(playerO.level, playerO.exp, rewardsO.exp);

        await tx.user.update({
          where: { id: playerX.id },
          data: {
            coins: { increment: coinsGainedX },
            level: newStatsX.level,
            exp: newStatsX.exp,
          }
        });

        await tx.user.update({
          where: { id: playerO.id },
          data: {
            coins: { increment: coinsGainedO },
            level: newStatsO.level,
            exp: newStatsO.exp,
          }
        });

        const updatedRoom = await tx.gameRoom.update({
          where: { id: roomId },
          data: {
            board: updatedBoardStr,
            status: "FINISHED",
            draw: true,
            turnPlayerId: null,
          }
        });

        return {
          room: updatedRoom,
          finished: true,
          draw: true,
          wager: room.wager,
          rewards: {
            [playerX.id]: { outcome: "DRAW", coins: coinsGainedX, exp: rewardsX.exp, levelUp: newStatsX.level > playerX.level },
            [playerO.id]: { outcome: "DRAW", coins: coinsGainedO, exp: rewardsO.exp, levelUp: newStatsO.level > playerO.level },
          }
        };

      } else {
        // --- Tiếp tục trận đấu, chuyển lượt ---
        const nextTurnPlayerId = playerId === room.playerXId ? room.playerOId! : room.playerXId;

        const updatedRoom = await tx.gameRoom.update({
          where: { id: roomId },
          data: {
            board: updatedBoardStr,
            turnPlayerId: nextTurnPlayerId,
          }
        });

        return {
          room: updatedRoom,
          finished: false,
        };
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Lỗi đi nước cờ:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
