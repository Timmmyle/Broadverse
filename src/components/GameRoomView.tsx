"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "./providers/AuthProvider";
import { useAlert } from "./providers/AlertProvider";
import { createClient } from "@/lib/supabase/client";
import { checkTicTacToeWin, checkCaroWin, isRenjuForbidden } from "@/lib/gameLogic";
import { getTicTacToeBotMove, getCaroBotMove } from "@/lib/botAi";
import { SHOP_ITEMS } from "@/lib/shopItems";
import BattleshipView from "./BattleshipView";
import BauCuaView from "./BauCuaView";
import { 
  ArrowLeft, Swords, Award, AlertTriangle, Clock, RefreshCw, Copy, Check, Coins
} from "lucide-react";
import confetti from "canvas-confetti";
import { QRCodeSVG } from "qrcode.react";

interface GameRoomViewProps {
  gameType: "TIC_TAC_TOE" | "CARO" | "BATTLESHIP" | "BAU_CUA";
  mode: "BOT" | "FRIEND" | "RANDOM";
  details: {
    roomId?: string;
    isCreator?: boolean;
    difficulty?: "RANDOM" | "EASY" | "HARD";
  };
  onBack: () => void;
}

export default function GameRoomView({ gameType, mode, details, onBack }: GameRoomViewProps) {
  const { profile, refreshProfile, loginWithGoogle } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const supabase = createClient();

  const playMoveSFX = () => {
    if (typeof window === "undefined") return;
    const equippedSfx = localStorage.getItem("equipped_sfx") || "sfx_classic";
    const item = SHOP_ITEMS.find(i => i.id === equippedSfx);
    const sfxType = item?.visuals?.sfxType || "default";

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (sfxType === "retro") {
        osc.type = "square";
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (sfxType === "laser") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (sfxType === "epic") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.16);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (sfxType === "synth") {
        // Sóng biển rì rào
        osc.type = "sine";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(250, ctx.currentTime + 0.5);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 1.2);
        gain.gain.setValueAtTime(0.01, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        osc.start();
        osc.stop(ctx.currentTime + 1.2);
      } else {
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }
    } catch (e) {
      console.error("Lỗi phát âm thanh:", e);
    }
  };

  if (!profile) return null;

  if (gameType === "BAU_CUA") {
    return (
      <BauCuaView
        mode={mode}
        details={details}
        profile={profile}
        onBack={onBack}
        refreshProfile={refreshProfile}
      />
    );
  }

  if (gameType === "BATTLESHIP") {
    return (
      <BattleshipView
        mode={mode}
        details={details}
        profile={profile}
        onBack={onBack}
        refreshProfile={refreshProfile}
      />
    );
  }

  const [roomId, setRoomId] = useState<string | undefined>(details.roomId);
  const [room, setRoom] = useState<any | null>(null);
  
  // Board state cho chế độ chơi Offline (Bot)
  const [localBoard, setLocalBoard] = useState<string[]>([]);
  const [localTurn, setLocalTurn] = useState<"X" | "O">("X");
  const [localStatus, setLocalStatus] = useState<"PLAYING" | "FINISHED">("PLAYING");
  const [localWinner, setLocalWinner] = useState<string | null>(null); // "PLAYER", "BOT", "DRAW"
  
  const [loading, setLoading] = useState(mode !== "BOT");
  const [errorMsg, setErrorMsg] = useState("");

  // Trạng thái Optimistic Update để triệt tiêu độ trễ mạng khi click
  const [optimisticBoard, setOptimisticBoard] = useState<string[] | null>(null);
  const [optimisticTurnId, setOptimisticTurnId] = useState<string | null>(null);

  // Mời bạn bè trực tuyến chơi cùng
  const [friends, setFriends] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);

  // Trạng thái Biểu cảm Emoji thời gian thực
  const [activeEmojiX, setActiveEmojiX] = useState<string | null>(null);
  const [activeEmojiO, setActiveEmojiO] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  // Game End overlay state
  const [gameResult, setGameResult] = useState<{
    finished: boolean;
    outcome?: "WIN" | "LOSE" | "DRAW";
    coinsGained?: number;
    expGained?: number;
    levelUp?: boolean;
  } | null>(null);
  const [showResultModal, setShowResultModal] = useState<boolean>(true);
  const [lastMoveIndex, setLastMoveIndex] = useState<number | null>(null);

  // AFK Countdown & Timeout
  const [afkTimeLeft, setAfkTimeLeft] = useState<number>(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Ref lưu trạng thái room hiện tại để tránh stale closure trong callback realtime
  const roomRef = useRef<any>(null);

  // Clipboard copy state
  const [copiedLink, setCopiedLink] = useState(false);

  // Trạng thái luật Renju & Xác nhận 2 lần (Double-Tap to Confirm)
  const [ghostCell, setGhostCell] = useState<number | null>(null);
  const [renjuError, setRenjuError] = useState<string | null>(null);
  
  // Trạng thái giải đố Onboarding Renju
  const [showOnboard, setShowOnboard] = useState<boolean>(false);
  const [onboardStep, setOnboardStep] = useState<number>(1);
  const [onboardBoard, setOnboardBoard] = useState<string[]>(Array(36).fill(""));
  const [onboardMessage, setOnboardMessage] = useState<string>("");

  // Kích hoạt hiển thị Onboard Renju nếu eloGomoku >= 1200 và chưa hoàn thành
  useEffect(() => {
    if (gameType === "CARO" && profile && profile.eloGomoku >= 1200) {
      const completed = localStorage.getItem(`renju_onboard_completed_${profile.id}`);
      if (completed !== "true") {
        setShowOnboard(true);
      }
    }
  }, [gameType, profile]);

  // Cập nhật bàn cờ giải đố mẫu cho Onboard Renju
  useEffect(() => {
    if (!showOnboard) return;
    const board = Array(36).fill("");
    if (onboardStep === 1) {
      // Bài 1: Double 3 (Đôi ba) tại index 14
      board[8] = "X";
      board[20] = "X";
      board[13] = "X";
      board[15] = "X";
      setOnboardMessage("Bài 1/3: Hãy tìm ô cờ vi phạm luật cấm ĐÔI BA (Double Three) cho quân Đen X. Gợi ý: Giao điểm tạo thành hai hàng 3 cờ thoáng.");
    } else if (onboardStep === 2) {
      // Bài 2: Double 4 (Đôi bốn) tại index 9
      board[3] = "X";
      board[15] = "X";
      board[21] = "X";
      board[7] = "X";
      board[8] = "X";
      board[11] = "X";
      setOnboardMessage("Bài 2/3: Hãy tìm ô cờ vi phạm luật cấm ĐÔI BỐN (Double Four) cho quân Đen X. Gợi ý: Đánh vào đây sẽ tạo thành hai hàng 4 quân cờ.");
    } else if (onboardStep === 3) {
      // Bài 3: Overline (>5 quân) tại index 21
      board[18] = "X";
      board[19] = "X";
      board[20] = "X";
      board[22] = "X";
      board[23] = "X";
      setOnboardMessage("Bài 3/3: Hãy tìm ô cờ vi phạm luật cấm OVERLINE (Hàng cờ quá 5 quân). Gợi ý: Đặt quân Đen vào đây tạo thành hàng 6 quân liên tục.");
    }
    setOnboardBoard(board);
  }, [onboardStep, showOnboard]);

  const handleOnboardCellClick = async (idx: number) => {
    if (onboardStep === 1) {
      if (idx === 14) {
        showAlert("Chính xác! Đặt quân vào đây tạo thành Đôi Ba (Double Three) bị cấm ở luật Renju.");
        setOnboardStep(2);
      } else {
        showAlert("Sai rồi! Hãy tìm ô giao điểm của 2 đường cờ 3 quân.");
      }
    } else if (onboardStep === 2) {
      if (idx === 9) {
        showAlert("Chính xác! Đặt quân vào đây tạo thành Đôi Bốn (Double Four) bị cấm.");
        setOnboardStep(3);
      } else {
        showAlert("Sai rồi! Hãy tìm ô giao điểm của 2 đường cờ 4 quân.");
      }
    } else if (onboardStep === 3) {
      if (idx === 21) {
        showAlert("Chính xác! Tạo thành 6 quân cờ liên tục là Overline và bị xử thua ngay lập tức.");
        
        // Gọi API nhận thưởng
        try {
          const res = await fetch("/api/user/progression", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "COMPLETE_RENJU_ONBOARD" })
          });
          const data = await res.json();
          if (res.ok) {
            showAlert(data.message);
          }
        } catch (e) {
          console.error(e);
        }
        
        localStorage.setItem(`renju_onboard_completed_${profile.id}`, "true");
        setShowOnboard(false);
      } else {
        showAlert("Sai rồi! Hãy tìm ô cờ hoàn thành hàng 6 quân cờ.");
      }
    }
  };

  const sendEmoji = (emoji: string) => {
    if (mode === "BOT") {
      setActiveEmojiX(emoji);
      setTimeout(() => setActiveEmojiX(null), 2000);

      // Bot trả lời ngẫu nhiên sau 800ms
      const botEmojis = ["🤖", "😎", "😅", "😱", "💥", "👑", "🍀", "👀"];
      const randomBotEmoji = botEmojis[Math.floor(Math.random() * botEmojis.length)];
      setTimeout(() => {
        setActiveEmojiO(randomBotEmoji);
        setTimeout(() => setActiveEmojiO(null), 2000);
      }, 800);
      return;
    }

    if (!room) return;
    const isPlayerX = profile.id === room.playerXId;
    if (isPlayerX) {
      setActiveEmojiX(emoji);
      setTimeout(() => setActiveEmojiX(null), 2000);
    } else {
      setActiveEmojiO(emoji);
      setTimeout(() => setActiveEmojiO(null), 2000);
    }

    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "emoji",
        payload: { senderId: profile.id, emoji }
      });
    }
  };

  // Board Theme
  const [boardThemeClass, setBoardThemeClass] = useState("bg-[#1e1e22]");

  const boardSize = gameType === "TIC_TAC_TOE" ? 9 : 144;
  const size1D = gameType === "TIC_TAC_TOE" ? 3 : 12;

  // 1. Tải theme bàn cờ từ LocalStorage
  useEffect(() => {
    const savedThemeId = localStorage.getItem("board_theme") || "theme_classic";
    const savedTheme = SHOP_ITEMS.find(i => i.id === savedThemeId);
    if (savedTheme?.visuals?.className) {
      setBoardThemeClass(savedTheme.visuals.className);
    }
  }, []);

  // Đồng bộ ref của room
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  // 2. Khởi tạo game cờ với Bot (Offline)
  useEffect(() => {
    if (mode === "BOT") {
      setLocalBoard(Array(boardSize).fill(""));
      setLocalTurn("X"); // Player là X đi trước
      setLocalStatus("PLAYING");
      setLocalWinner(null);
      setGameResult(null);
    }
  }, [mode, gameType]);

  // 3. Tải và lắng nghe GameRoom nếu đấu Online (Friend / Random)
  useEffect(() => {
    if (mode === "BOT" || !roomId) return;

    const fetchRoom = async () => {
      try {
        setLoading(true);
        // Lấy phòng cờ và nạp thông tin hai người chơi
        const { data, error } = await supabase
          .from("GameRoom")
          .select(`
            *,
            playerX:User!GameRoom_playerXId_fkey(*),
            playerO:User!GameRoom_playerOId_fkey(*)
          `)
          .eq("id", roomId)
          .single();

        if (error || !data) {
          setErrorMsg("Không tìm thấy phòng game này hoặc lỗi kết nối.");
        } else {
          setRoom(data);
          setOptimisticBoard(null);
          setOptimisticTurnId(null);
          
          // Nếu đã kết thúc khi vào, hiển thị kết quả
          if (data.status === "FINISHED") {
            showOnlineResult(data);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();

    // Đăng ký realtime lắng nghe thay đổi của GameRoom
    const channel = supabase
      .channel(`room_${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "GameRoom",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const updatedRoom = payload.new;
          if (updatedRoom) {
            // Nếu có đối thủ vừa mới tham gia (playerOId đổi từ null/undefined sang có ID)
            // Ta cần gọi fetchRoom để lấy đầy đủ object profile đối thủ từ DB
            const currentRoom = roomRef.current;
            const opponentJoined = updatedRoom.playerOId && (!currentRoom || !currentRoom.playerOId);
            
            if (opponentJoined) {
              fetchRoom();
              return;
            }

            setRoom((prevRoom: any) => {
              if (!prevRoom) return null;
              
              if (updatedRoom.board && updatedRoom.board !== prevRoom.board) {
                const lastMoveByOpponent = updatedRoom.turnPlayerId === profile.id;
                if (lastMoveByOpponent) {
                  playMoveSFX();
                }
              }
              
              // Ghép dữ liệu cập nhật thời gian thực vào state hiện tại
              const newRoom = {
                ...prevRoom,
                ...updatedRoom,
                playerX: prevRoom.playerX,
                playerO: prevRoom.playerO
              };
              
              if (newRoom.status === "FINISHED" && prevRoom.status !== "FINISHED") {
                setTimeout(() => showOnlineResult(newRoom), 0);
              }
              
              return newRoom;
            });

            // Đồng bộ xong -> xóa bỏ trạng thái optimistic tạm thời
            setOptimisticBoard(null);
            setOptimisticTurnId(null);
          }
        }
      )
      .on(
        "broadcast",
        { event: "game_update" },
        (payload: any) => {
          const updatedRoom = payload.payload.room;
          if (updatedRoom) {
            setRoom((prevRoom: any) => {
              if (!prevRoom) return updatedRoom;
              
              if (updatedRoom.board && updatedRoom.board !== prevRoom.board) {
                const lastMoveByOpponent = updatedRoom.turnPlayerId === profile.id;
                if (lastMoveByOpponent) {
                  playMoveSFX();
                }
              }
              
              const newRoom = {
                ...prevRoom,
                ...updatedRoom,
                playerX: prevRoom.playerX,
                playerO: prevRoom.playerO
              };
              
              if (newRoom.status === "FINISHED" && prevRoom.status !== "FINISHED") {
                setTimeout(() => showOnlineResult(newRoom), 0);
              }
              
              return newRoom;
            });
            setOptimisticBoard(null);
            setOptimisticTurnId(null);
          }
        }
      )
      .on(
        "broadcast",
        { event: "emoji" },
        (payload: any) => {
          const { senderId, emoji } = payload.payload;
          const currentRoom = roomRef.current;
          if (currentRoom) {
            const isX = senderId === currentRoom.playerXId;
            if (isX) {
              setActiveEmojiX(emoji);
              setTimeout(() => setActiveEmojiX(null), 2000);
            } else {
              setActiveEmojiO(emoji);
              setTimeout(() => setActiveEmojiO(null), 2000);
            }
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, mode]);

  const fetchFriends = async () => {
    try {
      const res = await fetch("/api/friends/list");
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleInviteToGame = async (friendId: string, friendUsername: string) => {
    if (!profile || !room) return;
    setInvitingFriendId(friendId);
    try {
      const channel = supabase.channel(`user_notifications_${friendId}`);
      await channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.send({
            type: "broadcast",
            event: "game_invite",
            payload: {
              roomId: room.id,
              senderUsername: profile.username,
              gameType: gameType,
              wager: room.wager
            }
          });
          showAlert(`Đã gửi lời mời thách đấu tới @${friendUsername}`);
          supabase.removeChannel(channel);
          setInvitingFriendId(null);
        }
      });
    } catch (err) {
      console.error(err);
      showAlert("Lỗi kết nối mời bạn");
      setInvitingFriendId(null);
    }
  };

  useEffect(() => {
    if (mode !== "FRIEND" || !room || room.status !== "WAITING" || !profile) return;

    fetchFriends();

    // Subscribe to presence
    const presenceChannel = supabase.channel("lobby_presence", {
      config: {
        presence: {
          key: profile.id,
        },
      },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const onlineIds = new Set(Object.keys(state));
        setOnlineUsers(onlineIds);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            userId: profile.id,
            username: profile.username,
            onlineAt: new Date().toISOString()
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [room, mode, profile]);

  // 4. Lắng nghe và đếm ngược AFK (Timeout 60s)
  useEffect(() => {
    if (mode === "BOT" || !room || room.status !== "PLAYING") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // Tính thời gian trôi qua từ lần cập nhật cuối
    const calculateTimeLeft = () => {
      const lastUpdate = new Date(room.updatedAt).getTime();
      const elapsedSeconds = Math.floor((Date.now() - lastUpdate) / 1000);
      const remaining = Math.max(0, 60 - elapsedSeconds);
      setAfkTimeLeft(remaining);

      // Nếu đếm ngược về 0 và mình đang đến lượt đi -> Không làm gì cả
      // Nếu đếm ngược về 0 và ĐỐI THỦ đang đến lượt đi -> Hiện nút xử thắng (Claim timeout)
    };

    calculateTimeLeft();
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(calculateTimeLeft, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [room, mode]);

  // Hiển thị kết quả game đấu Online
  const showOnlineResult = (finishedRoom: any) => {
    if (!profile) return;
    
    let outcome: "WIN" | "LOSE" | "DRAW" = "DRAW";
    if (finishedRoom.winnerId === profile.id) {
      outcome = "WIN";
      // Bắn confetti chúc mừng
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } else if (finishedRoom.winnerId) {
      outcome = "LOSE";
    }

    // Ước tính phần thưởng nhận được (sẽ được sync lại sau khi fetch profile mới)
    const level = profile.level;
    let coins = 0;
    let exp = 0;
    
    if (outcome === "WIN") {
      coins = 10 + 2 * level;
      exp = 5 + Math.round(level * 0.2);
    } else if (outcome === "LOSE") {
      coins = Math.round(5 + 1.5 * level);
      exp = 2;
    } else {
      // DRAW
      coins = Math.round(5 + 1.5 * level);
      exp = 2;
    }

    // Áp dụng nhân hệ số cho tài khoản Premium (VIP): 2x EXP & 1.5x Coins
    if (profile.isPremium) {
      coins = Math.round(coins * 1.5);
      exp = exp * 2;
    }

    // Cộng tiền cược thu hồi
    if (outcome === "WIN") {
      coins += finishedRoom.wager * 2;
    } else if (outcome === "DRAW") {
      coins += finishedRoom.wager;
    }

    // Trì hoãn 1.5s để người chơi thấy rõ nước đi cuối cùng trên bàn cờ
    setTimeout(() => {
      setGameResult({
        finished: true,
        outcome,
        coinsGained: coins,
        expGained: exp,
        levelUp: profile.exp + exp >= 100 + profile.level * 5
      });
      setShowResultModal(true);
      refreshProfile();
    }, 1500);
  };

  // 5. CLICK ĐÁNH CỜ
  const handleCellClick = async (index: number) => {
    if (!profile) return;

    // Chế độ xác nhận hai lần (Double-Tap to Confirm)
    if (gameType === "TIC_TAC_TOE" || gameType === "CARO") {
      if (ghostCell !== index) {
        setGhostCell(index);
        
        // Kiểm tra xem nước đi Gomoku có vi phạm luật cấm Renju không để cảnh báo
        if (gameType === "CARO" && mySymbol === "X" && profile.eloGomoku >= 1200) {
          const check = isRenjuForbidden(displayBoard, index, "X");
          if (check.forbidden) {
            setRenjuError(check.reason || "Nước đi cấm Renju!");
          } else {
            setRenjuError(null);
          }
        } else {
          setRenjuError(null);
        }
        return;
      }
    }

    // Đã click lần 2 -> Tiến hành đi nước cờ
    setGhostCell(null);
    setRenjuError(null);

    // A. CHẾ ĐỘ BOT (OFFLINE)
    if (mode === "BOT") {
      if (localStatus !== "PLAYING" || localTurn !== "X" || localBoard[index] !== "") return;

      // Người đánh cờ (X)
      const nextBoard = [...localBoard];
      nextBoard[index] = "X";
      setLocalBoard(nextBoard);
      setLastMoveIndex(index);
      playMoveSFX();

      // Kiểm tra luật cấm Renju trong game đấu Bot (nếu eloGomoku >= 1200)
      if (gameType === "CARO" && profile.eloGomoku >= 1200) {
        const renjuCheck = isRenjuForbidden(nextBoard, index, "X");
        if (renjuCheck.forbidden) {
          setLocalStatus("FINISHED");
          setLocalWinner("BOT");
          setTimeout(() => {
            setGameResult({
              finished: true,
              outcome: "LOSE",
              coinsGained: 0,
              expGained: 0,
              levelUp: false,
            });
            setShowResultModal(true);
            handleEndBotMatch("LOSE");
          }, 1500);
          return;
        }
      }

      // Kiểm tra thắng thua
      let won = false;
      if (gameType === "TIC_TAC_TOE") {
        won = checkTicTacToeWin(nextBoard);
      } else {
        won = checkCaroWin(nextBoard, index, "X");
      }

      const draw = !won && nextBoard.every(c => c !== "");

      if (won) {
        setLocalStatus("FINISHED");
        setLocalWinner("PLAYER");
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        setTimeout(() => {
          setGameResult({
            finished: true,
            outcome: "WIN",
            coinsGained: 0,
            expGained: 0,
            levelUp: false,
          });
          setShowResultModal(true);
          handleEndBotMatch("WIN");
        }, 1500);
        return;
      }

      if (draw) {
        setLocalStatus("FINISHED");
        setLocalWinner("DRAW");
        setTimeout(() => {
          setGameResult({
            finished: true,
            outcome: "DRAW",
            coinsGained: 0,
            expGained: 0,
            levelUp: false,
          });
          setShowResultModal(true);
          handleEndBotMatch("DRAW");
        }, 1500);
        return;
      }

      // Đổi lượt sang Bot
      setLocalTurn("O");

      // Cho Bot suy nghĩ trong 500ms
      setTimeout(() => {
        setLocalBoard(currBoard => {
          const botBoard = [...currBoard];
          let botMove = -1;

          if (gameType === "TIC_TAC_TOE") {
            botMove = getTicTacToeBotMove(botBoard, details.difficulty || "EASY", "O", "X");
          } else {
            botMove = getCaroBotMove(botBoard, "O", "X");
          }

          if (botMove !== -1) {
            botBoard[botMove] = "O";
            setLastMoveIndex(botMove);
            playMoveSFX();

            // Kiểm tra thắng của Bot
            let botWon = false;
            if (gameType === "TIC_TAC_TOE") {
              botWon = checkTicTacToeWin(botBoard);
            } else {
              botWon = checkCaroWin(botBoard, botMove, "O");
            }

            const botDraw = !botWon && botBoard.every(c => c !== "");

            if (botWon) {
              setLocalStatus("FINISHED");
              setLocalWinner("BOT");
              setTimeout(() => {
                setGameResult({
                  finished: true,
                  outcome: "LOSE",
                  coinsGained: 0,
                  expGained: 0,
                  levelUp: false,
                });
                setShowResultModal(true);
                handleEndBotMatch("LOSE");
              }, 1500);
            } else if (botDraw) {
              setLocalStatus("FINISHED");
              setLocalWinner("DRAW");
              setTimeout(() => {
                setGameResult({
                  finished: true,
                  outcome: "DRAW",
                  coinsGained: 0,
                  expGained: 0,
                  levelUp: false,
                });
                setShowResultModal(true);
                handleEndBotMatch("DRAW");
              }, 1500);
            } else {
              setLocalTurn("X");
            }
          }
          return botBoard;
        });
      }, 500);

      return;
    }

    // B. CHẾ ĐỘ ONLINE (FRIEND / RANDOM)
    if (!room || room.status !== "PLAYING" || room.turnPlayerId !== profile.id) return;
    if (optimisticBoard && optimisticBoard[index] !== "") return; // Chống click đúp khi đang truyền mạng

    // Lấy trạng thái bàn cờ hiện tại
    const currentBoard = optimisticBoard || JSON.parse(room.board);
    if (currentBoard[index] !== "") return;

    // Nạp nước đi hiển thị ngay lập tức lên màn hình (<1ms)
    const nextBoard = [...currentBoard];
    nextBoard[index] = mySymbol;
    setOptimisticBoard(nextBoard);
    setLastMoveIndex(index);
    playMoveSFX();

    // Kiểm tra kết quả trận đấu cục bộ ngay lập tức để hiển thị popup không độ trễ
    let localWon = false;
    if (gameType === "TIC_TAC_TOE") {
      localWon = checkTicTacToeWin(nextBoard);
    } else {
      localWon = checkCaroWin(nextBoard, index, mySymbol);
    }
    const localDraw = !localWon && nextBoard.every(c => c !== "");

    if (localWon || localDraw) {
      const outcome = localWon ? "WIN" : "DRAW";
      if (outcome === "WIN") {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }

      // Ước tính phần thưởng nhanh hiển thị trên client
      const level = profile.level;
      let coins = outcome === "WIN" ? (10 + 2 * level) : Math.round(5 + 1.5 * level);
      let exp = outcome === "WIN" ? (5 + Math.round(level * 0.2)) : 2;

      if (profile.isPremium) {
        coins = Math.round(coins * 1.5);
        exp = exp * 2;
      }
      if (outcome === "WIN") {
        coins += room.wager * 2;
      } else if (outcome === "DRAW") {
        coins += room.wager;
      }

      setTimeout(() => {
        setGameResult({
          finished: true,
          outcome,
          coinsGained: coins,
          expGained: exp,
          levelUp: profile.exp + exp >= 100 + profile.level * 5
        });
        setShowResultModal(true);
      }, 1500);
    }

    // Đổi lượt tạm thời trên Client để khóa người chơi, không cho click đúp liên tục
    const opponentId = isOnlineCreator ? room.playerOId : room.playerXId;
    setOptimisticTurnId(opponentId);

    try {
      const res = await fetch("/api/match/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, position: index }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          // Cập nhật trạng thái phòng cục bộ ngay lập tức
          setRoom((prevRoom: any) => {
            if (!prevRoom) return data.room;
            return {
              ...prevRoom,
              ...data.room,
              playerX: prevRoom.playerX,
              playerO: prevRoom.playerO
            };
          });
          setOptimisticBoard(null);
          setOptimisticTurnId(null);

          // Phát sóng broadcast nước đi chiến thắng/mới tới đối thủ lập tức (<100ms)
          if (channelRef.current) {
            channelRef.current.send({
              type: "broadcast",
              event: "game_update",
              payload: { room: data.room }
            });
          }

          // Nếu game kết thúc, hiển thị kết quả luôn mà không chờ CDC
          if (data.finished) {
            showOnlineResult(data.room);
          }
        }
      } else {
        const err = await res.json();
        showAlert(err.error || "Nước đi không hợp lệ!");
        // Rollback lại trạng thái cũ
        setOptimisticBoard(null);
        setOptimisticTurnId(null);
      }
    } catch (err) {
      console.error(err);
      // Rollback lại trạng thái cũ
      setOptimisticBoard(null);
      setOptimisticTurnId(null);
    }
  };

  // Đồng bộ điểm khi đấu bot kết thúc
  const handleEndBotMatch = async (outcome: "WIN" | "LOSE" | "DRAW") => {
    try {
      const res = await fetch("/api/match/bot-end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, gameType }),
      });
      if (res.ok) {
        const data = await res.json();
        setGameResult({
          finished: true,
          outcome,
          coinsGained: data.rewards.coins,
          expGained: data.rewards.exp,
          levelUp: data.profile.level > profile!.level,
        });
        refreshProfile();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Đầu hàng (Surrender) hoặc Yêu cầu xử thắng do hết giờ (Claim AFK)
  const handleForfeit = (action: "SURRENDER" | "CLAIM_TIMEOUT") => {
    if (!roomId) return;
    const isSurrender = action === "SURRENDER";
    const title = isSurrender ? "Xác Nhận Đầu Hàng" : "Yêu Cầu Xử Thắng";
    const confirmMsg = isSurrender 
      ? "Bạn có chắc chắn muốn đầu hàng cờ không?\n(Bạn sẽ thua cuộc và mất tiền cược)" 
      : "Đối thủ đã hết thời gian lượt đi cờ, bạn muốn xử thắng ngay không?";
    const confirmText = isSurrender ? "Đầu Hàng" : "Xử Thắng";

    showConfirm({
      title,
      message: confirmMsg,
      confirmText,
      cancelText: "Hủy",
      variant: "danger",
      onConfirm: async () => {
        try {
          const res = await fetch("/api/match/forfeit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId, action }),
          });

          if (!res.ok) {
            const err = await res.json();
            showAlert(err.error || "Không thể thực hiện hành động!");
          }
        } catch (err) {
          console.error(err);
          showAlert("Lỗi kết nối máy chủ!");
        }
      }
    });
  };

  // Copy mã mời / link phòng
  const handleCopyLink = () => {
    if (typeof window === "undefined" || !roomId) return;
    const inviteLink = `${window.location.origin}?joinRoom=${roomId}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Chơi lại đối với Bot
  const handleRestartBotMatch = () => {
    setLocalBoard(Array(boardSize).fill(""));
    setLocalTurn("X");
    setLocalStatus("PLAYING");
    setLocalWinner(null);
    setGameResult(null);
  };

  // Biến lấy visual cờ
  const getSymbolVisual = (symbol: string, playerProfile: any) => {
    if (symbol === "") return "";
    const symbolItem = SHOP_ITEMS.find(
      (i) => i.id === (symbol === "X" ? playerProfile?.selectedSymbolX : playerProfile?.selectedSymbolO)
    );
    if (symbol === "X") {
      return symbolItem?.visuals?.symbolX || "X";
    } else {
      return symbolItem?.visuals?.symbolO || "O";
    }
  };

  // Xác định người chơi Online
  const isOnlineCreator = room?.playerXId === profile?.id;
  const mySymbol = isOnlineCreator ? "X" : "O";
  const getOpponentUsername = () => {
    if (mode === "BOT") return `BOT [${details.difficulty}]`;
    if (room?.playerOId === "bot") {
      const names = ["KỳVươngĐắcBắc", "ThầnCờ9x", "VuaĐấuCờ", "SátThủGà", "MâyTrắng", "GàLửa99", "ĐộcCôCầuBại", "KêVươngChiến", "ThíchCáo", "ThợSănGà", "GàNhàLành", "TrứngBáchNhật", "GàChiếnThuật"];
      const charSum = room.id.split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
      return names[charSum % names.length];
    }
    return room?.playerO?.username || "Đang chờ...";
  };

  const myTurn = mode === "BOT" 
    ? (localTurn === "X") 
    : (optimisticTurnId ? (optimisticTurnId === profile?.id) : (room?.turnPlayerId === profile?.id));

  const displayBoard = mode === "BOT" 
    ? localBoard 
    : (optimisticBoard || (room ? JSON.parse(room.board) : Array(boardSize).fill("")));

  const currentTurnPlayer = mode === "BOT" 
    ? (localTurn === "X" ? "BẠN" : "BOT") 
    : ((optimisticTurnId || room?.turnPlayerId) === room?.playerXId 
        ? room?.playerX?.username 
        : (room?.playerOId === "bot" ? getOpponentUsername() : room?.playerO?.username));

  // Mảng visual đối thủ
  const opponentProfile = mode === "BOT" 
    ? { username: `BOT [${details.difficulty}]`, level: 1, avatarFrame: "frame_default" } 
    : (isOnlineCreator ? room?.playerO : room?.playerX);

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#0f0f13] select-none text-white scanlines pb-10">
      
      {/* ONBOARDING INTERACTIVE GUIDE MODAL */}
      {showOnboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="pixel-box p-6 w-full max-w-lg bg-[#1C1C18] border border-[#D4AF37]/35 text-center space-y-6">
            <div className="space-y-1">
              <span className="bg-[#FF9F0A]/10 text-[#FF9F0A] border border-[#FF9F0A]/30 text-[12px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Bài Học Chuyển Giao: Rank Bạch Kim Gomoku
              </span>
              <h2 className="text-base font-extrabold text-white">Luật Renju Quốc Tế Cho Quân Đen</h2>
              <p className="text-[12px] text-[#F3E5AB]/75 leading-relaxed max-w-sm mx-auto">
                Để cân bằng tỷ lệ thắng của bên đi trước (Đen), luật Renju cấm quân Đen tạo nước cờ lỗi đôi <strong>Double 3 (Đôi ba)</strong>, <strong>Double 4 (Đôi bốn)</strong>, và <strong>Overline (&gt;5 quân)</strong>. Hãy hoàn thành 3 bài đố vui để mở khóa sảnh chơi và nhận thưởng <strong>100 Coins</strong>!
              </p>
            </div>

            <div className="pixel-box-nested p-4 bg-black/50 border border-[#D4AF37]/10 rounded-xl space-y-3">
              <p className="text-[10.5px] text-[#FF9F0A] font-bold font-mono">{onboardMessage}</p>
              
              {/* 6x6 puzzle board */}
              <div className="grid grid-cols-6 gap-1 w-44 h-44 mx-auto border border-[#D4AF37]/25 p-1.5 bg-[#141412] rounded-lg">
                {onboardBoard.map((val, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOnboardCellClick(idx)}
                    className="w-full aspect-square flex items-center justify-center font-bold text-xs bg-[#1C1C18] hover:bg-[#D4AF37]/25 border border-[#D4AF37]/10 transition-colors cursor-pointer"
                  >
                    {val === "X" ? (
                      <span className="text-red-500 font-extrabold">X</span>
                    ) : val === "O" ? (
                      <span className="text-blue-500 font-extrabold">O</span>
                    ) : (
                      ""
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  localStorage.setItem(`renju_onboard_completed_${profile.id}`, "true");
                  setShowOnboard(false);
                }}
                className="bg-[#1C1C18] hover:bg-[#272722] text-[#F3E5AB]/60 border border-[#D4AF37]/15 py-2 px-6 rounded-lg text-[12px] font-bold uppercase transition"
              >
                Bỏ qua (Không nhận Coin)
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Top Navigation */}
      <header className="w-full bg-[#16161c]/90 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <button onClick={onBack} className="pixel-btn pixel-btn-red py-2 px-3 text-[12px] flex items-center gap-2">
          <ArrowLeft className="w-3 h-3" />
          Rời Phòng
        </button>
        
        <div className="text-center font-bold">
          <span className="block text-[12px] text-pixel-blue uppercase tracking-widest">
            {gameType === "TIC_TAC_TOE" ? "Tic-Tac-Toe 3x3" : "Caro 12x12"}
          </span>
          <span className="text-[12px] text-pixel-yellow uppercase mt-1">
            {mode === "BOT" ? "Luyện tập Bot" : `Đấu cược (${room?.wager || 0} Coin)`}
          </span>
        </div>

        <div className="w-20"></div> {/* Spacer */}
      </header>

      {/* MOCK AD TOP BANNER IN GAMEROOM */}
      {profile && !profile.isPremium && (
        <div className="w-full bg-gradient-to-r from-red-950/20 via-black/85 to-red-950/20 border-b border-red-500/10 text-center py-1.5 px-4 relative overflow-hidden group">
          <span className="absolute top-0.5 left-2 text-[4.5px] text-gray-600 uppercase font-mono">Sponsored Ad</span>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className="text-[7.5px] text-gray-400 font-medium">Bị làm phiền bởi quảng cáo? Nâng cấp Premium ngay để ẩn quảng cáo và nhận các đặc quyền đi kèm!</span>
            <span className="text-[7.5px] text-pixel-yellow font-bold border border-pixel-yellow/30 px-1.5 py-0.5 rounded bg-pixel-yellow/5 select-none">
              Giảm giá 20% cửa hàng 👑
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex-grow flex flex-col items-center justify-center space-y-4">
          <RefreshCw className="w-8 h-8 text-pixel-yellow animate-spin" />
          <p className="text-[12px] text-pixel-yellow font-medium">Đang nạp bàn cờ...</p>
        </div>
      ) : errorMsg ? (
        <div className="flex-grow flex flex-col items-center justify-center p-6 space-y-4">
          <AlertTriangle className="w-10 h-10 text-pixel-red" />
          <p className="text-center text-xs text-pixel-red font-mono bg-pixel-red/10 border-2 border-pixel-red p-4 max-w-md">[ERROR]: {errorMsg}</p>
          <button onClick={onBack} className="pixel-btn pixel-btn-yellow py-2 px-6 text-[12px] font-bold">Quay lại sảnh</button>
        </div>
      ) : room?.status === "WAITING" ? (
        /* CHỜ BẠN BÈ JOIN PHÒNG (FRIEND MODE WAITING) */
        <div className="flex-grow max-w-md w-full mx-auto px-4 mt-8 flex flex-col items-center justify-center space-y-6">
          <div className="pixel-box bg-[#16161c] p-6 w-full text-center space-y-6">
            <h2 className="text-xs text-pixel-yellow uppercase tracking-wider border-b border-black pb-3">Phòng Đấu Bạn Bè</h2>
            
            <p className="text-[12px] text-gray-400 leading-relaxed uppercase">
              Hãy gửi link mời bên dưới cho bạn bè để cùng tham gia đấu cờ cược {room.wager} Coin.
            </p>

            <div className="pixel-box-nested p-4 flex flex-col items-center justify-center bg-black">
              {/* QR Code */}
              <div className="bg-white p-2 border-4 border-black mb-4">
                <QRCodeSVG value={typeof window !== "undefined" ? `${window.location.origin}?joinRoom=${room.id}` : room.id} size={128} />
              </div>
              <span className="text-[12px] text-gray-500 font-mono select-all">ID: {room.id}</span>
            </div>

            <div className="space-y-2">
              <button 
                onClick={handleCopyLink} 
                className="w-full pixel-btn pixel-btn-blue py-3 text-[12px] uppercase font-bold flex items-center justify-center gap-2"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedLink ? "Đã copy link mời!" : "Copy Link Mời Trực Tiếp"}
              </button>
            </div>

            {/* Danh sách bạn bè trực tuyến để mời trực tiếp */}
            <div className="border-t border-black/20 pt-4 space-y-3 text-left">
              <span className="block text-[12px] text-gray-500 uppercase tracking-wider font-semibold">Mời bạn bè trực tuyến:</span>
              <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                {friends.length === 0 ? (
                  <div className="text-[12px] text-gray-500 text-center py-2">Chưa có bạn bè</div>
                ) : friends.filter(f => onlineUsers.has(f.id)).length === 0 ? (
                  <div className="text-[12px] text-gray-500 text-center py-2">Không có bạn bè trực tuyến</div>
                ) : (
                  friends.filter(f => onlineUsers.has(f.id)).map((f) => (
                    <div key={f.id} className="flex justify-between items-center bg-black/20 p-2 rounded border border-[#D4AF37]/10 text-xs">
                      <span className="font-bold text-white truncate">@{f.username}</span>
                      <button
                        onClick={() => handleInviteToGame(f.id, f.username)}
                        disabled={invitingFriendId === f.id}
                        className="bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] px-3 py-1 rounded text-[12px] font-bold transition"
                      >
                        {invitingFriendId === f.id ? "Đang mời..." : "Mời đấu"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="text-[12px] text-pixel-blue animate-pulse uppercase tracking-wider">
              === Đang chờ bạn bè kết nối ===
            </div>
          </div>
        </div>
      ) : (
        /* GAME BOARD SCREEN (PLAYING & FINISHED) */
        <div className="flex-grow max-w-4xl w-full mx-auto px-4 mt-6 flex flex-col items-center space-y-6">
          
          {/* Active players dashboard */}
          <div className="w-full hidden md:grid grid-cols-2 gap-4 max-w-lg">
            
            {/* Player X / Left Side */}
            <div className={`pixel-box p-3 bg-[#16161c] relative flex items-center gap-3 transition-all duration-300 ${
              mode === "BOT" 
                ? (localTurn === "X" ? "border-pixel-yellow shadow-lg shadow-pixel-yellow/10 -translate-y-0.5" : "border-white/10")
                : (room.turnPlayerId === room.playerXId ? "border-pixel-yellow shadow-lg shadow-pixel-yellow/10 -translate-y-0.5" : "border-white/10")
            }`}>
              {activeEmojiX && (
                <div className="absolute -top-10 left-4 bg-[#1e1e24] border-2 border-black text-lg p-1.5 rounded-md animate-bounce shadow-lg z-50 font-mono">
                  {activeEmojiX}
                  <div className="absolute -bottom-1.5 left-3 w-2 h-2 bg-[#1e1e24] border-r-2 border-b-2 border-black transform rotate-45"></div>
                </div>
              )}
              <div className={`w-10 h-10 bg-pixel-gray-light border border-white/10 rounded-xl flex items-center justify-center shrink-0 ${
                SHOP_ITEMS.find(i => i.id === (mode === "BOT" ? profile.avatarFrame : room.playerX.avatarFrame))?.visuals?.className || ""
              }`}>
                <span className="text-sm font-bold text-pixel-yellow font-press-start">
                  {getSymbolVisual("X", room?.playerX || profile)}
                </span>
              </div>
              <div className="overflow-hidden">
                <span className="block text-[12px] font-bold text-pixel-yellow truncate uppercase tracking-wider">
                  {mode === "BOT" ? profile.username : room.playerX.username}
                </span>
                <span className="text-[12px] text-gray-400 font-mono">Lv.{mode === "BOT" ? profile.level : room.playerX.level}</span>
              </div>
              {((mode === "BOT" && localTurn === "X") || (mode !== "BOT" && room.turnPlayerId === room.playerXId)) && (
                <span className="absolute -top-2 left-2 bg-pixel-yellow text-black text-[12px] border border-white/10 rounded-full font-bold uppercase px-2 py-0.5 animate-pulse">
                  Lượt đi
                </span>
              )}
            </div>

            {/* Player O / Right Side */}
            <div className={`pixel-box p-3 bg-[#16161c] relative flex items-center gap-3 transition-all duration-300 ${
              mode === "BOT" 
                ? (localTurn === "O" ? "border-pixel-blue shadow-lg shadow-pixel-blue/10 -translate-y-0.5" : "border-white/10")
                : (room.turnPlayerId === room.playerOId ? "border-pixel-blue shadow-lg shadow-pixel-blue/10 -translate-y-0.5" : "border-white/10")
            }`}>
              {activeEmojiO && (
                <div className="absolute -top-10 right-4 bg-[#1e1e24] border-2 border-black text-lg p-1.5 rounded-md animate-bounce shadow-lg z-50 font-mono">
                  {activeEmojiO}
                  <div className="absolute -bottom-1.5 right-3 w-2 h-2 bg-[#1e1e24] border-r-2 border-b-2 border-black transform rotate-45"></div>
                </div>
              )}
              <div className={`w-10 h-10 bg-pixel-gray-light border border-white/10 rounded-xl flex items-center justify-center shrink-0 ${
                SHOP_ITEMS.find(i => i.id === (mode === "BOT" ? opponentProfile?.avatarFrame : room?.playerO?.avatarFrame))?.visuals?.className || ""
              }`}>
                <span className="text-sm font-bold text-pixel-blue font-press-start">
                  {mode === "BOT" ? "O" : getSymbolVisual("O", room?.playerO || {})}
                </span>
              </div>
              <div className="overflow-hidden">
                <span className="block text-[12px] font-bold text-pixel-blue truncate uppercase tracking-wider">
                  {getOpponentUsername()}
                </span>
                <span className="text-[12px] text-gray-400 font-mono">Lv.{mode === "BOT" ? opponentProfile?.level : (room?.playerOId === "bot" ? profile?.level : room?.playerO?.level || 1)}</span>
              </div>
              {((mode === "BOT" && localTurn === "O") || (mode !== "BOT" && room.turnPlayerId === room.playerOId)) && (
                <span className="absolute -top-2 left-2 bg-pixel-blue text-white text-[12px] border border-white/10 rounded-full font-bold uppercase px-2 py-0.5 animate-pulse">
                  Lượt đi
                </span>
              )}
            </div>
          </div>

          {/* TURN INDICATOR TEXT */}
          <div className="h-6 flex items-center justify-center">
            {room?.status === "PLAYING" || localStatus === "PLAYING" ? (
              <span className="text-[12px] text-pixel-yellow font-bold uppercase tracking-wider animate-pulse flex items-center gap-2">
                <Clock className="w-3 h-3 text-pixel-yellow" />
                Lượt của: {currentTurnPlayer} {mode !== "BOT" && `(${afkTimeLeft}s)`}
              </span>
            ) : null}
          </div>

          {/* EMOJI QUICK CHAT BAR */}
          {mode !== "BOT" && room && room.status === "PLAYING" && (
            <div className="flex gap-2 bg-black bg-opacity-25 border border-white/5 p-1 px-3 rounded-full items-center select-none">
              <span className="text-[12px] text-gray-500 font-mono uppercase mr-1">Biểu cảm:</span>
              {SHOP_ITEMS.filter(item => item.type === "EMOJI" && (profile.purchasedItems.includes(item.id) || item.price === 0)).map(emojiItem => (
                <button
                  key={emojiItem.id}
                  onClick={() => sendEmoji(emojiItem.visuals.emoji!)}
                  className="text-sm hover:scale-125 transition-transform p-1 cursor-pointer"
                  title={emojiItem.name}
                >
                  {emojiItem.visuals.emoji}
                </button>
              ))}
              {SHOP_ITEMS.filter(item => item.type === "EMOJI" && (profile.purchasedItems.includes(item.id) || item.price === 0)).length === 0 && (
                <span className="text-[12px] text-gray-400 italic">Chưa sở hữu biểu cảm nào</span>
              )}
            </div>
          )}

          {/* GAME BOARD (TIC-TAC-TOE & CARO) */}
          <div className="relative w-full max-w-[320px] sm:max-w-[384px] aspect-square mx-auto">
            {/* Board Background container based on theme */}
            <div 
              className={`p-3 ${boardThemeClass} border border-white/10 rounded-2xl shadow-2xl grid gap-1.5 aspect-square w-full h-full relative z-10`}
              style={{
                gridTemplateColumns: `repeat(${size1D}, minmax(0, 1fr))`,
              }}
            >
              {displayBoard.map((cell: string, idx: number) => {
                const isX = cell === "X";
                const isO = cell === "O";
                const isGhost = (ghostCell === idx);
                const isLastMove = idx === lastMoveIndex;
                
                // Trả về visual quân cờ đúng (bao gồm ghost piece nếu là click nháp)
                const visual = isX 
                  ? getSymbolVisual("X", room?.playerX || profile) 
                  : (isO ? getSymbolVisual("O", room?.playerO || opponentProfile) : (isGhost ? getSymbolVisual(mySymbol, profile) : ""));

                // Kiểm tra xem ghost cell có phải ô cấm Renju không
                const isForbiddenCell = isGhost && renjuError !== null;

                return (
                  <button
                    key={idx}
                    onClick={() => handleCellClick(idx)}
                    disabled={(mode === "BOT" ? localStatus !== "PLAYING" : room.status !== "PLAYING") || (cell !== "" && !isGhost) || !myTurn}
                    className={`pixel-box-nested aspect-square flex items-center justify-center font-bold transition-all duration-75 cursor-pointer select-none relative ${
                      cell === "" 
                        ? (myTurn ? (isGhost ? (isForbiddenCell ? "bg-red-950/20 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)] animate-pulse" : "bg-yellow-500/10 border-yellow-400/50 animate-pulse") : "hover:bg-white/10") : "cursor-not-allowed") 
                        : ""
                    } ${
                      gameType === "TIC_TAC_TOE" ? "text-2xl sm:text-3xl" : "text-[12px] sm:text-xs"
                    }`}
                    style={{
                      backgroundColor: cell === "" ? (isGhost ? (isForbiddenCell ? "rgba(220,38,38,0.1)" : "rgba(212,175,55,0.15)") : "rgba(0,0,0,0.4)") : "rgba(0,0,0,0.25)",
                      boxShadow: isLastMove ? "0 0 12px rgba(250, 204, 21, 0.8), inset 0 0 8px rgba(250, 204, 21, 0.6)" : "inset 1px 1px 0px 0px rgba(255,255,255,0.05)",
                      border: isForbiddenCell ? "1.5px solid #ef4444" : (isLastMove ? "2px solid #facc15" : (isGhost ? "1.5px solid #D4AF37" : "1px solid rgba(255,255,255,0.08)"))
                    }}
                  >
                    {isLastMove && cell !== "" && (
                      <span className="absolute -top-1 -right-1 z-20 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500 border border-black"></span>
                      </span>
                    )}
                    {isX ? (
                      <span className={`w-11/12 h-11/12 rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white flex items-center justify-center shadow-lg transform scale-95 border ${isLastMove ? "border-yellow-300 ring-2 ring-yellow-400/80 animate-pulse" : "border-red-400"}`}>
                        {visual}
                      </span>
                    ) : isO ? (
                      <span className={`w-11/12 h-11/12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center shadow-lg transform scale-95 border ${isLastMove ? "border-yellow-300 ring-2 ring-yellow-400/80 animate-pulse" : "border-blue-400"}`}>
                        {visual}
                      </span>
                    ) : isGhost ? (
                      <span className={`w-11/12 h-11/12 rounded-full border border-dashed flex items-center justify-center opacity-50 transform scale-95 ${
                        isForbiddenCell ? "border-red-500 text-red-500 bg-red-950/20" : (mySymbol === "X" ? "border-red-500 bg-red-500/10 text-red-400" : "border-blue-500 bg-blue-500/10 text-blue-400")
                      }`}>
                        {isForbiddenCell ? "⚠️" : visual}
                      </span>
                    ) : (
                      ""
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CẢNH BÁO LUẬT RENJU TRÊN MÀN HÌNH */}
          {renjuError && (
            <div className="w-full max-w-[320px] sm:max-w-[384px] mx-auto text-red-400 text-xs font-bold text-center mt-4 px-4 bg-red-950/20 py-2.5 rounded-xl border border-red-500/30 animate-pulse relative z-20">
              ⚠️ CẢNH BÁO PHẠM QUY RENJU:<br />
              <span className="text-white mt-1 block font-extrabold">{renjuError}</span>
              <span className="text-[12px] text-gray-400 mt-1 block font-medium">Bấm lần nữa để xác nhận đặt cờ và BỊ XỬ THUA!</span>
            </div>
          )}

          {/* NÚT XEM KẾT QUẢ KHI ẨN MODAL KẾT QUẢ */}
          {gameResult?.finished && !showResultModal && (
            <div className="mt-4 flex justify-center z-20">
              <button
                onClick={() => setShowResultModal(true)}
                className="pixel-btn pixel-btn-yellow py-2.5 px-6 text-xs uppercase font-extrabold flex items-center gap-2 shadow-xl animate-bounce"
              >
                🏆 Xem Kết Quả Trận Đấu
              </button>
            </div>
          )}

          {/* ONLINE BOTTOM ACTIONS (SURRENDER & TIMEOUT CLAIM) */}
          {mode !== "BOT" && room.status === "PLAYING" && (
            <div className="w-full max-w-xs flex gap-3">
              <button 
                onClick={() => handleForfeit("SURRENDER")} 
                className="flex-grow pixel-btn pixel-btn-red py-2 px-3 text-[12px] uppercase font-bold"
              >
                Đầu hàng cờ
              </button>

              {/* Hiện nút xử thắng nếu đối thủ AFK quá 55 giây và đó là lượt của đối thủ */}
              {room.turnPlayerId !== profile.id && afkTimeLeft === 0 && (
                <button
                  onClick={() => handleForfeit("CLAIM_TIMEOUT")}
                  className="flex-grow pixel-btn pixel-btn-yellow py-2 px-3 text-[12px] uppercase font-bold animate-[pulse_1s_infinite]"
                >
                  Xử thắng đối thủ
                </button>
              )}
            </div>
          )}

          {/* PRACTICE BOT RESTART BUTTON */}
          {mode === "BOT" && localStatus === "FINISHED" && (
            <button 
              onClick={handleRestartBotMatch} 
              className="pixel-btn pixel-btn-yellow py-3 px-8 text-xs uppercase font-bold flex items-center gap-2 mb-4"
            >
              <RefreshCw className="w-4 h-4" /> Chơi Lại Với Bot
            </button>
          )}

          {/* ADS BANNER PLACEHOLDER (Only show if NOT premium) */}
          {!profile.isPremium && (
            <div className="w-full max-w-xs bg-[#111116] border border-red-500/10 rounded-2xl p-3 mt-4 text-center relative overflow-hidden group">
              <span className="absolute top-0.5 left-2 text-[5px] text-gray-500 uppercase tracking-widest">Sponsored Ad</span>
              <div className="flex items-center gap-3 pt-2">
                {/* SVG avatar frame mockup */}
                <div className="w-12 h-12 bg-black/40 border-2 border-red-500/30 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-red-600/20 to-orange-600/20 animate-pulse"></div>
                  <Award className="w-5 h-5 text-red-500" />
                </div>
                <div className="text-left flex-grow">
                  <span className="block text-[12px] text-pixel-yellow uppercase font-bold tracking-wide">KHUNG RỒNG LỬA CHỈ 50 COIN</span>
                  <p className="text-[12px] text-gray-400 leading-tight mt-0.5">Vào Cửa Hàng mua ngay khung avatar rực cháy huyền thoại!</p>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* GAME END OVERLAY PANEL */}
      {gameResult?.finished && showResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 animate-fade-in">
          <div className="pixel-box bg-[#16161c] max-w-sm w-full p-6 text-center space-y-6 relative border-4 border-black">
            
            {/* Title Result */}
            <div>
              {gameResult.outcome === "WIN" ? (
                <h1 className="text-2xl font-bold text-pixel-yellow uppercase tracking-widest pixel-text-shadow animate-bounce">
                  🏆 Chiến Thắng! 🏆
                </h1>
              ) : gameResult.outcome === "LOSE" ? (
                <h1 className="text-2xl font-bold text-pixel-red uppercase tracking-widest pixel-text-shadow">
                  💀 Thất Bại! 💀
                </h1>
              ) : (
                <h1 className="text-2xl font-bold text-gray-400 uppercase tracking-widest pixel-text-shadow">
                  🤝 Trận Hòa! 🤝
                </h1>
              )}
              
              <p className="text-[12px] text-gray-500 mt-2 uppercase font-mono tracking-widest">
                Trận đấu đã khép lại
              </p>
            </div>

            {/* Rewards Card */}
            <div className="pixel-box-nested p-4 bg-black/60 space-y-3">
              <span className="block text-[12px] text-pixel-blue uppercase tracking-widest border-b border-black pb-1 mb-2">
                Phần thưởng nhận được
              </span>
              
              <div className="flex items-center justify-around">
                <div className="flex flex-col items-center">
                  <span className="text-[12px] text-gray-400 uppercase">Coin thưởng</span>
                  <span className="text-sm font-bold text-pixel-yellow mt-1 flex items-center gap-1">
                    +{gameResult.coinsGained} <Coins className="w-3.5 h-3.5 fill-pixel-yellow text-pixel-yellow" />
                  </span>
                </div>
                <div className="h-6 w-[2px] bg-black"></div>
                <div className="flex flex-col items-center">
                  <span className="text-[12px] text-gray-400 uppercase">Kinh nghiệm</span>
                  <span className="text-sm font-bold text-pixel-blue mt-1 flex items-center gap-1">
                    +{gameResult.expGained} <Award className="w-3.5 h-3.5 text-pixel-blue" />
                  </span>
                </div>
              </div>

              {gameResult.levelUp && (
                <div className="bg-pixel-yellow/20 border border-pixel-yellow p-2 mt-3 animate-pulse">
                  <span className="text-[12px] text-pixel-yellow uppercase font-bold tracking-widest">
                    ⭐ Đã Tăng Cấp Level! ⭐
                  </span>
                </div>
              )}
            </div>

            {/* Guest Promo / Reward Box */}
            {profile?.isGuest && (
              <div className="pixel-box-nested p-4 bg-gradient-to-br from-[#D4AF37]/10 to-[#FF9F0A]/5 border border-[#D4AF37]/30 text-center space-y-3 mt-2">
                <span className="block text-[12px] text-[#FF9F0A] uppercase tracking-widest font-extrabold animate-pulse">
                  🎁 QUÀ LIÊN KẾT GMAIL TÂN THỦ 🎁
                </span>
                <p className="text-[9.5px] text-[#F3E5AB]/90 leading-relaxed">
                  Đăng nhập tài khoản Gmail của bạn để nhận ngay **+200 Coin** và **Skin Gà Samurai** cực VIP, đồng thời bảo vệ vĩnh viễn tiến trình chơi game!
                </p>
                <button
                  onClick={loginWithGoogle}
                  className="w-full bg-red-600 hover:bg-red-700 text-white text-[9.5px] uppercase font-extrabold py-2 px-4 rounded border-2 border-black flex items-center justify-center gap-1.5 transition duration-150 active:translate-y-[1px]"
                >
                  <span>🐔</span> ĐĂNG NHẬP VỚI GMAIL
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={() => setShowResultModal(false)}
                className="w-full bg-white/10 hover:bg-white/20 text-white py-2.5 text-[12px] uppercase font-bold rounded border border-white/20 flex items-center justify-center gap-2"
              >
                🔍 Xem Lại Bàn Cờ
              </button>
              {mode === "BOT" && (
                <button
                  onClick={handleRestartBotMatch}
                  className="w-full pixel-btn pixel-btn-blue py-3 text-[12px] uppercase font-bold"
                >
                  Đấu lại Bot
                </button>
              )}
              <button
                onClick={onBack}
                className="w-full pixel-btn pixel-btn-yellow py-3 text-[12px] uppercase font-bold"
              >
                Quay lại sảnh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
