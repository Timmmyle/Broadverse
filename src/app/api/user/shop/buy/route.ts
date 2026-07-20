import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SHOP_ITEMS } from "@/lib/shopItems";
import { checkAndUnlockAchievements } from "@/lib/progression";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { itemId } = await req.json();
    const item = SHOP_ITEMS.find((i) => i.id === itemId);

    if (!item) {
      return NextResponse.json({ error: "Vật phẩm không tồn tại trong cửa hàng" }, { status: 404 });
    }

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ người chơi" }, { status: 404 });
    }

    // Kiểm tra xem có phải vật phẩm đặc quyền VIP
    if (item.isPremiumOnly && !profile.isPremium) {
      return NextResponse.json({ error: "Vật phẩm này chỉ dành riêng cho thành viên VIP Premium!" }, { status: 400 });
    }

    // Kiểm tra xem đã sở hữu chưa
    if (profile.purchasedItems.includes(itemId)) {
      return NextResponse.json({ error: "Bạn đã sở hữu vật phẩm này rồi" }, { status: 400 });
    }

    // Áp dụng giảm giá 20% nếu tài khoản là Premium
    const actualPrice = profile.isPremium ? Math.floor(item.price * 0.8) : item.price;

    // Kiểm tra số dư eggs
    if (profile.eggs < actualPrice) {
      return NextResponse.json({ error: "Không đủ Trứng để mua vật phẩm này" }, { status: 400 });
    }

    // Thực hiện trừ eggs và thêm vào danh sách sở hữu
    const updatedProfile = await prisma.user.update({
      where: { id: user.id },
      data: {
        eggs: { decrement: actualPrice },
        purchasedItems: { push: itemId }
      }
    });

    // Quét thành tựu mới sau khi mua vật phẩm
    await checkAndUnlockAchievements(user.id, prisma);

    // Lấy lại profile mới nhất (đã cập nhật thành tựu và coin nếu có thưởng)
    const finalProfile = await prisma.user.findUnique({
      where: { id: user.id }
    });

    return NextResponse.json(finalProfile || updatedProfile);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
