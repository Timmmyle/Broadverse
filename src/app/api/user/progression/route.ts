import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { 
  addExp, 
  generateDailyMissions, 
  MAX_LEVEL_FOR_PRESTIGE, 
  DailyMission 
} from "@/lib/progression";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action, missionId } = await req.json();

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ người chơi" }, { status: 404 });
    }

    const now = new Date();

    // 1. NHẬN QUÀ ĐIỂM DANH HÀNG NGÀY & TÍNH STREAK
    if (action === "CLAIM_DAILY") {
      if (profile.lastClaimedDaily) {
        const lastClaim = new Date(profile.lastClaimedDaily);
        if (
          lastClaim.getDate() === now.getDate() &&
          lastClaim.getMonth() === now.getMonth() &&
          lastClaim.getFullYear() === now.getFullYear()
        ) {
          return NextResponse.json({ error: "Bạn đã điểm danh hôm nay rồi!" }, { status: 400 });
        }
      }

      let streak = profile.loginStreak;
      let dayIndex = profile.dailyStreakDay;
      let freezes = profile.streakFreezes;
      let streakSaved = false;

      if (profile.lastClaimedDaily) {
        const lastClaimTime = new Date(profile.lastClaimedDaily).getTime();
        const hoursPassed = (now.getTime() - lastClaimTime) / (1000 * 60 * 60);

        if (hoursPassed > 36) {
          // Bị đứt chuỗi! Kiểm tra có đóng băng chuỗi không
          if (freezes > 0) {
            freezes -= 1;
            streakSaved = true;
          } else {
            streak = 0;
            dayIndex = 1;
          }
        }
      }

      streak += 1;
      
      // Ngày điểm danh chạy từ 1 đến 7
      const rewardCoinsMap = [10, 15, 20, 25, 30, 40, 50];
      const coinsReward = rewardCoinsMap[dayIndex - 1] ?? 10;
      const finalCoins = profile.isPremium ? coinsReward * 2 : coinsReward;
      const expReward = 200; // Thưởng exp cố định cho điểm danh

      // Tính toán cấp độ mới
      const newStats = addExp(profile.level, profile.exp, expReward);

      // Cập nhật ngày tiếp theo cho chu kỳ 7 ngày
      const nextDayIndex = dayIndex === 7 ? 1 : dayIndex + 1;

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          coins: { increment: finalCoins },
          level: newStats.level,
          exp: newStats.exp,
          loginStreak: streak,
          dailyStreakDay: nextDayIndex,
          streakFreezes: freezes,
          lastClaimedDaily: now,
        },
      });

      return NextResponse.json({
        profile: updated,
        message: `Điểm danh Ngày ${dayIndex} thành công! Nhận ${finalCoins} Coins và ${expReward} EXP. ${
          streakSaved ? "(Chuỗi đăng nhập đã được cứu bằng Thẻ Đóng Băng)" : ""
        }`,
      });
    }

    // 2. MUA THẺ ĐÓNG BĂNG CHUỖI
    if (action === "BUY_FREEZE") {
      if (profile.coins < 10) {
        return NextResponse.json({ error: "Không đủ Coin. Thẻ đóng băng chuỗi giá 10 Coins!" }, { status: 400 });
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          coins: { decrement: 10 },
          streakFreezes: { increment: 1 },
        },
      });

      return NextResponse.json({
        profile: updated,
        message: "Mua Thẻ Đóng Băng Chuỗi thành công! (-10 Coins)",
      });
    }

    // 3. KÍCH HOẠT PRESTIGE (DANH VỌNG)
    if (action === "PRESTIGE") {
      if (profile.level < MAX_LEVEL_FOR_PRESTIGE) {
        return NextResponse.json({ 
          error: `Bạn cần đạt cấp độ ${MAX_LEVEL_FOR_PRESTIGE} để kích hoạt Danh Vọng (Prestige)!` 
        }, { status: 400 });
      }

      // Đặt lại cấp độ về 1, giữ lại trang phục và tăng prestigeLevel lên 1
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          level: 1,
          exp: 0,
          prestigeLevel: { increment: 1 },
        },
      });

      return NextResponse.json({
        profile: updated,
        message: "Chúc mừng! Bạn đã kích hoạt Prestige thành công. Cấp độ đã được đặt lại về 1 và thứ hạng Danh Vọng của bạn đã tăng lên!",
      });
    }

    // 4. LẤY / LÀM MỚI NHIỆM VỤ HÀNG NGÀY
    if (action === "GET_MISSIONS") {
      let currentMissions: DailyMission[] = [];
      let shouldGenerate = false;

      if (!profile.lastMissionGenerated || !profile.dailyMissions || profile.dailyMissions === "[]") {
        shouldGenerate = true;
      } else {
        const lastGen = new Date(profile.lastMissionGenerated);
        if (
          lastGen.getDate() !== now.getDate() ||
          lastGen.getMonth() !== now.getMonth() ||
          lastGen.getFullYear() !== now.getFullYear()
        ) {
          shouldGenerate = true;
        }
      }

      if (shouldGenerate) {
        currentMissions = generateDailyMissions();
        const updated = await prisma.user.update({
          where: { id: user.id },
          data: {
            dailyMissions: JSON.stringify(currentMissions),
            lastMissionGenerated: now,
          },
        });
        return NextResponse.json({ profile: updated, missions: currentMissions });
      } else {
        currentMissions = JSON.parse(profile.dailyMissions);
        return NextResponse.json({ profile, missions: currentMissions });
      }
    }

    // 5. NHẬN THƯỞNG NHIỆM VỤ HÀNG NGÀY
    if (action === "CLAIM_MISSION") {
      if (!missionId) {
        return NextResponse.json({ error: "Thiếu ID nhiệm vụ" }, { status: 400 });
      }

      const missions: DailyMission[] = JSON.parse(profile.dailyMissions);
      const missionIdx = missions.findIndex((m) => m.id === missionId);

      if (missionIdx === -1) {
        return NextResponse.json({ error: "Không tìm thấy nhiệm vụ này" }, { status: 400 });
      }

      const mission = missions[missionIdx];
      if (mission.claimed) {
        return NextResponse.json({ error: "Nhiệm vụ này đã được nhận thưởng rồi!" }, { status: 400 });
      }

      if (mission.progress < mission.target) {
        return NextResponse.json({ error: "Nhiệm vụ chưa hoàn thành!" }, { status: 400 });
      }

      // Đánh dấu đã nhận
      mission.claimed = true;

      // Cộng EXP và tiền
      const newStats = addExp(profile.level, profile.exp, mission.rewardExp);

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          coins: { increment: mission.rewardCoins },
          level: newStats.level,
          exp: newStats.exp,
          dailyMissions: JSON.stringify(missions),
        },
      });

      return NextResponse.json({
        profile: updated,
        message: `Nhận thưởng nhiệm vụ "${mission.description}" thành công! +${mission.rewardCoins} Coins và +${mission.rewardExp} EXP.`,
      });
    }

    // 6. HOÀN THÀNH HƯỚNG DẪN RENJU
    if (action === "COMPLETE_RENJU_ONBOARD") {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          coins: { increment: 100 },
        },
      });

      return NextResponse.json({
        profile: updated,
        message: "Chúc mừng bạn đã hoàn thành bài học luật Renju! Nhận ngay 100 Coins thưởng.",
      });
    }

    return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 });
  } catch (error: any) {
    console.error("Lỗi API tiến trình:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
