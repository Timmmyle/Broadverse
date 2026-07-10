import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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

    const now = new Date();
    if (profile.lastClaimedDaily) {
      const lastClaim = new Date(profile.lastClaimedDaily);
      // Kiểm tra xem có cùng ngày (cùng năm, tháng, ngày) không
      if (
        lastClaim.getDate() === now.getDate() &&
        lastClaim.getMonth() === now.getMonth() &&
        lastClaim.getFullYear() === now.getFullYear()
      ) {
        return NextResponse.json({ 
          error: "Bạn đã nhận quà điểm danh hôm nay rồi! Hãy quay lại vào ngày mai." 
        }, { status: 400 });
      }
    }

    // Phần thưởng: 50 Trứng cho VIP Premium, 10 Trứng cho người chơi thường
    const rewardCoins = profile.isPremium ? 50 : 10;

    const updatedProfile = await prisma.user.update({
      where: { id: user.id },
      data: {
        eggs: { increment: rewardCoins },
        lastClaimedDaily: now,
      },
    });

    return NextResponse.json({ 
      profile: updatedProfile, 
      rewardCoins, 
      message: `Điểm danh thành công! Nhận ${rewardCoins} Trứng.` 
    });
  } catch (error: any) {
    console.error("Lỗi điểm danh:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
