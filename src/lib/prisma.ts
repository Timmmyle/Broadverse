import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

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
        if (result && result.status === "FINISHED") {
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

              // --- LOGIC LÊN CẤP TỔ ĐỘI ---
              // Kiểm tra xem hai người chơi có ở chung một tổ đội không
              if (result.playerXId && result.playerOId) {
                const memberX = await basePrisma.partyMember.findUnique({
                  where: { userId: result.playerXId }
                });
                const memberO = await basePrisma.partyMember.findUnique({
                  where: { userId: result.playerOId }
                });

                if (memberX && memberO && memberX.partyId === memberO.partyId) {
                  const partyId = memberX.partyId;
                  const party = await basePrisma.party.findUnique({
                    where: { id: partyId }
                  });

                  if (party) {
                    // Cả đội thi đấu cùng nhau: +15 EXP hoàn thành, +40 EXP nếu có thắng cuộc (không hòa)
                    const isDraw = result.draw === true;
                    const expGained = isDraw ? 15 : 40;

                    let newExp = party.exp + expGained;
                    let newLevel = party.level;
                    let expNeeded = newLevel * 100; // 100 EXP * cấp độ hiện tại để lên cấp

                    while (newExp >= expNeeded) {
                      newExp -= expNeeded;
                      newLevel += 1;
                      expNeeded = newLevel * 100;
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
