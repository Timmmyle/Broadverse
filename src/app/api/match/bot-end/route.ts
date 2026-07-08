import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Cộng EXP và tính toán lên cấp (Level up)
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

    const { outcome } = await req.json(); // outcome: "WIN" | "LOSE" | "DRAW"

    // Thưởng luyện tập với Bot nhỏ để tránh cày cuốc (exploit)
    let coinsGained = 0;
    let expGained = 0;

    if (outcome === "WIN") {
      coinsGained = 2;
      expGained = 5;
    } else {
      coinsGained = 1;
      expGained = 1;
    }

    const updatedProfile = await prisma.$transaction(async (tx) => {
      const profile = await tx.user.findUnique({
        where: { id: user.id },
      });

      if (!profile) throw new Error("Không tìm thấy hồ sơ người chơi");

      const newStats = addExpAndCalculateLevel(profile.level, profile.exp, expGained);

      return await tx.user.update({
        where: { id: user.id },
        data: {
          coins: { increment: coinsGained },
          level: newStats.level,
          exp: newStats.exp,
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
