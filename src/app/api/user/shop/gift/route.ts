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

    const { itemId, targetUsername, message } = await req.json();
    const item = SHOP_ITEMS.find((i) => i.id === itemId);

    if (!item) {
      return NextResponse.json({ error: "Vật phẩm không tồn tại trong cửa hàng" }, { status: 404 });
    }

    // 1. Kiểm tra tài khoản người gửi
    const senderProfile = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!senderProfile) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ người gửi" }, { status: 404 });
    }

    if (item.isPremiumOnly && !senderProfile.isPremium) {
      return NextResponse.json({ error: "Vật phẩm này chỉ dành riêng cho VIP Premium!" }, { status: 400 });
    }

    // 2. Tìm người nhận qua username (không phân biệt hoa thường)
    const receiverProfile = await prisma.user.findFirst({
      where: {
        username: {
          equals: targetUsername,
          mode: 'insensitive'
        }
      }
    });

    if (!receiverProfile) {
      return NextResponse.json({ error: `Không tìm thấy người chơi có biệt danh '${targetUsername}'` }, { status: 404 });
    }

    if (receiverProfile.id === senderProfile.id) {
      return NextResponse.json({ error: "Bạn không thể tự tặng quà cho chính mình!" }, { status: 400 });
    }

    // 3. Kiểm tra xem người nhận đã sở hữu chưa
    if (receiverProfile.purchasedItems.includes(itemId)) {
      return NextResponse.json({ error: `Người chơi '${targetUsername}' đã sở hữu vật phẩm này rồi!` }, { status: 400 });
    }

    // Áp dụng giảm giá 20% nếu người gửi là Premium, sau đó giảm 50% (làm tròn) cho việc tặng quà
    const basePrice = senderProfile.isPremium ? Math.floor(item.price * 0.8) : item.price;
    const actualPrice = Math.round(basePrice / 2);

    // 4. Kiểm tra số dư coin người gửi
    if (senderProfile.coins < actualPrice) {
      return NextResponse.json({ error: "Số dư Coin của bạn không đủ để tặng vật phẩm này" }, { status: 400 });
    }

    // 5. Thực hiện khấu trừ coin của người gửi và đẩy vật phẩm vào danh mục của người nhận
    await prisma.$transaction([
      prisma.user.update({
        where: { id: senderProfile.id },
        data: { coins: { decrement: actualPrice } }
      }),
      prisma.user.update({
        where: { id: receiverProfile.id },
        data: { purchasedItems: { push: itemId } }
      })
    ]);

    // Trả về thông tin cập nhật của người gửi
    const updatedSender = await prisma.user.findUnique({
      where: { id: senderProfile.id }
    });

    return NextResponse.json({
      profile: updatedSender,
      receiverName: receiverProfile.username,
      message: `Tặng thành công [${item.name}] cho người chơi '${receiverProfile.username}'!`
    });
  } catch (error: any) {
    console.error("Lỗi tặng quà:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
