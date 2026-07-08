import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SHOP_ITEMS } from "@/lib/shopItems";

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

    // Kiểm tra số dư coin
    if (profile.coins < actualPrice) {
      return NextResponse.json({ error: "Không đủ Coin để mua vật phẩm này" }, { status: 400 });
    }

    // Thực hiện trừ coin và thêm vào danh sách sở hữu
    const updatedProfile = await prisma.user.update({
      where: { id: user.id },
      data: {
        coins: { decrement: actualPrice },
        purchasedItems: { push: itemId }
      }
    });

    return NextResponse.json(updatedProfile);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
