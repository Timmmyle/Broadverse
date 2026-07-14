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

    const { partyId } = await req.json();

    if (!partyId) {
      return NextResponse.json({ error: "Thiếu partyId" }, { status: 400 });
    }

    const userId = user.id;

    // Check if the user is already in a party
    const existingMember = await prisma.partyMember.findUnique({
      where: { userId }
    });

    if (existingMember) {
      return NextResponse.json({ error: "Bạn đã ở trong một tổ đội rồi" }, { status: 400 });
    }

    // Find the target party
    const party = await prisma.party.findUnique({
      where: { id: partyId },
      include: { members: true }
    });

    if (!party) {
      return NextResponse.json({ error: "Không tìm thấy tổ đội này" }, { status: 404 });
    }

    // Check member limits (maximum 5 members in a party)
    if (party.members.length >= 5) {
      return NextResponse.json({ error: "Tổ đội đã đầy (Tối đa 5 người)" }, { status: 400 });
    }

    // Add member to party
    const member = await prisma.partyMember.create({
      data: {
        partyId: party.id,
        userId: userId
      }
    });

    return NextResponse.json({ success: true, party, member });
  } catch (error: any) {
    console.error("Lỗi tham gia tổ đội:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
