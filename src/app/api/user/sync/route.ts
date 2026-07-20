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

    // Tìm kiếm profile của user
    let profile = await prisma.user.findUnique({
      where: { id: user.id },
    });

    const isGuest = user.app_metadata.provider === "anonymous" || !user.email;

    // Nếu chưa tồn tại trong Prisma DB, tạo mới
    if (!profile) {
      const defaultUsername = isGuest 
        ? `Guest_${user.id.substring(0, 5).toUpperCase()}` 
        : user.email?.split("@")[0] || `Player_${user.id.substring(0, 5).toUpperCase()}`;

      profile = await prisma.user.create({
        data: {
          id: user.id,
          email: user.email || null,
          username: defaultUsername,
          isGuest,
          eggs: 100, // Tặng 100 quả trứng khởi nghiệp
          level: 1,
          exp: 0,
          avatarFrame: "frame_default",
          selectedSymbolX: "sym_classic",
          selectedSymbolO: "sym_classic",
          equippedChickenSkin: "skin_default",
          equippedDiceSkin: "dice_wood",
          equippedCardBack: "banner_classic",
          equippedBanner: "banner_classic",
          purchasedItems: ["sym_classic", "frame_default", "theme_classic", "skin_default", "dice_wood", "banner_classic"],
        },
      });
    } else {
      // Nếu đã tồn tại, kiểm tra xem có nâng cấp từ Guest lên tài khoản đăng ký chính thức hay không
      if (profile.isGuest && !isGuest) {
        // Tặng thưởng nâng cấp tài khoản: +200 Coin và Skin Samurai
        const startingSkinId = "skin_samurai";
        const updatedPurchasedItems = Array.from(new Set([...profile.purchasedItems, startingSkinId]));

        profile = await prisma.user.update({
          where: { id: user.id },
          data: {
            isGuest: false,
            email: user.email,
            eggs: { increment: 200 }, // +200 coin
            purchasedItems: updatedPurchasedItems,
            equippedChickenSkin: startingSkinId, // Tự động trang bị skin Gà Samurai
          },
        });
      } else {
        // Nếu đã tồn tại, kiểm tra và tự động hết hạn Premium nếu quá hạn (dùng Coin mua 3 ngày)
        if (profile.isPremium && profile.premiumUntil && new Date() > new Date(profile.premiumUntil)) {
          profile = await prisma.user.update({
            where: { id: user.id },
            data: {
              isPremium: false,
              premiumUntil: null
            }
          });
        }
      }
    }

    return NextResponse.json(profile);
  } catch (error: any) {
    console.error("Lỗi đồng bộ user:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
