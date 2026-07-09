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

    const { packageId } = await req.json();

    let rewardCoins = 0;
    let price = 0;

    switch (packageId) {
      case "package_10k":
        rewardCoins = 100;
        price = 10000;
        break;
      case "package_20k":
        rewardCoins = 220; // Khuyến mãi 10%
        price = 20000;
        break;
      case "package_50k":
        rewardCoins = 600; // Khuyến mãi 20%
        price = 50000;
        break;
      case "package_100k":
        rewardCoins = 1300; // Khuyến mãi 30%
        price = 100000;
        break;
      default:
        return NextResponse.json({ error: "Gói nạp không hợp lệ" }, { status: 400 });
    }

    // Cập nhật số dư Coin của người dùng
    const updatedProfile = await prisma.user.update({
      where: { id: user.id },
      data: {
        coins: { increment: rewardCoins }
      }
    });

    return NextResponse.json({
      profile: updatedProfile,
      rewardCoins,
      price,
      message: `Nạp thành công ${rewardCoins} Coins vào tài khoản!`
    });
  } catch (error: any) {
    console.error("Lỗi nạp coin:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
