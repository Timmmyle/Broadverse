/**
 * Hệ thống Tiến trình & Xếp hạng Gridline
 * Định nghĩa công thức tính EXP, Battle Pass, Elo và Nhiệm vụ hàng ngày.
 */

// 1. Công thức EXP người chơi
// EXP_required(L) = 100 * L^1.5 + 500
export function getExpNeededForLevel(level: number): number {
  return Math.round(100 * Math.pow(level, 1.5) + 500);
}

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

// 2. Battle Pass (50 Cấp độ, flat 1000 EXP mỗi cấp)
export function getBattlePassExpNeeded(): number {
  return 1000;
}

export function addBattlePassExp(currentLevel: number, currentExp: number, expGained: number) {
  let level = currentLevel;
  let exp = currentExp + expGained;
  const needed = 1000;

  while (exp >= needed && level < 50) {
    exp -= needed;
    level += 1;
  }

  return { level, exp };
}

// 3. Công thức tính điểm xếp hạng Elo
// Ra = Ra + K * (Sa - Ea)
export function calculateElo(playerElo: number, opponentElo: number, outcome: 1 | 0 | 0.5, kFactor = 32): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  return Math.round(playerElo + kFactor * (outcome - expectedScore));
}

// Chuyển đổi Elo sang Phân bậc Rank tương ứng
// [ Đồng ] -> [ Bạc ] -> [ Vàng ] -> [ Bạch Kim ] -> [ Kim Cương ] -> [ Cao Thủ ] -> [ Gridmaster (Top 500) ]
export function getRankTier(elo: number): { name: string; className: string; minElo: number } {
  if (elo >= 2200) return { name: "Gridmaster", className: "text-amber-400 font-extrabold", minElo: 2200 };
  if (elo >= 1800) return { name: "Cao Thủ", className: "text-red-500 font-bold", minElo: 1800 };
  if (elo >= 1500) return { name: "Kim Cương", className: "text-cyan-400 font-bold", minElo: 1500 };
  if (elo >= 1200) return { name: "Bạch Kim", className: "text-indigo-400 font-bold", minElo: 1200 };
  if (elo >= 900)  return { name: "Vàng", className: "text-yellow-500 font-bold", minElo: 900 };
  if (elo >= 600)  return { name: "Bạc", className: "text-gray-400 font-medium", minElo: 600 };
  return { name: "Đồng", className: "text-amber-700", minElo: 0 };
}

// 4. Hệ thống Prestige (Danh vọng)
// Yêu cầu tối thiểu cấp 50 để Prestige
export const MAX_LEVEL_FOR_PRESTIGE = 50;

export function canPrestige(level: number): boolean {
  return level >= MAX_LEVEL_FOR_PRESTIGE;
}

// 5. Hệ thống Nhiệm vụ Hàng ngày mặc định
export interface DailyMission {
  id: string;
  description: string;
  type: "WIN_GAME" | "PLAY_GAME" | "HIT_SHIP" | "SEND_EMOTE";
  target: number;
  progress: number;
  gameType?: "TIC_TAC_TOE" | "CARO" | "BATTLESHIP";
  rewardCoins: number;
  rewardExp: number;
  claimed: boolean;
}

export function generateDailyMissions(): DailyMission[] {
  return [
    {
      id: "mission_win_caro",
      description: "Thắng 1 trận Gomoku (Caro) Xếp hạng hoặc đấu Bot",
      type: "WIN_GAME",
      gameType: "CARO",
      target: 1,
      progress: 0,
      rewardCoins: 30,
      rewardExp: 400,
      claimed: false,
    },
    {
      id: "mission_hit_battleship",
      description: "Bắn trúng 5 ô cờ tàu chiến trong Battleship",
      type: "HIT_SHIP",
      gameType: "BATTLESHIP",
      target: 5,
      progress: 0,
      rewardCoins: 30,
      rewardExp: 400,
      claimed: false,
    },
    {
      id: "mission_send_emote",
      description: "Sử dụng 3 biểu cảm tương tác trong trận đấu",
      type: "SEND_EMOTE",
      target: 3,
      progress: 0,
      rewardCoins: 20,
      rewardExp: 200,
      claimed: false,
    }
  ];
}
