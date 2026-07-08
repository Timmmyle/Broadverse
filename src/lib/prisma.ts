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

export const prisma = globalForPrisma.prisma || new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Tự động cấu hình kích hoạt Supabase Realtime Replication cho các bảng cần thiết.
// Việc này giúp đồng bộ nước đi và hàng chờ ghép trận ngay lập tức mà không cần người dùng tự bật bằng tay.
if (typeof window === "undefined") {
  prisma.$executeRawUnsafe('ALTER PUBLICATION supabase_realtime ADD TABLE "GameRoom";')
    .catch(() => { /* Bỏ qua nếu đã được thêm từ trước */ });
    
  prisma.$executeRawUnsafe('ALTER PUBLICATION supabase_realtime ADD TABLE "MatchmakingQueue";')
    .catch(() => { /* Bỏ qua nếu đã được thêm từ trước */ });
}
