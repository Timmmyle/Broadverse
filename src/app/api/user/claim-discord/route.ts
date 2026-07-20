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

    const profile = await prisma.user.findUnique({
      where: { id: user.id }
    });

    if (!profile) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ người chơi" }, { status: 404 });
    }

    if (profile.claimedDiscordReward) {
      return NextResponse.json({ error: "Bạn đã nhận phần thưởng này rồi!" }, { status: 400 });
    }

    // Thêm skin_discord và cộng 200 Trứng
    const discordSkinId = "skin_discord";
    const updatedPurchasedItems = Array.from(new Set([...profile.purchasedItems, discordSkinId]));

    const updatedProfile = await prisma.user.update({
      where: { id: user.id },
      data: {
        eggs: { increment: 200 },
        claimedDiscordReward: true,
        purchasedItems: updatedPurchasedItems
      }
    });

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (error: any) {
    console.error("Lỗi nhận thưởng Discord:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
