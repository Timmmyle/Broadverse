export interface PitState {
  id: number;
  type: "DAN" | "QUAN";
  owner: 1 | 2 | null; // 1: Player 1, 2: Player 2, null: Quan
  stones: number; // Số lượng sỏi dân
  hasQuanBigStone: boolean; // Có chứa quan lớn không (1 quan lớn = 10 sỏi)
}

export interface AnimationStep {
  type: "PICK" | "SOW" | "EAT" | "STOP" | "FEED";
  pitIndex: number;
  stonesInHand?: number;
  eatenStones?: number;
  eatenQuan?: number;
  gainedScore?: number;
  player: 1 | 2;
  boardState: PitState[];
  p1Score: number;
  p2Score: number;
  message?: string;
}

export interface OAnQuanGameState {
  board: PitState[];
  currentPlayer: 1 | 2;
  p1Score: number;
  p2Score: number;
  p1Borrowed: number;
  p2Borrowed: number;
  isGameOver: boolean;
  winner: 1 | 2 | "DRAW" | null;
  lastMoveInfo?: {
    pitIndex: number;
    direction: "CW" | "CCW";
    player: 1 | 2;
  };
}

/**
 * Khởi tạo bàn cờ Ô Ăn Quan ban đầu
 * - 10 ô Dân: 0..4 (P1), 6..10 (P2). Ban đầu mỗi ô 5 sỏi dân.
 * - 2 ô Quan: 5 (Quan B), 11 (Quan A). Ban đầu mỗi ô chứa 1 Quan Lớn (10 điểm).
 */
export function createInitialGameState(firstPlayer: 1 | 2 = 1): OAnQuanGameState {
  const board: PitState[] = [];

  for (let i = 0; i < 12; i++) {
    if (i === 5 || i === 11) {
      board.push({
        id: i,
        type: "QUAN",
        owner: null,
        stones: 0,
        hasQuanBigStone: true,
      });
    } else if (i >= 0 && i <= 4) {
      board.push({
        id: i,
        type: "DAN",
        owner: 1,
        stones: 5,
        hasQuanBigStone: false,
      });
    } else {
      board.push({
        id: i,
        type: "DAN",
        owner: 2,
        stones: 5,
        hasQuanBigStone: false,
      });
    }
  }

  return {
    board,
    currentPlayer: firstPlayer,
    p1Score: 0,
    p2Score: 0,
    p1Borrowed: 0,
    p2Borrowed: 0,
    isGameOver: false,
    winner: null,
  };
}

/**
 * Lấy các nước đi hợp lệ cho người chơi hiện tại
 * Trả về danh sách chỉ số ô Dân có sỏi thuộc sở hữu của người chơi
 */
export function getValidPits(state: OAnQuanGameState, player: 1 | 2): number[] {
  if (state.isGameOver) return [];
  const playerPits = player === 1 ? [0, 1, 2, 3, 4] : [6, 7, 8, 9, 10];
  return playerPits.filter((idx) => state.board[idx].stones > 0);
}

/**
 * Kiểm tra xem người chơi có cần rải sỏi (Bón quân) do 5 ô dân trống không
 */
export function checkAndApplyFeedIfNeeded(
  state: OAnQuanGameState,
  player: 1 | 2
): { newState: OAnQuanGameState; fed: boolean; steps: AnimationStep[] } {
  const newState = JSON.parse(JSON.stringify(state)) as OAnQuanGameState;
  const steps: AnimationStep[] = [];
  const validPits = getValidPits(newState, player);

  if (validPits.length === 0 && !newState.isGameOver) {
    // 5 ô trống! Phải bỏ 5 điểm từ kho để rải vào 5 ô
    const playerPits = player === 1 ? [0, 1, 2, 3, 4] : [6, 7, 8, 9, 10];
    const cost = 5;

    if (player === 1) {
      if (newState.p1Score >= cost) {
        newState.p1Score -= cost;
      } else {
        const diff = cost - newState.p1Score;
        newState.p1Borrowed += diff;
        newState.p1Score = 0;
      }
    } else {
      if (newState.p2Score >= cost) {
        newState.p2Score -= cost;
      } else {
        const diff = cost - newState.p2Score;
        newState.p2Borrowed += diff;
        newState.p2Score = 0;
      }
    }

    // Nạp 1 sỏi vào mỗi ô
    playerPits.forEach((p) => {
      newState.board[p].stones = 1;
    });

    steps.push({
      type: "FEED",
      pitIndex: playerPits[0],
      player,
      boardState: JSON.parse(JSON.stringify(newState.board)),
      p1Score: newState.p1Score,
      p2Score: newState.p2Score,
      message: `Người chơi ${player} bón 5 sỏi vào các ô dân!`,
    });

    return { newState, fed: true, steps };
  }

  return { newState, fed: false, steps };
}

