import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Công thức tính thưởng
function calculateReward(outcome: "WIN" | "LOSE", level: number, isPremium: boolean = false) {
  let coins = 0;
  let exp = 0;

  if (outcome === "WIN") {
    coins = 10 + 2 * level;
    exp = 5 + Math.round(level * 0.20);
  } else {
    coins = Math.round(5 + 1.5 * level);
    exp = 2;
  }

  // Áp dụng x2 EXP và 1.5x Coins cho tài khoản Premium (VIP)
  if (isPremium) {
    coins = Math.round(coins * 1.5);
    exp = exp * 2;
  }

  return { coins, exp };
}

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
    const { roomId, action } = await req.json(); // action: "SURRENDER" (tự đầu hàng) hoặc "CLAIM_TIMEOUT" (đối thủ AFK quá lâu)

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
        throw new Error("Trận đấu không ở trạng thái đang chơi");
      }

      const isPlayerX = room.playerXId === playerId;
      const isPlayerO = room.playerOId === playerId;

      if (!isPlayerX && !isPlayerO) {
        throw new Error("Bạn không thuộc phòng đấu này");
      }

      let winnerId = "";
      let loserId = "";

      if (action === "SURRENDER") {
        // Người gọi đầu hàng là người thua
        loserId = playerId;
        winnerId = isPlayerX ? room.playerOId! : room.playerXId;
      } else if (action === "CLAIM_TIMEOUT") {
        // Kiểm tra xem đối thủ có thực sự AFK không? 
        // Ở đây để đơn giản cho client, client sẽ đo lường thời gian không có nước đi (ví dụ: >60 giây kể từ updatedAt của phòng)
        const secondsSinceLastUpdate = (Date.now() - new Date(room.updatedAt).getTime()) / 1000;
        if (secondsSinceLastUpdate < 55) {
          throw new Error("Chưa đủ thời gian 60 giây để xử thua đối thủ");
        }
        // Người gọi yêu cầu xử thắng là người thắng
        winnerId = playerId;
        loserId = isPlayerX ? room.playerOId! : room.playerXId;
      } else {
        throw new Error("Hành động không hợp lệ");
      }

      const winner = winnerId === room.playerXId ? room.playerX : room.playerO!;
      const loser = loserId === room.playerXId ? room.playerX : room.playerO!;

      // Tính thưởng
      const winnerRewards = calculateReward("WIN", winner.level, winner.isPremium);
      const loserRewards = calculateReward("LOSE", loser.level, loser.isPremium);

      const winnerCoinsGained = winnerRewards.coins + room.wager * 2;
      const loserCoinsGained = loserRewards.coins;

      const winnerNewStats = addExpAndCalculateLevel(winner.level, winner.exp, winnerRewards.exp);
      const loserNewStats = addExpAndCalculateLevel(loser.level, loser.exp, loserRewards.exp);

      // Cập nhật người thắng
      await tx.user.update({
        where: { id: winner.id },
        data: {
          coins: { increment: winnerCoinsGained },
          level: winnerNewStats.level,
          exp: winnerNewStats.exp,
        }
      });

      // Cập nhật người thua
      await tx.user.update({
        where: { id: loser.id },
        data: {
          coins: { increment: loserCoinsGained },
          level: loserNewStats.level,
          exp: loserNewStats.exp,
        }
      });

      // Cập nhật trạng thái phòng game
      const updatedRoom = await tx.gameRoom.update({
        where: { id: roomId },
        data: {
          status: "FINISHED",
          winnerId: winner.id,
          turnPlayerId: null,
        }
      });

      return {
        room: updatedRoom,
        finished: true,
        winnerId: winner.id,
        rewards: {
          [winner.id]: { outcome: "WIN", coins: winnerCoinsGained, exp: winnerRewards.exp, levelUp: winnerNewStats.level > winner.level },
          [loser.id]: { outcome: "LOSE", coins: loserCoinsGained, exp: loserRewards.exp, levelUp: loserNewStats.level > loser.level },
        }
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Lỗi xử phạt đầu hàng/AFK:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
