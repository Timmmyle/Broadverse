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

    const { itemId, slot } = await req.json(); // slot: "X" hoặc "O" (chỉ áp dụng cho SYMBOL)
    const item = SHOP_ITEMS.find((i) => i.id === itemId);

    if (!item) {
      return NextResponse.json({ error: "Vật phẩm không tồn tại" }, { status: 404 });
    }

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ người chơi" }, { status: 404 });
    }

    // Kiểm tra xem người dùng đã mua vật phẩm này chưa
    if (!profile.purchasedItems.includes(itemId)) {
      return NextResponse.json({ error: "Bạn chưa sở hữu vật phẩm này" }, { status: 400 });
    }

    let updateData: any = {};

    if (item.type === "FRAME") {
      updateData.avatarFrame = itemId;
    } else if (item.type === "SYMBOL") {
      if (slot === "X") {
        updateData.selectedSymbolX = itemId;
      } else if (slot === "O") {
        updateData.selectedSymbolO = itemId;
      } else {
        return NextResponse.json({ error: "Slot không hợp lệ (phải là X hoặc O)" }, { status: 400 });
      }
    } else if (item.type === "THEME") {
      // Đối với Theme, có thể lưu vào localStorage hoặc lưu trực tiếp nếu cần thiết, 
      // ở đây tạm thời cho phép trang bị trong DB bằng cách cập nhật avatarFrame hoặc 
      // lưu trên client. Chúng ta sẽ lưu trực tiếp cấu hình theme ở client cho đơn giản.
      return NextResponse.json({ message: "Đã chọn theme thành công" });
    }

    const updatedProfile = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return NextResponse.json(updatedProfile);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