/**
 * Tính toán vị trí kế tiếp trên bàn cờ tròn (12 ô)
 */
export function getNextPitIndex(current: number, direction: "CW" | "CCW"): number {
  if (direction === "CW") {
    return (current + 1) % 12;
  } else {
    return (current + 11) % 12;
  }
}

/**
 * Thực thi nước đi Ô Ăn Quan và trả về kết quả kèm danh sách các bước Animation
 */
export function executeMove(
  state: OAnQuanGameState,
  pitIndex: number,
  direction: "CW" | "CCW"
): { finalState: OAnQuanGameState; animationSteps: AnimationStep[] } {
  const animationSteps: AnimationStep[] = [];
  let currentBoard: PitState[] = JSON.parse(JSON.stringify(state.board));
  let p1Score = state.p1Score;
  let p2Score = state.p2Score;
  let p1Borrowed = state.p1Borrowed;
  let p2Borrowed = state.p2Borrowed;
  const player = state.currentPlayer;

  // Kiểm tra nước đi hợp lệ
  const validPits = getValidPits(state, player);
  if (!validPits.includes(pitIndex)) {
    return { finalState: state, animationSteps: [] };
  }

  let handStones = currentBoard[pitIndex].stones;
  currentBoard[pitIndex].stones = 0;

  animationSteps.push({
    type: "PICK",
    pitIndex,
    stonesInHand: handStones,
    player,
    boardState: JSON.parse(JSON.stringify(currentBoard)),
    p1Score,
    p2Score,
    message: `Bốc ${handStones} sỏi từ ô ${pitIndex}`,
  });

  let currPit = pitIndex;

  while (true) {
    // Rải sỏi từng viên
    while (handStones > 0) {
      currPit = getNextPitIndex(currPit, direction);
      currentBoard[currPit].stones += 1;
      handStones -= 1;

      animationSteps.push({
        type: "SOW",
        pitIndex: currPit,
        stonesInHand: handStones,
        player,
        boardState: JSON.parse(JSON.stringify(currentBoard)),
        p1Score,
        p2Score,
      });
    }

    // Sau khi rải hết sỏi trong tay, xét ô tiếp theo
    const nextPit = getNextPitIndex(currPit, direction);

    // TH1: Ô tiếp theo là ô Dân có sỏi -> Bốc tiếp rải tiếp!
    if (nextPit !== 5 && nextPit !== 11 && currentBoard[nextPit].stones > 0) {
      handStones = currentBoard[nextPit].stones;
      currentBoard[nextPit].stones = 0;
      currPit = nextPit;

      animationSteps.push({
        type: "PICK",
        pitIndex: nextPit,
        stonesInHand: handStones,
        player,
        boardState: JSON.parse(JSON.stringify(currentBoard)),
        p1Score,
        p2Score,
        message: `Tiếp tục bốc ${handStones} sỏi từ ô ${nextPit}`,
      });
      continue;
    }

    // TH2: Ô tiếp theo là ô trống -> Xét ô sau ô trống để ĂN!
    let checkEmptyPit = nextPit;
    let isEatingLoop = true;

    while (isEatingLoop) {
      const isEmpty =
        currentBoard[checkEmptyPit].stones === 0 &&
        !currentBoard[checkEmptyPit].hasQuanBigStone;

      if (!isEmpty) {
        break;
      }

      const targetPit = getNextPitIndex(checkEmptyPit, direction);
      const hasStonesOrQuan =
        currentBoard[targetPit].stones > 0 ||
        currentBoard[targetPit].hasQuanBigStone;

      if (hasStonesOrQuan) {
        // ĂN!
        const eatenStones = currentBoard[targetPit].stones;
        const eatenQuan = currentBoard[targetPit].hasQuanBigStone ? 1 : 0;
        const gainedScore = eatenStones + eatenQuan * 10;

        currentBoard[targetPit].stones = 0;
        currentBoard[targetPit].hasQuanBigStone = false;

        if (player === 1) {
          p1Score += gainedScore;
        } else {
          p2Score += gainedScore;
        }

        animationSteps.push({
          type: "EAT",
          pitIndex: targetPit,
          eatenStones,
          eatenQuan,
          gainedScore,
          player,
          boardState: JSON.parse(JSON.stringify(currentBoard)),
          p1Score,
          p2Score,
          message: `Ăn được ${eatenStones} sỏi${eatenQuan > 0 ? " và 1 Quan Lớn" : ""} tại ô ${targetPit}! (+${gainedScore}đ)`,
        });

        // Kiểm tra xem có ăn chùm tiếp không
        checkEmptyPit = getNextPitIndex(targetPit, direction);
      } else {
        // Sau ô trống là ô trống khác (2 ô trống liên tiếp) -> Dừng!
        isEatingLoop = false;
      }
    }

    // Kết thúc lượt đi
    break;
  }

  animationSteps.push({
    type: "STOP",
    pitIndex: currPit,
    player,
    boardState: JSON.parse(JSON.stringify(currentBoard)),
    p1Score,
    p2Score,
    message: `Kết thúc lượt đi của Người chơi ${player}.`,
  });

  // Kiểm tra xem 2 Quan đã bị ăn sạch chưa
  const quan5Empty =
    currentBoard[5].stones === 0 && !currentBoard[5].hasQuanBigStone;
  const quan11Empty =
    currentBoard[11].stones === 0 && !currentBoard[11].hasQuanBigStone;
  const isGameOver = quan5Empty && quan11Empty;

  let winner: 1 | 2 | "DRAW" | null = null;

  if (isGameOver) {
    // Gom tất cả sỏi dân còn lại thuộc sở hữu mỗi bên vào điểm số
    [0, 1, 2, 3, 4].forEach((p) => {
      p1Score += currentBoard[p].stones;
      currentBoard[p].stones = 0;
    });

    [6, 7, 8, 9, 10].forEach((p) => {
      p2Score += currentBoard[p].stones;
      currentBoard[p].stones = 0;
    });

    // Trừ điểm nợ mượn
    p1Score = Math.max(0, p1Score - p1Borrowed);
    p2Score = Math.max(0, p2Score - p2Borrowed);

    if (p1Score > p2Score) winner = 1;
    else if (p2Score > p1Score) winner = 2;
    else winner = "DRAW";
  }

  const nextPlayer = player === 1 ? 2 : 1;

  let finalState: OAnQuanGameState = {
    board: currentBoard,
    currentPlayer: isGameOver ? player : nextPlayer,
    p1Score,
    p2Score,
    p1Borrowed,
    p2Borrowed,
    isGameOver,
    winner,
    lastMoveInfo: {
      pitIndex,
      direction,
      player,
    },
  };

  // Nếu chưa game over, tự động kiểm tra xem đối thủ có cần bón sỏi không
  if (!isGameOver) {
    const feedCheck = checkAndApplyFeedIfNeeded(finalState, nextPlayer);
    finalState = feedCheck.newState;
    if (feedCheck.fed) {
      animationSteps.push(...feedCheck.steps);
    }
  }

  return { finalState, animationSteps };
}

