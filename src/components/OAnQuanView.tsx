"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  createInitialGameState,
  executeMove,
  getBotMove,
  getValidPits,
  OAnQuanGameState,
  AnimationStep,
  PitState,
} from "@/lib/oAnQuanEngine";
import { ArrowLeft, ArrowRight, RotateCcw, Volume2, VolumeX, Bot, Users, Trophy, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";

interface OAnQuanViewProps {
  mode: "BOT" | "FRIEND" | "LOCAL" | "RANDOM";
  botDifficulty?: "EASY" | "HARD";
  details?: any;
  onBack: () => void;
  userProfile?: any;
}

export default function OAnQuanView({
  mode,
  botDifficulty = "HARD",
  details,
  onBack,
  userProfile,
}: OAnQuanViewProps) {
  const [startingPlayer, setStartingPlayer] = useState<1 | 2>(() => (Math.random() < 0.5 ? 1 : 2));
  const [gameState, setGameState] = useState<OAnQuanGameState>(() => createInitialGameState(startingPlayer));
  const [selectedPit, setSelectedPit] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const [displayedBoard, setDisplayedBoard] = useState<PitState[]>(gameState.board);
  const [displayedP1Score, setDisplayedP1Score] = useState<number>(0);
  const [displayedP2Score, setDisplayedP2Score] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>(
    startingPlayer === 1 ? "🎲 Bốc thăm: Bạn (P1) được ĐI TRƯỚC!" : "🎲 Bốc thăm: Đối thủ (P2) được ĐI TRƯỚC!"
  );
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [gameMode, setGameMode] = useState<"BOT" | "LOCAL" | "RANDOM" | "FRIEND">(
    mode || "BOT"
  );
  const [diff, setDiff] = useState<"EASY" | "HARD">(botDifficulty);

  // Audio Context cho âm thanh Web Audio API
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSound = (type: "sow" | "pick" | "eat" | "win") => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === "sow") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(400 + Math.random() * 200, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === "pick") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(300, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === "eat") {
        osc.type = "square";
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1000, now + 0.15);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === "win") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Đồng bộ displayed state khi gameState thay đổi ngoài animation
  useEffect(() => {
    if (!animating) {
      setDisplayedBoard(gameState.board);
      setDisplayedP1Score(gameState.p1Score);
      setDisplayedP2Score(gameState.p2Score);
    }
  }, [gameState, animating]);

  const [showResultModal, setShowResultModal] = useState(false);

  // Báo chiến thắng khi game over
  useEffect(() => {
    if (gameState.isGameOver) {
      playSound("win");
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      if (gameState.winner === 1) {
        setStatusMessage("🎉 NGƯỜI CHƠI 1 THẮNG CUỘC!");
      } else if (gameState.winner === 2) {
        setStatusMessage(
          gameMode === "BOT" ? "🤖 BOT THẮNG CUỘC!" : "🎉 NGƯỜI CHƠI 2 THẮNG CUỘC!"
        );
      } else {
        setStatusMessage("🤝 TRẬN ĐẤU HÒA!");
      }

      const timer = setTimeout(() => {
        setShowResultModal(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [gameState.isGameOver, gameState.winner, gameMode]);

  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);

  const handleSurrenderClick = () => {
    if (gameState.isGameOver || animating) return;
    setShowSurrenderConfirm(true);
  };

  const confirmSurrender = async () => {
    setShowSurrenderConfirm(false);
    const finalState: OAnQuanGameState = {
      ...gameState,
      isGameOver: true,
      winner: 2,
    };
    setGameState(finalState);
    setStatusMessage("🏳️ BẠN ĐÃ ĐẦU HÀNG!");
    setShowResultModal(true);

    if (details?.roomId) {
      try {
        await fetch("/api/match/forfeit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: details.roomId, action: "SURRENDER" }),
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleBackToLobby = async () => {
    if (details?.roomId && !gameState.isGameOver) {
      try {
        await fetch("/api/match/forfeit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: details.roomId, action: "SURRENDER" }),
        });
      } catch (e) {
        console.error(e);
      }
    }
    onBack();
  };

  // Áp dụng Theme mua từ Shop (Cyber / Nature / Classic)
  const equippedTheme = userProfile?.board_theme || (typeof window !== "undefined" ? localStorage.getItem("board_theme") : null) || "theme_cyber";

  const getBoardThemeStyles = () => {
    if (equippedTheme === "theme_nature") {
      return "bg-gradient-to-b from-[#0e2216] via-[#09170e] to-[#040a06] border-4 border-emerald-500/60 shadow-[0_0_35px_rgba(16,185,129,0.35)]";
    }
    if (equippedTheme === "theme_classic") {
      return "bg-gradient-to-b from-[#1c140d] via-[#140e09] to-[#0a0704] border-4 border-amber-600/60 shadow-[0_0_35px_rgba(245,158,11,0.35)]";
    }
    return "bg-gradient-to-b from-[#150a24] via-[#0d0617] to-[#06030b] border-4 border-purple-500/60 shadow-[0_0_35px_rgba(168,85,247,0.35)]";
  };

  // Xử lý chạy Animation các bước di chuyển
  const playAnimationSteps = async (steps: AnimationStep[], finalState: OAnQuanGameState) => {
    setAnimating(true);
    setSelectedPit(null);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      setDisplayedBoard(step.boardState);
      setDisplayedP1Score(step.p1Score);
      setDisplayedP2Score(step.p2Score);

      if (step.message) {
        setStatusMessage(step.message);
      }

      if (step.type === "SOW") {
        playSound("sow");
        await new Promise((r) => setTimeout(r, 480));
      } else if (step.type === "PICK") {
        playSound("pick");
        await new Promise((r) => setTimeout(r, 650));
      } else if (step.type === "EAT") {
        playSound("eat");
        await new Promise((r) => setTimeout(r, 850));
      } else if (step.type === "FEED") {
        playSound("pick");
        await new Promise((r) => setTimeout(r, 900));
      } else {
        await new Promise((r) => setTimeout(r, 450));
      }
    }

    setGameState(finalState);
    setAnimating(false);

    if (!finalState.isGameOver) {
      const nextTurnText =
        finalState.currentPlayer === 1
          ? "Đến lượt Người chơi 1 (Phía dưới)"
          : gameMode === "BOT"
          ? "🤖 Bot đang suy nghĩ..."
          : "Đến lượt Người chơi 2 (Phía trên)";
      setStatusMessage(nextTurnText);
    }
  };

  // Người chơi thực hiện nước đi
  const handleMakeMove = (pitIndex: number, direction: "CW" | "CCW") => {
    if (animating || gameState.isGameOver) return;

    // Kiểm tra lượt hợp lệ
    const isP1 = gameState.currentPlayer === 1;
    const validPits = getValidPits(gameState, gameState.currentPlayer);

    if (!validPits.includes(pitIndex)) return;

    const { finalState, animationSteps } = executeMove(gameState, pitIndex, direction);
    playAnimationSteps(animationSteps, finalState);
  };

  // Tự động cho Bot đi khi đến lượt P2 trong BOT hoặc RANDOM mode
  useEffect(() => {
    if (
      (gameMode === "BOT" || gameMode === "RANDOM") &&
      gameState.currentPlayer === 2 &&
      !gameState.isGameOver &&
      !animating
    ) {
      const timer = setTimeout(() => {
        const botMove = getBotMove(gameState, diff);
        if (botMove) {
          const { finalState, animationSteps } = executeMove(
            gameState,
            botMove.pitIndex,
            botMove.direction
          );
          playAnimationSteps(animationSteps, finalState);
        }
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [gameState.currentPlayer, gameState.isGameOver, animating, gameMode, diff]);

  const handleResetGame = () => {
    const nextFirst = Math.random() < 0.5 ? 1 : 2;
    setStartingPlayer(nextFirst);
    const freshState = createInitialGameState(nextFirst);
    setGameState(freshState);
    setDisplayedBoard(freshState.board);
    setDisplayedP1Score(0);
    setDisplayedP2Score(0);
    setSelectedPit(null);
    const firstText = nextFirst === 1 ? "🎲 Bốc thăm: Bạn (P1) được ĐI TRƯỚC!" : "🎲 Bốc thăm: Đối thủ (P2) được ĐI TRƯỚC!";
    setStatusMessage(`Trận mới! ${firstText}`);
  };

  // Render hạt sỏi ngẫu nhiên trong ô để tạo cảm giác tự nhiên sinh động
  const renderStonesInPit = (pit: PitState) => {
    const elements = [];

    // Quan lớn (Nút lớn màu vàng kim)
    if (pit.hasQuanBigStone) {
      elements.push(
        <div
          key="quan-big"
          className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-200 border-2 border-yellow-100 shadow-[0_0_12px_rgba(251,191,36,0.8)] flex items-center justify-center font-extrabold text-[10px] sm:text-xs text-amber-950 transform hover:scale-110 transition-transform"
          title="Quan Lớn (10 điểm)"
        >
          QUAN
        </div>
      );
    }

    // Sỏi nhỏ (Ngọc bích / Đá neon phát sáng)
    const stonesCount = pit.stones;
    const maxVisibleStones = Math.min(stonesCount, 15);

    for (let i = 0; i < maxVisibleStones; i++) {
      elements.push(
        <div
          key={`stone-${i}`}
          className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-gradient-to-br from-emerald-300 via-teal-500 to-emerald-700 border border-emerald-200/60 shadow-[0_0_6px_rgba(16,185,129,0.7)] transform transition-all duration-300"
          style={{
            transform: `translate(${(i % 4) * 2 - 3}px, ${Math.floor(i / 4) * 2 - 3}px)`,
          }}
        />
      );
    }

    return (
      <div className="flex flex-wrap items-center justify-center gap-1 p-1 max-w-[80%] max-h-[80%] overflow-hidden">
        {elements}
      </div>
    );
  };

  const isMyTurnP1 = gameState.currentPlayer === 1 && !animating && !gameState.isGameOver;
  const isMyTurnP2 =
    gameState.currentPlayer === 2 &&
    gameMode === "LOCAL" &&
    !animating &&
    !gameState.isGameOver;

  return (
    <div className="min-h-screen w-full bg-[#0a0c10] text-slate-100 flex flex-col items-center justify-between p-3 sm:p-6 select-none font-sans relative overflow-hidden">
      {/* Dynamic Background Effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293715_1px,transparent_1px),linear-gradient(to_bottom,#1f293715_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Header Bar */}
      <header className="w-full max-w-5xl flex items-center justify-between z-10 bg-slate-900/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-amber-500/20 shadow-lg">
        <button
          onClick={handleBackToLobby}
          className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-amber-400 hover:text-amber-300 bg-amber-950/40 hover:bg-amber-900/50 px-3 py-1.5 rounded-xl border border-amber-500/30 transition-all"
        >
          ← Trở lại Lobby
        </button>

        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          <h1 className="text-base sm:text-xl font-extrabold tracking-wider bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 bg-clip-text text-transparent uppercase">
            Ô Ăn Quan
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSurrenderClick}
            disabled={animating || gameState.isGameOver}
            className="flex items-center gap-1 text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 px-2.5 py-1.5 rounded-xl border border-rose-500/30 transition-all disabled:opacity-40"
            title="Đầu hàng trận đấu"
          >
            <span>🏳️</span> Đầu hàng
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
            title={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
          </button>

          <button
            onClick={handleResetGame}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition-all"
            title="Chơi lại trận mới"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Top Status & Controls */}
      <main className="w-full max-w-5xl flex flex-col items-center gap-4 my-auto z-10 py-4">
        {/* Mode Selector & Status */}
        <div className="flex flex-wrap items-center justify-between w-full gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            {gameMode === "BOT" && (
              <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border bg-amber-500/20 text-amber-300 border-amber-500/50">
                <Bot className="w-4 h-4 text-amber-400" /> Đang chơi với Bot AI ({diff === "EASY" ? "Dễ" : "Khó"})
              </span>
            )}
            {gameMode === "LOCAL" && (
              <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border bg-emerald-500/20 text-emerald-300 border-emerald-500/50">
                <Users className="w-4 h-4 text-emerald-400" /> Đang chơi 2 Người (Local)
              </span>
            )}
            {gameMode === "RANDOM" && (
              <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                <Trophy className="w-4 h-4 text-purple-400 animate-pulse" /> Đang Đấu Xếp Hạng (Rank)
              </span>
            )}
            {gameMode === "FRIEND" && (
              <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border bg-cyan-500/20 text-cyan-300 border-cyan-500/50">
                <Users className="w-4 h-4 text-cyan-400" /> Đang chơi với Bạn Bè
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Status Text Banner */}
        <div className="w-full text-center py-2 px-4 rounded-xl bg-slate-900/90 border border-amber-500/30 text-amber-300 font-semibold text-xs sm:text-sm tracking-wide shadow-md transition-all">
          {statusMessage}
        </div>

        {/* Players Score Board (Matching Image 4 Style) */}
        <div className="w-full grid grid-cols-2 gap-4">
          {/* Player 1 Score Card (Bottom Player - User) */}
          <div
            className={`relative flex items-center justify-between p-3 rounded-2xl bg-[#141412] border transition-all ${
              gameState.currentPlayer === 1
                ? "border-2 border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                : "border-[#282824]"
            }`}
          >
            {gameState.currentPlayer === 1 && (
              <span className="absolute -top-2.5 left-3 px-2 py-0.5 rounded bg-[#D4AF37] text-[#141412] text-[9px] font-black tracking-widest uppercase shadow">
                LƯỢT ĐI
              </span>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-lg font-bold text-amber-300 shadow">
                🥚
              </div>
              <div>
                <div className="text-xs sm:text-sm font-extrabold text-white tracking-wide">
                  {userProfile?.username || "TIMMYLE"}
                </div>
                <div className="text-[10px] text-[#888880] font-mono font-bold">
                  Lv.{userProfile?.level || 1}
                </div>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-xl sm:text-2xl font-black text-[#F3E5AB]">{displayedP1Score}</span>
              {gameState.p1Borrowed > 0 && (
                <span className="block text-[9px] text-rose-400 font-mono">Nợ: -{gameState.p1Borrowed}đ</span>
              )}
            </div>
          </div>

          {/* Player 2 Score Card (Top Player - Bot / Opponent) */}
          <div
            className={`relative flex items-center justify-between p-3 rounded-2xl bg-[#141412] border transition-all ${
              gameState.currentPlayer === 2
                ? "bg-[#181814] border-2 border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                : "border-[#282824]"
            }`}
          >
            {gameState.currentPlayer === 2 && (
              <span className="absolute -top-2.5 left-3 px-2 py-0.5 rounded bg-[#D4AF37] text-[#141412] text-[9px] font-black tracking-widest uppercase shadow">
                LƯỢT ĐI
              </span>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-lg font-bold text-cyan-300 shadow">
                {gameMode === "BOT" ? "🤖" : "O"}
              </div>
              <div>
                <div className="text-xs sm:text-sm font-extrabold text-white tracking-wide">
                  {gameMode === "BOT"
                    ? `BOT [${diff === "EASY" ? "EASY" : "HARD"}]`
                    : gameMode === "RANDOM"
                    ? "KỳVương_ĐấtBắc"
                    : gameMode === "FRIEND"
                    ? (details?.opponentUsername || "Người chơi 2")
                    : "Người chơi 2"}
                </div>
                <div className="text-[10px] text-[#888880] font-mono font-bold">
                  Lv.1
                </div>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-xl sm:text-2xl font-black text-[#F3E5AB]">{displayedP2Score}</span>
              {gameState.p2Borrowed > 0 && (
                <span className="block text-[9px] text-rose-400 font-mono">Nợ: -{gameState.p2Borrowed}đ</span>
              )}
            </div>
          </div>
        </div>

        {/* Turn Status Indicator matching Image 4 */}
        <div className="flex items-center gap-2 text-xs font-mono font-extrabold uppercase tracking-widest text-[#cccccc]">
          <span>⏱ LƯỢT CỦA:</span>
          <span className={gameState.currentPlayer === 1 ? "text-amber-400" : "text-cyan-400"}>
            {gameState.currentPlayer === 1 ? "BẠN" : gameMode === "BOT" ? "BOT" : "ĐỐI THỦ"}
          </span>
        </div>

        {/* ---------------- BÀN CỜ Ô ĂN QUAN ---------------- */}
        <div className={`w-full p-4 sm:p-6 rounded-3xl relative flex flex-col items-center transition-all ${getBoardThemeStyles()}`}>
          {/* Cyber Wood Border Glow Effect */}
          <div className="absolute inset-2 rounded-2xl border border-amber-500/20 pointer-events-none" />
          {/* Cyber Wood Border Glow Effect */}
          <div className="absolute inset-2 rounded-2xl border border-amber-500/20 pointer-events-none" />

          {/* Core Grid: 2 Quan Pits at ends, 10 Dan Pits in middle (2 rows of 5) */}
          <div className="w-full flex items-center justify-between gap-2 sm:gap-4 my-2">
            {/* --- Quan Left Pit (Index 11) --- */}
            <div
              className="w-24 sm:w-32 h-40 sm:h-52 rounded-l-full bg-gradient-to-r from-amber-950/90 to-amber-900/40 border-2 border-amber-600/60 flex flex-col items-center justify-between pt-4 pb-2 px-1 shadow-inner relative overflow-hidden"
              title="Ô Quan Trái (Ô 11)"
            >
              <span className="translate-x-1.5 px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-500/50 text-[9.5px] sm:text-[11px] font-black text-amber-400 shadow-md tracking-wider">
                QUAN A
              </span>
              {renderStonesInPit(displayedBoard[11])}
              <div className="text-xs sm:text-sm font-black text-amber-400 font-mono bg-black/50 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                {displayedBoard[11].stones + (displayedBoard[11].hasQuanBigStone ? 10 : 0)}
              </div>
            </div>

            {/* --- 10 Dan Pits Layout (2 Rows: Top 10->6, Bottom 0->4) --- */}
            <div className="flex-1 flex flex-col gap-3 sm:gap-4">
              {/* TOP ROW: Pits 10, 9, 8, 7, 6 (Clockwise order for Player 2) */}
              <div className="grid grid-cols-5 gap-2 sm:gap-3">
                {[10, 9, 8, 7, 6].map((idx) => {
                  const pit = displayedBoard[idx];
                  const isSelectable = isMyTurnP2 && pit.stones > 0;
                  const isSelected = selectedPit === idx;

                  return (
                    <div
                      key={`pit-${idx}`}
                      onClick={() => {
                        if (isSelectable) setSelectedPit(isSelected ? null : idx);
                      }}
                      className={`h-20 sm:h-24 rounded-2xl border-2 flex flex-col items-center justify-between p-1.5 relative transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "bg-cyan-900/60 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.6)] scale-105"
                          : isSelectable
                          ? "bg-slate-900/80 border-cyan-500/50 hover:bg-cyan-950/40 hover:border-cyan-400 shadow-md"
                          : "bg-slate-950/60 border-slate-800/80 opacity-90"
                      }`}
                    >
                      <span className="text-[9px] sm:text-[10px] font-mono text-cyan-400/70">
                        Ô {idx}
                      </span>
                      {renderStonesInPit(pit)}
                      <span className="text-xs sm:text-sm font-bold text-cyan-300 font-mono bg-black/50 px-1.5 py-0.5 rounded-md">
                        {pit.stones}
                      </span>

                      {/* Direction Picker Popup for Selected Pit */}
                      {isSelected && (
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/95 border border-cyan-400 p-1 rounded-xl shadow-xl z-30 animate-in fade-in zoom-in-95">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMakeMove(idx, "CCW");
                            }}
                            className="flex items-center gap-1 text-[11px] font-bold text-cyan-300 bg-cyan-950 hover:bg-cyan-900 px-2 py-1 rounded-lg border border-cyan-500/40"
                            title="Rải theo chiều Trái (CCW)"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" /> Trái
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMakeMove(idx, "CW");
                            }}
                            className="flex items-center gap-1 text-[11px] font-bold text-cyan-300 bg-cyan-950 hover:bg-cyan-900 px-2 py-1 rounded-lg border border-cyan-500/40"
                            title="Rải theo chiều Phải (CW)"
                          >
                            Phải <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* BOTTOM ROW: Pits 0, 1, 2, 3, 4 (For Player 1) */}
              <div className="grid grid-cols-5 gap-2 sm:gap-3">
                {[0, 1, 2, 3, 4].map((idx) => {
                  const pit = displayedBoard[idx];
                  const isSelectable = isMyTurnP1 && pit.stones > 0;
                  const isSelected = selectedPit === idx;

                  return (
                    <div
                      key={`pit-${idx}`}
                      onClick={() => {
                        if (isSelectable) setSelectedPit(isSelected ? null : idx);
                      }}
                      className={`h-20 sm:h-24 rounded-2xl border-2 flex flex-col items-center justify-between p-1.5 relative transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "bg-amber-900/60 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.6)] scale-105"
                          : isSelectable
                          ? "bg-slate-900/80 border-amber-500/50 hover:bg-amber-950/40 hover:border-amber-400 shadow-md"
                          : "bg-slate-950/60 border-slate-800/80 opacity-90"
                      }`}
                    >
                      <span className="text-[9px] sm:text-[10px] font-mono text-amber-400/70">
                        Ô {idx}
                      </span>
                      {renderStonesInPit(pit)}
                      <span className="text-xs sm:text-sm font-bold text-amber-300 font-mono bg-black/50 px-1.5 py-0.5 rounded-md">
                        {pit.stones}
                      </span>

                      {/* Direction Picker Popup for Selected Pit */}
                      {isSelected && (
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/95 border border-amber-400 p-1 rounded-xl shadow-xl z-30 animate-in fade-in zoom-in-95">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMakeMove(idx, "CCW");
                            }}
                            className="flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-950 hover:bg-amber-900 px-2 py-1 rounded-lg border border-amber-500/40"
                            title="Rải theo chiều Trái (CCW)"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" /> Trái
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMakeMove(idx, "CW");
                            }}
                            className="flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-950 hover:bg-amber-900 px-2 py-1 rounded-lg border border-amber-500/40"
                            title="Rải theo chiều Phải (CW)"
                          >
                            Phải <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* --- Quan Right Pit (Index 5) --- */}
            <div
              className="w-24 sm:w-32 h-40 sm:h-52 rounded-r-full bg-gradient-to-l from-amber-950/90 to-amber-900/40 border-2 border-amber-600/60 flex flex-col items-center justify-between pt-4 pb-2 px-1 shadow-inner relative overflow-hidden"
              title="Ô Quan Phải (Ô 5)"
            >
              <span className="-translate-x-1.5 px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-500/50 text-[9.5px] sm:text-[11px] font-black text-amber-400 shadow-md tracking-wider">
                QUAN B
              </span>
              {renderStonesInPit(displayedBoard[5])}
              <div className="text-xs sm:text-sm font-black text-amber-400 font-mono bg-black/50 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                {displayedBoard[5].stones + (displayedBoard[5].hasQuanBigStone ? 10 : 0)}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Guide Footer */}
      <footer className="w-full max-w-5xl text-center text-[11px] text-slate-500 py-2 border-t border-slate-900">
        💡 Hướng dẫn: Chọn ô dân thuộc phía bạn có sỏi -&gt; Chọn hướng Trái hoặc Phải để rải sỏi. Trò chơi kết thúc khi 2 Quan bị ăn hết.
      </footer>

      {/* ---------------- POPUP XÁC NHẬN ĐẦU HÀNG (CUSTOM SURRENDER CONFIRMATION POPUP) ---------------- */}
      {showSurrenderConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-[#181816] border-2 border-[#2b2b26] rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-950/60 border border-rose-500/40 flex items-center justify-center mx-auto text-2xl">
              🏳️
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-extrabold text-white tracking-wide">Xác Nhận Đầu Hàng</h3>
              <p className="text-xs text-gray-400 leading-relaxed font-sans">
                Bạn có chắc chắn muốn đầu hàng cờ không?<br />(Đối thủ sẽ giành chiến thắng ngay lập tức)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowSurrenderConfirm(false)}
                className="w-full bg-[#2a2a26] hover:bg-[#383832] text-white py-3 rounded-xl font-bold text-xs border border-[#404038] transition active:scale-98"
              >
                Hủy Bỏ
              </button>

              <button
                onClick={confirmSurrender}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-md transition active:scale-98"
              >
                Đầu Hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL TỔNG KẾT TRẬN ĐẤU (MATCH SUMMARY RESULT MODAL) ---------------- */}
      {showResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm sm:max-w-md bg-[#181816] border-2 border-[#2b2b26] rounded-3xl p-6 shadow-2xl text-center space-y-5 relative overflow-hidden">
            
            {/* Title Section (Matching attached image) */}
            <div className="space-y-1.5">
              {gameState.winner === 2 ? (
                <h2 className="text-2xl sm:text-3xl font-black text-[#ffffff] tracking-wider flex items-center justify-center gap-2">
                  <span>💀</span> THẤT BẠI! <span>💀</span>
                </h2>
              ) : gameState.winner === 1 ? (
                <h2 className="text-2xl sm:text-3xl font-black text-[#F3E5AB] tracking-wider flex items-center justify-center gap-2">
                  <span>🎉</span> CHIẾN THẮNG! <span>🎉</span>
                </h2>
              ) : (
                <h2 className="text-2xl sm:text-3xl font-black text-cyan-300 tracking-wider flex items-center justify-center gap-2">
                  <span>🤝</span> HÒA CỜ! <span>🤝</span>
                </h2>
              )}

              <p className="text-[11px] text-[#777770] uppercase font-mono tracking-[0.25em] font-bold">
                TRẬN ĐẤU ĐÃ KHẾP LẠI
              </p>
            </div>

            {/* Rewards Box (Matching image) */}
            <div className="bg-[#121210] border border-[#262622] rounded-2xl p-4 space-y-3">
              <span className="block text-[11px] text-[#cccccc] uppercase font-extrabold tracking-widest border-b border-[#242420] pb-2">
                PHẦN THƯỞNG NHẬN ĐƯỢC
              </span>
              
              <div className="flex items-center justify-around font-mono">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-[#888880] uppercase font-bold">COIN THƯỞNG</span>
                  <span className="text-base sm:text-lg font-black text-[#f3e5ab] mt-1 flex items-center gap-1">
                    +{gameState.winner === 1 ? 20 : 0} 🥚
                  </span>
                </div>

                <div className="h-8 w-[1px] bg-[#262622]" />

                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-[#888880] uppercase font-bold">KINH NGHIỆM</span>
                  <span className="text-base sm:text-lg font-black text-[#f3e5ab] mt-1 flex items-center gap-1">
                    +{gameState.winner === 1 ? 350 : 120} 🎖️
                  </span>
                </div>
              </div>
            </div>

            {/* Scores summary sub-text */}
            <div className="text-[11px] text-[#999990] font-mono bg-[#141412] py-2 px-3 rounded-xl border border-[#242420] flex items-center justify-between">
              <span>Bạn: <b className="text-amber-400">{displayedP1Score}đ</b></span>
              <span>•</span>
              <span>Đối thủ: <b className="text-cyan-400">{displayedP2Score}đ</b></span>
            </div>

            {/* Action Buttons (Matching image) */}
            <div className="space-y-2.5 pt-1">
              <button
                onClick={() => setShowResultModal(false)}
                className="w-full bg-[#2a2a26] hover:bg-[#383832] text-white py-3 rounded-xl border border-[#404038] text-xs font-extrabold uppercase flex items-center justify-center gap-2 transition active:scale-98 shadow-md"
              >
                🔍 XEM LẠI BÀN CỜ
              </button>

              <button
                onClick={() => {
                  setShowResultModal(false);
                  handleResetGame();
                }}
                className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-md transition active:scale-98"
              >
                {gameMode === "BOT" ? "ĐẤU LẠI BOT" : "ĐẤU TRẬN MỚI"}
              </button>

              <button
                onClick={handleBackToLobby}
                className="w-full bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-md transition active:scale-98"
              >
                QUAY LẠI SẢNH
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
