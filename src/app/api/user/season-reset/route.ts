import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getRankFromElo } from "@/lib/progression";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ người chơi" }, { status: 404 });
    }

    // 1. Tính toán phần thưởng dựa trên rankTier hiện tại
    const currentTier = profile.rankTier;
    let rewardEggs = 100;
    let rewardGoldenEggs = 0;
    let rewardFrameId = "";

    switch (currentTier) {
      case 1: // Trứng
        rewardEggs = 100;
        break;
      case 2: // Gà Con
        rewardEggs = 200;
        break;
      case 3: // Gà Non
        rewardEggs = 400;
        rewardGoldenEggs = 50;
        break;
      case 4: // Gà Nhà
        rewardEggs = 600;
        rewardGoldenEggs = 100;
        break;
      case 5: // Gà Chiến
        rewardEggs = 1000;
        rewardGoldenEggs = 200;
        break;
      case 6: // Cao Thủ Gà
        rewardEggs = 2000;
        rewardGoldenEggs = 400;
        rewardFrameId = "frame_gold";
        break;
      case 7: // Phượng Hoàng
        rewardEggs = 5000;
        rewardGoldenEggs = 1000;
        rewardFrameId = "frame_phoenix";
        break;
    }

    // 2. Tính toán Rank mới (Giảm đi 2 cấp, tối thiểu là cấp 1)
    let newTier = Math.max(1, currentTier - 2);
    // Elo mặc định tương ứng với bậc rank mới (để cân bằng cày rank)
    let newElo = 1000;
    if (newTier === 1) newElo = 500;
    else if (newTier === 2) newElo = 750;
    else if (newTier === 3) newElo = 1000;
    else if (newTier === 4) newElo = 1350;
    else if (newTier === 5) newElo = 1650;
    else if (newTier === 6) newElo = 1950;

    // Phân hạng division tương ứng
    let newDivision = newTier >= 5 ? 4 : 3;

    // Danh sách purchasedItems cập nhật
    let updatedPurchasedItems = [...profile.purchasedItems];
    if (rewardFrameId && !updatedPurchasedItems.includes(rewardFrameId)) {
      updatedPurchasedItems.push(rewardFrameId);
    }

    // 3. Thực hiện cập nhật Database
    const updatedProfile = await prisma.user.update({
      where: { id: user.id },
      data: {
        eggs: { increment: rewardEggs },
        goldenEggs: { increment: rewardGoldenEggs },
        rankTier: newTier,
        rankDivision: newDivision,
        eloGomoku: newElo,
        eloTicTacToe: newElo,
        eloBattleship: newElo,
        battlePassLevel: 1,
        battlePassExp: 0,
        purchasedItems: updatedPurchasedItems,
        prestigeLevel: { increment: 1 } // Tăng điểm uy tín/ prestige sau mùa giải
      }
    });

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      rewards: {
        eggs: rewardEggs,
        goldenEggs: rewardGoldenEggs,
        frameId: rewardFrameId
      },
      oldTier: currentTier,
      newTier,
      message: `Chúc mừng bạn đã hoàn thành mùa giải! Nhận được ${rewardEggs} 🥚 và ${rewardGoldenEggs} ✨. Cấp bậc rank mùa mới của bạn là Tier ${newTier}.`
    });
  } catch (error: any) {
    console.error("Lỗi reset mùa giải:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