/**
 * AI Bot tìm nước đi Ô Ăn Quan
 */
export function getBotMove(
  state: OAnQuanGameState,
  difficulty: "EASY" | "HARD"
): { pitIndex: number; direction: "CW" | "CCW" } | null {
  const validPits = getValidPits(state, state.currentPlayer);
  if (validPits.length === 0) return null;

  const options: { pitIndex: number; direction: "CW" | "CCW"; scoreDiff: number }[] = [];

  for (const pit of validPits) {
    for (const dir of ["CW", "CCW"] as ("CW" | "CCW")[]) {
      const { finalState } = executeMove(state, pit, dir);
      const myScore = state.currentPlayer === 1 ? finalState.p1Score : finalState.p2Score;
      const oppScore = state.currentPlayer === 1 ? finalState.p2Score : finalState.p1Score;
      options.push({
        pitIndex: pit,
        direction: dir,
        scoreDiff: myScore - oppScore,
      });
    }
  }

  if (options.length === 0) return null;

  if (difficulty === "EASY") {
    // Lựa chọn ngẫu nhiên
    const rand = options[Math.floor(Math.random() * options.length)];
    return { pitIndex: rand.pitIndex, direction: rand.direction };
  } else {
    // Chế độ KHÓ: Ưu tiên nước đi nhận được chênh lệch điểm cao nhất
    options.sort((a, b) => b.scoreDiff - a.scoreDiff);
    return { pitIndex: options[0].pitIndex, direction: options[0].direction };
  }
}
