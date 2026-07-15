"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  ArrowLeft, Users, Trophy, Coins, RotateCcw, Swords, Plus, LogOut, Check, HelpCircle, Copy, Clock
} from "lucide-react";
import confetti from "canvas-confetti";

// Các linh vật Bầu Cua và Emoji tương ứng
const ANIMALS = [
  { id: "bau", name: "Bầu", icon: "🪵", color: "bg-amber-950/40 border-amber-800 text-amber-300" },
  { id: "cua", name: "Cua", icon: "🦀", color: "bg-red-950/40 border-red-800 text-red-400" },
  { id: "tom", name: "Tôm", icon: "🦐", color: "bg-orange-950/40 border-orange-800 text-orange-400" },
  { id: "ca", name: "Cá", icon: "🐟", color: "bg-blue-950/40 border-blue-800 text-blue-400" },
  { id: "ga", name: "Gà", icon: " Rooster", color: "bg-yellow-950/40 border-yellow-800 text-yellow-300" },
  { id: "nai", name: "Nại", icon: "🦌", color: "bg-emerald-950/40 border-emerald-800 text-emerald-300" }
];

// Định nghĩa con vật cụ thể cho Gà
ANIMALS[4].icon = "🐓"; // Gà Rooster 🐓

interface BauCuaViewProps {
  mode: "BOT" | "FRIEND" | "RANDOM";
  details: {
    roomId?: string;
  };
  profile: any;
  onBack: () => void;
  refreshProfile: () => Promise<any>;
}

