/**
 * Hệ thống Tiến trình & Xếp hạng Vuiga.com
 * Định nghĩa công thức tính EXP, Battle Pass, Elo, Rank Divisions, Achievements và Nhiệm vụ hàng ngày.
 */

// 1. Công thức EXP người chơi
// EXP_required(L) = 100 * L^1.5 + 500
export function getExpNeededForLevel(level: number): number {
  return Math.round(100 * Math.pow(level, 1.5) + 500);
}
export const MAX_LEVEL_FOR_PRESTIGE = 50;

export function addExp(currentLevel: number, currentExp: number, expGained: number) {
  let level = currentLevel;
  let exp = currentExp + expGained;
  let levelUp = false;

  while (true) {
    const needed = getExpNeededForLevel(level);
    if (exp >= needed) {
      exp -= needed;
      level += 1;
      levelUp = true;
    } else {
      break;
    }
  }

  return { level, exp, levelUp };
}

// 2. Battle Pass "Vuiga Pass" (100 Cấp độ, flat 1000 EXP mỗi cấp, chu kỳ 60 ngày)
export function getBattlePassExpNeeded(): number {
  return 1000;
}

export function addBattlePassExp(currentLevel: number, currentExp: number, expGained: number) {
  let level = currentLevel;
  let exp = currentExp + expGained;
  const needed = 1000;

  while (exp >= needed && level < 100) {
    exp -= needed;
    level += 1;
  }

  return { level, exp };
}

// 3. Công thức tính điểm xếp hạng Elo
export function calculateElo(playerElo: number, opponentElo: number, outcome: 1 | 0 | 0.5, kFactor = 32): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  return Math.round(playerElo + kFactor * (outcome - expectedScore));
}

// Chuyển đổi Elo sang Cấp bậc Rank & Division Gà
// Tier 1 -> 4: 3 Divisions (III, II, I)
// Tier 5 -> 6: 4 Divisions (IV, III, II, I)
// Tier 7: Phượng Hoàng (Top xếp hạng)
export interface RankInfo {
  tier: number;
  division: number;
  name: string;
  divisionName: string;
  icon: string;
  className: string;
  perks: string[];
}

export function getRankFromElo(elo: number): RankInfo {
  if (elo >= 2200) {
    return {
      tier: 7,
      division: 1,
      name: "Phượng Hoàng",
      divisionName: "🔥",
      icon: "🔥",
      className: "text-[#FF9F0A] font-extrabold animate-pulse",
      perks: [
        "Khung avatar động độc quyền",
        "Hiệu ứng cánh lửa quanh hồ sơ",
        "Danh hiệu hiển thị toàn nền tảng",
        "Cosmetic theo mùa cho Phượng Hoàng",
        "Huy hiệu Phoenix Badge vĩnh viễn"
      ]
    };
  }
  if (elo >= 1800) {
    // Tier 6: Cao Thủ Gà (1800 - 2199) -> 4 divisions (IV, III, II, I)
    const diff = elo - 1800;
    let division = 4;
    if (diff >= 300) division = 1;
    else if (diff >= 200) division = 2;
    else if (diff >= 100) division = 3;
    
    const roman = ["", "I", "II", "III", "IV"];
    return {
      tier: 6,
      division,
      name: "Cao Thủ Gà",
      divisionName: roman[division],
      icon: "⚔️",
      className: "text-red-500 font-bold",
      perks: [
        "Hiệu ứng vào trận hoành tráng",
        "Hồ sơ nổi bật trên bảng xếp hạng",
        "Tặng thêm Egg từ phần thưởng cuối mùa"
      ]
    };
  }
  if (elo >= 1500) {
    // Tier 5: Gà Chiến (1500 - 1799) -> 4 divisions
    const diff = elo - 1500;
    let division = 4;
    if (diff >= 225) division = 1;
    else if (diff >= 150) division = 2;
    else if (diff >= 75) division = 3;

    const roman = ["", "I", "II", "III", "IV"];
    return {
      tier: 5,
      division,
      name: "Gà Chiến",
      divisionName: roman[division],
      icon: "🪶",
      className: "text-amber-500 font-bold",
      perks: [
        "Khung hồ sơ nâng cao Gà Chiến",
        "Hiệu ứng tên đơn giản",
        "Huy hiệu mùa giải"
      ]
    };
  }
  if (elo >= 1200) {
    // Tier 4: Gà Nhà (1200 - 1499) -> 3 divisions (III, II, I)
    const diff = elo - 1200;
    let division = 3;
    if (diff >= 200) division = 1;
    else if (diff >= 100) division = 2;

    const roman = ["", "I", "II", "III"];
    return {
      tier: 4,
      division,
      name: "Gà Nhà",
      divisionName: roman[division],
      icon: "🐔",
      className: "text-amber-300 font-bold",
      perks: [
        "Mở khóa Guild (Chicken Coop)",
        "Mở rộng trang trí hồ sơ cá nhân"
      ]
    };
  }
  if (elo >= 900) {
    // Tier 3: Gà Non (900 - 1199) -> 3 divisions
    const diff = elo - 900;
    let division = 3;
    if (diff >= 200) division = 1;
    else if (diff >= 100) division = 2;

    const roman = ["", "I", "II", "III"];
    return {
      tier: 3,
      division,
      name: "Gà Non",
      divisionName: roman[division],
      icon: "🐥",
      className: "text-indigo-400 font-medium",
      perks: [
        "Mở rộng Party và mời tổ đội",
        "Mở khóa emotes tương tác trong trận"
      ]
    };
  }
  if (elo >= 600) {
    // Tier 2: Gà Con (600 - 899) -> 3 divisions
    const diff = elo - 600;
    let division = 3;
    if (diff >= 200) division = 1;
    else if (diff >= 100) division = 2;

    const roman = ["", "I", "II", "III"];
    return {
      tier: 2,
      division,
      name: "Gà Con",
      divisionName: roman[division],
      icon: "🐣",
      className: "text-cyan-400 font-medium",
      perks: [
        "Mở danh sách bạn bè",
        "Mở khóa hệ thống thành tựu"
      ]
    };
  }
  // Tier 1: Trứng (0 - 599) -> 3 divisions
  let division = 3;
  if (elo >= 400) division = 1;
  else if (elo >= 200) division = 2;

  const roman = ["", "I", "II", "III"];
  return {
    tier: 1,
    division,
    name: "Trứng",
    divisionName: roman[division],
    icon: "🥚",
    className: "text-gray-400",
    perks: [
      "Mở khóa chơi chế độ Xếp Hạng",
      "Nhận quà điểm danh hàng ngày"
    ]
  };
}

