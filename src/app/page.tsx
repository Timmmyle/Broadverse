"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import LoginScreen from "@/components/LoginScreen";
import Dashboard from "@/components/Dashboard";
import GameRoomView from "@/components/GameRoomView";
import { useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";

function HomeContent() {
  const { profile, loading } = useAuth();
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
            alert(err.error || "Không thể tham gia phòng cờ của bạn bè!");
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

  // 1. Tải phiên đăng nhập ban đầu: Chỉ hiện màn hình tối trống 
  // giúp tạo cảm giác web được load ngay lập tức mà không có độ trễ spinner thô ráp.
  if (loading) {
    return <div className="min-h-screen bg-[#0c0c0e]"></div>;
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
