import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { checkTicTacToeWin, checkCaroWin, decryptShips, encryptShips, validateShipPlacement, checkBattleshipShot } from "@/lib/gameLogic";

// Công thức tính thưởng
function calculateReward(outcome: "WIN" | "LOSE" | "DRAW", level: number, isPremium: boolean = false) {
  let coins = 0;
  let exp = 0;

  if (outcome === "WIN") {
    coins = 10 + 2 * level;
    exp = 5 + Math.round(level * 0.20);
  } else {
    // LOSE hoặc DRAW
    coins = Math.round(5 + 1.5 * level);
    exp = 2;
  }

  // Áp dụng x2 EXP và 1.5x Coins cho tài khoản Premium (VIP)
  if (isPremium) {
    coins = Math.round(coins * 1.5);
    exp = exp * 2;
  }

  return { coins, exp };
}

// Logic nâng cấp độ (Level up)
function addExpAndCalculateLevel(currentLevel: number, currentExp: number, expGained: number) {
  let level = currentLevel;
  let exp = currentExp + expGained;

  while (exp >= 100 + level * 5) {
    exp -= (100 + level * 5);
    level += 1;
  }

  return { level, exp };
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

          // Xác định danh sách toạ độ bắn dựa trên vũ khí
          const targetCoords: { x: number; y: number }[] = [];

          if (weapon === "NORMAL") {
            targetCoords.push({ x: targetX, y: targetY });
          } else if (weapon === "CLUSTER") {
            const charge = isPlayerX ? boardObj.clusterChargeX : boardObj.clusterChargeO;
            if (charge < 2) throw new Error("Chưa sạc đủ Đạn Chùm (cần 2 điểm)");
            
            // Khấu trừ sạc
            if (isPlayerX) boardObj.clusterChargeX = 0;
            else boardObj.clusterChargeO = 0;

            // Vùng 2x2 từ (targetX, targetY)
            for (let dx = 0; dx < 2; dx++) {
              for (let dy = 0; dy < 2; dy++) {
                const cx = targetX + dx;
                const cy = targetY + dy;
                if (cx >= 0 && cx < 10 && cy >= 0 && cy < 10) {
                  targetCoords.push({ x: cx, y: cy });
                }
              }
            }
          } else if (weapon === "CROSS") {
            const charge = isPlayerX ? boardObj.crossChargeX : boardObj.crossChargeO;
            if (charge < 3) throw new Error("Chưa sạc đủ Đạn Chữ Thập (cần 3 điểm)");

            // Khấu trừ sạc
            if (isPlayerX) boardObj.crossChargeX = 0;
            else boardObj.crossChargeO = 0;

            // Vùng hình chữ thập
            const offsets = [
              { dx: 0, dy: 0 },
              { dx: -1, dy: 0 },
              { dx: 1, dy: 0 },
              { dx: 0, dy: -1 },
              { dx: 0, dy: 1 },
            ];
            for (const offset of offsets) {
              const cx = targetX + offset.dx;
              const cy = targetY + offset.dy;
              if (cx >= 0 && cx < 10 && cy >= 0 && cy < 10) {
                targetCoords.push({ x: cx, y: cy });
              }
            }
          } else if (weapon === "RADAR") {
            const radarCount = isPlayerX ? boardObj.radarX : boardObj.radarO;
            if (radarCount < 1) throw new Error("Không còn lượt quét Radar");

            // Khấu trừ radar
            if (isPlayerX) boardObj.radarX--;
            else boardObj.radarO--;

            // Quét rada 3x3 quanh (targetX, targetY)
            let shipCellsCount = 0;
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                const cx = targetX + dx;
                const cy = targetY + dy;
                if (cx >= 0 && cx < 10 && cy >= 0 && cy < 10) {
                  // Check if this cell is occupied by opponent ship
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

            // Radar là kỹ năng phụ trợ, không gây sát thương nên luôn chuyển lượt
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

          // Xử lý các phát bắn gây sát thương (NORMAL, CLUSTER, CROSS)
          let anyHit = false;

          for (const coord of targetCoords) {
            // Check if already shot
            const alreadyShot = myShots.some((s: any) => s.x === coord.x && s.y === coord.y);
            if (alreadyShot) continue; // Bỏ qua ô đã bắn trước đó

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

              // Tăng điểm sạc đạn đặc biệt (chỉ khi dùng đạn thường bắn trúng)
              if (weapon === "NORMAL") {
                if (isPlayerX) {
                  boardObj.clusterChargeX = Math.min(2, boardObj.clusterChargeX + 1);
                  boardObj.crossChargeX = Math.min(3, boardObj.crossChargeX + 1);
                } else {
                  boardObj.clusterChargeO = Math.min(2, boardObj.clusterChargeO + 1);
                  boardObj.crossChargeO = Math.min(3, boardObj.crossChargeO + 1);
                }
              }

              if (shotResult.sunk && shotResult.shipId) {
                opponentSunkShips.push(shotResult.shipId);

                // Cập nhật tất cả các phát bắn của tàu đã chìm thành sunk = true
                myShots.forEach((s: any) => {
                  if (s.shipId === shotResult.shipId) {
                    s.sunk = true;
                  }
                });

                // Hồi 1 lượt quét Rada cho người bắn
                if (isPlayerX) boardObj.radarX++;
                else boardObj.radarO++;
              }
            }
          }

          // Kiểm tra xem đã thắng cuộc chưa (đối thủ chìm đủ 5 tàu)
          const hasWon = opponentSunkShips.length === 5;

          if (hasWon) {
            // --- Xử lý người thắng và thua cuộc ---
            const winner = isPlayerX ? room.playerX : room.playerO!;
            const loser = isPlayerX ? room.playerO! : room.playerX;

            const winnerRewards = calculateReward("WIN", winner.level, winner.isPremium);
            const loserRewards = calculateReward("LOSE", loser.level, loser.isPremium);

            const winnerCoinsGained = winnerRewards.coins + room.wager * 2;
            const loserCoinsGained = loserRewards.coins;

            const winnerNewStats = addExpAndCalculateLevel(winner.level, winner.exp, winnerRewards.exp);
            const loserNewStats = addExpAndCalculateLevel(loser.level, loser.exp, loserRewards.exp);

            await tx.user.update({
              where: { id: winner.id },
              data: {
                coins: { increment: winnerCoinsGained },
                level: winnerNewStats.level,
                exp: winnerNewStats.exp,
              },
            });

            await tx.user.update({
              where: { id: loser.id },
              data: {
                coins: { increment: loserCoinsGained },
                level: loserNewStats.level,
                exp: loserNewStats.exp,
              },
            });

            const updatedRoom = await tx.gameRoom.update({
              where: { id: roomId },
              data: {
                board: JSON.stringify(boardObj),
                status: "FINISHED",
                winnerId: winner.id,
                turnPlayerId: null,
              },
            });

            return {
              room: updatedRoom,
              finished: true,
              winnerId: winner.id,
              wager: room.wager,
              rewards: {
                [winner.id]: { outcome: "WIN", coins: winnerCoinsGained, exp: winnerRewards.exp, levelUp: winnerNewStats.level > winner.level },
                [loser.id]: { outcome: "LOSE", coins: loserCoinsGained, exp: loserRewards.exp, levelUp: loserNewStats.level > loser.level },
              },
            };
          } else {
            // Không thắng: Chuyển lượt đi
            // Nếu có bắn trúng (anyHit === true), giữ nguyên lượt đi (Chain-shot rules).
            // Nếu trượt (anyHit === false), chuyển lượt sang đối thủ.
            let nextTurnPlayerId = room.turnPlayerId;
            if (!anyHit) {
              nextTurnPlayerId = isPlayerX ? room.playerOId! : room.playerXId;
            }

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
        }
      } else {
        // --- TIC-TAC-TOE & CARO (CŨ) ---
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

        // Xác định quân cờ (X hay O) của người chơi hiện tại
        const symbol = playerId === room.playerXId ? "X" : "O";
        board[pos] = symbol;

        // Kiểm tra thắng cuộc
        let hasWon = false;
        if (room.gameType === "TIC_TAC_TOE") {
          hasWon = checkTicTacToeWin(board);
        } else {
          hasWon = checkCaroWin(board, pos, symbol);
        }

        // Kiểm tra hòa cuộc (Draw - hết ô trống)
        const isDraw = !hasWon && board.every((cell) => cell !== "");

        // Cập nhật trạng thái bàn cờ
        const updatedBoardStr = JSON.stringify(board);

        if (hasWon) {
          // --- Xử lý người chơi thắng cuộc và thua cuộc ---
          const winner = playerId === room.playerXId ? room.playerX : room.playerO!;
          const loser = playerId === room.playerXId ? room.playerO! : room.playerX;

          // Tính toán thưởng
          const winnerRewards = calculateReward("WIN", winner.level, winner.isPremium);
          const loserRewards = calculateReward("LOSE", loser.level, loser.isPremium);

          // Cộng cược cho người thắng (nhận lại cược của mình + cược đối thủ)
          const winnerCoinsGained = winnerRewards.coins + room.wager * 2;
          const loserCoinsGained = loserRewards.coins;

          // Nâng cấp level
          const winnerNewStats = addExpAndCalculateLevel(winner.level, winner.exp, winnerRewards.exp);
          const loserNewStats = addExpAndCalculateLevel(loser.level, loser.exp, loserRewards.exp);

          // Cập nhật Database cho người thắng
          await tx.user.update({
            where: { id: winner.id },
            data: {
              coins: { increment: winnerCoinsGained },
              level: winnerNewStats.level,
              exp: winnerNewStats.exp,
            }
          });

          // Cập nhật Database cho người thua
          await tx.user.update({
            where: { id: loser.id },
            data: {
              coins: { increment: loserCoinsGained },
              level: loserNewStats.level,
              exp: loserNewStats.exp,
            }
          });

          // Cập nhật phòng đấu thành kết thúc
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
          // --- Xử lý hòa cuộc ---
          const playerX = room.playerX;
          const playerO = room.playerO!;

          const rewardsX = calculateReward("DRAW", playerX.level, playerX.isPremium);
          const rewardsO = calculateReward("DRAW", playerO.level, playerO.isPremium);

          // Trả lại cược
          const coinsGainedX = rewardsX.coins + room.wager;
          const coinsGainedO = rewardsO.coins + room.wager;

          const newStatsX = addExpAndCalculateLevel(playerX.level, playerX.exp, rewardsX.exp);
          const newStatsO = addExpAndCalculateLevel(playerO.level, playerO.exp, rewardsO.exp);

          await tx.user.update({
            where: { id: playerX.id },
            data: {
              coins: { increment: coinsGainedX },
              level: newStatsX.level,
              exp: newStatsX.exp,
            }
          });

          await tx.user.update({
            where: { id: playerO.id },
            data: {
              coins: { increment: coinsGainedO },
              level: newStatsO.level,
              exp: newStatsO.exp,
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
          // --- Tiếp tục trận đấu, chuyển lượt ---
          const nextTurnPlayerId = playerId === room.playerXId ? room.playerOId! : room.playerXId;

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
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Lỗi đi nước cờ:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
