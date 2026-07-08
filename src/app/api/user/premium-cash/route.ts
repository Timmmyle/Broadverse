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

    // Cập nhật trạng thái Premium trực tiếp (thanh toán tiền thật qua QR) - Vĩnh viễn (premiumUntil: null)
    const updatedProfile = await prisma.user.update({
      where: { id: user.id },
      data: {
        isPremium: true,
        premiumUntil: null
      }
    });

    return NextResponse.json(updatedProfile);
  } catch (error: any) {
    console.error("Lỗi mua premium bằng tiền mặt:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
