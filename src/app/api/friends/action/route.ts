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

    const { action, friendId, friendUsername } = await req.json();

    if (!action) {
      return NextResponse.json({ error: "Thiếu action" }, { status: 400 });
    }

    // 1. GỬI YÊU CẦU KẾT BẠN (SEND)
    if (action === "SEND") {
      let targetId = friendId;
      if (!targetId && friendUsername) {
        const targetUser = await prisma.user.findFirst({
          where: { username: friendUsername }
        });
        if (!targetUser) {
          return NextResponse.json({ error: "Không tìm thấy người chơi này" }, { status: 404 });
        }
        targetId = targetUser.id;
      }

      if (!targetId) {
        return NextResponse.json({ error: "Thiếu thông tin người chơi cần kết bạn" }, { status: 400 });
      }

      if (targetId === user.id) {
        return NextResponse.json({ error: "Bạn không thể tự kết bạn với chính mình" }, { status: 400 });
      }

      // Kiểm tra xem mối quan hệ đã tồn tại chưa
      const existing = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userId: user.id, friendId: targetId },
            { userId: targetId, friendId: user.id }
          ]
        }
      });

      if (existing) {
        if (existing.status === "ACCEPTED") {
          return NextResponse.json({ error: "Hai bạn đã là bạn bè rồi" }, { status: 400 });
        }
        if (existing.status === "BLOCKED") {
          return NextResponse.json({ error: "Không thể gửi lời mời kết bạn (Bị chặn)" }, { status: 400 });
        }
        return NextResponse.json({ error: "Yêu cầu kết bạn đã được gửi từ trước" }, { status: 400 });
      }

      // Tạo mối quan hệ PENDING
      const friendship = await prisma.friendship.create({
        data: {
          userId: user.id,
          friendId: targetId,
          status: "PENDING"
        }
      });

      return NextResponse.json({ success: true, message: "Đã gửi lời mời kết bạn thành công", friendship });
    }

    // 2. CHẤP NHẬN KẾT BẠN (ACCEPT)
    if (action === "ACCEPT") {
      if (!friendId) {
        return NextResponse.json({ error: "Thiếu friendId" }, { status: 400 });
      }

      // Tìm lời mời kết bạn PENDING (trong đó user hiện tại là người nhận: friendId === user.id)
      const pendingRequest = await prisma.friendship.findFirst({
        where: {
          userId: friendId,
          friendId: user.id,
          status: "PENDING"
        }
      });

      if (!pendingRequest) {
        return NextResponse.json({ error: "Không tìm thấy yêu cầu kết bạn chờ duyệt" }, { status: 404 });
      }

      const updated = await prisma.friendship.update({
        where: { id: pendingRequest.id },
        data: { status: "ACCEPTED" }
      });

      return NextResponse.json({ success: true, message: "Đã chấp nhận kết bạn thành công", friendship: updated });
    }

    // 3. XÓA BẠN / TỪ CHỐI KẾT BẠN (REMOVE / REJECT)
    if (action === "REMOVE") {
      if (!friendId) {
        return NextResponse.json({ error: "Thiếu friendId" }, { status: 400 });
      }

      const relation = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userId: user.id, friendId: friendId },
            { userId: friendId, friendId: user.id }
          ]
        }
      });

      if (!relation) {
        return NextResponse.json({ error: "Không tìm thấy mối quan hệ bạn bè" }, { status: 404 });
      }

      await prisma.friendship.delete({
        where: { id: relation.id }
      });

      return NextResponse.json({ success: true, message: "Đã xóa mối quan hệ bạn bè thành công" });
    }

    // 4. CHẶN NGƯỜI CHƠI (BLOCK)
    if (action === "BLOCK") {
      if (!friendId) {
        return NextResponse.json({ error: "Thiếu friendId" }, { status: 400 });
      }

      if (friendId === user.id) {
        return NextResponse.json({ error: "Bạn không thể tự chặn chính mình" }, { status: 400 });
      }

      const relation = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userId: user.id, friendId: friendId },
            { userId: friendId, friendId: user.id }
          ]
        }
      });

      if (relation) {
        // Cập nhật mối quan hệ hiện tại thành BLOCKED và gán userId chặn
        const updated = await prisma.friendship.update({
          where: { id: relation.id },
          data: {
            userId: user.id,
            friendId: friendId,
            status: "BLOCKED"
          }
        });
        return NextResponse.json({ success: true, message: "Đã chặn người chơi này thành công", friendship: updated });
      } else {
        // Tạo mới bản ghi chặn
        const blocked = await prisma.friendship.create({
          data: {
            userId: user.id,
            friendId: friendId,
            status: "BLOCKED"
          }
        });
        return NextResponse.json({ success: true, message: "Đã chặn người chơi này thành công", friendship: blocked });
      }
    }

    return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
  } catch (error: any) {
    console.error("Lỗi thao tác bạn bè:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
