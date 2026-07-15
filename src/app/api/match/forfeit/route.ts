import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { addExp, calculateElo, addBattlePassExp, DailyMission, calculateRankUpdate } from "@/lib/progression";

// Công thức tính thưởng
function calculateReward(outcome: "WIN" | "LOSE", level: number, isPremium: boolean = false, wager: number = 0, isBot: boolean = false) {
  if (isBot) {
    return { coins: 0, exp: 0 };
  }

  let coins = 0;
  let exp = 0;

  if (outcome === "WIN") {
    coins = 20 + 2 * level;
    exp = 350 + 10 * level;
  } else {
    coins = Math.round(10 + 1 * level);
    exp = 120 + 5 * level;
  }

  // Áp dụng x2 EXP và 1.5x Coins cho tài khoản Premium (VIP)
  if (isPremium) {
    coins = Math.round(coins * 1.5);
    exp = exp * 2;
  }

  if (wager === 0) {
    coins = 0;
  }

  return { coins, exp };
}

// Cập nhật tiến trình nhiệm vụ
function updatePlayerMissions(missionsJson: string, gameType: string, actionType: "WIN_GAME" | "PLAY_GAME", amount = 1) {
  if (!missionsJson || missionsJson === "[]") return missionsJson;
  try {
    const missions: DailyMission[] = JSON.parse(missionsJson);
    let updated = false;
    for (const m of missions) {
      if (m.claimed) continue;
      if (m.type === actionType && (!m.gameType || m.gameType === gameType)) {
        m.progress = Math.min(m.target, m.progress + amount);
        updated = true;
      }
    }
    return JSON.stringify(missions);
  } catch (e) {
    console.error(e);
    return missionsJson;
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const playerId = user.id;
    const { roomId, action } = await req.json(); // action: "SURRENDER" hoặc "CLAIM_TIMEOUT"

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
        loserId = playerId;
        winnerId = isPlayerX ? room.playerOId! : room.playerXId;
      } else if (action === "CLAIM_TIMEOUT") {
        const secondsSinceLastUpdate = (Date.now() - new Date(room.updatedAt).getTime()) / 1000;
        if (secondsSinceLastUpdate < 55) {
          throw new Error("Chưa đủ thời gian 60 giây để xử thua đối thủ");
        }
        winnerId = playerId;
        loserId = isPlayerX ? room.playerOId! : room.playerXId;
      } else {
        throw new Error("Hành động không hợp lệ");
      }

      const winner = winnerId === room.playerXId ? room.playerX : room.playerO!;
      const loser = loserId === room.playerXId ? room.playerX : room.playerO!;

      // Tính thưởng
      const winnerRewards = calculateReward("WIN", winner.level, winner.isPremium, room.wager, room.playerOId === "bot");
      const loserRewards = calculateReward("LOSE", loser.level, loser.isPremium, room.wager, room.playerOId === "bot");

      const winnerCoinsGained = room.wager === 0 ? 0 : (winnerRewards.coins + room.wager * 2);
      const loserCoinsGained = room.wager === 0 ? 0 : loserRewards.coins;

      // Cộng EXP mới
      const winnerNewStats = addExp(winner.level, winner.exp, winnerRewards.exp);
      const loserNewStats = addExp(loser.level, loser.exp, loserRewards.exp);

      // Cập nhật Elo cho game tương ứng
      const isGomoku = room.gameType === "CARO";
      const isBattleship = room.gameType === "BATTLESHIP";
      
      let winnerElo = 1000;
      let loserElo = 1000;
      let eloField = "";

      let tierField = "rankTierTicTacToe";
      let divisionField = "rankDivisionTicTacToe";
      let pointsField = "rankPointsTicTacToe";

      if (isGomoku) {
        winnerElo = winner.eloGomoku;
        loserElo = loser.eloGomoku;
        eloField = "eloGomoku";
        tierField = "rankTierCaro";
        divisionField = "rankDivisionCaro";
        pointsField = "rankPointsCaro";
      } else if (isBattleship) {
        winnerElo = winner.eloBattleship;
        loserElo = loser.eloBattleship;
        eloField = "eloBattleship";
        tierField = "rankTierBattleship";
        divisionField = "rankDivisionBattleship";
        pointsField = "rankPointsBattleship";
      } else {
        winnerElo = winner.eloTicTacToe;
        loserElo = loser.eloTicTacToe;
        eloField = "eloTicTacToe";
        tierField = "rankTierTicTacToe";
        divisionField = "rankDivisionTicTacToe";
        pointsField = "rankPointsTicTacToe";
      }

      const newWinnerElo = calculateElo(winnerElo, loserElo, 1);
      const newLoserElo = calculateElo(loserElo, winnerElo, 0);

      // Cập nhật Battle Pass
      const winBPMatch = addBattlePassExp(winner.battlePassLevel, winner.battlePassExp, winner.isPremium ? 172 : 150);
      const loseBPMatch = addBattlePassExp(loser.battlePassLevel, loser.battlePassExp, loser.isPremium ? 57 : 50);

      // Cập nhật Nhiệm vụ hàng ngày
      const winnerMissions = updatePlayerMissions(winner.dailyMissions, room.gameType, "PLAY_GAME");
      const loserMissions = updatePlayerMissions(loser.dailyMissions, room.gameType, "PLAY_GAME");
      const winnerWinMissions = updatePlayerMissions(winnerMissions, room.gameType, "WIN_GAME");

      // Cập nhật Rank
      const winnerRank = calculateRankUpdate((winner as any)[tierField] as number, (winner as any)[divisionField] as number, (winner as any)[pointsField] as number, "WIN");
      const loserRank = calculateRankUpdate((loser as any)[tierField] as number, (loser as any)[divisionField] as number, (loser as any)[pointsField] as number, "LOSE");

      // Cập nhật người thắng
      await tx.user.update({
        where: { id: winner.id },
        data: {
          eggs: { increment: winnerCoinsGained },
          level: winnerNewStats.level,
          exp: winnerNewStats.exp,
          [eloField]: newWinnerElo,
          [tierField]: winnerRank.tier,
          [divisionField]: winnerRank.division,
          [pointsField]: winnerRank.rankPoints,
          // Đồng thời cập nhật global rank để tương thích ngược
          rankTier: winnerRank.tier,
          rankDivision: winnerRank.division,
          rankPoints: winnerRank.rankPoints,
          battlePassLevel: winBPMatch.level,
          battlePassExp: winBPMatch.exp,
          dailyMissions: winnerWinMissions,
        }
      });

      // Cập nhật người thua
      await tx.user.update({
        where: { id: loser.id },
        data: {
          eggs: { increment: loserCoinsGained },
          level: loserNewStats.level,
          exp: loserNewStats.exp,
          [eloField]: newLoserElo,
          [tierField]: loserRank.tier,
          [divisionField]: loserRank.division,
          [pointsField]: loserRank.rankPoints,
          // Đồng thời cập nhật global rank để tương thích ngược
          rankTier: loserRank.tier,
          rankDivision: loserRank.division,
          rankPoints: loserRank.rankPoints,
          battlePassLevel: loseBPMatch.level,
          battlePassExp: loseBPMatch.exp,
          dailyMissions: loserMissions,
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
