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

    const body = await req.json().catch(() => ({}));
    const duration = body.duration === 6 ? 6 : 1;

    // Lấy thông tin người chơi hiện tại
    const profile = await prisma.user.findUnique({
      where: { id: user.id }
    });

    if (!profile) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ người chơi" }, { status: 404 });
    }

    // Tính toán hạn sử dụng Premium mới
    let premiumUntil: Date | null = null;
    const now = new Date();
    const daysToAdd = duration === 6 ? 180 : 30;

    if (profile.isPremium && profile.premiumUntil === null) {
      // Đã có Premium vĩnh viễn, giữ nguyên
      premiumUntil = null;
    } else if (profile.isPremium && profile.premiumUntil && new Date(profile.premiumUntil) > now) {
      // Đang có Premium hạn dùng, cộng dồn tiếp
      premiumUntil = new Date(new Date(profile.premiumUntil).getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    } else {
      // Hết hạn hoặc chưa có, tính từ thời điểm hiện tại
      premiumUntil = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    }

    const updatedProfile = await prisma.user.update({
      where: { id: user.id },
      data: {
        isPremium: true,
        premiumUntil: premiumUntil
      }
    });

    return NextResponse.json(updatedProfile);
  } catch (error: any) {
    console.error("Lỗi mua premium bằng tiền mặt:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
