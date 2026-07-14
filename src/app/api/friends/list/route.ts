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

    // Lấy tất cả quan hệ bạn bè đã ACCEPTED liên quan đến user hiện tại
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: user.id },
          { friendId: user.id }
        ],
        status: "ACCEPTED"
      }
    });

    const friendIds = friendships.map(f => f.userId === user.id ? f.friendId : f.userId);

    const friendsList = await prisma.user.findMany({
      where: {
        id: { in: friendIds }
      },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        eloGomoku: true,
        isPremium: true,
        level: true
      }
    });

    // Lấy tất cả yêu cầu kết bạn PENDING gửi đến user hiện tại
    const pendingFriendships = await prisma.friendship.findMany({
      where: {
        friendId: user.id,
        status: "PENDING"
      }
    });

    const pendingSenderIds = pendingFriendships.map(f => f.userId);

    const pendingRequests = await prisma.user.findMany({
      where: {
        id: { in: pendingSenderIds }
      },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        eloGomoku: true,
        level: true
      }
    });

    return NextResponse.json({ friends: friendsList, pendingRequests });
  } catch (error: any) {
    console.error("Lỗi lấy danh sách bạn bè:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
