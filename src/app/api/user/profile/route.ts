import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let profile = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ người chơi" }, { status: 404 });
    }

    // Kiểm tra và tự động hết hạn Premium nếu quá hạn (dùng Coin mua 3 ngày)
    if (profile.isPremium && profile.premiumUntil && new Date() > new Date(profile.premiumUntil)) {
      profile = await prisma.user.update({
        where: { id: user.id },
        data: {
          isPremium: false,
          premiumUntil: null
        }
      });
    }

    return NextResponse.json(profile);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { username } = await req.json();

    if (!username || username.trim().length < 3 || username.trim().length > 15) {
      return NextResponse.json({ error: "Tên người chơi phải từ 3 đến 15 ký tự" }, { status: 400 });
    }

    // Cập nhật tên người chơi trong cơ sở dữ liệu
    const updatedProfile = await prisma.user.update({
      where: { id: user.id },
      data: { username: username.trim() },
    });

    return NextResponse.json(updatedProfile);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
