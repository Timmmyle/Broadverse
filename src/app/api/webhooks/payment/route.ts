import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ success: true, message: "SePay Webhook is active" });
}

export async function POST(req: Request) {
  try {
    // 1. Xác thực request từ SePay nếu cấu hình TOKEN trong file .env
    const authHeader = req.headers.get("authorization");
    const webhookToken = process.env.SEPAY_WEBHOOK_TOKEN;

    if (webhookToken && authHeader !== `Bearer ${webhookToken}`) {
      console.warn("Cảnh báo: Yêu cầu Webhook không được xác thực chính xác.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("Nhận callback thanh toán từ SePay:", body);

    const content = body.content || "";
    // Chuẩn hóa nội dung chuyển khoản: chuyển thành chữ in hoa và loại bỏ mọi khoảng trắng
    const cleanContent = content.toUpperCase().replace(/\s+/g, "");

    // RegExp khớp định dạng: BG[8_KÝ_TỰ_HEX]P[1_HOẶC_6]
    // Ví dụ: BGE4E0B04AP1 hoặc BGE4E0B04AP6
    const match = cleanContent.match(/BG([0-9A-F]{8})P(1|6)/);

    if (!match) {
      console.log(`Bỏ qua: Nội dung chuyển khoản "${content}" không khớp định dạng BG[8_HEX]P[1|6]`);
      return NextResponse.json({ success: true, message: "Ignored: Pattern not matched" });
    }

    const userIdPrefix = match[1].toLowerCase();
    const duration = parseInt(match[2]) === 6 ? 6 : 1;
    const amount = body.transferAmount || 0;

    // Kiểm tra số tiền nhận được so với giá trị gói
    const expectedAmount = duration === 6 ? 349000 : 69000;
    if (amount < expectedAmount) {
      console.warn(`Cảnh báo: Số tiền nhận được (${amount}đ) ít hơn giá trị gói (${expectedAmount}đ).`);
      // Vẫn xử lý hoặc có thể trả về lỗi tuỳ thuộc vào quy trình vận hành. Ở đây chúng ta vẫn ghi nhận để tối ưu trải nghiệm.
    }

    // Tìm kiếm người dùng có ID bắt đầu bằng prefix
    const user = await prisma.user.findFirst({
      where: {
        id: {
          startsWith: userIdPrefix
        }
      }
    });

    if (!user) {
      console.error(`Lỗi: Không tìm thấy người chơi có ID bắt đầu bằng: ${userIdPrefix}`);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Tính toán hạn sử dụng Premium mới
    let premiumUntil: Date | null = null;
    const now = new Date();
    const daysToAdd = duration === 6 ? 180 : 30;

    if (user.isPremium && user.premiumUntil === null) {
      // Đã có Premium vĩnh viễn, giữ nguyên
      premiumUntil = null;
    } else if (user.isPremium && user.premiumUntil && new Date(user.premiumUntil) > now) {
      // Đang có Premium hạn dùng, cộng dồn tiếp
      premiumUntil = new Date(new Date(user.premiumUntil).getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    } else {
      // Hết hạn hoặc chưa có, tính từ thời điểm hiện tại
      premiumUntil = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    }

    // Cập nhật thông tin Premium của người chơi
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isPremium: true,
        premiumUntil: premiumUntil
      }
    });

    console.log(`Đã nâng cấp Premium thành công cho ${updatedUser.username} (${duration} tháng, hạn dùng: ${premiumUntil})`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Lỗi xử lý webhook thanh toán:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
