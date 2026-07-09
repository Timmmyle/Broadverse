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

    // Lấy thông tin người dùng hiện tại
    const profile = await prisma.user.findUnique({
      where: { id: user.id }
    });

    if (!profile) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ người chơi" }, { status: 404 });
    }

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
        questName = "Mời bạn bè";
        rewardCoins = 150;
        rewardShells = 100;
        break;
      default:
        return NextResponse.json({ error: "Nhiệm vụ không hợp lệ" }, { status: 400 });
    }

    // Ràng buộc cho nhiệm vụ mời bạn bè
    if (questId === "quest_invite") {
      // 1. Kiểm tra số lượng người đã đăng ký qua referral
      const totalInvites = await prisma.user.count({
        where: {
          referredBy: {
            equals: profile.username,
            mode: "insensitive"
          }
        }
      });

      // 2. Kiểm tra xem số lượng mời thực tế có lớn hơn số lần đã nhận thưởng hay chưa
      const claimedCount = profile.claimedReferralsCount ?? 0;
      if (totalInvites <= claimedCount) {
        return NextResponse.json({ 
          error: "Bạn chưa có bạn bè mới nào đăng ký qua tên biệt danh của bạn! Hãy chia sẻ biệt danh của bạn cho người chơi mới khi đăng ký." 
        }, { status: 400 });
      }

      // 3. Kiểm tra cooldown 2 giờ giữa các lần nhận thưởng giới thiệu
      if (profile.lastClaimedReferral) {
        const timeDiff = Date.now() - new Date(profile.lastClaimedReferral).getTime();
        const twoHours = 2 * 60 * 60 * 1000;
        if (timeDiff < twoHours) {
          const minutesLeft = Math.ceil((twoHours - timeDiff) / (60 * 1000));
          return NextResponse.json({ 
            error: `Bạn chỉ được nhận thưởng giới thiệu tối đa 1 lần mỗi 2 giờ! Vui lòng quay lại sau ${minutesLeft} phút.` 
          }, { status: 400 });
        }
      }
    }

    // Xây dựng dữ liệu cập nhật
    let updateData: any = {
      coins: { increment: rewardCoins },
      shells: { increment: rewardShells }
    };

    if (questId === "quest_invite") {
      updateData.claimedReferralsCount = { increment: 1 };
      updateData.lastClaimedReferral = new Date();
    }

    // Cập nhật tài khoản người dùng
    const updatedProfile = await prisma.user.update({
      where: { id: user.id },
      data: updateData
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
