import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { 
  checkTicTacToeWin, 
  checkCaroWin, 
  decryptShips, 
  encryptShips, 
  validateShipPlacement, 
  checkBattleshipShot, 
  isRenjuForbidden,
  generateRandomShips
} from "@/lib/gameLogic";
import { addExp, calculateElo, addBattlePassExp, DailyMission, calculateRankUpdate } from "@/lib/progression";
import { getTicTacToeBotMove, getCaroBotMove, getBattleshipBotMove } from "@/lib/botAi";

// Công thức tính thưởng
function calculateReward(outcome: "WIN" | "LOSE" | "DRAW", level: number, isPremium: boolean = false) {
  let coins = 0;
  let exp = 0;

  if (outcome === "WIN") {
    coins = 20 + 2 * level;
    exp = 350 + 10 * level;
  } else {
    // LOSE hoặc DRAW
    coins = Math.round(10 + 1 * level);
    exp = 120 + 5 * level;
  }

  // Áp dụng x2 EXP và 1.5x Coins cho tài khoản Premium (VIP)
  if (isPremium) {
    coins = Math.round(coins * 1.5);
    exp = exp * 2;
  }

  return { coins, exp };
}

// Cập nhật tiến trình nhiệm vụ của người chơi
function updatePlayerMissions(missionsJson: string, gameType: string, actionType: "WIN_GAME" | "PLAY_GAME" | "HIT_SHIP", amount = 1) {
  if (!missionsJson || missionsJson === "[]") return missionsJson;
  try {
    const missions: DailyMission[] = JSON.parse(missionsJson);
    let updated = false;
    for (const m of missions) {
      if (m.claimed) continue;
      if (m.type === actionType && (!m.gameType || m.gameType === gameType)) {
        m.progress = Math.min(m.target, m.progress + amount);
        updated = true;
      }
    }
    return JSON.stringify(missions);
  } catch (e) {
    console.error(e);
    return missionsJson;
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const playerId = user.id;
    const { roomId, position, ships, weaponType } = await req.json();

    // Chạy Transaction để khóa phòng và cập nhật nước đi
    const result = await prisma.$transaction(async (tx) => {
      const room = await tx.gameRoom.findUnique({
        where: { id: roomId },
        include: {
          playerX: true,
          playerO: true,
        }
      });

      if (!room) {
        throw new Error("Phòng game không tồn tại");
      }

      // --- GAME BATTLESHIP (TÀU CHIẾN) ---
      if (room.gameType === "BATTLESHIP") {
        if (room.status !== "PLAYING" && room.status !== "WAITING") {
          throw new Error("Trận đấu đã kết thúc");
        }

        const boardObj = JSON.parse(room.board);
        const isPlayerX = playerId === room.playerXId;
        const isPlayerO = playerId === room.playerOId;

        if (!isPlayerX && !isPlayerO) {
          throw new Error("Bạn không tham gia phòng đấu này");
        }

        // --- GIAI ĐOẠN ĐẶT TÀU (PLACEMENT) ---
        if (boardObj.phase === "PLACEMENT") {
          if (!ships) {
            throw new Error("Thiếu thông tin đặt tàu");
          }

          if (!validateShipPlacement(ships)) {
            throw new Error("Vị trí đặt tàu không hợp lệ");
          }

          const encrypted = encryptShips(ships);
          if (isPlayerX) {
            if (boardObj.readyX) throw new Error("Bạn đã đặt tàu rồi");
            boardObj.shipsX = encrypted;
            boardObj.readyX = true;

            // Nếu đối thủ là BOT, tự động sinh tàu cho BOT luôn
            if (room.playerOId === "bot") {
              const botShips = generateRandomShips();
              boardObj.shipsO = encryptShips(botShips);
              boardObj.readyO = true;
            }
          } else {
            if (boardObj.readyO) throw new Error("Bạn đã đặt tàu rồi");
            boardObj.shipsO = encrypted;
            boardObj.readyO = true;
          }

          let nextStatus = room.status;
          let nextTurnPlayerId = room.turnPlayerId;

          // Nếu cả hai đều đã đặt xong tàu
          if (boardObj.readyX && boardObj.readyO) {
            boardObj.phase = "PLAYING";
            nextStatus = "PLAYING";
            nextTurnPlayerId = room.playerXId; // Người chơi X đi trước
            
            // Khởi tạo năng lượng (bắt đầu từ 50)
            boardObj.energyX = 50;
            boardObj.energyO = 50;
          }

          const updatedRoom = await tx.gameRoom.update({
            where: { id: roomId },
            data: {
              board: JSON.stringify(boardObj),
              status: nextStatus,
              turnPlayerId: nextTurnPlayerId,
            },
          });

          return {
            room: updatedRoom,
            finished: false,
          };
        }

        // --- GIAI ĐOẠN CHIẾN ĐẤU (PLAYING) ---
        if (boardObj.phase === "PLAYING") {
          if (room.status !== "PLAYING") {
            throw new Error("Trận đấu chưa sẵn sàng");
          }

          if (room.turnPlayerId !== playerId) {
            throw new Error("Chưa đến lượt đi của bạn");
          }

          if (position === undefined || position === null) {
            throw new Error("Vị trí bắn không được để trống");
          }

          const pos = Number(position);
          if (pos < 0 || pos >= 100) {
            throw new Error("Vị trí bắn vượt quá giới hạn bàn cờ 10x10");
          }

          const targetX = pos % 10;
          const targetY = Math.floor(pos / 10);

          const weapon = weaponType || "NORMAL";
          const myShots = isPlayerX ? boardObj.shotsX : boardObj.shotsO;
          const myRadarResults = isPlayerX ? boardObj.radarResultsX : boardObj.radarResultsO;
          const opponentShipsEnc = isPlayerX ? boardObj.shipsO : boardObj.shipsX;
          const opponentSunkShips = isPlayerX ? boardObj.sunkO : boardObj.sunkX;

          if (!opponentShipsEnc) {
            throw new Error("Không tìm thấy tàu của đối thủ");
          }

          const opponentShips = decryptShips(opponentShipsEnc);
          const targetCoords: { x: number; y: number }[] = [];

          // Sử dụng năng lượng thay cho điểm đạn giới hạn
          let currentEnergy = isPlayerX ? boardObj.energyX : boardObj.energyO;

          if (weapon === "NORMAL") {
            targetCoords.push({ x: targetX, y: targetY });
          } else if (weapon === "CLUSTER") {
            if (currentEnergy < 50) throw new Error("Không đủ Năng lượng! Kỹ năng Bom Chùm cần 50 Năng lượng.");
            
            // Trừ năng lượng
            currentEnergy -= 50;

            for (let dx = 0; dx < 2; dx++) {
              for (let dy = 0; dy < 2; dy++) {
                const cx = targetX + dx;
                const cy = targetY + dy;
                if (cx >= 0 && cx < 10 && cy >= 0 && cy < 10) {
                  targetCoords.push({ x: cx, y: cy });
                }
              }
            }
          } else if (weapon === "CROSS") { // Đội bay thám thính do thám 3 ô
            if (currentEnergy < 40) throw new Error("Không đủ Năng lượng! Kỹ năng Đội Bay Thám Thính cần 40 Năng lượng.");
            
            currentEnergy -= 40;

            const offsets = [
              { dx: 0, dy: 0 },
              { dx: -1, dy: 0 },
              { dx: 1, dy: 0 }
            ];
            for (const offset of offsets) {
              const cx = targetX + offset.dx;
              const cy = targetY + offset.dy;
              if (cx >= 0 && cx < 10 && cy >= 0 && cy < 10) {
                targetCoords.push({ x: cx, y: cy });
              }
            }
          } else if (weapon === "RADAR") {
            if (currentEnergy < 30) throw new Error("Không đủ Năng lượng! Kỹ năng Quét Rada cần 30 Năng lượng.");

            currentEnergy -= 30;

            // Quét rada 3x3
            let shipCellsCount = 0;
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                const cx = targetX + dx;
                const cy = targetY + dy;
                if (cx >= 0 && cx < 10 && cy >= 0 && cy < 10) {
                  const occupies = opponentShips.some(ship => {
                    for (let i = 0; i < ship.size; i++) {
                      const sx = ship.vertical ? ship.x : ship.x + i;
                      const sy = ship.vertical ? ship.y + i : ship.y;
                      if (sx === cx && sy === cy) return true;
                    }
                    return false;
                  });
                  if (occupies) shipCellsCount++;
                }
              }
            }

            myRadarResults.push({ x: targetX, y: targetY, count: shipCellsCount });

            // Lưu năng lượng cập nhật
            if (isPlayerX) boardObj.energyX = currentEnergy;
            else boardObj.energyO = currentEnergy;

            const nextTurnPlayerId = isPlayerX ? room.playerOId! : room.playerXId;
            const updatedRoom = await tx.gameRoom.update({
              where: { id: roomId },
              data: {
                board: JSON.stringify(boardObj),
                turnPlayerId: nextTurnPlayerId,
              },
            });

            return {
              room: updatedRoom,
              finished: false,
            };
          }

          // Xử lý bắn trúng
          let anyHit = false;
          let hitsCount = 0;

          for (const coord of targetCoords) {
            const alreadyShot = myShots.some((s: any) => s.x === coord.x && s.y === coord.y);
            if (alreadyShot) continue;

            const shotResult = checkBattleshipShot(coord.x, coord.y, opponentShips, myShots);
            
            myShots.push({
              x: coord.x,
              y: coord.y,
              hit: shotResult.hit,
              shipId: shotResult.shipId,
              sunk: shotResult.sunk,
            });

            if (shotResult.hit) {
              anyHit = true;
              hitsCount++;
              
              // Hồi năng lượng (+15 mỗi phát trúng)
              currentEnergy = Math.min(100, currentEnergy + 15);

              if (shotResult.sunk && shotResult.shipId) {
                opponentSunkShips.push(shotResult.shipId);
                
                myShots.forEach((s: any) => {
                  if (s.shipId === shotResult.shipId) s.sunk = true;
                });

                // Hồi năng lượng (+30 khi chìm tàu)
                currentEnergy = Math.min(100, currentEnergy + 30);
              }
            }
          }

          // Cập nhật năng lượng
          if (isPlayerX) boardObj.energyX = currentEnergy;
          else boardObj.energyO = currentEnergy;

          const isGameOver = opponentSunkShips.length === 5;
          const updatedBoardStr = JSON.stringify(boardObj);

          if (isGameOver) {
            // Trận đấu kết thúc
            const winner = isPlayerX ? room.playerX : room.playerO!;
            const loser = isPlayerX ? room.playerO! : room.playerX;

            const winnerRewards = calculateReward("WIN", winner.level, winner.isPremium);
            const loserRewards = calculateReward("LOSE", loser.level, loser.isPremium);

            const winnerCoinsGained = winnerRewards.coins + room.wager * 2;
            const loserCoinsGained = loserRewards.coins;

            // Tiến trình EXP mới
            const winnerNewStats = addExp(winner.level, winner.exp, winnerRewards.exp);
            const loserNewStats = addExp(loser.level, loser.exp, loserRewards.exp);

            // Cập nhật Elo & Rank Battleship
            const winnerElo = winner.eloBattleship;
            const loserElo = loser.eloBattleship;
            const newWinnerElo = calculateElo(winnerElo, loserElo, 1);
            const newLoserElo = calculateElo(loserElo, winnerElo, 0);

            const winnerRank = calculateRankUpdate(winner.rankTier, winner.rankDivision, winner.rankPoints, "WIN");
            const loserRank = calculateRankUpdate(loser.rankTier, loser.rankDivision, loser.rankPoints, "LOSE");

            // Tiến trình Battle Pass
            const winBPMatch = addBattlePassExp(winner.battlePassLevel, winner.battlePassExp, winner.isPremium ? 172 : 150);
            const loseBPMatch = addBattlePassExp(loser.battlePassLevel, loser.battlePassExp, loser.isPremium ? 57 : 50);

            // Cập nhật nhiệm vụ hàng ngày
            const winnerMissions = updatePlayerMissions(winner.dailyMissions, "BATTLESHIP", "PLAY_GAME");
            const loserMissions = updatePlayerMissions(loser.dailyMissions, "BATTLESHIP", "PLAY_GAME");
            const winnerHitMissions = updatePlayerMissions(winnerMissions, "BATTLESHIP", "HIT_SHIP", hitsCount);

            await tx.user.update({
              where: { id: winner.id },
              data: {
                eggs: { increment: winnerCoinsGained },
                level: winnerNewStats.level,
                exp: winnerNewStats.exp,
                eloBattleship: newWinnerElo,
                rankTier: winnerRank.tier,
                rankDivision: winnerRank.division,
                rankPoints: winnerRank.rankPoints,
                battlePassLevel: winBPMatch.level,
                battlePassExp: winBPMatch.exp,
                dailyMissions: winnerHitMissions,
              }
            });

            await tx.user.update({
              where: { id: loser.id },
              data: {
                eggs: { increment: loserCoinsGained },
                level: loserNewStats.level,
                exp: loserNewStats.exp,
                eloBattleship: newLoserElo,
                rankTier: loserRank.tier,
                rankDivision: loserRank.division,
                rankPoints: loserRank.rankPoints,
                battlePassLevel: loseBPMatch.level,
                battlePassExp: loseBPMatch.exp,
                dailyMissions: loserMissions,
              }
            });

            const updatedRoom = await tx.gameRoom.update({
              where: { id: roomId },
              data: {
                board: updatedBoardStr,
                status: "FINISHED",
                winnerId: winner.id,
                turnPlayerId: null,
              }
            });

            return {
              room: updatedRoom,
              finished: true,
              winnerId: winner.id,
              wager: room.wager,
              rewards: {
                [winner.id]: { outcome: "WIN", coins: winnerCoinsGained, exp: winnerRewards.exp, levelUp: winnerNewStats.level > winner.level },
                [loser.id]: { outcome: "LOSE", coins: loserCoinsGained, exp: loserRewards.exp, levelUp: loserNewStats.level > loser.level },
              }
            };
          } else {
            let nextTurnPlayerId: string | null = anyHit ? playerId : (isPlayerX ? room.playerOId! : room.playerXId);
            let finalStatus = room.status;
            let finalWinnerId = null;
            let finished = false;
            let finalRewards: any = null;

            if (nextTurnPlayerId === "bot") {
              // --- BOT TỰ ĐỘNG BẮN TRẢ NGAY LẬP TỨC TRÊN SERVER ---
              const playerShips = decryptShips(boardObj.shipsX);
              let botTurn = true;

              while (botTurn) {
                const botKnowledge = Array(100).fill("");
                boardObj.shotsO.forEach((s: any) => {
                  const idx = s.y * 10 + s.x;
                  if (s.sunk) botKnowledge[idx] = "S";
                  else if (s.hit) botKnowledge[idx] = "H";
                  else botKnowledge[idx] = "M";
                });

                const botMoveIdx = getBattleshipBotMove(botKnowledge, "EASY");
                if (botMoveIdx === -1) break;

                const bx = botMoveIdx % 10;
                const by = Math.floor(botMoveIdx / 10);
                const shotResult = checkBattleshipShot(bx, by, playerShips, boardObj.shotsO);

                boardObj.shotsO.push({
                  x: bx,
                  y: by,
                  hit: shotResult.hit,
                  shipId: shotResult.shipId,
                  sunk: shotResult.sunk
                });

                if (shotResult.hit) {
                  boardObj.energyO = Math.min(100, (boardObj.energyO || 50) + 15);
                  if (shotResult.sunk && shotResult.shipId) {
                    if (!boardObj.sunkX) boardObj.sunkX = [];
                    boardObj.sunkX.push(shotResult.shipId);
                    boardObj.shotsO.forEach((s: any) => {
                      if (s.shipId === shotResult.shipId) s.sunk = true;
                    });
                    boardObj.energyO = Math.min(100, boardObj.energyO + 30);
                  }

                  // Kiểm tra Bot thắng
                  if (boardObj.sunkX && boardObj.sunkX.length === 5) {
                    finalStatus = "FINISHED";
                    finalWinnerId = "bot";
                    nextTurnPlayerId = null;
                    finished = true;
                    botTurn = false;

                    // Tính điểm thua cho Player
                    const player = room.playerX;
                    const rewards = calculateReward("LOSE", player.level, player.isPremium);
                    const coinsGained = rewards.coins;
                    const newStats = addExp(player.level, player.exp, rewards.exp);
                    const currentElo = player.eloBattleship;
                    const newElo = calculateElo(currentElo, 1000, 0);
                    const playerRank = calculateRankUpdate(player.rankTier, player.rankDivision, player.rankPoints, "LOSE");
                    const loseBPMatch = addBattlePassExp(player.battlePassLevel, player.battlePassExp, player.isPremium ? 57 : 50);
                    const playerMissions = updatePlayerMissions(player.dailyMissions, "BATTLESHIP", "PLAY_GAME");

                    await tx.user.update({
                      where: { id: player.id },
                      data: {
                        eggs: { increment: coinsGained },
                        level: newStats.level,
                        exp: newStats.exp,
                        eloBattleship: newElo,
                        rankTier: playerRank.tier,
                        rankDivision: playerRank.division,
                        rankPoints: playerRank.rankPoints,
                        battlePassLevel: loseBPMatch.level,
                        battlePassExp: loseBPMatch.exp,
                        dailyMissions: playerMissions
                      }
                    });

                    finalRewards = {
                      [player.id]: { outcome: "LOSE", coins: coinsGained, exp: rewards.exp, levelUp: newStats.level > player.level }
                    };
                  }
                } else {
                  // Trượt, chuyển lại lượt cho Player
                  nextTurnPlayerId = room.playerXId;
                  botTurn = false;
                }
              }
            }

            // Cập nhật nhiệm vụ bắn trúng của Player (chỉ chạy khi lượt đi vừa rồi của Player bắn trúng)
            if (hitsCount > 0 && isPlayerX) {
              const currentMissions = room.playerX.dailyMissions;
              const updatedMissions = updatePlayerMissions(currentMissions, "BATTLESHIP", "HIT_SHIP", hitsCount);
              await tx.user.update({
                where: { id: playerId },
                data: { dailyMissions: updatedMissions }
              });
            }

            const updatedRoom = await tx.gameRoom.update({
              where: { id: roomId },
              data: {
                board: JSON.stringify(boardObj),
                status: finalStatus,
                winnerId: finalWinnerId,
                turnPlayerId: nextTurnPlayerId,
              }
            });

            return {
              room: updatedRoom,
              finished,
              winnerId: finalWinnerId,
              wager: room.wager,
              rewards: finalRewards
            };
          }
        }
      } else {
        // --- GAME TIC-TAC-TOE & GOMOKU (CARO) ---
        if (room.status !== "PLAYING") {
          throw new Error("Trận đấu đã kết thúc hoặc chưa sẵn sàng");
        }

        if (room.turnPlayerId !== playerId) {
          throw new Error("Chưa đến lượt đi của bạn");
        }

        if (position === undefined || position === null) {
          throw new Error("Vị trí đánh cờ không được để trống");
        }

        const pos = Number(position);
        const board: string[] = JSON.parse(room.board);
        const boardSize = room.gameType === "TIC_TAC_TOE" ? 9 : 144;

        if (pos < 0 || pos >= boardSize) {
          throw new Error("Vị trí đánh cờ vượt quá giới hạn bàn cờ");
        }

        if (board[pos] !== "") {
          throw new Error("Vị trí này đã được đánh trước đó");
        }

        const symbol = playerId === room.playerXId ? "X" : "O";

        // --- KIỂM TRA LUẬT CẤM RENJU (CHO RANK BẠCH KIM GOMOKU TRỞ LÊN) ---
        if (room.gameType === "CARO" && symbol === "X" && room.playerX.eloGomoku >= 1200) {
          const renjuCheck = isRenjuForbidden(board, pos, "X");
          if (renjuCheck.forbidden) {
            // Quân Đen vi phạm luật cấm Renju -> Xử thua ngay lập tức!
            const winner = room.playerO!;
            const loser = room.playerX;

            const winnerRewards = calculateReward("WIN", winner.level, winner.isPremium);
            const loserRewards = calculateReward("LOSE", loser.level, loser.isPremium);

            const winnerCoinsGained = winnerRewards.coins + room.wager * 2;
            const loserCoinsGained = loserRewards.coins;

            const winnerNewStats = addExp(winner.level, winner.exp, winnerRewards.exp);
            const loserNewStats = addExp(loser.level, loser.exp, loserRewards.exp);

            // Cập nhật Elo Gomoku
            const winnerElo = winner.eloGomoku;
            const loserElo = loser.eloGomoku;
            const newWinnerElo = calculateElo(winnerElo, loserElo, 1);
            const newLoserElo = calculateElo(loserElo, winnerElo, 0);

            const winnerRank = calculateRankUpdate(winner.rankTier, winner.rankDivision, winner.rankPoints, "WIN");
            const loserRank = calculateRankUpdate(loser.rankTier, loser.rankDivision, loser.rankPoints, "LOSE");

            // Cập nhật Database
            await tx.user.update({
              where: { id: winner.id },
              data: {
                eggs: { increment: winnerCoinsGained },
                level: winnerNewStats.level,
                exp: winnerNewStats.exp,
                eloGomoku: newWinnerElo,
                rankTier: winnerRank.tier,
                rankDivision: winnerRank.division,
                rankPoints: winnerRank.rankPoints,
              }
            });

            await tx.user.update({
              where: { id: loser.id },
              data: {
                eggs: { increment: loserCoinsGained },
                level: loserNewStats.level,
                exp: loserNewStats.exp,
                eloGomoku: newLoserElo,
                rankTier: loserRank.tier,
                rankDivision: loserRank.division,
                rankPoints: loserRank.rankPoints,
              }
            });

            board[pos] = "X"; // Ghi nhận nước đi vi phạm lên bàn cờ

            const updatedRoom = await tx.gameRoom.update({
              where: { id: roomId },
              data: {
                board: JSON.stringify(board),
                status: "FINISHED",
                winnerId: winner.id,
                turnPlayerId: null,
              }
            });

            return {
              room: updatedRoom,
              finished: true,
              winnerId: winner.id,
              wager: room.wager,
              renjuViolated: true,
              rewards: {
                [winner.id]: { outcome: "WIN", coins: winnerCoinsGained, exp: winnerRewards.exp, levelUp: winnerNewStats.level > winner.level },
                [loser.id]: { outcome: "LOSE", coins: loserCoinsGained, exp: loserRewards.exp, levelUp: loserNewStats.level > loser.level },
              }
            };
          }
        }

        // Đặt quân cờ
        board[pos] = symbol;

        // Kiểm tra thắng cuộc
        let hasWon = false;
        if (room.gameType === "TIC_TAC_TOE") {
          hasWon = checkTicTacToeWin(board);
        } else {
          hasWon = checkCaroWin(board, pos, symbol);
        }

        const isDraw = !hasWon && board.every((cell) => cell !== "");
        const updatedBoardStr = JSON.stringify(board);

        if (hasWon) {
          const winner = playerId === room.playerXId ? room.playerX : room.playerO!;
          const loser = playerId === room.playerXId ? room.playerO! : room.playerX;

          const winnerRewards = calculateReward("WIN", winner.level, winner.isPremium);
          const loserRewards = calculateReward("LOSE", loser.level, loser.isPremium);

          const winnerCoinsGained = winnerRewards.coins + room.wager * 2;
          const loserCoinsGained = loserRewards.coins;

          const winnerNewStats = addExp(winner.level, winner.exp, winnerRewards.exp);
          const loserNewStats = addExp(loser.level, loser.exp, loserRewards.exp);

          // Cập nhật Elo theo game
          const isGomoku = room.gameType === "CARO";
          const winnerElo = isGomoku ? winner.eloGomoku : winner.eloTicTacToe;
          const loserElo = isGomoku ? loser.eloGomoku : loser.eloTicTacToe;
          const newWinnerElo = calculateElo(winnerElo, loserElo, 1);
          const newLoserElo = calculateElo(loserElo, winnerElo, 0);

          // Cập nhật BP EXP
          const winBPMatch = addBattlePassExp(winner.battlePassLevel, winner.battlePassExp, winner.isPremium ? 172 : 150);
          const loseBPMatch = addBattlePassExp(loser.battlePassLevel, loser.battlePassExp, loser.isPremium ? 57 : 50);

          // Cập nhật nhiệm vụ hàng ngày
          const winnerMissions = updatePlayerMissions(winner.dailyMissions, room.gameType, "PLAY_GAME");
          const loserMissions = updatePlayerMissions(loser.dailyMissions, room.gameType, "PLAY_GAME");
          const winnerWinMissions = updatePlayerMissions(winnerMissions, room.gameType, "WIN_GAME");

          const winnerRank = calculateRankUpdate(winner.rankTier, winner.rankDivision, winner.rankPoints, "WIN");
          const loserRank = calculateRankUpdate(loser.rankTier, loser.rankDivision, loser.rankPoints, "LOSE");

          await tx.user.update({
            where: { id: winner.id },
            data: {
              eggs: { increment: winnerCoinsGained },
              level: winnerNewStats.level,
              exp: winnerNewStats.exp,
              eloGomoku: isGomoku ? newWinnerElo : undefined,
              eloTicTacToe: !isGomoku ? newWinnerElo : undefined,
              rankTier: winnerRank.tier,
              rankDivision: winnerRank.division,
              rankPoints: winnerRank.rankPoints,
              battlePassLevel: winBPMatch.level,
              battlePassExp: winBPMatch.exp,
              dailyMissions: winnerWinMissions,
            }
          });

          await tx.user.update({
            where: { id: loser.id },
            data: {
              eggs: { increment: loserCoinsGained },
              level: loserNewStats.level,
              exp: loserNewStats.exp,
              eloGomoku: isGomoku ? newLoserElo : undefined,
              eloTicTacToe: !isGomoku ? newLoserElo : undefined,
              rankTier: loserRank.tier,
              rankDivision: loserRank.division,
              rankPoints: loserRank.rankPoints,
              battlePassLevel: loseBPMatch.level,
              battlePassExp: loseBPMatch.exp,
              dailyMissions: loserMissions,
            }
          });

          const updatedRoom = await tx.gameRoom.update({
            where: { id: roomId },
            data: {
              board: updatedBoardStr,
              status: "FINISHED",
              winnerId: winner.id,
              turnPlayerId: null,
            }
          });

          return {
            room: updatedRoom,
            finished: true,
            winnerId: winner.id,
            wager: room.wager,
            rewards: {
              [winner.id]: { outcome: "WIN", coins: winnerCoinsGained, exp: winnerRewards.exp, levelUp: winnerNewStats.level > winner.level },
              [loser.id]: { outcome: "LOSE", coins: loserCoinsGained, exp: loserRewards.exp, levelUp: loserNewStats.level > loser.level },
            }
          };
        } else if (isDraw) {
          const playerX = room.playerX;
          const playerO = room.playerO!;

          const rewardsX = calculateReward("DRAW", playerX.level, playerX.isPremium);
          const rewardsO = calculateReward("DRAW", playerO.level, playerO.isPremium);

          const coinsGainedX = rewardsX.coins + room.wager;
          const coinsGainedO = rewardsO.coins + room.wager;

          const newStatsX = addExp(playerX.level, playerX.exp, rewardsX.exp);
          const newStatsO = addExp(playerO.level, playerO.exp, rewardsO.exp);

          // Cập nhật Elo Draw
          const isGomoku = room.gameType === "CARO";
          const eloX = isGomoku ? playerX.eloGomoku : playerX.eloTicTacToe;
          const eloO = isGomoku ? playerO.eloGomoku : playerO.eloTicTacToe;
          const newEloX = calculateElo(eloX, eloO, 0.5);
          const newEloO = calculateElo(eloO, eloX, 0.5);

          const rankX = calculateRankUpdate(playerX.rankTier, playerX.rankDivision, playerX.rankPoints, "DRAW");
          const rankO = calculateRankUpdate(playerO.rankTier, playerO.rankDivision, playerO.rankPoints, "DRAW");

          await tx.user.update({
            where: { id: playerX.id },
            data: {
              eggs: { increment: coinsGainedX },
              level: newStatsX.level,
              exp: newStatsX.exp,
              eloGomoku: isGomoku ? newEloX : undefined,
              eloTicTacToe: !isGomoku ? newEloX : undefined,
              rankTier: rankX.tier,
              rankDivision: rankX.division,
              rankPoints: rankX.rankPoints,
            }
          });

          await tx.user.update({
            where: { id: playerO.id },
            data: {
              eggs: { increment: coinsGainedO },
              level: newStatsO.level,
              exp: newStatsO.exp,
              eloGomoku: isGomoku ? newEloO : undefined,
              eloTicTacToe: !isGomoku ? newEloO : undefined,
              rankTier: rankO.tier,
              rankDivision: rankO.division,
              rankPoints: rankO.rankPoints,
            }
          });

          const updatedRoom = await tx.gameRoom.update({
            where: { id: roomId },
            data: {
              board: updatedBoardStr,
              status: "FINISHED",
              draw: true,
              turnPlayerId: null,
            }
          });

          return {
            room: updatedRoom,
            finished: true,
            draw: true,
            wager: room.wager,
            rewards: {
              [playerX.id]: { outcome: "DRAW", coins: coinsGainedX, exp: rewardsX.exp, levelUp: newStatsX.level > playerX.level },
              [playerO.id]: { outcome: "DRAW", coins: coinsGainedO, exp: rewardsO.exp, levelUp: newStatsO.level > playerO.level },
            }
          };
        } else {
          // Tiếp tục chuyển lượt
          const nextTurnPlayerId = playerId === room.playerXId ? room.playerOId! : room.playerXId;

          if (nextTurnPlayerId === "bot") {
            // --- BOT ĐÁNH TRẢ NGAY LẬP TỨC TRÊN SERVER ---
            const botSymbol = "O";
            const playerSymbol = "X";
            
            let botMove = -1;
            if (room.gameType === "TIC_TAC_TOE") {
              botMove = getTicTacToeBotMove(board, "EASY", botSymbol, playerSymbol);
            } else {
              botMove = getCaroBotMove(board, botSymbol, playerSymbol);
            }

            if (botMove !== -1) {
              board[botMove] = botSymbol;
            }

            // Kiểm tra thắng thua sau nước đi của Bot
            let botWon = false;
            if (room.gameType === "TIC_TAC_TOE") {
              botWon = checkTicTacToeWin(board);
            } else {
              botWon = checkCaroWin(board, botMove, botSymbol);
            }

            const botDraw = !botWon && board.every((cell) => cell !== "");
            const finalBoardStr = JSON.stringify(board);

            if (botWon) {
              // Bot thắng -> Người chơi thua (playerX)
              const player = room.playerX;
              const rewards = calculateReward("LOSE", player.level, player.isPremium);
              const coinsGained = rewards.coins;
              const newStats = addExp(player.level, player.exp, rewards.exp);
              const isGomoku = room.gameType === "CARO";
              const currentElo = isGomoku ? player.eloGomoku : player.eloTicTacToe;
              const newElo = calculateElo(currentElo, 1000, 0); 
              const playerRank = calculateRankUpdate(player.rankTier, player.rankDivision, player.rankPoints, "LOSE");
              const loseBPMatch = addBattlePassExp(player.battlePassLevel, player.battlePassExp, player.isPremium ? 57 : 50);
              const playerMissions = updatePlayerMissions(player.dailyMissions, room.gameType, "PLAY_GAME");

              await tx.user.update({
                where: { id: player.id },
                data: {
                  eggs: { increment: coinsGained },
                  level: newStats.level,
                  exp: newStats.exp,
                  eloGomoku: isGomoku ? newElo : undefined,
                  eloTicTacToe: !isGomoku ? newElo : undefined,
                  rankTier: playerRank.tier,
                  rankDivision: playerRank.division,
                  rankPoints: playerRank.rankPoints,
                  battlePassLevel: loseBPMatch.level,
                  battlePassExp: loseBPMatch.exp,
                  dailyMissions: playerMissions,
                }
              });

              const updatedRoom = await tx.gameRoom.update({
                where: { id: roomId },
                data: {
                  board: finalBoardStr,
                  status: "FINISHED",
                  winnerId: "bot",
                  turnPlayerId: null,
                }
              });

              return {
                room: updatedRoom,
                finished: true,
                winnerId: "bot",
                wager: room.wager,
                rewards: {
                  [player.id]: { outcome: "LOSE", coins: coinsGained, exp: rewards.exp, levelUp: newStats.level > player.level }
                }
              };
            } else if (botDraw) {
              // Hòa game
              const player = room.playerX;
              const rewards = calculateReward("DRAW", player.level, player.isPremium);
              const coinsGained = rewards.coins + room.wager;
              const newStats = addExp(player.level, player.exp, rewards.exp);
              const isGomoku = room.gameType === "CARO";
              const currentElo = isGomoku ? player.eloGomoku : player.eloTicTacToe;
              const newElo = calculateElo(currentElo, 1000, 0.5);

              const playerRank = calculateRankUpdate(player.rankTier, player.rankDivision, player.rankPoints, "DRAW");

              await tx.user.update({
                where: { id: player.id },
                data: {
                  eggs: { increment: coinsGained },
                  level: newStats.level,
                  exp: newStats.exp,
                  eloGomoku: isGomoku ? newElo : undefined,
                  eloTicTacToe: !isGomoku ? newElo : undefined,
                  rankTier: playerRank.tier,
                  rankDivision: playerRank.division,
                  rankPoints: playerRank.rankPoints,
                }
              });

              const updatedRoom = await tx.gameRoom.update({
                where: { id: roomId },
                data: {
                  board: finalBoardStr,
                  status: "FINISHED",
                  draw: true,
                  turnPlayerId: null,
                }
              });

              return {
                room: updatedRoom,
                finished: true,
                draw: true,
                wager: room.wager,
                rewards: {
                  [player.id]: { outcome: "DRAW", coins: coinsGained, exp: rewards.exp, levelUp: newStats.level > player.level }
                }
              };
            } else {
              // Game tiếp tục, chuyển lượt về lại người chơi
              const updatedRoom = await tx.gameRoom.update({
                where: { id: roomId },
                data: {
                  board: finalBoardStr,
                  turnPlayerId: playerId,
                }
              });

              return {
                room: updatedRoom,
                finished: false,
              };
            }
          } else {
            // Người chơi thật khác, chuyển lượt bình thường
            const updatedRoom = await tx.gameRoom.update({
              where: { id: roomId },
              data: {
                board: updatedBoardStr,
                turnPlayerId: nextTurnPlayerId,
              }
            });

            return {
              room: updatedRoom,
              finished: false,
            };
          }
        }
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Lỗi đi nước cờ:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
