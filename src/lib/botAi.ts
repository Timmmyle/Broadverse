/**
 * Tic-Tac-Toe AI Move Calculator
 */
export function getTicTacToeBotMove(
  board: string[],
  difficulty: "RANDOM" | "EASY" | "HARD",
  botSymbol: string,
  playerSymbol: string
): number {
  const emptyCells = board
    .map((val, idx) => (val === "" ? idx : null))
    .filter((val) => val !== null) as number[];

  if (emptyCells.length === 0) return -1;

  // 1. RANDOM DIFFICULTY
  if (difficulty === "RANDOM") {
    const randIdx = Math.floor(Math.random() * emptyCells.length);
    return emptyCells[randIdx];
  }

  // Khai báo các hàng thắng cuộc
  const winLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  // 2. EASY DIFFICULTY (Chặn & Tấn công cơ bản)
  if (difficulty === "EASY") {
    // 2a. Kiểm tra xem Bot có nước đi nào để thắng ngay lập tức không
    for (const [a, b, c] of winLines) {
      if (board[a] === botSymbol && board[b] === botSymbol && board[c] === "") return c;
      if (board[a] === botSymbol && board[c] === botSymbol && board[b] === "") return b;
      if (board[b] === botSymbol && board[c] === botSymbol && board[a] === "") return a;
    }

    // 2b. Kiểm tra xem Player chuẩn bị thắng không -> Chặn
    for (const [a, b, c] of winLines) {
      if (board[a] === playerSymbol && board[b] === playerSymbol && board[c] === "") return c;
      if (board[a] === playerSymbol && board[c] === playerSymbol && board[b] === "") return b;
      if (board[b] === playerSymbol && board[c] === playerSymbol && board[a] === "") return a;
    }

    // Nếu không có gì nguy hiểm, đánh ngẫu nhiên
    const randIdx = Math.floor(Math.random() * emptyCells.length);
    return emptyCells[randIdx];
  }

  // 3. HARD DIFFICULTY (Minimax vô địch)
  let bestScore = -Infinity;
  let bestMove = emptyCells[0];

  for (const move of emptyCells) {
    board[move] = botSymbol;
    const score = minimax(board, 0, false, botSymbol, playerSymbol);
    board[move] = "";
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

// Thuật toán Minimax cho Tic-Tac-Toe
function minimax(
  board: string[],
  depth: number,
  isMaximizing: boolean,
  botSymbol: string,
  playerSymbol: string
): number {
  // Kiểm tra điểm số trạng thái hiện tại
  if (checkTTTWin(board, botSymbol)) return 10 - depth;
  if (checkTTTWin(board, playerSymbol)) return depth - 10;
  if (board.every(cell => cell !== "")) return 0;

  const emptyCells = board
    .map((val, idx) => (val === "" ? idx : null))
    .filter((val) => val !== null) as number[];

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (const move of emptyCells) {
      board[move] = botSymbol;
      const score = minimax(board, depth + 1, false, botSymbol, playerSymbol);
      board[move] = "";
      bestScore = Math.max(bestScore, score);
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (const move of emptyCells) {
      board[move] = playerSymbol;
      const score = minimax(board, depth + 1, true, botSymbol, playerSymbol);
      board[move] = "";
      bestScore = Math.min(bestScore, score);
    }
    return bestScore;
  }
}

function checkTTTWin(board: string[], symbol: string): boolean {
  const winLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  return winLines.some(([a, b, c]) => board[a] === symbol && board[b] === symbol && board[c] === symbol);
}

/**
 * Caro (12x12) Heuristic Bot Move Calculator
 * Thuật toán Heuristic chấm điểm bàn cờ cực mạnh cho Caro
 */
export function getCaroBotMove(board: string[], botSymbol: string, playerSymbol: string): number {
  const SIZE = 12;
  let bestScore = -1;
  let bestMoves: number[] = [];

  // Quét qua toàn bộ ô cờ trống
  for (let idx = 0; idx < board.length; idx++) {
    if (board[idx] !== "") continue;

    const row = Math.floor(idx / SIZE);
    const col = idx % SIZE;

    // Tính điểm phòng ngự (Defensive) và tấn công (Offensive) tại ô này
    const attackScore = evaluateCaroCell(board, row, col, botSymbol, SIZE);
    const defenseScore = evaluateCaroCell(board, row, col, playerSymbol, SIZE);

    // Trọng số kết hợp: Ưu tiên phòng ngự chặn 4 hoặc tấn công thắng
    // Trọng số tấn công hơi cao hơn một chút để Bot chủ động tấn công nếu cả hai đều có cơ hội ngang nhau
    const totalScore = attackScore * 1.1 + defenseScore;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestMoves = [idx];
    } else if (totalScore === bestScore) {
      bestMoves.push(idx);
    }
  }

  if (bestMoves.length === 0) return -1;
  // Đánh ngẫu nhiên một trong những ô có điểm cao nhất để Bot chơi đa dạng
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// Hàm đánh giá sức mạnh của một ô cờ cho một biểu tượng cụ thể
function evaluateCaroCell(board: string[], row: number, col: number, symbol: string, SIZE: number): number {
  const directions = [
    [0, 1],   // Ngang
    [1, 0],   // Dọc
    [1, 1],   // Chéo xuống phải
    [1, -1]   // Chéo xuống trái
  ];

  let totalCellScore = 0;

  for (const [dr, dc] of directions) {
    let count = 0;
    let openEnds = 0;

    // Hướng thuận
    let i = 1;
    while (i < 5) {
      const r = row + i * dr;
      const c = col + i * dc;
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) {
        break; // Hết bàn cờ (bị chặn đầu)
      }
      if (board[r * SIZE + c] === symbol) {
        count++;
      } else if (board[r * SIZE + c] === "") {
        openEnds++;
        break;
      } else {
        break; // Bị quân đối thủ chặn
      }
      i++;
    }

    // Hướng nghịch
    i = 1;
    while (i < 5) {
      const r = row - i * dr;
      const c = col - i * dc;
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) {
        break; // Hết bàn cờ (bị chặn đầu)
      }
      if (board[r * SIZE + c] === symbol) {
        count++;
      } else if (board[r * SIZE + c] === "") {
        openEnds++;
        break;
      } else {
        break; // Bị quân đối thủ chặn
      }
      i++;
    }

    // Quy đổi điểm số dựa trên số lượng quân cờ liên tiếp và độ mở hai đầu
    if (count === 4) {
      totalCellScore += openEnds > 0 ? 10000 : 2000; // 4 quân cờ: 1 đầu mở là thắng hoặc chặn cực nguy cấp
    } else if (count === 3) {
      totalCellScore += openEnds === 2 ? 1000 : (openEnds === 1 ? 200 : 0);
    } else if (count === 2) {
      totalCellScore += openEnds === 2 ? 100 : (openEnds === 1 ? 15 : 0);
    } else if (count === 1) {
      totalCellScore += openEnds === 2 ? 10 : (openEnds === 1 ? 2 : 0);
    }
  }

  return totalCellScore;
}

