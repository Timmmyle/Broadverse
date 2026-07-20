export interface ShopItem {
  id: string;
  name: string;
  type: "SYMBOL" | "FRAME" | "THEME" | "SFX" | "EMOJI" | "SKIN" | "DICE" | "CARDBACK";
  price: number;
  description: string;
  visuals: {
    symbolX?: string;
    symbolO?: string;
    className?: string;
    color?: string;
    sfxType?: "retro" | "laser" | "epic" | "synth"; // Dành cho SFX
    emoji?: string; // Dành cho Emoji
    skinUrl?: string; // Skin Gà hoặc xúc xắc
    cardBackUrl?: string;
  };
  isPremiumOnly?: boolean; // Chỉ dành cho Premium mua (Golden Egg)
  isEventOnly?: boolean; // Chỉ dành cho Sự kiện đổi
}

export const SHOP_ITEMS: ShopItem[] = [
  // 1. SYMBOLS (Quân cờ)
  {
    id: "sym_classic",
    name: "Classic X & O",
    type: "SYMBOL",
    price: 0,
    description: "Quân cờ X và O truyền thống.",
    visuals: { symbolX: "X", symbolO: "O" }
  },
  {
    id: "sym_chicken_egg",
    name: "🥚 Trứng Gà vs 🐣 Gà Con",
    type: "SYMBOL",
    price: 80,
    description: "Biểu tượng Trứng Gà đấu Gà Con.",
    visuals: { symbolX: "🥚", symbolO: "🐣" }
  },
  {
    id: "sym_battle",
    name: "⚔️ Kiếm vs 🛡️ Khiên",
    type: "SYMBOL",
    price: 100,
    description: "Trận chiến trung cổ bảo vệ chuồng.",
    visuals: { symbolX: "⚔️", symbolO: "🛡️" }
  },
  {
    id: "sym_premium_crown",
    name: "👑 Vương Miện vs 💎 Kim Cương",
    type: "SYMBOL",
    price: 150,
    description: "Biểu tượng hoàng gia đẳng cấp VIP.",
    visuals: { symbolX: "👑", symbolO: "💎" },
    isPremiumOnly: true
  },

  // 2. CHICKEN SKINS (Ngoại hình Gà)
  {
    id: "skin_default",
    name: "🐔 Gà Mặc Định",
    type: "SKIN",
    price: 0,
    description: "Chú gà trắng đáng yêu lúc mới nở.",
    visuals: { className: "bg-white" }
  },
  {
    id: "skin_samurai",
    name: "🏯 Samurai Chicken",
    type: "SKIN",
    price: 200,
    description: "Skin Gà chiến binh Samurai cổ truyền Nhật Bản.",
    visuals: { className: "bg-red-800 text-yellow-500 border-yellow-400" }
  },
  {
    id: "skin_ninja",
    name: "🥷 Ninja Chicken",
    type: "SKIN",
    price: 200,
    description: "Skin Gà sát thủ bóng đêm huyền bí.",
    visuals: { className: "bg-gray-900 text-purple-400 border-purple-500" }
  },
  {
    id: "skin_pirate",
    name: "🏴‍☠️ Pirate Chicken",
    type: "SKIN",
    price: 250,
    description: "Skin Gà cướp biển khét tiếng đại dương.",
    visuals: { className: "bg-amber-950 text-yellow-600" }
  },
  {
    id: "skin_cyber",
    name: "🤖 Cyber Chicken",
    type: "SKIN",
    price: 300,
    description: "Skin Gà người máy tương lai tích hợp AI.",
    visuals: { className: "bg-[#0f172a] text-cyan-400 border-cyan-400 shadow-[0_0_10px_#22d3ee]" }
  },
  {
    id: "skin_phoenix",
    name: "🔥 Phoenix Chicken (VIP)",
    type: "SKIN",
    price: 500,
    description: "Skin Phượng Hoàng tái sinh rực lửa.",
    visuals: { className: "bg-gradient-to-r from-red-600 to-orange-500 text-yellow-200 border-yellow-400 shadow-[0_0_15px_#ea580c] animate-pulse" },
    isPremiumOnly: true
  },
  {
    id: "skin_discord",
    name: "👾 Discord Chicken",
    type: "SKIN",
    price: 99999,
    description: "Trang phục chú gà Gamer Discord độc quyền từ vuiga.com.",
    visuals: { className: "bg-[#5865F2] text-white border-white shadow-[0_0_10px_#5865F2]" }
  },


  // 3. AVATAR FRAMES (Khung Avatar)
  {
    id: "frame_default",
    name: "Khung Mặc Định",
    type: "FRAME",
    price: 0,
    description: "Khung gỗ chuồng đơn giản.",
    visuals: { className: "border-0" }
  },
  {
    id: "frame_wood",
    name: "🪓 Khung Gỗ Chuồng",
    type: "FRAME",
    price: 50,
    description: "Khung làm từ các thanh gỗ mộc mạc.",
    visuals: { className: "outline-[3px] outline-amber-800 outline-offset-1" }
  },
  {
    id: "frame_iron",
    name: "⛓️ Khung Sắt Rèn",
    type: "FRAME",
    price: 100,
    description: "Khung sắt bảo vệ chống cáo hoang.",
    visuals: { className: "outline-[3px] outline-gray-500 outline-offset-1" }
  },
  {
    id: "frame_gold",
    name: "🏆 Khung Hoàng Kim",
    type: "FRAME",
    price: 250,
    description: "Khung mạ vàng hoàng gia bóng loáng.",
    visuals: { className: "outline-[3px] outline-yellow-500 outline-offset-1 animate-pulse" }
  },
  {
    id: "frame_fire",
    name: "🔥 Khung Rực Lửa",
    type: "FRAME",
    price: 350,
    description: "Khung được đúc từ dung nham nóng chảy.",
    visuals: { className: "outline-[3px] outline-red-600 outline-offset-1 shadow-[0_0_8px_#ef4444]" }
  },
  {
    id: "frame_phoenix",
    name: "🦅 Khung Phượng Hoàng (VIP)",
    type: "FRAME",
    price: 500,
    description: "Khung lông vũ Phượng Hoàng lấp lánh.",
    visuals: { className: "outline-[4px] outline-yellow-400 outline-offset-1 ring-4 ring-orange-500 animate-pulse shadow-[0_0_12px_#f59e0b]" },
    isPremiumOnly: true
  },

  // 4. BANNERS (Bảng Hiệu Profile)
  {
    id: "banner_classic",
    name: "Classic Wood Banner",
    type: "CARDBACK", // Dùng type cardback/banner tương tự
    price: 0,
    description: "Phông nền gỗ cổ điển của chuồng gà.",
    visuals: { className: "bg-amber-900/50" }
  },
  {
    id: "banner_nature",
    name: "🌳 Đồng Cỏ Xanh",
    type: "CARDBACK",
    price: 80,
    description: "Đồng cỏ xanh tươi mát mẻ thích hợp chăn nuôi.",
    visuals: { className: "bg-emerald-900/50" }
  },
  {
    id: "banner_galaxy",
    name: "🌌 Tinh Vân Gà",
    type: "CARDBACK",
    price: 180,
    description: "Giải ngân hà với chòm sao Gà Trống độc đáo.",
    visuals: { className: "bg-indigo-950/70 text-indigo-200" }
  },
  {
    id: "banner_cyber",
    name: "⚡ Cyber Neon Space (VIP)",
    type: "CARDBACK",
    price: 300,
    description: "Phông nền Neon tương lai sôi động.",
    visuals: { className: "bg-[#0b0c10] border-cyan-500 shadow-[inset_0_0_10px_#00d2ff]" },
    isPremiumOnly: true
  },

  // 5. DICE SKINS (Giao diện Xúc Xắc)
  {
    id: "dice_wood",
    name: "🎲 Xúc Xắc Gỗ Sồi",
    type: "DICE",
    price: 0,
    description: "Bộ xúc xắc làm từ gỗ sồi bền đẹp.",
    visuals: { className: "bg-amber-700 text-white" }
  },
  {
    id: "dice_crystal",
    name: "💎 Xúc Xắc Pha Lê",
    type: "DICE",
    price: 150,
    description: "Bộ xúc xắc pha lê lung linh nhiều màu sắc.",
    visuals: { className: "bg-cyan-600/50 border-cyan-400" }
  },
  {
    id: "dice_golden_egg",
    name: "✨ Xúc Xắc Trứng Vàng (VIP)",
    type: "DICE",
    price: 350,
    description: "Bộ xúc xắc mô phỏng Trứng Vàng may mắn.",
    visuals: { className: "bg-gradient-to-b from-yellow-400 to-yellow-600 text-yellow-950 font-bold" },
    isPremiumOnly: true
  },

  // 6. BOARD THEMES (Chủ đề bàn cờ)
  {
    id: "theme_classic",
    name: "Classic Nest",
    type: "THEME",
    price: 0,
    description: "Giao diện tổ rơm truyền thống.",
    visuals: { className: "bg-[#1e1e22]" }
  },
  {
    id: "theme_nature",
    name: "Green Pasture",
    type: "THEME",
    price: 100,
    description: "Màu đồng cỏ xanh mướt mát mắt.",
    visuals: { className: "bg-[#1c3a27] border-emerald-800 text-emerald-100" }
  },
  {
    id: "theme_cyber",
    name: "Neon Coop",
    type: "THEME",
    price: 200,
    description: "Phong cách chuồng gà công nghệ viễn tưởng.",
    visuals: { className: "bg-[#1f0f33] border-purple-500 text-purple-200" }
  },

  // 7. SOUND EFFECTS (Âm thanh nước đi)
  {
    id: "sfx_retro",
    name: "👾 8-Bit Arcade SFX",
    type: "SFX",
    price: 100,
    description: "Âm thanh bíp bíp cổ điển điện tử xèng.",
    visuals: { sfxType: "retro" }
  },
  {
    id: "sfx_laser",
    name: "🚀 Space Laser SFX",
    type: "SFX",
    price: 150,
    description: "Tiếng súng laser viễn tưởng siêu ngầu.",
    visuals: { sfxType: "laser" }
  },

  // 8. EMOJIS (Biểu cảm Gà)
  {
    id: "emoji_lol",
    name: "😂 Gà Cười Haha",
    type: "EMOJI",
    price: 50,
    description: "Thả biểu cảm cười lăn lộn.",
    visuals: { emoji: "😂" }
  },
  {
    id: "emoji_chicken_dance",
    name: "🕺 Điệu Nhảy Gà Con",
    type: "EMOJI",
    price: 80,
    description: "Điệu nhảy vỗ cánh chọc tức đối thủ.",
    visuals: { emoji: "🕺" }
  },
  {
    id: "emoji_chicken_scream",
    name: "😱 Gà Hét Thất Thanh",
    type: "EMOJI",
    price: 80,
    description: "Biểu cảm hoảng hốt khi bị chặn nước đi.",
    visuals: { emoji: "😱" }
  },
  {
    id: "emoji_egg_throw",
    name: "🥚 Chọi Trứng (VIP)",
    type: "EMOJI",
    price: 150,
    description: "Chọi một quả trứng vào màn hình đối thủ.",
    visuals: { emoji: "🥚" },
    isPremiumOnly: true
  }
];

export function getShopItem(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.id === id);
}
