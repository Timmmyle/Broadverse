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

    let invoiceCode = "";
    let amount = 0;

    // 1. Phân loại cấu trúc payload nhận được (Gateway Webhook vs Bank Webhook)
    if (body.notification_type === "ORDER_PAID" && body.order) {
      // Dạng Webhook Cổng thanh toán (Payment Gateway / IPN)
      invoiceCode = body.order.order_invoice_number || "";
      amount = parseFloat(body.order.order_amount) || 0;
    } else {
      // Dạng Webhook Ngân hàng thô (Bank Webhook)
      const content = body.content || "";
      const cleanContent = content.toUpperCase().replace(/\s+/g, "");
      const match = cleanContent.match(/BG([0-9A-F]{8})P(1|6)/);
      if (match) {
        invoiceCode = match[0];
      }
      amount = body.transferAmount || 0;
    }

    // 2. Chuẩn hóa và trích xuất thông tin gói
    const cleanInvoice = invoiceCode.toUpperCase().replace(/\s+/g, "");
    const match = cleanInvoice.match(/BG([0-9A-F]{8})P(1|6)/);

    if (!match) {
      console.log(`Bỏ qua: Không trích xuất được mã khớp lệnh BG[8_HEX]P[1|6] từ "${invoiceCode}"`);
      return NextResponse.json({ success: true, message: "Ignored: Invoice code pattern not matched" });
    }

    const userIdPrefix = match[1].toLowerCase();
    const duration = parseInt(match[2]) === 6 ? 6 : 1;

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