/**
 * Battleship Bot Move Calculator
 * @param board Mảng 1D 100 phần tử ("" | "M" | "H" | "S")
 * @param difficulty Cấp độ khó ("EASY" | "HARD")
 */
export function getBattleshipBotMove(board: string[], difficulty: "EASY" | "HARD"): number {
  const SIZE = 10;
  const emptyCells = board
    .map((val, idx) => (val === "" ? idx : null))
    .filter((val) => val !== null) as number[];

  if (emptyCells.length === 0) return -1;

  if (difficulty === "EASY") {
    const randIdx = Math.floor(Math.random() * emptyCells.length);
    return emptyCells[randIdx];
  }

  // CẤP ĐỘ KHÓ: SĂN LÙNG THÔNG MINH (HUNT & TARGET)
  // 1. Tìm tất cả các ô đang bị thương nhưng chưa chìm hoàn toàn ("H")
  const hits: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === "H") {
      hits.push(i);
    }
  }

  // 2. Nếu không có ô nào bị thương, bắn theo chiến thuật bàn cờ (checkerboard pattern) để tăng hiệu suất tìm tàu
  if (hits.length === 0) {
    const checkerboardEmpty = emptyCells.filter((idx) => {
      const r = Math.floor(idx / SIZE);
      const c = idx % SIZE;
      return (r + c) % 2 === 0;
    });

    if (checkerboardEmpty.length > 0) {
      const randIdx = Math.floor(Math.random() * checkerboardEmpty.length);
      return checkerboardEmpty[randIdx];
    }

    const randIdx = Math.floor(Math.random() * emptyCells.length);
    return emptyCells[randIdx];
  }

  // 3. Nếu có ô bị thương, cố gắng phát triển các ô bị thương thành đường thẳng (ngang hoặc dọc)
  for (let i = 0; i < hits.length; i++) {
    const h1 = hits[i];
    const r1 = Math.floor(h1 / SIZE);
    const c1 = h1 % SIZE;

    for (let j = i + 1; j < hits.length; j++) {
      const h2 = hits[j];
      const r2 = Math.floor(h2 / SIZE);
      const c2 = h2 % SIZE;

      // Nếu cùng hàng và gần nhau (hoặc cách nhau bởi các ô hit khác)
      if (r1 === r2) {
        const minC = Math.min(c1, c2);
        const maxC = Math.max(c1, c2);

        // Thử bắn sang trái của vùng hit
        const leftIdx = r1 * SIZE + (minC - 1);
        if (minC > 0 && board[leftIdx] === "") return leftIdx;

        // Thử bắn sang phải của vùng hit
        const rightIdx = r1 * SIZE + (maxC + 1);
        if (maxC < SIZE - 1 && board[rightIdx] === "") return rightIdx;
      }

      // Nếu cùng cột và gần nhau
      if (c1 === c2) {
        const minR = Math.min(r1, r2);
        const maxR = Math.max(r1, r2);

        // Thử bắn lên trên của vùng hit
        const upIdx = (minR - 1) * SIZE + c1;
        if (minR > 0 && board[upIdx] === "") return upIdx;

        // Thử bắn xuống dưới của vùng hit
        const downIdx = (maxR + 1) * SIZE + c1;
        if (maxR < SIZE - 1 && board[downIdx] === "") return downIdx;
      }
    }
  }

  // 4. Nếu không có cặp ô bị thương nào tạo đường thẳng có thể bắn tiếp, bắn các ô liền kề của bất kỳ ô bị thương nào
  for (const h of hits) {
    const r = Math.floor(h / SIZE);
    const c = h % SIZE;

    const neighbors = [
      { r: r - 1, c: c, idx: h - SIZE }, // Trên
      { r: r + 1, c: c, idx: h + SIZE }, // Dưới
      { r: r, c: c - 1, idx: h - 1 },    // Trái
      { r: r, c: c + 1, idx: h + 1 }     // Phải
    ];

    for (const n of neighbors) {
      if (n.r >= 0 && n.r < SIZE && n.c >= 0 && n.c < SIZE && board[n.idx] === "") {
        return n.idx;
      }
    }
  }

  // Fallback bắn ngẫu nhiên ô trống
  const randIdx = Math.floor(Math.random() * emptyCells.length);
  return emptyCells[randIdx];
}

