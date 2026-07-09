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

    const { questId } = await req.json();

    let rewardCoins = 0;
    let rewardShells = 0;
    let questName = "";

    switch (questId) {
      case "quest_daily":
        questName = "Đăng nhập ngày";
        rewardCoins = 20;
        rewardShells = 15;
        break;
      case "quest_win_3":
        questName = "Thắng 3 trận cờ";
        rewardCoins = 50;
        rewardShells = 40;
        break;
      case "quest_play_5":
        questName = "Chơi đủ 5 trận cờ";
        rewardCoins = 40;
        rewardShells = 30;
        break;
      case "quest_invite":
        questName = "Giới thiệu bạn bè chơi game";
        rewardCoins = 150;
        rewardShells = 100;
        break;
      default:
        return NextResponse.json({ error: "Nhiệm vụ không hợp lệ" }, { status: 400 });
    }

    // Cập nhật tài khoản người dùng
    const updatedProfile = await prisma.user.update({
      where: { id: user.id },
      data: {
        coins: { increment: rewardCoins },
        shells: { increment: rewardShells }
      }
    });

    return NextResponse.json({
      profile: updatedProfile,
      rewardCoins,
      rewardShells,
      message: `Hoàn thành nhiệm vụ '${questName}'! Nhận được ${rewardShells} Vỏ Sò và ${rewardCoins} Coins.`
    });
  } catch (error: any) {
    console.error("Lỗi nhận thưởng nhiệm vụ:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
