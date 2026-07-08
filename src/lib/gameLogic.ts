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
