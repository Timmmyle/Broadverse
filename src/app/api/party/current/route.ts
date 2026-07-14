import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Tìm xem user có ở trong tổ đội nào không
    const member = await prisma.partyMember.findUnique({
      where: { userId },
    });

    if (!member) {
      return NextResponse.json({ party: null });
    }

    const party = await prisma.party.findUnique({
      where: { id: member.partyId },
      include: {
        members: {
          include: {
            // Include user details of members
            party: false // avoid circular
          }
        },
        missions: true
      }
    });

    if (!party) {
      return NextResponse.json({ party: null });
    }

    // Lấy thông tin chi tiết (username, avatar) của từng thành viên trong tổ đội
    const memberUserIds = party.members.map(m => m.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: memberUserIds } },
      select: {
        id: true,
        username: true,
        avatarFrame: true,
        equippedChickenSkin: true,
        eloGomoku: true,
        level: true
      }
    });

    const usersMap = new Map(users.map(u => [u.id, u]));
    const membersWithProfile = party.members.map(m => ({
      ...m,
      profile: usersMap.get(m.userId) || null
    }));

    return NextResponse.json({
      party: {
        ...party,
        members: membersWithProfile
      }
    });
  } catch (error: any) {
    console.error("Lỗi lấy thông tin tổ đội hiện tại:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
