/**
 * Kiểm tra thắng cuộc cho Tic-Tac-Toe (3x3)
 */
export function checkTicTacToeWin(board: string[]): boolean {
  const winLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Hàng ngang
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Hàng dọc
    [0, 4, 8], [2, 4, 6]             // Đường chéo
  ];
  return winLines.some(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
}

/**
 * Kiểm tra thắng cuộc cho Caro (12x12, 5 nước liên tiếp)
 * @param board Bàn cờ 1D size 144
 * @param lastPos Vị trí nước đánh cuối cùng (0-143)
 * @param symbol Ký tự quân cờ vừa đánh ("X" hoặc "O")
 */
export function checkCaroWin(board: string[], lastPos: number, symbol: string): boolean {
  const SIZE = 12;
  const lastRow = Math.floor(lastPos / SIZE);
  const lastCol = lastPos % SIZE;

  // 4 hướng kiểm tra: [dòng, cột]
  const directions = [
    [0, 1],   // Ngang
    [1, 0],   // Dọc
    [1, 1],   // Chéo xuống phải
    [1, -1]   // Chéo xuống trái
  ];

  for (const [dr, dc] of directions) {
    let count = 1; // Tính nước vừa đánh

    // Đi về hướng thuận
    for (let i = 1; i < 5; i++) {
      const r = lastRow + i * dr;
      const c = lastCol + i * dc;
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) break;
      if (board[r * SIZE + c] === symbol) {
        count++;
      } else {
        break;
      }
    }

    // Đi về hướng nghịch
    for (let i = 1; i < 5; i++) {
      const r = lastRow - i * dr;
      const c = lastCol - i * dc;
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) break;
      if (board[r * SIZE + c] === symbol) {
        count++;
      } else {
        break;
      }
    }

    // Nếu đạt từ 5 quân liên tiếp trở lên -> Thắng
    if (count >= 5) {
      return true;
    }
  }

  return false;
}

import crypto from "crypto";

export interface BattleshipShip {
  id: string; // "carrier" | "battleship" | "destroyer" | "submarine" | "patrol"
  name: string;
  size: number;
  x: number;
  y: number;
  vertical: boolean;
}

export interface BattleshipShot {
  x: number;
  y: number;
  hit: boolean;
  shipId: string | null;
  sunk: boolean;
}

export const BATTLESHIP_SHIPS_CONFIG = [
  { id: "carrier", name: "Tàu sân bay", size: 5 },
  { id: "battleship", name: "Thiết giáp hạm", size: 4 },
  { id: "destroyer", name: "Tàu khu trục", size: 3 },
  { id: "submarine", name: "Tàu ngầm", size: 3 },
  { id: "patrol", name: "Tàu tuần tra", size: 2 }
];

export function generateRandomShips(): BattleshipShip[] {
  const ships: BattleshipShip[] = [];
  const occupied = new Set<string>();

  for (const config of BATTLESHIP_SHIPS_CONFIG) {
    let placed = false;
    while (!placed) {
      const vertical = Math.random() > 0.5;
      const x = Math.floor(Math.random() * (vertical ? 10 : 10 - config.size + 1));
      const y = Math.floor(Math.random() * (vertical ? 10 - config.size + 1 : 10));

      let overlaps = false;
      for (let i = 0; i < config.size; i++) {
        const cx = vertical ? x : x + i;
        const cy = vertical ? y + i : y;
        if (occupied.has(`${cx},${cy}`)) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        for (let i = 0; i < config.size; i++) {
          const cx = vertical ? x : x + i;
          const cy = vertical ? y + i : y;
          occupied.add(`${cx},${cy}`);
        }
        ships.push({ id: config.id, name: config.name, size: config.size, x, y, vertical });
        placed = true;
      }
    }
  }
  return ships;
}

const ENCRYPTION_KEY = process.env.BATTLESHIP_SECRET || "default_battleship_secret_key_32_bytes_length!!";

function getKey() {
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
}

