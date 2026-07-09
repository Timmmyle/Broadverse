export interface ShopItem {
  id: string;
  name: string;
  type: "SYMBOL" | "FRAME" | "THEME" | "SFX" | "EMOJI";
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
    sfxType?: "retro" | "laser" | "epic" | "synth"; // Dành cho SFX
    emoji?: string; // Dành cho Emoji
  };
  isPremiumOnly?: boolean; // Chỉ dành cho Premium mua
  isEventOnly?: boolean; // Chỉ dành cho Sự kiện đổi (bằng Vỏ sò)
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

  // SOUND EFFECTS (Hiệu ứng âm thanh nước đi)
  {
    id: "sfx_retro",
    name: "👾 8-Bit Arcade SFX",
    type: "SFX",
    price: 120,
    description: "Âm thanh bíp bíp cổ điển phong cách điện tử xèng.",
    visuals: { sfxType: "retro" }
  },
  {
    id: "sfx_laser",
    name: "🚀 Space Laser SFX",
    type: "SFX",
    price: 150,
    description: "Tiếng súng bắn laser công nghệ viễn tưởng cực ngầu.",
    visuals: { sfxType: "laser" }
  },
  {
    id: "sfx_epic",
    name: "⚡ Triad Epic SFX (VIP)",
    type: "SFX",
    price: 220,
    description: "Hợp âm hoành tráng biểu thị quyền uy của VIP.",
    visuals: { sfxType: "epic" },
    isPremiumOnly: true
  },

  // EMOJIS (Biểu cảm nhanh)
  {
    id: "emoji_cool",
    name: "😎 Kính Đen Ngầu",
    type: "EMOJI",
    price: 80,
    description: "Gửi biểu cảm cool ngầu trêu chọc đối thủ.",
    visuals: { emoji: "😎" }
  },
  {
    id: "emoji_rage",
    name: "😡 Nổi Giận Lôi Đình",
    type: "EMOJI",
    price: 80,
    description: "Gửi biểu cảm giận dữ khi bị đối phương chặn nước đi.",
    visuals: { emoji: "😡" }
  },
  {
    id: "emoji_celebrate",
    name: "🎉 Ăn Mừng Chiến Thắng (VIP)",
    type: "EMOJI",
    price: 120,
    description: "Bắn pháo hoa ăn mừng dành riêng cho VIP.",
    visuals: { emoji: "🎉" },
    isPremiumOnly: true
  },

  // PREMIUM VIP EXCLUSIVE ITEMS (Vật phẩm VIP)
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
  },

  // EVENT EXCLUSIVE ITEMS (Vật phẩm sự kiện - Đổi bằng Vỏ Sò)
  {
    id: "sym_summer_melon",
    name: "🍉 Dưa Hấu vs 🥥 Quả Dừa",
    type: "SYMBOL",
    price: 80, // Giá tính bằng Vỏ Sò
    description: "Quân cờ Mùa Hè độc quyền, chỉ có thể đổi bằng Vỏ Sò trong thời gian sự kiện.",
    visuals: { symbolX: "🍉", symbolO: "🥥" },
    isEventOnly: true
  },
  {
    id: "frame_summer_sand",
    name: "Khung Cát Vàng Bãi Biển",
    type: "FRAME",
    price: 100, // Giá tính bằng Vỏ Sò
    description: "Khung avatar bãi cát vàng biển xanh, chỉ có thể đổi bằng Vỏ Sò.",
    visuals: { className: "outline-[4px] outline-yellow-200 outline-offset-1 ring-4 ring-orange-300 shadow-[0_0_8px_rgba(253,224,71,0.6)]" },
    isEventOnly: true
  },
  {
    id: "theme_summer_ocean",
    name: "Blue Ocean",
    type: "THEME",
    price: 150, // Giá tính bằng Vỏ Sò
    description: "Bàn cờ sóng biển xanh ngọc cực mát mẻ cho ngày hè oi bức.",
    visuals: { className: "bg-[#0b4d6b] border-cyan-400 text-cyan-200" },
    isEventOnly: true
  },
  {
    id: "sfx_beach",
    name: "🌊 Sóng Biển Rì Rào SFX",
    type: "SFX",
    price: 80, // Giá tính bằng Vỏ Sò
    description: "Tiếng sóng biển rì rào cực kỳ thư giãn khi đi cờ.",
    visuals: { sfxType: "synth" },
    isEventOnly: true
  },
  {
    id: "emoji_beach",
    name: "🏖️ Kì Nghỉ Bãi Biển",
    type: "EMOJI",
    price: 60, // Giá tính bằng Vỏ Sò
    description: "Biểu cảm kì nghỉ bãi biển lãng mạn.",
    visuals: { emoji: "🏖️" },
    isEventOnly: true
  }
];

export function getShopItem(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.id === id);
}
