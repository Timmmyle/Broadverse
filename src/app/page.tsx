"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import LoginScreen from "@/components/LoginScreen";
import Dashboard from "@/components/Dashboard";
import GameRoomView from "@/components/GameRoomView";
import { useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useAlert } from "@/components/providers/AlertProvider";

function HomeContent() {
  const { profile, loading } = useAuth();
  const { showAlert } = useAlert();
  const searchParams = useSearchParams();

  // Trạng thái màn hình hiện tại: "LOBBY" (Dashboard) hoặc "GAME" (Bàn cờ)
  const [screen, setScreen] = useState<"LOBBY" | "GAME">("LOBBY");
  const [gameConfig, setGameConfig] = useState<{
    gameType: "TIC_TAC_TOE" | "CARO" | "BATTLESHIP" | "BAU_CUA";
    mode: "BOT" | "FRIEND" | "RANDOM";
    details: any;
  } | null>(null);

  const [joiningRoom, setJoiningRoom] = useState(false);
  const [restoringMatch, setRestoringMatch] = useState(false);

  // 1. Kiểm tra tham số joinRoom trong URL để tự động vào phòng cờ của bạn bè
  useEffect(() => {
    if (loading || !profile) return;

    const roomId = searchParams.get("joinRoom");
    if (roomId && !joiningRoom) {
      setJoiningRoom(true);

      const joinFriendRoom = async () => {
        try {
          const res = await fetch("/api/match/join-friend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId }),
          });

          if (res.ok) {
            const room = await res.json();
            // Điều hướng thẳng vào phòng game
            setGameConfig({
              gameType: room.gameType as "TIC_TAC_TOE" | "CARO" | "BATTLESHIP" | "BAU_CUA",
              mode: "FRIEND",
              details: { roomId: room.id, isCreator: false },
            });
            setScreen("GAME");
            
            // Xóa query param khỏi URL
            const url = new URL(window.location.href);
            url.searchParams.delete("joinRoom");
            window.history.replaceState({}, "", url.toString());
          } else {
            const err = await res.json();
            showAlert(err.error || "Không thể tham gia phòng cờ của bạn bè!");
          }
        } catch (err) {
          console.error("Lỗi tham gia phòng:", err);
        } finally {
          setJoiningRoom(false);
        }
      };

      joinFriendRoom();
    }
  }, [profile, loading, searchParams]);

  // 2. Tự động phục hồi trận đấu đang diễn ra khi người dùng tải lại trang (F5)
  useEffect(() => {
    if (loading || !profile || searchParams.get("joinRoom")) return;

    const checkActiveMatch = async () => {
      setRestoringMatch(true);
      try {
        const res = await fetch("/api/match/active");
        if (res.ok) {
          const data = await res.json();
          if (data.room) {
            // Khôi phục phòng đấu đang PLAYING
            setGameConfig({
              gameType: data.room.gameType as "TIC_TAC_TOE" | "CARO" | "BATTLESHIP" | "BAU_CUA",
              mode: data.room.wager > 0 ? "FRIEND" : "RANDOM",
              details: { roomId: data.room.id },
            });
            setScreen("GAME");
          }
        }
      } catch (err) {
        console.error("Lỗi phục hồi trận:", err);
      } finally {
        setRestoringMatch(false);
      }
    };

    checkActiveMatch();
  }, [profile, loading, searchParams]);

  // 1. Tải phiên đăng nhập ban đầu: Hiển thị màn hình chờ Premium (Cyber Chicken theme)
  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0a0a0c] relative overflow-hidden select-none">
        {/* Neon grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1c1c18_1px,transparent_1px),linear-gradient(to_bottom,#1c1c18_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-5 pointer-events-none"></div>
        
        {/* Glow ambient */}
        <div className="absolute w-[250px] h-[250px] rounded-full bg-[#FF9F0A]/5 blur-[70px] pointer-events-none animate-pulse"></div>

        <div className="relative z-10 flex flex-col items-center space-y-6">
          {/* Mascot icon wrapper */}
          <div className="relative w-20 h-20 overflow-hidden bg-[#1C1C18] rounded-2xl flex items-center justify-center shadow-lg shadow-[#FF9F0A]/10 border border-[#D4AF37]/30 animate-bounce p-3">
            <img src="/logo.png" className="w-full h-full object-contain animate-pulse" alt="Vuiga logo" />

            {/* Spinning decorative frame */}
            <div className="absolute -inset-1.5 border border-dashed border-[#D4AF37]/20 rounded-2xl animate-[spin_8s_linear_infinite]"></div>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-lg font-extrabold uppercase tracking-widest text-white">
              Vuiga<span className="text-[#FF9F0A]">.com</span>
            </h2>
            <div className="flex items-center justify-center gap-1.5 text-[12px] text-[#FF9F0A] uppercase font-mono tracking-widest animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Đang vào phòng chờ...</span>
            </div>
          </div>

          {/* Micro loading bar */}
          <div className="w-40 h-1 bg-[#141412] border border-[#D4AF37]/15 rounded-full overflow-hidden relative">
            <div className="h-full bg-gradient-to-r from-[#D4AF37] to-[#FF9F0A] rounded-full absolute left-0 top-0 w-1/2 progress-bar-shimmer"></div>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes progressMove {
            0% { left: -100%; }
            100% { left: 100%; }
          }
          .progress-bar-shimmer {
            width: 60%;
            animation: progressMove 1.5s infinite ease-in-out;
          }
        `}} />
      </div>
    );
  }

  // Nếu chưa đăng nhập, hiển thị màn hình đăng nhập
  if (!profile) {
    return <LoginScreen />;
  }

  // Vào phòng game
  const handleSelectGame = (
    game: "TIC_TAC_TOE" | "CARO" | "BATTLESHIP" | "BAU_CUA",
    mode: "BOT" | "FRIEND" | "RANDOM",
    details: any
  ) => {
    setGameConfig({ gameType: game, mode, details });
    setScreen("GAME");
  };

  // Quay lại sảnh chính
  const handleBackToLobby = () => {
    localStorage.setItem("game_played", "true");
    setScreen("LOBBY");
    setGameConfig(null);
  };


  return (
    <>
      {screen === "LOBBY" ? (
        <Dashboard onSelectGame={handleSelectGame} />
      ) : (
        gameConfig && (
          <GameRoomView
            gameType={gameConfig.gameType}
            mode={gameConfig.mode}
            details={gameConfig.details}
            onBack={handleBackToLobby}
          />
        )
      )}

    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0a0a0c] scanlines">
        <RefreshCw className="w-10 h-10 text-pixel-yellow animate-spin" />
        <h2 className="text-xs text-pixel-yellow uppercase mt-4 tracking-widest animate-pulse">
          BOOTING UP...
        </h2>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
