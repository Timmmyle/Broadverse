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

    const { message } = await req.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Tin nhắn không được để trống" }, { status: 400 });
    }

    const userId = user.id;

    // Tìm xem user có ở trong tổ đội nào không
    const member = await prisma.partyMember.findUnique({
      where: { userId },
    });

    if (!member) {
      return NextResponse.json({ error: "Bạn không ở trong tổ đội nào" }, { status: 400 });
    }

    // Lưu tin nhắn chat tổ đội vào DB
    const chatMsg = await prisma.chatMessage.create({
      data: {
        senderId: userId,
        partyId: member.partyId,
        content: message.trim(),
      },
    });

    return NextResponse.json({ success: true, message: chatMsg });
  } catch (error: any) {
    console.error("Lỗi gửi tin nhắn tổ đội:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
