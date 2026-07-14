import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  // Bảo mật cron-job bằng CRON_SECRET nếu được cấu hình
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Xóa các hàng chờ ghép trận có tuổi thọ lớn hơn 2 phút
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const queueResult = await prisma.matchmakingQueue.deleteMany({
      where: {
        createdAt: {
          lt: twoMinutesAgo,
        },
      },
    });

    // 2. Xóa các trận đấu (GameRoom) đã kết thúc cũ hơn 2 giờ (có điều kiện đã lưu MatchHistory)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const finishedRooms = await prisma.gameRoom.findMany({
      where: {
        status: "FINISHED",
        createdAt: {
          lt: twoHoursAgo,
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    const finishedRoomIds = finishedRooms.map((r) => r.id);
    const histories = await prisma.matchHistory.findMany({
      where: {
        id: {
          in: finishedRoomIds,
        },
      },
      select: {
        id: true,
      },
    });
    const historyIds = new Set(histories.map((h) => h.id));
    const roomsToDelete = finishedRooms.filter((r) => historyIds.has(r.id));
    const roomsToDeleteIds = roomsToDelete.map((r) => r.id);

    // 3. Xóa các trận đấu bỏ hoang cũ hơn 30 phút (trạng thái WAITING hoặc PLAYING)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const abandonedRooms = await prisma.gameRoom.findMany({
      where: {
        status: {
          in: ["WAITING", "PLAYING"],
        },
        createdAt: {
          lt: thirtyMinutesAgo,
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
    });
    const abandonedRoomIds = abandonedRooms.map((r) => r.id);

    // Ghi log giám sát trước khi xóa để đối chiếu lỗi
    if (roomsToDelete.length > 0) {
      console.log(
        "[CRON CLEANUP] Xóa các trận đấu đã hoàn thành cũ hơn 2 giờ (có MatchHistory):",
        JSON.stringify(roomsToDelete)
      );
    }
    if (abandonedRooms.length > 0) {
      console.log(
        "[CRON CLEANUP] Xóa các trận đấu bỏ hoang cũ hơn 30 phút (WAITING/PLAYING):",
        JSON.stringify(abandonedRooms)
      );
    }

    let deletedFinishedCount = 0;
    if (roomsToDeleteIds.length > 0) {
      const delFinished = await prisma.gameRoom.deleteMany({
        where: {
          id: {
            in: roomsToDeleteIds,
          },
        },
      });
      deletedFinishedCount = delFinished.count;
    }

    let deletedAbandonedCount = 0;
    if (abandonedRoomIds.length > 0) {
      const delAbandoned = await prisma.gameRoom.deleteMany({
        where: {
          id: {
            in: abandonedRoomIds,
          },
        },
      });
      deletedAbandonedCount = delAbandoned.count;
    }

    return NextResponse.json({
      success: true,
      message: `Đã dọn dẹp ${queueResult.count} hàng chờ ghép trận, đã xóa ${deletedFinishedCount} trận đã kết thúc (>2h) và ${deletedAbandonedCount} trận bỏ hoang (>30p).`,
    });
  } catch (error: any) {
    console.error("Lỗi dọn dẹp hệ thống:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
