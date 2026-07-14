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

    const { targetUserId } = await req.json();

    if (!targetUserId) {
      return NextResponse.json({ error: "Thiếu targetUserId" }, { status: 400 });
    }

    const userId = user.id;

    // Tìm tổ đội mà user làm Leader
    const party = await prisma.party.findUnique({
      where: { leaderId: userId }
    });

    if (!party) {
      return NextResponse.json({ error: "Chỉ trưởng nhóm mới có quyền trục xuất thành viên" }, { status: 403 });
    }

    if (targetUserId === userId) {
      return NextResponse.json({ error: "Bạn không thể trục xuất chính mình" }, { status: 400 });
    }

    // Xóa thành viên
    await prisma.$transaction(async (tx) => {
      const member = await tx.partyMember.findFirst({
        where: {
          partyId: party.id,
          userId: targetUserId
        }
      });

      if (!member) {
        throw new Error("Thành viên không ở trong tổ đội này");
      }

      await tx.partyMember.delete({
        where: { id: member.id }
      });

      // Kiểm tra xem số thành viên còn lại có <= 1 không, nếu có tự giải tán
      const remainingMembers = await tx.partyMember.findMany({
        where: { partyId: party.id }
      });

      if (remainingMembers.length <= 1) {
        await tx.partyMember.deleteMany({
          where: { partyId: party.id }
        });
        await tx.party.delete({
          where: { id: party.id }
        });
        console.log(`[Party] Trục xuất thành công. Đã tự động giải tán tổ đội ${party.id} do chỉ còn 1 thành viên`);
      }
    });

    return NextResponse.json({ success: true, message: "Trục xuất thành viên thành công" });
  } catch (error: any) {
    console.error("Lỗi trục xuất thành viên:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
