/**
 * Hệ thống Tiến trình & Xếp hạng Vuiga.com
 * Định nghĩa công thức tính EXP, Battle Pass, Elo, Rank Divisions, Achievements và Nhiệm vụ hàng ngày.
 */

import { SHOP_ITEMS } from "./shopItems";

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

export function getRankFromDb(tier: number, division: number, points: number): RankInfo {
  const roman = ["", "I", "II", "III", "IV"];
  const tierNames = [
    "",
    "Trứng",
    "Gà Con",
    "Gà Non",
    "Gà Nhà",
    "Gà Chiến",
    "Cao Thủ Gà",
    "Phượng Hoàng"
  ];
  const tierIcons = ["", "🥚", "🐣", "🐥", "🐔", "🪶", "⚔️", "🔥"];
  const tierClassNames = [
    "",
    "text-gray-400",
    "text-cyan-400 font-medium",
    "text-indigo-400 font-medium",
    "text-amber-300 font-bold",
    "text-[#FF9F0A] font-bold",
    "text-red-500 font-bold",
    "text-[#FF9F0A] font-extrabold animate-pulse"
  ];

  const name = tierNames[tier] || "Chưa Hạng";
  const icon = tierIcons[tier] || "🥚";
  const className = tierClassNames[tier] || "text-gray-400";
  
  let divisionName = "";
  if (tier === 7) {
    divisionName = "🔥";
  } else {
    divisionName = roman[division] || "";
  }

  return {
    tier,
    division,
    name,
    divisionName,
    icon,
    className,
    perks: []
  };
}

export function calculateRankUpdate(
  currentTier: number,
  currentDivision: number,
  currentPoints: number,
  outcome: "WIN" | "LOSE" | "DRAW",
  overridePointsChange?: number
): { tier: number; division: number; rankPoints: number; promoted: boolean; demoted: boolean } {
  let pointsChange = 0;
  if (overridePointsChange !== undefined) {
    pointsChange = overridePointsChange;
  } else {
    if (outcome === "WIN") pointsChange = 25;
    else if (outcome === "LOSE") pointsChange = -15;
    else if (outcome === "DRAW") pointsChange = 5;
  }

  let newPoints = currentPoints + pointsChange;
  let tier = currentTier;
  let division = currentDivision;
  let promoted = false;
  let demoted = false;

  const getMaxDivision = (t: number) => {
    if (t >= 5 && t <= 6) return 4;
    if (t >= 1 && t <= 4) return 3;
    return 1;
  };

  const maxDiv = getMaxDivision(tier);
  if (division > maxDiv) {
    division = maxDiv;
  }

  if (tier === 7) {
    if (newPoints < 0) newPoints = 0;
    if (newPoints > 100) newPoints = 100;
    return { tier, division: 1, rankPoints: newPoints, promoted: false, demoted: false };
  }

  if (newPoints >= 100) {
    promoted = true;
    if (division === 1) {
      if (tier < 7) {
        tier += 1;
        const newMaxDiv = getMaxDivision(tier);
        division = newMaxDiv;
        newPoints = newPoints - 100;
      } else {
        newPoints = 100;
      }
    } else {
      division -= 1;
      newPoints = newPoints - 100;
    }
    if (newPoints > 100) newPoints = 99;
  } else if (newPoints < 0) {
    const maxDiv = getMaxDivision(tier);
    if (tier === 1 && division === maxDiv) {
      newPoints = 0;
    } else {
      demoted = true;
      if (division === maxDiv) {
        tier -= 1;
        division = 1;
        newPoints = 100 + newPoints;
      } else {
        division += 1;
        newPoints = 100 + newPoints;
      }
    }
    if (newPoints < 0) newPoints = 0;
  }

  return { tier, division, rankPoints: newPoints, promoted, demoted };
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

export async function checkAndUnlockAchievements(userId: string, prismaClient: any) {
  const user = await prismaClient.user.findUnique({
    where: { id: userId }
  });
  if (!user) return [];

  const unlocked = new Set<string>(user.achievementsUnlocked);
  const newlyUnlocked: string[] = [];

  const unlock = (id: string) => {
    if (!unlocked.has(id)) {
      unlocked.add(id);
      newlyUnlocked.push(id);
    }
  };

  // 1. first_egg: "Sở hữu trang bị đầu tiên của chú Gà" (không phải mặc định)
  const defaultItems = ["sym_classic", "frame_default", "theme_classic", "skin_default", "dice_wood", "banner_classic"];
  const nonDefaultOwned = user.purchasedItems.filter((item: string) => !defaultItems.includes(item));
  if (nonDefaultOwned.length >= 1) {
    unlock("first_egg");
  }

  // 2. Wins achievements
  const winCount = await prismaClient.matchHistory.count({
    where: { winnerId: userId }
  });

  if (winCount >= 1) unlock("first_win");
  if (winCount >= 10) unlock("wins_10");
  if (winCount >= 100) unlock("wins_100");
  if (winCount >= 1000) unlock("wins_1000");

  // 3. chicken_collector: 5 skin chú Gà
  const chickenSkinsCount = user.purchasedItems.filter((itemId: string) => {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    return item && item.type === "SKIN";
  }).length;
  if (chickenSkinsCount >= 5) unlock("chicken_collector");

  // 4. dice_master: 3 skin xúc xắc
  const diceSkinsCount = user.purchasedItems.filter((itemId: string) => {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    return item && item.type === "DICE";
  }).length;
  if (diceSkinsCount >= 3) unlock("dice_master");

  // 5. board_master: 3 themes bàn cờ
  const boardThemesCount = user.purchasedItems.filter((itemId: string) => {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    return item && item.type === "THEME";
  }).length;
  if (boardThemesCount >= 3) unlock("board_master");

  // 6. rank_up
  if (user.rankTier >= 2) unlock("rank_up");

  // 7. top_100
  if (user.rankTier === 7) unlock("top_100");

  // 8. legend_player
  if (user.eloTicTacToe >= 2000 || user.eloGomoku >= 2000 || user.eloBattleship >= 2000 || user.eloBauCua >= 2000) {
    unlock("legend_player");
  }

  // 9. phoenix
  if (user.rankTier === 7) unlock("phoenix");

  // 10. win_streak_10
  const lastMatches = await prismaClient.matchHistory.findMany({
    where: {
      OR: [
        { playerXId: userId },
        { playerOId: userId }
      ]
    },
    orderBy: { endedAt: "desc" },
    take: 10
  });
  if (lastMatches.length >= 10 && lastMatches.every((m: any) => m.winnerId === userId)) {
    unlock("win_streak_10");
  }

  // 11. comeback_king
  if (winCount >= 5) {
    unlock("comeback_king");
  }

  if (newlyUnlocked.length > 0) {
    let totalEggReward = 0;
    const achievementsMap = new Map(ACHIEVEMENTS.map(a => [a.id, a]));
    for (const achId of newlyUnlocked) {
      const ach = achievementsMap.get(achId);
      if (ach) {
        totalEggReward += ach.rewardEggs;
      }
    }

    await prismaClient.user.update({
      where: { id: userId },
      data: {
        achievementsUnlocked: Array.from(unlocked),
        eggs: { increment: totalEggReward }
      }
    });
  }

  return newlyUnlocked;
}

