import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SHOP_ITEMS } from "@/lib/shopItems";

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

    const BOX_COST = 80; // Giá mở hộp quà cố định là 80 Trứng theo yêu cầu

    if (profile.eggs < BOX_COST) {
      return NextResponse.json({ 
        error: `Bạn không đủ Trứng để mở Hộp Quà Mùa Hè! Cần ${BOX_COST} Trứng (Bạn hiện có ${profile.eggs} Trứng).` 
      }, { status: 400 });
    }

    // Tỉ lệ rơi vật phẩm theo điều chỉnh của Admin:
    // - 25 Eggs (30%)
    // - 50 Eggs (20%)
    // - 150 Eggs (10%)
    // - Bàn cờ đại dương (7.5%)
    // - Quân cờ dưa hấu (5%)
    // - Khung cát vàng (5%)
    // - Sound effect kiểu bãi biển (5%)
    // - Ăn mừng bãi biển (10%)
    // - 10 Eggs (7.5% còn lại)
    const roll = Math.random() * 100;
    let rewardItemId = "";
    let coinsReward = 0;

    if (roll < 30) {
      coinsReward = 25;
    } else if (roll < 50) {
      coinsReward = 50;
    } else if (roll < 60) {
      coinsReward = 150;
    } else if (roll < 67.5) {
      rewardItemId = "theme_summer_ocean";
    } else if (roll < 72.5) {
      rewardItemId = "sym_summer_melon";
    } else if (roll < 77.5) {
      rewardItemId = "frame_summer_sand";
    } else if (roll < 82.5) {
      rewardItemId = "sfx_beach";
    } else if (roll < 92.5) {
      rewardItemId = "emoji_beach";
    } else {
      coinsReward = 10;
    }

    let updateData: any = {
      eggs: { decrement: BOX_COST },
      boxOpenings: { increment: 1 }
    };

    let rewardMessage = "";
    let itemReward = null;

    if (rewardItemId) {
      itemReward = SHOP_ITEMS.find(i => i.id === rewardItemId);
      // Kiểm tra xem đã sở hữu vật phẩm này chưa
      if (profile.purchasedItems.includes(rewardItemId)) {
        // Đã sở hữu -> hoàn lại 120 Trứng
        coinsReward = 120;
        rewardMessage = `Bạn mở ra [${itemReward?.name}] nhưng đã sở hữu rồi! Hệ thống đền bù cho bạn ${coinsReward} Trứng.`;
        updateData.eggs = { increment: coinsReward };
      } else {
        rewardMessage = `Chúc mừng! Bạn đã mở ra vật phẩm sự kiện độc quyền: [${itemReward?.name}]!`;
        updateData.purchasedItems = { push: rewardItemId };
      }
    } else {
      rewardMessage = `Tuyệt vời! Bạn nhận được phần quà Trứng may mắn: +${coinsReward} Trứng!`;
      updateData.eggs = { increment: coinsReward };
    }

    const updatedProfile = await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });

    return NextResponse.json({
      profile: updatedProfile,
      rewardItemId,
      itemReward,
      coinsReward,
      message: rewardMessage
    });
  } catch (error: any) {
    console.error("Lỗi mở hộp quà:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