// 4. Danh sách Thành tựu (Achievements)
export interface Achievement {
  id: string;
  name: string;
  description: string;
  rewardEggs: number;
  icon: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_egg", name: "Quả Trứng Đầu Tiên", description: "Sở hữu trang bị đầu tiên của chú Gà", rewardEggs: 50, icon: "🥚" },
  { id: "first_win", name: "Khởi Đầu May Mắn", description: "Giành chiến thắng đầu tiên", rewardEggs: 50, icon: "🏆" },
  { id: "wins_10", name: "Gà Tập Sự", description: "Đạt 10 trận thắng xếp hạng", rewardEggs: 100, icon: "🐣" },
  { id: "wins_100", name: "Đại Kỳ Thủ Gà", description: "Đạt 100 trận thắng xếp hạng", rewardEggs: 500, icon: "🐔" },
  { id: "wins_1000", name: "Huyền Thoại Kê Vương", description: "Đạt 1000 trận thắng xếp hạng", rewardEggs: 2000, icon: "👑" },
  { id: "chicken_collector", name: "Nhà Sưu Tầm Gà", description: "Sở hữu từ 5 skin chú Gà trở lên", rewardEggs: 200, icon: "🎨" },
  { id: "dice_master", name: "Đổ Xúc Xắc Mỏi Tay", description: "Sở hữu từ 3 skin Xúc xắc trở lên", rewardEggs: 150, icon: "🎲" },
  { id: "board_master", name: "Kiến Trúc Sư Bàn Cờ", description: "Sở hữu từ 3 themes bàn cờ khác nhau", rewardEggs: 200, icon: "🗺️" },
  { id: "comeback_king", name: "Lội Ngược Dòng", description: "Giành chiến thắng sau chuỗi bất lợi", rewardEggs: 100, icon: "↩️" },
  { id: "win_streak_10", name: "Chuỗi 10 Chiến Thắng", description: "Đạt chuỗi 10 trận thắng xếp hạng liên tiếp", rewardEggs: 300, icon: "⚡" },
  { id: "rank_up", name: "Trưởng Thành", description: "Vượt qua rank Trứng lên Gà Con", rewardEggs: 100, icon: "⬆️" },
  { id: "top_100", name: "Cửu Ngũ Chí Tôn", description: "Lọt vào Top 100 Phượng Hoàng", rewardEggs: 1000, icon: "🔥" },
  { id: "legend_player", name: "Trí Tuệ Kê Vương", description: "Đạt mốc Elo xếp hạng từ 2000 điểm", rewardEggs: 500, icon: "🧠" },
  { id: "phoenix", name: "Phượng Hoàng Tái Sinh", description: "Đạt cấp bậc rank cao nhất Phượng Hoàng", rewardEggs: 1000, icon: "🦅" }
];

// 5. Hệ thống Nhiệm vụ Hàng ngày mặc định cho Vuiga.com
export interface DailyMission {
  id: string;
  description: string;
  type: "WIN_GAME" | "PLAY_GAME" | "HIT_SHIP" | "SEND_EMOTE" | "FRIEND_PLAY" | "PLAY_3_DIFFERENT";
  target: number;
  progress: number;
  gameType?: "TIC_TAC_TOE" | "CARO" | "BATTLESHIP";
  rewardCoins: number; // Mapped to eggs in UI
  rewardExp: number;
  rewardBPExp?: number; // Thưởng EXP Battle Pass
  claimed: boolean;
}

export function generateDailyMissions(): DailyMission[] {
  return [
    {
      id: "mission_play_1",
      description: "Hoàn thành 1 trận đấu bất kỳ (Bot hoặc Xếp Hạng)",
      type: "PLAY_GAME",
      target: 1,
      progress: 0,
      rewardCoins: 20,
      rewardExp: 150,
      rewardBPExp: 150,
      claimed: false,
    },
    {
      id: "mission_win_2",
      description: "Thắng 2 trận đấu xếp hạng",
      type: "WIN_GAME",
      target: 2,
      progress: 0,
      rewardCoins: 50,
      rewardExp: 300,
      rewardBPExp: 300,
      claimed: false,
    },
    {
      id: "mission_send_emote",
      description: "Sử dụng biểu cảm (Emote) 3 lần trong các trận đấu",
      type: "SEND_EMOTE",
      target: 3,
      progress: 0,
      rewardCoins: 15,
      rewardExp: 100,
      rewardBPExp: 100,
      claimed: false,
    }
  ];
}
