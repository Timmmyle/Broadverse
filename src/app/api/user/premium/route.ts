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

    // Lấy thông tin người chơi hiện tại
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ người chơi" }, { status: 404 });
    }

    if (profile.isPremium) {
      return NextResponse.json({ error: "Tài khoản của bạn đã là Premium rồi!" }, { status: 400 });
    }

    const PREMIUM_COST = 200; // Giá mua Premium là 200 Coins

    if (profile.eggs < PREMIUM_COST) {
      return NextResponse.json({ 
        error: `Bạn không đủ Trứng để mua Premium! Cần ${PREMIUM_COST} Trứng (Bạn hiện có ${profile.eggs} Trứng).` 
      }, { status: 400 });
    }

    // Tính thời gian hết hạn sau 3 ngày (Premium tạm thời)
    const premiumUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    // Khấu trừ Trứng và nâng cấp Premium tạm thời
    const updatedProfile = await prisma.user.update({
      where: { id: user.id },
      data: {
        eggs: { decrement: PREMIUM_COST },
        isPremium: true,
        premiumUntil: premiumUntil
      }
    });

    return NextResponse.json(updatedProfile);
  } catch (error: any) {
    console.error("Lỗi mua premium:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
