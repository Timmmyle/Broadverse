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

    // Tìm xem user có ở trong tổ đội nào không
    const member = await prisma.partyMember.findUnique({
      where: { userId },
      include: { party: true }
    });

    if (!member) {
      return NextResponse.json({ error: "Bạn không ở trong tổ đội nào" }, { status: 400 });
    }

    const partyId = member.partyId;
    const party = member.party;

    await prisma.$transaction(async (tx) => {
      // 1. Xóa bản thân khỏi danh sách thành viên tổ đội
      await tx.partyMember.delete({
        where: { id: member.id }
      });

      // 2. Tìm các thành viên còn lại xếp theo thời gian gia nhập tăng dần
      const remainingMembers = await tx.partyMember.findMany({
        where: { partyId },
        orderBy: { joinedAt: "asc" }
      });

      if (remainingMembers.length <= 1) {
        // Nếu tổ đội chỉ còn lại tối đa 1 người -> Tự động giải tán tổ đội hoàn toàn
        await tx.partyMember.deleteMany({
          where: { partyId }
        });
        await tx.party.delete({
          where: { id: partyId }
        });
        console.log(`[Party] Đã tự giải tán tổ đội ${partyId} do chỉ còn 1 thành viên`);
      } else {
        // Nếu người rời đi là trưởng nhóm (Leader) -> Chuyển quyền Leader cho người tiếp theo
        if (party.leaderId === userId) {
          const nextLeader = remainingMembers[0];
          await tx.party.update({
            where: { id: partyId },
            data: { leaderId: nextLeader.userId }
          });
          console.log(`[Party] Đã chuyển quyền trưởng nhóm tổ đội ${partyId} sang @${nextLeader.userId}`);
        }
      }
    });

    return NextResponse.json({ success: true, message: "Đã rời tổ đội thành công" });
  } catch (error: any) {
    console.error("Lỗi rời tổ đội:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
