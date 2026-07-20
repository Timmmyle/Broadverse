import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { checkAndUnlockAchievements } from "./progression";


const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

const connectionString = process.env.DATABASE_URL;

// Khởi tạo Pool kết nối PostgreSQL (chỉ tạo 1 lần duy nhất trong quá trình hot-reload)
const pool = globalForPrisma.pgPool || new Pool({ connectionString });
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pgPool = pool;
}

const adapter = new PrismaPg(pool);

const basePrisma = globalForPrisma.prisma || new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

// Đăng ký Prisma Client Extension tự động ghi lịch sử trận đấu (MatchHistory) khi GameRoom đổi trạng thái FINISHED
export const prisma = basePrisma.$extends({
  query: {
    gameRoom: {
      async update({ args, query }) {
        const result = await query(args);
        if (result && result.status === "FINISHED" && result.gameType !== "BAU_CUA") {
          try {
            const existing = await basePrisma.matchHistory.findUnique({
              where: { id: result.id }
            });
            if (!existing) {
              await basePrisma.matchHistory.create({
                data: {
                  id: result.id,
                  gameType: result.gameType || "CARO",
                  playerXId: result.playerXId || "",
                  playerOId: result.playerOId || "",
                  winnerId: result.winnerId || null,
                  draw: typeof result.draw === "boolean" ? result.draw : false,
                  wager: typeof result.wager === "number" ? result.wager : 0,
                  expGained: 50, // Lượng exp cơ bản thưởng
                  createdAt: (result.createdAt as unknown as Date) || new Date(),
                  endedAt: new Date(),
                }
              });
              console.log(`[PrismaExtension] Đã tự động tạo MatchHistory cho trận đấu: ${result.id}`);

              // --- MỞ KHÓA THÀNH TỰU CÁ NHÂN ---
              if (result.playerXId) {
                await checkAndUnlockAchievements(result.playerXId, basePrisma);
              }
              if (result.playerOId && result.playerOId !== "bot") {
                await checkAndUnlockAchievements(result.playerOId, basePrisma);
              }

              // --- LOGIC LÊN CẤP & NHIỆM VỤ TỔ ĐỘI ---
              const partiesToUpdate = new Set<string>();
              if (result.playerXId) {
                const memberX = await basePrisma.partyMember.findUnique({
                  where: { userId: result.playerXId }
                });
                if (memberX) partiesToUpdate.add(memberX.partyId);
              }
              if (result.playerOId && result.playerOId !== "bot") {
                const memberO = await basePrisma.partyMember.findUnique({
                  where: { userId: result.playerOId }
                });
                if (memberO) partiesToUpdate.add(memberO.partyId);
              }

              for (const partyId of partiesToUpdate) {
                const party = await basePrisma.party.findUnique({
                  where: { id: partyId },
                  include: { members: true, missions: true }
                });

                if (party) {
                  const memberIds = party.members.map(m => m.userId);
                  const hasWinner = result.winnerId && memberIds.includes(result.winnerId);
                  const isDraw = result.draw === true;

                  // Thưởng EXP cho tổ đội
                  const expGained = hasWinner ? 40 : (isDraw ? 20 : 15);
                  let newExp = party.exp + expGained;
                  let newLevel = party.level;
                  let expNeeded = newLevel * 100;

                  while (newExp >= expNeeded) {
                    newExp -= expNeeded;
                    newLevel += 1;
                    expNeeded = newLevel * 100;
                  }

                  // Tạo nhiệm vụ mặc định nếu chưa có
                  let missions = party.missions;
                  if (missions.length === 0) {
                    await basePrisma.partyMission.createMany({
                      data: [
                        { partyId, title: "Cả đội thắng 5 trận cùng nhau", type: "WIN_GAMES", targetValue: 5, rewardCoins: 30, rewardExp: 100 },
                        { partyId, title: "Cả đội chơi 10 trận cùng nhau", type: "PLAY_GAMES", targetValue: 10, rewardCoins: 40, rewardExp: 120 }
                      ]
                    });
                    missions = await basePrisma.partyMission.findMany({
                      where: { partyId }
                    });
                  }

                  // Cập nhật tiến độ nhiệm vụ tổ đội
                  for (const mission of missions) {
                    let increment = 0;
                    if (mission.type === "PLAY_GAMES") {
                      const playingMembers = party.members.filter(m => m.userId === result.playerXId || m.userId === result.playerOId).length;
                      increment = playingMembers;
                    } else if (mission.type === "WIN_GAMES" && hasWinner) {
                      increment = 1;
                    }

                    if (increment > 0) {
                      const newCurrentValue = mission.currentValue + increment;
                      const isCompletedNow = newCurrentValue >= mission.targetValue && mission.currentValue < mission.targetValue;

                      await basePrisma.partyMission.update({
                        where: { id: mission.id },
                        data: { currentValue: Math.min(mission.targetValue, newCurrentValue) }
                      });

                      if (isCompletedNow) {
                        newExp += mission.rewardExp;
                        while (newExp >= expNeeded) {
                          newExp -= expNeeded;
                          newLevel += 1;
                          expNeeded = newLevel * 100;
                        }

                        // Thưởng Trứng cho tất cả thành viên trong tổ đội
                        await basePrisma.user.updateMany({
                          where: { id: { in: memberIds } },
                          data: { eggs: { increment: mission.rewardCoins } }
                        });
                        console.log(`[PartyMission] Tổ đội ${partyId} hoàn thành: ${mission.title}. Thưởng ${mission.rewardCoins} Trứng cho các thành viên.`);
                      }
                    }
                  }

                  await basePrisma.party.update({
                    where: { id: partyId },
                    data: {
                      level: newLevel,
                      exp: newExp
                    }
                  });
                  console.log(`[PartyLeveling] Tổ đội ${partyId} nhận +${expGained} EXP. Cấp độ mới: ${newLevel} (${newExp}/${expNeeded} XP)`);
                }
              }

            }
          } catch (err) {
            console.error("Lỗi tự động ghi MatchHistory/Tổ đội trong Prisma extension:", err);
          }
        }
        return result;
      }
    }
  }
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

// Tự động cấu hình kích hoạt Supabase Realtime Replication cho các bảng cần thiết.
if (typeof window === "undefined") {
  basePrisma.$executeRawUnsafe('ALTER PUBLICATION supabase_realtime ADD TABLE "GameRoom";')
    .catch(() => { /* Bỏ qua nếu đã được thêm từ trước */ });
    
  basePrisma.$executeRawUnsafe('ALTER PUBLICATION supabase_realtime ADD TABLE "MatchmakingQueue";')
    .catch(() => { /* Bỏ qua nếu đã được thêm từ trước */ });
}
