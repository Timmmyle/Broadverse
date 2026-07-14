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

    const userId = user.id;

    // Check if the user is already in another party
    const existingMember = await prisma.partyMember.findUnique({
      where: { userId }
    });

    if (existingMember) {
      return NextResponse.json({ error: "Bạn đã ở trong một tổ đội khác" }, { status: 400 });
    }

    // Check if user is already leader of a party
    const existingLeader = await prisma.party.findUnique({
      where: { leaderId: userId }
    });

    if (existingLeader) {
      return NextResponse.json({ error: "Bạn đã là trưởng nhóm của một tổ đội" }, { status: 400 });
    }

    // Create new Party
    const party = await prisma.$transaction(async (tx) => {
      const newParty = await tx.party.create({
        data: {
          leaderId: userId,
          gameType: "CARO",
          wager: 0,
          level: 1,
          exp: 0,
          status: "LOBBY"
        }
      });

      await tx.partyMember.create({
        data: {
          partyId: newParty.id,
          userId: userId
        }
      });

      return newParty;
    });

    return NextResponse.json({ success: true, party });
  } catch (error: any) {
    console.error("Lỗi tạo tổ đội:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
