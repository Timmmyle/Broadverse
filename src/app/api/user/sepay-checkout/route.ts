import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SePayPgClient } from "sepay-pg-node";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const duration = body.duration === 6 ? 6 : 1;

    const profile = await prisma.user.findUnique({
      where: { id: user.id }
    });

    if (!profile) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ người chơi" }, { status: 404 });
    }

    // Khởi tạo SePay PG Client
    const merchantId = process.env.SEPAY_MERCHANT_ID || "SP-TEST-LA27B439";
    const secretKey = process.env.SEPAY_SECRET_KEY || "spsk_test_J38k4BQgZ9z87NLa64paj69tYLspoAEY";
    const env = (process.env.SEPAY_ENV || "sandbox") as "sandbox" | "production";

    const client = new SePayPgClient({
      env,
      merchant_id: merchantId,
      secret_key: secretKey
    });

    const amount = duration === 6 ? 349000 : 69000;
    const shortId = profile.id.replace(/-/g, "").slice(0, 8).toUpperCase();
    
    // Tạo mã chuyển khoản/invoice: Ví dụ BGE4E0B04AP1
    const invoiceCode = `BG${shortId}P${duration}`;

    // Lấy origin động từ request headers để đảm bảo redirect đúng về localhost hoặc domain production
    const origin = req.headers.get("origin") || `http://${req.headers.get("host") || "localhost:3000"}`;
    const successUrl = `${origin}/?payment=success`;
    const errorUrl = `${origin}/?payment=error`;
    const cancelUrl = `${origin}/?payment=cancel`;

    // Khởi tạo link checkout
    const checkoutURL = client.checkout.initCheckoutUrl();

    // Tạo các trường dữ liệu thanh toán
    const checkoutFormfields = client.checkout.initOneTimePaymentFields({
      payment_method: "BANK_TRANSFER",
      order_invoice_number: invoiceCode,
      order_amount: amount,
      currency: "VND",
      order_description: invoiceCode, // Nội dung chuyển khoản sẽ chứa mã này để khớp webhook
      success_url: successUrl,
      error_url: errorUrl,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({
      checkoutURL,
      checkoutFormfields,
      invoiceCode,
      amount
    });
  } catch (error: any) {
    console.error("Lỗi tạo link checkout SePay:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
