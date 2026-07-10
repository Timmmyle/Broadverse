import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { addExp, DailyMission } from "@/lib/progression";

// Cập nhật tiến trình nhiệm vụ của người chơi
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

    const { outcome, gameType } = await req.json(); // outcome: "WIN" | "LOSE" | "DRAW", gameType?: "CARO" | "TIC_TAC_TOE" | "BATTLESHIP"
    const currentGameType = gameType || "CARO";

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ người chơi" }, { status: 404 });
    }

    // Thưởng luyện tập với Bot nhỏ để tránh cày cuốc (exploit)
    let coinsGained = 0;
    let expGained = 0;

    if (outcome === "WIN") {
      coinsGained = 5;
      expGained = 150; // Thích ứng với lượng EXP lớn hơn của công thức mới
    } else {
      coinsGained = 2;
      expGained = 50;
    }

    // Áp dụng x2 EXP và 1.5x Coins cho tài khoản Premium (VIP)
    if (profile.isPremium) {
      coinsGained = Math.round(coinsGained * 1.5);
      expGained = expGained * 2;
    }

    // Cập nhật nhiệm vụ hàng ngày
    let updatedMissions = updatePlayerMissions(profile.dailyMissions, currentGameType, "PLAY_GAME");
    if (outcome === "WIN") {
      updatedMissions = updatePlayerMissions(updatedMissions, currentGameType, "WIN_GAME");
    }

    const updatedProfile = await prisma.$transaction(async (tx) => {
      const newStats = addExp(profile.level, profile.exp, expGained);

      return await tx.user.update({
        where: { id: user.id },
        data: {
          coins: { increment: coinsGained },
          level: newStats.level,
          exp: newStats.exp,
          dailyMissions: updatedMissions,
        },
      });
    });

    return NextResponse.json({
      profile: updatedProfile,
      rewards: { coins: coinsGained, exp: expGained }
    });
  } catch (error: any) {
    console.error("Lỗi thưởng đấu bot:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