export function encryptShips(ships: BattleshipShip[]): string {
  const text = JSON.stringify(ships);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decryptShips(encryptedText: string): BattleshipShip[] {
  const parts = encryptedText.split(":");
  if (parts.length !== 2) throw new Error("Invalid encrypted format");
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv("aes-256-cbc", getKey(), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
}

export function validateShipPlacement(ships: BattleshipShip[]): boolean {
  if (!Array.isArray(ships) || ships.length !== 5) return false;

  const occupied = new Set<string>();

  for (const ship of ships) {
    const config = BATTLESHIP_SHIPS_CONFIG.find(c => c.id === ship.id);
    if (!config || config.size !== ship.size) return false;

    // Check bounds
    if (ship.x < 0 || ship.x >= 10 || ship.y < 0 || ship.y >= 10) return false;
    
    if (ship.vertical) {
      if (ship.y + ship.size > 10) return false;
    } else {
      if (ship.x + ship.size > 10) return false;
    }

    // Check overlaps
    for (let i = 0; i < ship.size; i++) {
      const cx = ship.vertical ? ship.x : ship.x + i;
      const cy = ship.vertical ? ship.y + i : ship.y;
      const key = `${cx},${cy}`;
      if (occupied.has(key)) return false;
      occupied.add(key);
    }
  }

  return true;
}

export function checkBattleshipShot(
  x: number,
  y: number,
  ships: BattleshipShip[],
  previousShots: { x: number; y: number }[]
): { hit: boolean; shipId: string | null; sunk: boolean } {
  // Find if shot hits any ship
  let hitShip: BattleshipShip | null = null;
  
  for (const ship of ships) {
    for (let i = 0; i < ship.size; i++) {
      const cx = ship.vertical ? ship.x : ship.x + i;
      const cy = ship.vertical ? ship.y + i : ship.y;
      if (cx === x && cy === y) {
        hitShip = ship;
        break;
      }
    }
    if (hitShip) break;
  }

  if (!hitShip) {
    return { hit: false, shipId: null, sunk: false };
  }

  // Check if ship is sunk
  // A ship is sunk if all its cells are hit (either in previousShots or this current shot)
  let hitCount = 0;
  for (let i = 0; i < hitShip.size; i++) {
    const cx = hitShip.vertical ? hitShip.x : hitShip.x + i;
    const cy = hitShip.vertical ? hitShip.y + i : hitShip.y;
    
    const isThisShot = (cx === x && cy === y);
    const isPrevShot = previousShots.some(s => s.x === cx && s.y === cy);
    
    if (isThisShot || isPrevShot) {
      hitCount++;
    }
  }

  const sunk = (hitCount === hitShip.size);
  return { hit: true, shipId: hitShip.id, sunk };
}

/**
 * Kiểm tra xem nước đi của quân Đen (đi trước) có vi phạm luật cấm Renju hay không
 * Luật cấm Renju bao gồm: Double 3 (Đôi ba), Double 4 (Đôi bốn), và Overline (Quá 5 quân cờ liên tiếp)
 */
export function isRenjuForbidden(board: string[], lastPos: number, symbol: string): { forbidden: boolean; reason?: string } {
  const SIZE = 12;
  const lastRow = Math.floor(lastPos / SIZE);
  const lastCol = lastPos % SIZE;

  const directions = [
    [0, 1],   // Ngang
    [1, 0],   // Dọc
    [1, 1],   // Chéo xuống phải
    [1, -1]   // Chéo xuống trái
  ];

  // 1. Kiểm tra Overline (lớn hơn 5 quân cờ liên tiếp)
  for (const [dr, dc] of directions) {
    let count = 1;
    // Chiều thuận
    for (let i = 1; i < 7; i++) {
      const r = lastRow + i * dr;
      const c = lastCol + i * dc;
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) break;
      if (board[r * SIZE + c] === symbol) count++;
      else break;
    }
    // Chiều nghịch
    for (let i = 1; i < 7; i++) {
      const r = lastRow - i * dr;
      const c = lastCol - i * dc;
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) break;
      if (board[r * SIZE + c] === symbol) count++;
      else break;
    }
    if (count >= 6) {
      return { forbidden: true, reason: "Overline (Hàng cờ quá 5 quân)" };
    }
  }

  // 2. Kiểm tra Double Three (Đôi 3) & Double Four (Đôi 4)
  let threeCount = 0;
  let fourCount = 0;

  for (const [dr, dc] of directions) {
    const tempBoard = [...board];
    tempBoard[lastPos] = symbol;

    const lineCells: { r: number; c: number; val: string }[] = [];
    for (let i = -4; i <= 4; i++) {
      const r = lastRow + i * dr;
      const c = lastCol + i * dc;
      if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
        lineCells.push({ r, c, val: tempBoard[r * SIZE + c] });
      } else {
        lineCells.push({ r, c, val: "OUT" });
      }
    }

    let isFour = false;
    let isOpenThree = false;

    // Xem xét các cửa sổ dài 5 ô chứa nước đi mới ở giữa (vị trí index 4)
    for (let start = 0; start <= 4; start++) {
      const window = lineCells.slice(start, start + 5);
      if (window.some(cell => cell.val === "OUT")) continue;

      const symbolCount = window.filter(c => c.val === symbol).length;
      const emptyCount = window.filter(c => c.val === "").length;

      if (symbolCount === 4 && emptyCount === 1) {
        isFour = true;
      }
    }

    // Xem xét các cửa sổ dài 6 ô chứa nước đi mới (đầu & đuôi là ô trống, ở giữa chứa 3 quân)
    for (let start = 0; start <= 3; start++) {
      const window = lineCells.slice(start, start + 6);
      if (window.some(cell => cell.val === "OUT")) continue;

      const head = window[0].val;
      const tail = window[5].val;
      const inner = window.slice(1, 5);
      const innerSymbolCount = inner.filter(c => c.val === symbol).length;
      const innerEmptyCount = inner.filter(c => c.val === "").length;

      if (head === "" && tail === "" && innerSymbolCount === 3 && innerEmptyCount === 1) {
        isOpenThree = true;
      }
    }

    if (isFour) fourCount++;
    if (isOpenThree) threeCount++;
  }

  if (threeCount >= 2) {
    return { forbidden: true, reason: "Double Three (Lỗi đôi ba)" };
  }
  if (fourCount >= 2) {
    return { forbidden: true, reason: "Double Four (Lỗi đôi bốn)" };
  }

  return { forbidden: false };
}