export default function BauCuaView({ mode, details, profile, onBack, refreshProfile }: BauCuaViewProps) {
  const supabase = createClient();
  const roomId = details.roomId;

  const [room, setRoom] = useState<any | null>(null);
  const [board, setBoard] = useState<any | null>(null); // Parse từ room.board
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeChip, setActiveChip] = useState<number>(5); // Chip cược được chọn (5, 10, 20, 50, 100)

  // Cược cục bộ tạm thời (trước khi lưu cược)
  const [localBets, setLocalBets] = useState<Record<string, number>>({
    bau: 0, cua: 0, tom: 0, ca: 0, ga: 0, nai: 0
  });

  // Countdown timer hiển thị ở client
  const [timeLeft, setTimeLeft] = useState<number>(20);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Hiệu ứng xúc xắc xoay
  const [rolling, setRolling] = useState(false);
  const [rollingDice, setRollingDice] = useState<number[]>([0, 1, 2]); // Bầu, Cua, Tôm làm mặc định

  // Mở bát
  const [dishOpen, setDishOpen] = useState(true);

  // Copy mã phòng
  const [copied, setCopied] = useState(false);

  // 1. Tải thông tin phòng ban đầu
  useEffect(() => {
    if (!roomId) return;

    const fetchRoom = async () => {
      try {
        const res = await fetch(`/api/matchmaking/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameType: "BAU_CUA", wager: 0 }) // load lại phòng hiện tại
        });
        if (res.ok) {
          const data = await res.json();
          if (data.room) {
            setRoom(data.room);
            const parsedBoard = JSON.parse(data.room.board);
            setBoard(parsedBoard);

            // Đồng bộ cược cục bộ nếu có sẵn
            if (parsedBoard.bets[profile.id]) {
              setLocalBets({
                bau: parsedBoard.bets[profile.id].bau || 0,
                cua: parsedBoard.bets[profile.id].cua || 0,
                tom: parsedBoard.bets[profile.id].tom || 0,
                ca: parsedBoard.bets[profile.id].ca || 0,
                ga: parsedBoard.bets[profile.id].ga || 0,
                nai: parsedBoard.bets[profile.id].nai || 0,
              });
            }
          }
        }
      } catch (err) {
        console.error("Lỗi fetch phòng Bầu Cua:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();
  }, [roomId, profile.id]);

  // 2. Đăng ký Supabase Realtime lắng nghe thay đổi của phòng
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room_${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "GameRoom", filter: `id=eq.${roomId}` },
        async (payload: any) => {
          const updatedRoom = payload.new;
          const parsedBoard = JSON.parse(updatedRoom.board);
          
          const prevStatus = board?.status;
          const newStatus = parsedBoard.status;

          // Nếu trạng thái đổi sang FINISHED (Xúc xắc đã lắc xong)
          if (newStatus === "FINISHED" && prevStatus !== "FINISHED") {
            if (timerRef.current) clearInterval(timerRef.current);
            triggerRollAnimation(parsedBoard.dice, () => {
              setRoom(updatedRoom);
              setBoard(parsedBoard);
              refreshProfile();
            });
          } else {
            // Cập nhật thông thường
            setRoom(updatedRoom);
            setBoard(parsedBoard);
            
            if (newStatus === "BETTING" && prevStatus !== "BETTING") {
              setLocalBets({ bau: 0, cua: 0, tom: 0, ca: 0, ga: 0, nai: 0 });
              setDishOpen(false);
              setRolling(false);
            }
          }

          refreshProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roomId, board]);

  // 2.5 Polling dự phòng (mỗi 3.5 giây) đề phòng kết nối WebSocket Realtime bị chặn hoặc đóng
  useEffect(() => {
    if (!roomId) return;

    const interval = setInterval(async () => {
      // Chỉ poll khi không ở trạng thái FINISHED
      if (board?.status === "FINISHED") return;

      try {
        const res = await fetch(`/api/matchmaking/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameType: "BAU_CUA", wager: 0 })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.room) {
            const parsedBoard = JSON.parse(data.room.board);
            
            // So sánh xem có thay đổi quan trọng để cập nhật không
            const hasStatusChanged = data.room.status !== room.status || parsedBoard.status !== board.status;
            const hasBetsChanged = JSON.stringify(parsedBoard.bets) !== JSON.stringify(board.bets);
            const hasPlayersChanged = parsedBoard.players?.length !== board.players?.length || 
              parsedBoard.players?.some((p: any, idx: number) => p.ready !== board.players?.[idx]?.ready);

            if (hasStatusChanged || hasBetsChanged || hasPlayersChanged) {
              setRoom(data.room);
              setBoard(parsedBoard);
              refreshProfile();
            }
          }
        }
      } catch (err) {
        console.error("Lỗi polling dự phòng Bầu Cua:", err);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [roomId, room, board]);

  // 3. Đếm ngược đặt cược ở client dựa trên bettingEndsAt
  useEffect(() => {
    if (board?.status !== "BETTING" || !board?.bettingEndsAt) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const calculateTimeLeft = () => {
      const endsAt = Number(board.bettingEndsAt);
      if (!endsAt) return 20;
      const diff = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      return diff;
    };

    setTimeLeft(calculateTimeLeft());

    timerRef.current = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [board?.status, board?.bettingEndsAt]);

  // Tự động lắc nếu hết giờ (chủ phòng)
  useEffect(() => {
    if (timeLeft === 0 && board?.status === "BETTING" && room?.playerXId === profile.id) {
      handleRollDice();
    }
  }, [timeLeft, board?.status, room?.playerXId, profile.id]);

  // 4. Hiệu ứng xúc xắc quay linh vật
  const triggerRollAnimation = (finalDice: number[], onDone?: () => void) => {
    setRolling(true);
    setDishOpen(false);

    let rolls = 0;
    const interval = setInterval(() => {
      setRollingDice([
        Math.floor(Math.random() * 6),
        Math.floor(Math.random() * 6),
        Math.floor(Math.random() * 6)
      ]);
      rolls++;

      if (rolls > 15) {
        clearInterval(interval);
        setRollingDice(finalDice);
        setRolling(false);
        // Mở bát sau khi xúc xắc dừng lại
        setTimeout(() => {
          setDishOpen(true);
          
          if (onDone) {
            onDone();
          } else {
            refreshProfile();
          }

          // Bắn pháo hoa nếu thắng ròng
          const myResult = board?.results?.find((r: any) => r.id === profile.id);
          if (myResult && myResult.profit > 0) {
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
          }
        }, 800);
      }
    }, 100);
  };

  // 5. Thao tác: Đặt cược cục bộ
  const handleBetLocal = (animalId: string) => {
    if (board?.status !== "BETTING") return;

    const currentTotal = Object.values(localBets).reduce((a, b) => a + b, 0);
    const limit = board.betLimit > 0 ? board.betLimit : Infinity;

    if (currentTotal + activeChip > limit) {
      alert(`Bạn đã đạt giới hạn cược tối đa của phòng này (${limit} Coin)!`);
      return;
    }

    // Kiểm tra số dư ví (Coins) xem còn đủ để tăng cược không
    const myPlacedBet = board.bets[profile.id] ? Object.values(board.bets[profile.id]).reduce((a: number, b: any) => a + Number(b), 0) as number : 0;
    const pendingIncrease = (currentTotal + activeChip) - myPlacedBet;

    if (profile.eggs < pendingIncrease) {
      alert("Số dư Coin của bạn không đủ để đặt thêm cược này!");
      return;
    }

    setLocalBets((prev) => ({
      ...prev,
      [animalId]: prev[animalId] + activeChip
    }));
  };

  // Xóa sạch cược cục bộ
  const handleClearBets = () => {
    if (board?.status !== "BETTING") return;
    setLocalBets({ bau: 0, cua: 0, tom: 0, ca: 0, ga: 0, nai: 0 });
  };

  const updateRoomState = (newRoom: any) => {
    setRoom(newRoom);
    if (newRoom.board) {
      const parsedBoard = JSON.parse(newRoom.board);
      setBoard(parsedBoard);
    }
  };

  // Gửi cược lên Server
  const handleConfirmBets = async () => {
    if (board?.status !== "BETTING" || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/match/baucua", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PLACE_BET",
          roomId,
          data: { bets: localBets }
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          updateRoomState(data.room);
        }
        refreshProfile();
      } else {
        const err = await res.json();
        alert(err.error || "Gửi cược thất bại!");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  // 6. Thao tác Host: Sẵn sàng, Thêm Bot, Bắt đầu, Lắc xúc xắc, Rời phòng
  const handleToggleReady = async () => {
    try {
      const res = await fetch("/api/match/baucua", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "READY", roomId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) updateRoomState(data.room);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddBot = async () => {
    try {
      const res = await fetch("/api/match/baucua", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ADD_BOT", roomId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) updateRoomState(data.room);
      } else {
        const err = await res.json();
        alert(err.error || "Thêm Bot thất bại!");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartGame = async () => {
    try {
      const res = await fetch("/api/match/baucua", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "START", roomId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          updateRoomState(data.room);
          setLocalBets({ bau: 0, cua: 0, tom: 0, ca: 0, ga: 0, nai: 0 });
          setDishOpen(false);
          setRolling(false);
        }
      } else {
        const err = await res.json();
        alert(err.error || "Bắt đầu game thất bại!");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRollDice = async () => {
    try {
      const res = await fetch("/api/match/baucua", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ROLL", roomId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          const parsedBoard = JSON.parse(data.room.board);
          triggerRollAnimation(parsedBoard.dice, () => {
            updateRoomState(data.room);
            refreshProfile();
          });
        }
      } else {
        const err = await res.json();
        alert(err.error || "Lắc xúc xắc thất bại!");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePlayAgain = async () => {
    try {
      const res = await fetch("/api/match/baucua", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "PLAY_AGAIN", roomId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) updateRoomState(data.room);
      } else {
        const err = await res.json();
        alert(err.error || "Reset game thất bại!");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLeaveRoom = async () => {
    try {
      const res = await fetch("/api/match/baucua", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "LEAVE", roomId })
      });
      if (res.ok) {
        refreshProfile();
        onBack();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyRoomId = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !room || !board) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0a0a0c] scanlines">
        <RotateCcw className="w-10 h-10 text-pixel-yellow animate-spin" />
        <h2 className="text-xs text-pixel-yellow uppercase mt-4 tracking-widest animate-pulse">
          ĐANG TẢI BÀN CƯỢC BẦU CUA...
        </h2>
      </div>
    );
  }

  const isHost = room.playerXId === profile.id;
  const isLobby = board.status === "WAITING";
  const isBetting = board.status === "BETTING";
  const isFinished = board.status === "FINISHED";

  const totalLocalBet = Object.values(localBets).reduce((a, b) => a + b, 0);
  const totalConfirmedBet = board.bets[profile.id] ? Object.values(board.bets[profile.id]).reduce((a: number, b: any) => a + Number(b), 0) as number : 0;
  const isBetModified = totalLocalBet !== totalConfirmedBet || ANIMALS.some(a => localBets[a.id] !== (board.bets[profile.id]?.[a.id] || 0));

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#0c0c0e] text-white scanlines p-4 sm:p-6 relative select-none">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#D4AF37]/10 pb-4 mb-6 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleLeaveRoom}
            className="pixel-btn pixel-btn-gray py-2 px-3 flex items-center justify-center gap-1.5 text-[10px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Rời Phòng
          </button>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2 drop-shadow-md">
              🎯 BÀN ĐẤU BẦU CUA TÔM CÁ
            </h1>
            <div className="flex items-center gap-2 text-[8.5px] text-[#F3E5AB]/60 uppercase tracking-widest font-bold">
              <span>Hạng phòng: {board.betLimit > 0 ? `Giới hạn ${board.betLimit} Coin` : "Không giới hạn"}</span>
              <span>•</span>
              <span className="text-[#FF9F0A]">Ranked Mode</span>
            </div>
          </div>
        </div>

        {/* Room Code Code (If FRIEND mode) */}
        {mode === "FRIEND" && (
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-[#D4AF37]/10">
            <span className="text-[9px] text-[#F3E5AB]/50 font-mono uppercase">Mã mời bạn:</span>
            <span className="text-[10px] font-mono font-extrabold text-[#F3E5AB]">{roomId?.substring(0, 8).toUpperCase()}</span>
            <button 
              onClick={copyRoomId} 
              className="text-[#FF9F0A] hover:text-[#FF9F0A]/80 active:scale-95 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full max-w-6xl mx-auto flex-1">
        
        {/* LEFT COLUMN: LOBBY & BOARD (COL-SPAN 8) */}
        <div className="lg:col-span-8 flex flex-col gap-6 w-full">
          
          {/* LẮC XÚC XẮC DISPLAY */}
          <div className="pixel-box p-6 bg-black/35 flex flex-col items-center justify-center relative min-h-[180px] overflow-hidden">
            
            {/* Background effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.06),transparent_70%)] pointer-events-none"></div>

            {isLobby && (
              <div className="text-center space-y-3 z-10">
                <Users className="w-12 h-12 text-[#F3E5AB]/30 mx-auto animate-pulse" />
                <h3 className="text-xs font-bold text-[#F3E5AB] uppercase tracking-wider">Đang đợi các kỳ thủ sẵn sàng...</h3>
                <p className="text-[9px] text-gray-500 max-w-sm mx-auto">Vui lòng bấm Sẵn Sàng. Chủ phòng có thể thêm Bot hoặc bấm Bắt đầu khi phòng có ít nhất 1 người chơi khác hoặc Bot.</p>
                {isHost && (
                  <button 
                    onClick={handleAddBot}
                    className="pixel-btn pixel-btn-gray py-2 px-4 text-[9.5px] font-bold mx-auto flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm Bot AI
                  </button>
                )}
              </div>
            )}

            {(isBetting || isFinished) && (
              <div className="flex flex-col items-center gap-5 z-10 w-full">
                
                {/* Bát Đĩa Lắc Xúc Xắc */}
                <div className="relative w-40 h-40 bg-[#16161a] rounded-full border-4 border-[#D4AF37]/20 flex items-center justify-center shadow-[inset_0_4px_16px_rgba(0,0,0,0.6)]">
                  
                  {/* Bát úp (khi đang lắc) */}
                  {!dishOpen ? (
                    <div className={`w-32 h-32 bg-radial from-amber-600 to-amber-950 rounded-full border-2 border-[#D4AF37]/30 shadow-2xl flex flex-col items-center justify-center ${rolling ? "animate-bounce" : ""}`}>
                      <span className="text-2xl">🎲</span>
                      <span className="text-[8px] text-[#F3E5AB]/60 font-extrabold tracking-widest mt-1">ĐANG LẮC</span>
                    </div>
                  ) : (
                    /* 3 Viên Xúc xắc linh vật */
                    <div className="flex gap-4">
                      {rollingDice.map((idx, i) => {
                        const anim = ANIMALS[idx];
                        return (
                          <div 
                            key={i} 
                            className={`w-10 h-10 ${anim?.color || "bg-zinc-800 border-zinc-700"} border-2 rounded-xl flex items-center justify-center text-xl shadow-lg relative transform transition-transform duration-300 hover:scale-105 select-none`}
                          >
                            <span className="drop-shadow-sm">{anim?.icon}</span>
                            <span className="absolute bottom-0 text-[6px] text-gray-500 uppercase font-mono font-bold leading-none mb-0.5">{anim?.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Status Bar */}
                <div className="text-center">
                  {isBetting && (
                    <div className="flex flex-col items-center gap-1 animate-pulse">
                      <div className="flex items-center gap-1.5 text-pixel-yellow text-xs font-extrabold uppercase">
                        <Clock className="w-4 h-4 animate-spin" />
                        Thời gian đặt cược: {timeLeft}s
                      </div>
                      <span className="text-[9px] text-[#F3E5AB]/50">Vui lòng đặt chip và bấm xác nhận trước khi hết giờ!</span>
                    </div>
                  )}
                  {isFinished && (
                    <div className="space-y-1.5">
                      <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest">
                        🎉 ĐÃ MỞ BÁT KẾT QUẢ!
                      </h3>
                      <div className="flex items-center justify-center gap-1.5">
                        {rollingDice.map((idx, i) => (
                          <span key={i} className="text-sm bg-black/40 px-2 py-0.5 rounded border border-[#D4AF37]/15">
                            {ANIMALS[idx]?.icon} {ANIMALS[idx]?.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* BÀN ĐẶT CƯỢC BẦU CUA */}
          <div className="flex flex-col gap-4">
            
            {/* Lựa chọn Chip Đặt Cược (chỉ hiện khi đang trong phase cược) */}
            {isBetting && (
              <div className="pixel-box-nested p-3 flex flex-wrap items-center justify-between gap-3 bg-black/25">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-[#FF9F0A]" />
                  <span className="text-[9px] text-[#F3E5AB]/60 uppercase tracking-widest font-extrabold">Chọn Chip cược:</span>
                </div>
                <div className="flex items-center gap-2">
                  {[1, 5, 10, 50, 100].map((val) => (
                    <button
                      key={val}
                      onClick={() => setActiveChip(val)}
                      className={`w-10 h-10 rounded-full border-2 font-mono text-[10px] font-extrabold transition-all hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg ${
                        activeChip === val 
                          ? "bg-[#FF9F0A] border-white text-black shadow-[#FF9F0A]/20" 
                          : "bg-zinc-800 border-zinc-700 text-[#F3E5AB] hover:border-[#FF9F0A]/30"
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 6 Ô Linh Vật Bầu Cua */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {ANIMALS.map((animal) => {
                // Tính cược của người chơi này trên ô này
                const myPlacedBet = board.bets[profile.id]?.[animal.id] || 0;
                const myLocalBet = localBets[animal.id] || 0;

                // Tính tổng cược của tất cả mọi người trên ô này
                const totalBetOnSlot = Object.values(board.bets).reduce((acc: number, playerBets: any) => {
                  return acc + (Number(playerBets[animal.id]) || 0);
                }, 0) as number;

                return (
                  <div
                    key={animal.id}
                    onClick={() => handleBetLocal(animal.id)}
                    className={`pixel-box p-4 flex flex-col items-center justify-between min-h-[110px] cursor-pointer transition-all duration-200 select-none ${animal.color} ${
                      isBetting ? "hover:scale-[1.03] hover:border-yellow-600/40 active:scale-98" : ""
                    }`}
                  >
                    {/* Hàng đầu: Tên & Tổng cược */}
                    <div className="flex justify-between w-full text-[8.5px] font-mono leading-none border-b border-[#D4AF37]/5 pb-1">
                      <span className="uppercase font-bold tracking-wider">{animal.name}</span>
                      <span className="text-[#F3E5AB]/60">Tổng: {totalBetOnSlot} 🥚</span>
                    </div>

                    {/* Giữa: Icon linh vật to */}
                    <span className="text-4xl my-2 drop-shadow-md select-none">{animal.icon}</span>

                    {/* Dưới: Hiển thị cược của bản thân */}
                    <div className="w-full bg-black/30 py-1 px-2 rounded flex items-center justify-between text-[9px] font-mono border border-white/5">
                      <span className="text-gray-400">Bạn cược:</span>
                      <span className={`font-bold ${myLocalBet > 0 ? "text-[#FF9F0A]" : "text-white"}`}>
                        {myLocalBet} {myPlacedBet > 0 && myLocalBet !== myPlacedBet && <span className="text-gray-500">({myPlacedBet})</span>}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Các Nút Điều Khiển Đặt Cược (Xác Nhận, Xóa Cược) */}
            {isBetting && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClearBets}
                  disabled={submitting}
                  className="flex-1 pixel-btn pixel-btn-gray py-3 text-xs font-bold gap-2"
                >
                  Xóa Cược Hủy Lại
                </button>
                <button
                  onClick={handleConfirmBets}
                  disabled={submitting || !isBetModified}
                  className={`flex-1 pixel-btn py-3 text-xs font-bold gap-2 ${
                    isBetModified ? "pixel-btn-yellow" : "pixel-btn-gray opacity-60"
                  }`}
                >
                  {submitting ? "Đang gửi cược..." : "Xác Nhận Đặt Cược"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ROOM LOBBY & PLAYER LIST (COL-SPAN 4) */}
        <div className="lg:col-span-4 flex flex-col gap-6 w-full">
          
          {/* LOBBY PLAYERS CARD */}
          <div className="pixel-box p-4 space-y-4">
            <h4 className="text-xs font-extrabold text-white uppercase flex items-center gap-2 border-b border-[#D4AF37]/10 pb-2">
              <Users className="w-4 h-4 text-[#FF9F0A]" />
              Kỳ Thủ Trong Phòng ({board.players.length}/4)
            </h4>

            <div className="space-y-3">
              {board.players.map((p: any, i: number) => {
                const isPlayerHost = p.id === room.playerXId;
                const elo = p.isBot ? 1000 : (p.id === profile.id ? profile.eloBauCua : 1000); // placeholder or ELO
                const isSelf = p.id === profile.id;

                return (
                  <div 
                    key={p.id} 
                    className={`flex items-center justify-between p-2.5 rounded-lg border bg-black/20 ${
                      isSelf ? "border-[#FF9F0A]/30 bg-[#FF9F0A]/5" : "border-[#D4AF37]/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-zinc-800 rounded flex items-center justify-center text-base border border-zinc-700 relative">
                        {p.isBot ? "🤖" : "🐔"}
                        {isPlayerHost && (
                          <span className="absolute -top-1.5 -right-1 text-[8px] bg-[#FF9F0A] text-black px-0.5 rounded font-extrabold select-none leading-none">H</span>
                        )}
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] font-bold text-white block truncate max-w-[120px]">
                          {p.username} {isSelf && "(Bạn)"}
                        </span>
                        <span className="text-[7.5px] text-gray-500 font-mono">
                          ELO Bầu Cua: {elo}
                        </span>
                      </div>
                    </div>

                    <div>
                      {isLobby ? (
                        <span className={`text-[8.5px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                          p.ready 
                            ? "bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse" 
                            : "bg-zinc-800 text-zinc-500"
                        }`}>
                          {p.ready ? "Sẵn Sàng" : "Chờ..."}
                        </span>
                      ) : (
                        <span className="text-[8.5px] text-[#FF9F0A] font-bold font-mono">
                          Đang chơi
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Host Buttons to Control Game */}
            {isLobby && (
              <div className="pt-2 border-t border-[#D4AF37]/5">
                {isHost ? (
                  <button
                    onClick={handleStartGame}
                    disabled={board.players.length < 2 && !board.players.some((p: any) => p.isBot)}
                    className={`w-full pixel-btn py-3 text-xs font-bold gap-2 ${
                      board.players.length >= 2 || board.players.some((p: any) => p.isBot) 
                        ? "pixel-btn-yellow" 
                        : "pixel-btn-gray opacity-60"
                    }`}
                  >
                    Bắt Đầu Trận Đấu
                  </button>
                ) : (
                  <button
                    onClick={handleToggleReady}
                    className="w-full pixel-btn pixel-btn-yellow py-3 text-xs font-bold gap-2"
                  >
                    {board.players.find((p: any) => p.id === profile.id)?.ready ? "Hủy Sẵn Sàng" : "Sẵn Sàng Chiến"}
                  </button>
                )}
              </div>
            )}

            {/* Play Again (Host) or Waiting for Host message (Finished phase) */}
            {isFinished && (
              <div className="pt-2 border-t border-[#D4AF37]/5">
                {isHost ? (
                  <button
                    onClick={handlePlayAgain}
                    className="w-full pixel-btn pixel-btn-yellow py-3 text-xs font-bold gap-2"
                  >
                    Chơi Tiếp Ván Mới
                  </button>
                ) : (
                  <div className="text-center text-[9px] text-[#F3E5AB]/60 uppercase tracking-widest py-3 animate-pulse">
                    Đợi chủ phòng bắt đầu ván mới...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* GAME RESULTS DISPLAY (Only in Finished phase) */}
          {isFinished && board.results && (
            <div className="pixel-box p-4 space-y-3 bg-[#FF9F0A]/5 border-[#FF9F0A]/20">
              <h4 className="text-xs font-extrabold text-white uppercase flex items-center gap-2 border-b border-[#FF9F0A]/20 pb-2">
                <Trophy className="w-4 h-4 text-[#FF9F0A]" />
                Kết Quả Ván Đấu
              </h4>
              <div className="space-y-2">
                {board.results.map((res: any) => {
                  const isWinner = res.profit > 0;
                  const isLoser = res.profit < 0;

                  return (
                    <div key={res.id} className="flex justify-between items-center text-[10px] font-mono leading-none py-1.5 border-b border-white/5 last:border-0">
                      <span className="text-gray-400 font-bold truncate max-w-[120px]">
                        @{board.players.find((p: any) => p.id === res.id)?.username || "Kỳ Thủ"}
                      </span>
                      <div className="flex gap-2">
                        <span className="text-gray-500">Cược: {res.placedBet}</span>
                        <span className={`font-bold ${
                          isWinner ? "text-green-400" : isLoser ? "text-red-400" : "text-gray-400"
                        }`}>
                          {isWinner ? `+${res.profit}` : res.profit} Coin
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LỊCH SỬ KẾT QUẢ SOI CẦU */}
          {board.history && board.history.length > 0 && (
            <div className="pixel-box p-4 space-y-3">
              <h4 className="text-xs font-extrabold text-white uppercase flex items-center gap-2 border-b border-[#D4AF37]/10 pb-2">
                <RotateCcw className="w-4 h-4 text-[#FF9F0A]" />
                Lịch Sử Kết Quả (Cầu Bầu Cua)
              </h4>
              <div className="flex flex-col gap-2">
                {board.history.slice(0, 5).map((roll: number[], i: number) => (
                  <div key={i} className="flex items-center gap-2 bg-black/25 p-2 rounded border border-white/5">
                    <span className="text-[8px] text-gray-500 font-mono font-bold uppercase min-w-[36px]">Ván {i+1}:</span>
                    <div className="flex gap-1.5">
                      {roll.map((idx, k) => (
                        <span key={k} className="text-base bg-black/40 px-1 py-0.5 rounded leading-none">
                          {ANIMALS[idx]?.icon}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
