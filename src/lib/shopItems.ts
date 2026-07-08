export interface ShopItem {
  id: string;
  name: string;
  type: "SYMBOL" | "FRAME" | "THEME";
  price: number;
  description: string;
  visuals: {
    // Với Symbol: [symbolX, symbolO]
    // Với Frame: class CSS hoặc mã màu border
    // Với Theme: class CSS của bàn cờ
    symbolX?: string;
    symbolO?: string;
    className?: string;
    color?: string;
  };
  isPremiumOnly?: boolean; // Chỉ dành cho Premium mua
}

export const SHOP_ITEMS: ShopItem[] = [
  // SYMBOLS (Quân cờ)
  {
    id: "sym_classic",
    name: "Classic (X & O)",
    type: "SYMBOL",
    price: 0,
    description: "Quân cờ X và O truyền thống.",
    visuals: { symbolX: "X", symbolO: "O" }
  },
  {
    id: "sym_battle",
    name: "⚔️ Kiếm vs 🛡️ Khiên",
    type: "SYMBOL",
    price: 100,
    description: "Biến trận đấu thành chiến trường trung cổ.",
    visuals: { symbolX: "⚔️", symbolO: "🛡️" }
  },
  {
    id: "sym_cosmic",
    name: "☀️ Mặt Trời vs 🌙 Mặt Trăng",
    type: "SYMBOL",
    price: 150,
    description: "Đại chiến giữa ngày và đêm.",
    visuals: { symbolX: "☀️", symbolO: "🌙" }
  },
  {
    id: "sym_love",
    name: "❤️ Tim vs ⭐ Sao",
    type: "SYMBOL",
    price: 200,
    description: "Cặp biểu tượng pixel dễ thương.",
    visuals: { symbolX: "❤️", symbolO: "⭐" }
  },
  {
    id: "sym_elements",
    name: "🔥 Lửa vs ❄️ Băng",
    type: "SYMBOL",
    price: 250,
    description: "Băng hoả lưỡng nghi thiên.",
    visuals: { symbolX: "🔥", symbolO: "❄️" }
  },

  // FRAMES (Khung Avatar)
  {
    id: "frame_default",
    name: "Mặc định",
    type: "FRAME",
    price: 0,
    description: "Không dùng viền khung.",
    visuals: { className: "border-0" }
  },
  {
    id: "frame_bronze",
    name: "Khung Gỗ Sồi",
    type: "FRAME",
    price: 80,
    description: "Khung gỗ mộc mạc cổ xưa.",
    visuals: { className: "outline-[4px] outline-amber-700 outline-offset-1" }
  },
  {
    id: "frame_iron",
    name: "Khung Sắt Rèn",
    type: "FRAME",
    price: 150,
    description: "Khung sắt kiên cố xám đen.",
    visuals: { className: "outline-[4px] outline-gray-500 outline-offset-1" }
  },
  {
    id: "frame_gold",
    name: "Khung Hoàng Kim",
    type: "FRAME",
    price: 300,
    description: "Khung vàng lấp lánh sang trọng.",
    visuals: { className: "outline-[4px] outline-yellow-400 outline-offset-1 animate-pulse" }
  },
  {
    id: "frame_rainbow",
    name: "Khung Cầu Vồng RGB",
    type: "FRAME",
    price: 500,
    description: "Khung chuyển động màu đa sắc cực chất.",
    visuals: { className: "outline-[4px] outline-offset-1 ring-4 ring-offset-2 ring-red-500 animate-bounce" }
  },

  // THEMES (Chủ đề bàn cờ)
  {
    id: "theme_classic",
    name: "Classic Gray",
    type: "THEME",
    price: 0,
    description: "Bàn cờ xám mặc định.",
    visuals: { className: "bg-[#1e1e22]" }
  },
  {
    id: "theme_retro_green",
    name: "Gameboy Green",
    type: "THEME",
    price: 120,
    description: "Màu xanh lá phong cách màn hình Gameboy cổ.",
    visuals: { className: "bg-[#2b5c2a] border-emerald-950" }
  },
  {
    id: "theme_cyber",
    name: "Cyber Neon",
    type: "THEME",
    price: 250,
    description: "Tông hồng tím neon đậm chất Cyberpunk.",
    visuals: { className: "bg-[#250d3a] border-fuchsia-600 text-fuchsia-400" }
  },
  {
    id: "theme_desert",
    name: "Desert Sand",
    type: "THEME",
    price: 180,
    description: "Màu cát sa mạc ấm áp phong cách cờ gỗ xưa.",
    visuals: { className: "bg-[#b88b4a] border-amber-950 text-yellow-900" }
  },
  // PREMIUM VIP EXCLUSIVE ITEMS
  {
    id: "sym_premium_crown",
    name: "👑 Vương Miện vs 💎 Kim Cương (VIP)",
    type: "SYMBOL",
    price: 350,
    description: "Quân cờ biểu tượng quyền quý dành riêng cho tài khoản VIP Premium.",
    visuals: { symbolX: "👑", symbolO: "💎" },
    isPremiumOnly: true
  },
  {
    id: "frame_premium_phoenix",
    name: "Khung Phượng Hoàng Lửa (VIP)",
    type: "FRAME",
    price: 450,
    description: "Khung avatar Phượng Hoàng rực lửa quyền lực chỉ dành cho VIP.",
    visuals: { className: "outline-[4px] outline-red-600 outline-offset-1 ring-4 ring-offset-2 ring-yellow-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" },
    isPremiumOnly: true
  },
  {
    id: "theme_premium_gold",
    name: "Royal Gold (VIP)",
    type: "THEME",
    price: 400,
    description: "Bàn cờ hoàng gia viền mạ vàng bóng bẩy dành riêng cho VIP.",
    visuals: { className: "bg-[#2d220a] border-yellow-500 text-yellow-400" },
    isPremiumOnly: true
  }
];

export function getShopItem(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.id === id);
}
