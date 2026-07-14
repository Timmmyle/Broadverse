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
            }
          } catch (err) {
            console.error("Lỗi tự động ghi MatchHistory trong Prisma extension:", err);
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
