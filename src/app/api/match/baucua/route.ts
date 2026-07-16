import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { calculateElo, calculateRankUpdate, addExp, addBattlePassExp } from "@/lib/progression";

// Các linh vật trong Bầu Cua (1: bau, 2: cua, 3: tom, 4: ca, 5: ga, 6: nai)
const ANIMALS = ["1", "2", "3", "4", "5", "6"];

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const { action, roomId, data } = await req.json();

    if (!roomId) {
      return NextResponse.json({ error: "Thiếu ID phòng đấu" }, { status: 400 });
    }

    // Lấy thông tin phòng đấu
    const room = await prisma.gameRoom.findUnique({
      where: { id: roomId },
      include: {
        playerX: true,
        playerO: true,
        player3: true,
        player4: true,
      }
    });

    if (!room || room.gameType !== "BAU_CUA") {
      return NextResponse.json({ error: "Không tìm thấy phòng đấu Bầu Cua" }, { status: 404 });
    }

    // Parse board JSON
    let boardObj: any = { players: [], status: "WAITING", betLimit: room.wager, bets: {}, dice: [], history: [] };
    try {
      boardObj = JSON.parse(room.board);
    } catch (e) {}

    // 0. Hành động: LẤY THÔNG TIN PHÒNG (GET_ROOM)
    if (action === "GET_ROOM") {
      return NextResponse.json({ room });
    }

    // 1. Hành động: SẴN SÀNG (READY)
    if (action === "READY") {
      const player = boardObj.players.find((p: any) => p.id === userId);
      if (!player) {
        return NextResponse.json({ error: "Bạn không có trong phòng này" }, { status: 400 });
      }

      player.ready = !player.ready;

      const updatedRoom = await prisma.gameRoom.update({
        where: { id: roomId },
        data: { board: JSON.stringify(boardObj) }
      });

      return NextResponse.json({ room: updatedRoom });
    }

    // 2. Hành động: THÊM BOT (ADD_BOT)
    if (action === "ADD_BOT") {
      if (room.playerXId !== userId) {
        return NextResponse.json({ error: "Chỉ chủ phòng mới có quyền thêm Bot" }, { status: 403 });
      }

      if (boardObj.players.length >= 4) {
        return NextResponse.json({ error: "Phòng đã đầy" }, { status: 400 });
      }

      const botNames = ["BOT Kê Vương 🐓", "BOT Thần Bài 🃏", "BOT Lộc Phát 💸", "BOT Lắc Hũ 🎲", "BOT Vui Vẻ 🎉"];
      const botName = botNames[Math.floor(Math.random() * botNames.length)] + ` #${Math.floor(Math.random() * 900 + 100)}`;
      const botId = `bot_${Math.random().toString(36).substring(2, 9)}`;

      boardObj.players.push({
        id: botId,
        username: botName,
        avatarUrl: null,
        ready: true,
        isBot: true
      });

      // Tìm slot trống để gán botId vào cột DB
      let botField: "playerOId" | "player3Id" | "player4Id" | null = null;
      if (!room.playerOId) botField = "playerOId";
      else if (!room.player3Id) botField = "player3Id";
      else if (!room.player4Id) botField = "player4Id";

      const updateData: any = { board: JSON.stringify(boardObj) };
      if (botField) {
        updateData[botField] = botId;
        // Đảm bảo bot tồn tại trong DB (hoặc bot ảo)
        await prisma.user.upsert({
          where: { id: botId },
          update: { username: botName, isGuest: true },
          create: {
            id: botId,
            username: botName,
            email: `${botId}@bot.com`,
            isGuest: true,
            eggs: 1000
          }
        });
      }

      const updatedRoom = await prisma.gameRoom.update({
        where: { id: roomId },
        data: updateData
      });

      return NextResponse.json({ room: updatedRoom });
    }

    // 3. Hành động: BẮT ĐẦU (START)
    if (action === "START") {
      if (room.playerXId !== userId) {
        return NextResponse.json({ error: "Chỉ chủ phòng mới có quyền bắt đầu" }, { status: 403 });
      }

      // Đổi trạng thái sang PLAYING và bắt đầu cược
      boardObj.status = "BETTING";
      boardObj.bets = {};
      boardObj.dice = [];
      boardObj.bettingEndsAt = Date.now() + 20000; // 20 giây cược từ thời điểm bắt đầu

      // Cho các BOT đặt cược ngẫu nhiên ngay từ đầu để sinh động (Cược từ 10 - 100, chia ra hoặc cược 1 chỗ)
      boardObj.players.forEach((p: any) => {
        if (p.isBot) {
          const limit = boardObj.betLimit > 0 ? boardObj.betLimit : 200;
          const totalBet = Math.floor(Math.random() * 91) + 10; // 10 - 100 Coin
          const finalBet = Math.min(totalBet, limit);
          
          const botBets: any = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 };
          
          const split = Math.random() > 0.5;
          if (split && finalBet >= 20) {
            const count = Math.random() > 0.5 ? 2 : 3;
            let remaining = finalBet;
            const slots = ["1", "2", "3", "4", "5", "6"].sort(() => Math.random() - 0.5);
            
            for (let i = 0; i < count - 1; i++) {
              const chunk = Math.floor(Math.random() * (remaining - 10)) + 5;
              botBets[slots[i]] = chunk;
              remaining -= chunk;
            }
            botBets[slots[count - 1]] = remaining;
          } else {
            const randomSlot = String(Math.floor(Math.random() * 6) + 1);
            botBets[randomSlot] = finalBet;
          }
          boardObj.bets[p.id] = botBets;
        }
      });

      const updatedRoom = await prisma.gameRoom.update({
        where: { id: roomId },
        data: {
          status: "PLAYING",
          board: JSON.stringify(boardObj)
        }
      });

      return NextResponse.json({ room: updatedRoom });
    }

    // 4. Hành động: ĐẶT CƯỢC (PLACE_BET)
    if (action === "PLACE_BET") {
      if (boardObj.status !== "BETTING") {
        return NextResponse.json({ error: "Không trong thời gian đặt cược" }, { status: 400 });
      }

      const playerBets = data.bets; // { bau: 10, cua: 5... }
      
      // Kiểm tra tính hợp lệ của các linh vật cược
      let newTotalBet = 0;
      for (const [key, val] of Object.entries(playerBets)) {
        if (!ANIMALS.includes(key)) {
          return NextResponse.json({ error: "Linh vật cược không hợp lệ" }, { status: 400 });
        }
        if (typeof val !== "number" || val < 0) {
          return NextResponse.json({ error: "Số tiền cược không hợp lệ" }, { status: 400 });
        }
        newTotalBet += val;
      }

      // Kiểm tra giới hạn cược của phòng
      if (boardObj.betLimit > 0 && newTotalBet > boardObj.betLimit) {
        return NextResponse.json({ error: `Vượt quá giới hạn cược của phòng (${boardObj.betLimit} Coin)` }, { status: 400 });
      }

      // Lấy cược cũ của người chơi này
      const oldBets = boardObj.bets[userId] || {};
      const oldTotalBet = Object.values(oldBets).reduce((a: number, b: any) => a + (Number(b) || 0), 0) as number;

      const netDifference = newTotalBet - oldTotalBet;

      // Cập nhật số dư coin của người chơi trong DB
      const result = await prisma.$transaction(async (tx) => {
        const playerProfile = await tx.user.findUnique({
          where: { id: userId }
        });

        if (!playerProfile) {
          throw new Error("PLAYER_NOT_FOUND");
        }

        if (netDifference > 0 && playerProfile.eggs < netDifference) {
          throw new Error("INSUFFICIENT_FUNDS");
        }

        // Khấu trừ hoặc hoàn trả Coin tương ứng với lượng cược thay đổi
        const updatedProfile = await tx.user.update({
          where: { id: userId },
          data: {
            eggs: { decrement: netDifference }
          }
        });

        // Ghi cược mới vào boardObj
        boardObj.bets[userId] = playerBets;

        const updatedRoom = await tx.gameRoom.update({
          where: { id: roomId },
          data: { board: JSON.stringify(boardObj) }
        });

        return { room: updatedRoom, eggs: updatedProfile.eggs };
      });

      return NextResponse.json(result);
    }

    // 5. Hành động: LẮC XÚC XẮC & KẾT THÚC VÁN (ROLL)
    if (action === "ROLL") {
      if (room.playerXId !== userId) {
        return NextResponse.json({ error: "Chỉ chủ phòng mới có quyền lắc xúc xắc" }, { status: 403 });
      }

      // Thực hiện toàn bộ logic ROLL trong 1 transaction duy nhất để tránh race condition khi đa tab/double click
      try {
        const result = await prisma.$transaction(async (tx) => {
          const freshRoom = await tx.gameRoom.findUnique({
            where: { id: roomId }
          });

          if (!freshRoom) {
            throw new Error("Phòng đấu không tồn tại");
          }

          const freshBoardObj = JSON.parse(freshRoom.board);
          if (freshBoardObj.status !== "BETTING") {
            throw new Error("Trạng thái phòng không hợp lệ để lắc");
          }

          // Lắc ngẫu nhiên 3 xúc xắc (các giá trị 1-6 đại diện cho Bầu, Cua, Tôm, Cá, Gà, Nai)
          const dice = [
            Math.floor(Math.random() * 6) + 1,
            Math.floor(Math.random() * 6) + 1,
            Math.floor(Math.random() * 6) + 1
          ];

          // Đếm số lượng xuất hiện của từng linh vật trong kết quả xúc xắc (1-6)
          const counts: any = {};
          dice.forEach(val => {
            const key = String(val);
            counts[key] = (counts[key] || 0) + 1;
          });

          const updatedPlayersData: any[] = [];

          // Tính thưởng cho từng người chơi
          for (const p of freshBoardObj.players) {
            if (p.isBot) continue; // Bỏ qua bot

            const playerBets = freshBoardObj.bets[p.id] || {};
            let totalPayout = 0;
            let totalPlacedBet = 0;

            // Duyệt qua cược của người chơi trên 6 ô
            for (const animal of ANIMALS) {
              const betAmount = Number(playerBets[animal]) || 0;
              if (betAmount <= 0) continue;

              totalPlacedBet += betAmount;
              const matchCount = counts[animal] || 0;

              if (matchCount > 0) {
                // Thắng cược: nhận lại gốc + (cược * số lượng xúc xắc ra ô đó)
                totalPayout += betAmount * (matchCount + 1);
              }
            }

            // Cập nhật số dư Coin thực tế của người chơi trong DB
            let updatedCoins = 0;
            if (totalPayout > 0) {
              const up = await tx.user.update({
                where: { id: p.id },
                data: { eggs: { increment: totalPayout } }
              });
              updatedCoins = up.eggs;
            } else {
              const up = await tx.user.findUnique({
                where: { id: p.id }
              });
              updatedCoins = up?.eggs || 0;
            }

            // Tính toán ELO, Rank, EXP Bầu Cua dựa trên thắng/thua ròng (Cược càng cao, thưởng/phạt càng nhiều)
            const netProfit = totalPayout - totalPlacedBet;
            let eloChange = 0;
            let rankPointsChange = 0;
            let expGained = 0;
            let rankChangeOutcome: "WIN" | "LOSE" | "DRAW" | null = null;

            if (totalPlacedBet > 0) {
              if (netProfit > 0) {
                eloChange = Math.max(5, Math.min(50, Math.floor(netProfit * 0.2)));
                rankPointsChange = Math.max(5, Math.min(35, Math.floor(netProfit * 0.15)));
                expGained = Math.max(10, Math.min(300, Math.floor(netProfit * 0.5)));
                rankChangeOutcome = "WIN";
              } else if (netProfit < 0) {
                const lossAmount = -netProfit;
                eloChange = -Math.max(5, Math.min(40, Math.floor(lossAmount * 0.15)));
                rankPointsChange = -Math.max(5, Math.min(25, Math.floor(lossAmount * 0.12)));
                expGained = Math.max(2, Math.min(30, Math.floor(lossAmount * 0.05)));
                rankChangeOutcome = "LOSE";
              } else {
                eloChange = 2; // hòa vốn
                rankPointsChange = 2;
                expGained = 5;
                rankChangeOutcome = "DRAW";
              }
            }

            if (rankChangeOutcome) {
              const dbPlayer = await tx.user.findUnique({
                where: { id: p.id }
              });

              if (dbPlayer) {
                const newElo = Math.max(100, dbPlayer.eloBauCua + eloChange);
                const rankUpdate = calculateRankUpdate(
                  dbPlayer.rankTierBauCua,
                  dbPlayer.rankDivisionBauCua,
                  dbPlayer.rankPointsBauCua,
                  rankChangeOutcome,
                  rankPointsChange
                );

                const expUpdate = addExp(dbPlayer.level, dbPlayer.exp, expGained);
                const bpUpdate = addBattlePassExp(dbPlayer.battlePassLevel, dbPlayer.battlePassExp, Math.floor(expGained * 0.5));

                await tx.user.update({
                  where: { id: p.id },
                  data: {
                    eloBauCua: newElo,
                    rankTierBauCua: rankUpdate.tier,
                    rankDivisionBauCua: rankUpdate.division,
                    rankPointsBauCua: rankUpdate.rankPoints,
                    level: expUpdate.level,
                    exp: expUpdate.exp,
                    battlePassLevel: bpUpdate.level,
                    battlePassExp: bpUpdate.exp,
                    // Đồng bộ global rank
                    rankTier: rankUpdate.tier,
                    rankDivision: rankUpdate.division,
                    rankPoints: rankUpdate.rankPoints,
                  }
                });
              }
            }

            updatedPlayersData.push({
              id: p.id,
              placedBet: totalPlacedBet,
              payout: totalPayout,
              profit: netProfit,
              coins: updatedCoins
            });
          }

          // Cập nhật freshBoardObj
          freshBoardObj.dice = dice;
          freshBoardObj.status = "FINISHED";
          
          if (!freshBoardObj.history) freshBoardObj.history = [];
          freshBoardObj.history.unshift(dice);
          if (freshBoardObj.history.length > 10) {
            freshBoardObj.history = freshBoardObj.history.slice(0, 10);
          }
          freshBoardObj.results = updatedPlayersData;

          const updatedRoom = await tx.gameRoom.update({
            where: { id: roomId },
            data: {
              status: "FINISHED",
              board: JSON.stringify(freshBoardObj)
            }
          });

          return { room: updatedRoom };
        });

        return NextResponse.json(result);
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Lỗi xử lý lắc xúc xắc" }, { status: 400 });
      }
    }

    // 6. Hành động: CHƠI LẠI VÁN MỚI (PLAY_AGAIN)
    if (action === "PLAY_AGAIN") {
      if (room.playerXId !== userId) {
        return NextResponse.json({ error: "Chỉ chủ phòng mới có quyền bắt đầu ván mới" }, { status: 403 });
      }

      // Chuyển trực tiếp sang trạng thái đặt cược BETTING để game tự động lặp vòng chơi liên tục
      boardObj.status = "BETTING";
      boardObj.bets = {};
      boardObj.dice = [];
      boardObj.results = null;
      boardObj.bettingEndsAt = Date.now() + 20000; // 20 giây đặt cược mới

      // Tự động sinh cược mới cho BOT để ván chơi sinh động
      boardObj.players.forEach((p: any) => {
        if (p.isBot) {
          const limit = boardObj.betLimit > 0 ? boardObj.betLimit : 200;
          const totalBet = Math.floor(Math.random() * 91) + 10; // 10 - 100 Coin
          const finalBet = Math.min(totalBet, limit);
          
          const botBets: any = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 };
          
          const split = Math.random() > 0.5;
          if (split && finalBet >= 20) {
            const count = Math.random() > 0.5 ? 2 : 3;
            let remaining = finalBet;
            const slots = ["1", "2", "3", "4", "5", "6"].sort(() => Math.random() - 0.5);
            
            for (let i = 0; i < count - 1; i++) {
              const chunk = Math.floor(Math.random() * (remaining - 10)) + 5;
              botBets[slots[i]] = chunk;
              remaining -= chunk;
            }
            botBets[slots[count - 1]] = remaining;
          } else {
            const randomSlot = String(Math.floor(Math.random() * 6) + 1);
            botBets[randomSlot] = finalBet;
          }
          boardObj.bets[p.id] = botBets;
        }
      });

      const updatedRoom = await prisma.gameRoom.update({
        where: { id: roomId },
        data: {
          status: "PLAYING", // Trạng thái phòng game hoạt động
          board: JSON.stringify(boardObj)
        }
      });

      return NextResponse.json({ room: updatedRoom });
    }

    // 7. Hành động: RỜI PHÒNG (LEAVE)
    if (action === "LEAVE") {
      // Xóa người chơi khỏi danh sách players
      const isHost = room.playerXId === userId;
      boardObj.players = boardObj.players.filter((p: any) => p.id !== userId);

      // Nếu đang trong thời gian cược, hoàn trả lại cược nếu có
      if (boardObj.status === "BETTING" && boardObj.bets[userId]) {
        const oldBets = boardObj.bets[userId] || {};
        const oldTotalBet = Object.values(oldBets).reduce((a: number, b: any) => a + (Number(b) || 0), 0) as number;
        
        if (oldTotalBet > 0) {
          await prisma.user.update({
            where: { id: userId },
            data: { eggs: { increment: oldTotalBet } }
          });
        }
        delete boardObj.bets[userId];
      }

      let updateData: any = { board: JSON.stringify(boardObj) };

      // Tìm cột cần xóa ID
      let leaveField: "playerOId" | "player3Id" | "player4Id" | null = null;
      if (room.playerOId === userId) leaveField = "playerOId";
      else if (room.player3Id === userId) leaveField = "player3Id";
      else if (room.player4Id === userId) leaveField = "player4Id";

      if (leaveField) {
        updateData[leaveField] = null;
      }

      if (isHost) {
        // Tìm người chơi kế tiếp thay thế làm host (không phải bot)
        const nextHost = boardObj.players.find((p: any) => !p.isBot);
        if (nextHost) {
          updateData.playerXId = nextHost.id;
          // Tìm xem nextHost đang ở cột nào thì xóa cột đó
          let nextHostField: "playerOId" | "player3Id" | "player4Id" | null = null;
          if (room.playerOId === nextHost.id) nextHostField = "playerOId";
          else if (room.player3Id === nextHost.id) nextHostField = "player3Id";
          else if (room.player4Id === nextHost.id) nextHostField = "player4Id";

          if (nextHostField) {
            updateData[nextHostField] = null;
          }
        } else {
          // Phòng không còn người chơi thực tế nào nữa -> Đóng phòng
          updateData.status = "FINISHED";
        }
      }

      const updatedRoom = await prisma.gameRoom.update({
        where: { id: roomId },
        data: updateData
      });

      return NextResponse.json({ success: true, room: updatedRoom });
    }

    return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 });
  } catch (error: any) {
    console.error("Lỗi API Bầu Cua:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
