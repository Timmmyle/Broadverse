"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "./providers/AuthProvider";
import { SHOP_ITEMS, ShopItem, getShopItem } from "@/lib/shopItems";
import { createClient } from "@/lib/supabase/client";
import { 
  Coins, Trophy, LogOut, ShoppingBag, Settings, Play, 
  User as UserIcon, X, Swords, RefreshCw, Sparkles, Check, ChevronRight,
  CreditCard
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface DashboardProps {
  onSelectGame: (game: "TIC_TAC_TOE" | "CARO" | "BATTLESHIP", mode: "BOT" | "FRIEND" | "RANDOM", details: any) => void;
}

export default function Dashboard({ onSelectGame }: DashboardProps) {
  const { profile, signOutUser, refreshProfile } = useAuth();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"PLAY" | "SHOP" | "SETTINGS">("PLAY");
  
  // State tìm kiếm trận ngẫu nhiên
  const [matchmaking, setMatchmaking] = useState<{
    active: boolean;
    gameType: "TIC_TAC_TOE" | "CARO" | "BATTLESHIP";
    wager: number;
  } | null>(null);

  // Settings & Account Upgrade state
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [upgradePassword, setUpgradePassword] = useState("");
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeSuccessMsg, setUpgradeSuccessMsg] = useState("");

  // Premium Membership state
  const [buyingPremium, setBuyingPremium] = useState(false);
  const [premiumError, setPremiumError] = useState("");
  const [premiumSuccess, setPremiumSuccess] = useState(false);

  // Premium Cash Purchase states (VietQR)
  const [showQRPaymentModal, setShowQRPaymentModal] = useState(false);
  const [cashPaying, setCashPaying] = useState(false);
  const [cashError, setCashError] = useState("");

  // Game Options
  const [selectedGame, setSelectedGame] = useState<"TIC_TAC_TOE" | "CARO" | "BATTLESHIP">("TIC_TAC_TOE");
  const [selectedMode, setSelectedMode] = useState<"BOT" | "FRIEND" | "RANDOM">("BOT");
  const [botDifficulty, setBotDifficulty] = useState<"RANDOM" | "EASY" | "HARD">("EASY");
  const [matchWager, setMatchWager] = useState<number>(0);

  // Friend lobby state
  const [creatingFriendLobby, setCreatingFriendLobby] = useState(false);

  // Lưu trữ theme bàn cờ được chọn ở client
  const [equippedThemeId, setEquippedThemeId] = useState("theme_classic");

  // Bảng xếp hạng
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const res = await fetch("/api/leaderboard");
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error("Lỗi lấy bảng xếp hạng:", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setEquippedThemeId(localStorage.getItem("board_theme") || "theme_classic");
    }

    const handleThemeChange = () => {
      setEquippedThemeId(localStorage.getItem("board_theme") || "theme_classic");
    };

    window.addEventListener("theme_changed", handleThemeChange);
    
    // Nạp bảng xếp hạng lần đầu
    fetchLeaderboard();

    return () => {
      window.removeEventListener("theme_changed", handleThemeChange);
    };
  }, []);

  useEffect(() => {
    if (profile) {
      setNewUsername(profile.username);
    }
  }, [profile]);

  useEffect(() => {
    if (showQRPaymentModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showQRPaymentModal]);

  if (!profile) return null;

  // Lấy các item đang trang bị
  const frameItem = SHOP_ITEMS.find((i) => i.id === profile.avatarFrame);
  const symbolXItem = SHOP_ITEMS.find((i) => i.id === profile.selectedSymbolX);
  const symbolOItem = SHOP_ITEMS.find((i) => i.id === profile.selectedSymbolO);

  // Phép tính kinh nghiệm cần để lên cấp
  const expNeeded = 100 + profile.level * 5;
  const expPercent = Math.min(100, Math.floor((profile.exp / expNeeded) * 100));

  // 1. Lưu Username mới
  const handleSaveUsername = async () => {
    if (!newUsername.trim() || newUsername.trim() === profile.username) {
      setEditingUsername(false);
      return;
    }
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername }),
      });
      if (res.ok) {
        await refreshProfile();
        setEditingUsername(false);
      } else {
        alert(await res.text());
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 2. Nâng cấp tài khoản khách -> tài khoản email chính thức
  const handleUpgradeAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upgradeEmail || !upgradePassword) return;
    setUpgradeLoading(true);
    setUpgradeSuccessMsg("");

    try {
      // Supabase nâng cấp user ẩn danh thành vĩnh viễn bằng cách gọi updateUser
      const { data, error } = await supabase.auth.updateUser({
        email: upgradeEmail,
        password: upgradePassword,
      });

      if (error) throw error;

      // Cập nhật isGuest thành false ở Prisma
      const syncRes = await fetch("/api/user/sync", { method: "POST" });
      if (syncRes.ok) {
        await refreshProfile();
        setUpgradeSuccessMsg("Nâng cấp tài khoản thành công! Dữ liệu của bạn đã được bảo vệ.");
        setUpgradeEmail("");
        setUpgradePassword("");
      }
    } catch (err: any) {
      alert("Lỗi nâng cấp: " + (err.message || "Thử lại sau"));
    } finally {
      setUpgradeLoading(false);
    }
  };

  // 3. Mua vật phẩm trong Shop
  const handleBuyItem = async (itemId: string) => {
    try {
      const res = await fetch("/api/user/shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (res.ok) {
        await refreshProfile();
      } else {
        const err = await res.json();
        alert(err.error || "Mua hàng thất bại!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 4. Trang bị vật phẩm đã mua
  const handleEquipItem = async (itemId: string, slot?: "X" | "O") => {
    try {
      const res = await fetch("/api/user/shop/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, slot }),
      });
      if (res.ok) {
        await refreshProfile();
      } else {
        const err = await res.json();
        alert(err.error || "Trang bị thất bại!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 5. Bắt đầu ghép trận ngẫu nhiên (Matchmaking)
  const handleStartMatchmaking = async () => {
    if (profile.coins < matchWager) {
      alert("Bạn không đủ Coin cược để tham gia hàng chờ này!");
      return;
    }

    setMatchmaking({
      active: true,
      gameType: selectedGame,
      wager: matchWager,
    });

    try {
      const res = await fetch("/api/matchmaking/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: selectedGame, wager: matchWager }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.matched) {
          // Ghép trận thành công -> Chuyển vào màn game
          setMatchmaking(null);
          onSelectGame(selectedGame, "RANDOM", { roomId: data.room.id });
        } else if (data.retry) {
          // Thử lại nếu có xung đột đối thủ
          setTimeout(handleStartMatchmaking, 1000);
        } else {
          // Đang đợi đối thủ -> Đăng ký lắng nghe Supabase Realtime
          const channel = supabase
            .channel(`matchmaking_${profile.id}`)
            .on(
              "postgres_changes",
              {
                event: "INSERT",
                schema: "public",
                table: "GameRoom",
              },
              (payload: any) => {
                const room = payload.new;
                if (room.status === "PLAYING" && (room.playerXId === profile.id || room.playerOId === profile.id)) {
                  // Đã được ghép trận!
                  supabase.removeChannel(channel);
                  setMatchmaking(null);
                  onSelectGame(selectedGame, "RANDOM", { roomId: room.id });
                }
              }
            )
            .subscribe();

          // Lưu channel để hủy khi thoát
          (window as any).matchmakingChannel = channel;
        }
      } else {
        const err = await res.json();
        alert(err.error || "Ghép trận thất bại!");
        setMatchmaking(null);
      }
    } catch (err) {
      console.error(err);
      setMatchmaking(null);
    }
  };

  // Hủy ghép trận
  const handleCancelMatchmaking = async () => {
    setMatchmaking(null);
    if ((window as any).matchmakingChannel) {
      supabase.removeChannel((window as any).matchmakingChannel);
    }
    try {
      await fetch("/api/matchmaking/leave", { method: "POST" });
    } catch (err) {
      console.error(err);
    }
  };

  // 6. Tạo phòng đấu với Bạn bè
  const handleCreateFriendRoom = async () => {
    if (profile.coins < matchWager) {
      alert("Bạn không đủ Coin cược để tạo phòng này!");
      return;
    }

    setCreatingFriendLobby(true);
    try {
      const res = await fetch("/api/match/create-friend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: selectedGame, wager: matchWager }),
      });

      if (res.ok) {
        const data = await res.json();
        // Chuyển tới sảnh cờ đợi bạn bè
        onSelectGame(selectedGame, "FRIEND", { roomId: data.id, isCreator: true });
      } else {
        const err = await res.json();
        alert(err.error || "Tạo phòng cờ thất bại!");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingFriendLobby(false);
    }
  };

  // 7. Vào game với Bot
  const handlePlayBot = () => {
    onSelectGame(selectedGame, "BOT", { difficulty: botDifficulty });
  };

  // 8. Kích hoạt tài khoản Premium (ẩn QC)
  const handleBuyPremium = async () => {
    setBuyingPremium(true);
    setPremiumError("");
    try {
      const res = await fetch("/api/user/premium", {
        method: "POST",
      });
      if (res.ok) {
        setPremiumSuccess(true);
        await refreshProfile();
        fetchLeaderboard();
      } else {
        const err = await res.json();
        setPremiumError(err.error || "Giao dịch Premium thất bại!");
      }
    } catch (err) {
      console.error(err);
      setPremiumError("Lỗi kết nối khi mua Premium!");
    } finally {
      setBuyingPremium(false);
    }
  };

  // 9. Xác nhận thanh toán tiền thật qua QR (mô phỏng)
  const handleConfirmCashPayment = async () => {
    setCashPaying(true);
    setCashError("");
    try {
      const res = await fetch("/api/user/premium-cash", {
        method: "POST",
      });
      if (res.ok) {
        setPremiumSuccess(true);
        setShowQRPaymentModal(false);
        await refreshProfile();
        fetchLeaderboard();
      } else {
        const err = await res.json();
        setCashError(err.error || "Xác thực chuyển khoản thất bại!");
      }
    } catch (err) {
      console.error(err);
      setCashError("Lỗi kết nối máy chủ khi xác thực thanh toán!");
    } finally {
      setCashPaying(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#0f0f13] select-none text-white pb-10">
      
      {/* Header Dashboard */}
      <header className="w-full bg-[#16161c]/90 backdrop-blur-md border-b border-white/10 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* User Card (Modern Frame) */}
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 bg-pixel-gray-light border-2 border-white/10 rounded-2xl relative flex items-center justify-center ${frameItem?.visuals?.className || ""}`}>
            <UserIcon className="w-6 h-6 text-pixel-blue" />
            {profile.isGuest && (
              <span className="absolute -bottom-2 -right-2 bg-pixel-red text-white text-[8px] px-2 py-0.5 rounded-full border border-white/10 font-bold uppercase">
                Guest
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              {editingUsername ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="pixel-input py-1 px-2 text-[10px] w-32"
                    maxLength={15}
                  />
                  <button onClick={handleSaveUsername} className="pixel-btn pixel-btn-yellow py-1 px-2 text-[8px]">
                    Lưu
                  </button>
                  <button onClick={() => setEditingUsername(false)} className="pixel-btn pixel-btn-red py-1 px-2 text-[8px]">
                    Hủy
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-bold text-pixel-yellow uppercase tracking-wide">{profile.username}</span>
                  {profile.isPremium && (
                    <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-[7px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5 border border-yellow-300 scale-90 origin-left">
                      👑 PREMIUM
                    </span>
                  )}
                  <button onClick={() => setEditingUsername(true)} className="text-[8px] text-gray-500 hover:text-white uppercase">
                    [Đổi tên]
                  </button>
                </>
              )}
            </div>
            
            {/* Level & EXP Progress Bar */}
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[9px] text-pixel-blue uppercase">Lv.{profile.level}</span>
              <div className="w-32 md:w-44 h-4 bg-black/45 border border-white/10 rounded-full relative overflow-hidden flex items-center justify-center">
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-pixel-blue rounded-full transition-all duration-300"
                  style={{ width: `${expPercent}%` }}
                ></div>
                <span className="absolute z-10 text-[7px] text-white font-mono">
                  {profile.exp}/{expNeeded} EXP
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Currency & Actions */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 bg-black/40 border border-white/10 rounded-2xl p-2 pr-4">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-pixel-yellow fill-pixel-yellow" />
              <div className="text-right">
                <span className="block text-[8px] text-gray-400 uppercase">Số dư</span>
                <span className="text-xs text-pixel-yellow font-bold">{profile.coins} <span className="text-[8px] text-gray-400">Coin</span></span>
              </div>
            </div>
            {!profile.isPremium && (
              <button 
                onClick={() => setActiveTab("SETTINGS")}
                className="pixel-btn pixel-btn-yellow text-[8px] py-1.5 px-3 uppercase tracking-wider animate-pulse flex items-center gap-1 shrink-0"
              >
                👑 Premium
              </button>
            )}
          </div>

          <button onClick={signOutUser} className="pixel-btn pixel-btn-red py-2 px-3 text-[9px] flex items-center gap-2">
            <LogOut className="w-3 h-3" />
            Thoát
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-5xl w-full mx-auto px-4 mt-8 flex flex-col md:flex-row gap-6">
        
        {/* Navigation Tabs (Pixel Style Menu) */}
        <div className="w-full md:w-48 flex md:flex-col gap-2 shrink-0">
          <button 
            onClick={() => setActiveTab("PLAY")}
            className={`flex-grow md:flex-grow-0 pixel-btn justify-start py-3 px-4 uppercase text-[10px] gap-3 ${activeTab === "PLAY" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
          >
            <Swords className="w-4 h-4" />
            Vào trận
          </button>
          <button 
            onClick={() => setActiveTab("SHOP")}
            className={`flex-grow md:flex-grow-0 pixel-btn justify-start py-3 px-4 uppercase text-[10px] gap-3 ${activeTab === "SHOP" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
          >
            <ShoppingBag className="w-4 h-4" />
            Cửa hàng
          </button>
          <button 
            onClick={() => setActiveTab("SETTINGS")}
            className={`flex-grow md:flex-grow-0 pixel-btn justify-start py-3 px-4 uppercase text-[10px] gap-3 ${activeTab === "SETTINGS" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
          >
            <Settings className="w-4 h-4" />
            Tài khoản
          </button>

          {/* VERTICAL ADS BANNER (Only on desktop and if NOT premium) */}
          {!profile.isPremium && (
            <div className="hidden md:flex flex-col bg-[#111116] border border-white/5 rounded-2xl p-3 text-center relative overflow-hidden group mt-3">
              <span className="absolute top-0.5 left-2 text-[4.5px] text-gray-500 uppercase font-mono">Sponsored Ad</span>
              <div className="pt-2 pb-1">
                <span className="text-[8px] text-pixel-blue font-bold uppercase tracking-wider block mb-1">ĐẶC QUYỀN VIP SHOP</span>
                <p className="text-[6.5px] text-gray-400 leading-normal">Nhận ngay ưu đãi <span className="text-pixel-green font-bold">-20% giá mua</span> cho mọi vật phẩm trong cửa hàng!</p>
                <button
                  onClick={() => setActiveTab("SETTINGS")}
                  className="pixel-btn pixel-btn-blue text-[6.5px] py-1.5 px-3 mt-3 w-full uppercase font-bold justify-center"
                >
                  Mua Premium 👑
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tab Content Panel */}
        <div className="flex-grow pixel-box bg-[#16161c] p-6 min-h-[400px]">
          
          {/* TAB 1: PLAY GAME (ĐẤU TRƯỜNG) */}
          {activeTab === "PLAY" && (
            <div className="space-y-6">
              
              {/* Ghép trận ngẫu nhiên đang chạy */}
              {matchmaking?.active ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-6">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <RefreshCw className="w-10 h-10 text-pixel-yellow animate-spin" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-xs text-pixel-yellow uppercase tracking-widest animate-pulse">
                      Đang tìm đối thủ...
                    </h3>
                    <p className="text-[9px] text-gray-400 mt-2 uppercase">
                      Game: {matchmaking.gameType} | Cược: {matchmaking.wager} Coin
                    </p>
                  </div>
                  <button onClick={handleCancelMatchmaking} className="pixel-btn pixel-btn-red py-2 px-6 uppercase text-[9px]">
                    Hủy tìm trận
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* PHẦN TRÊN: SẢNH ĐẤU GAME */}
                  <div className="space-y-6">
                    <h2 className="text-xs text-pixel-yellow uppercase border-b border-black pb-2 mb-4 tracking-wider">
                      Sảnh Đấu Game
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Game Selection */}
                      <div className="pixel-box-nested p-4">
                        <span className="block text-[8px] text-gray-400 uppercase mb-2">1. Chọn trò chơi:</span>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => setSelectedGame("TIC_TAC_TOE")}
                            className={`pixel-btn text-[10px] py-2 ${selectedGame === "TIC_TAC_TOE" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                          >
                            Tic-Tac-Toe
                          </button>
                          <button
                            onClick={() => setSelectedGame("CARO")}
                            className={`pixel-btn text-[10px] py-2 ${selectedGame === "CARO" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                          >
                            Caro 12x12
                          </button>
                          <button
                            onClick={() => setSelectedGame("BATTLESHIP")}
                            className={`pixel-btn text-[10px] py-2 ${selectedGame === "BATTLESHIP" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                          >
                            Tàu chiến
                          </button>
                        </div>
                      </div>

                      {/* Mode Selection */}
                      <div className="pixel-box-nested p-4">
                        <span className="block text-[8px] text-gray-400 uppercase mb-2">2. Chế độ đấu:</span>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => setSelectedMode("BOT")}
                            className={`pixel-btn justify-start text-[10px] py-2 ${selectedMode === "BOT" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                          >
                            <ChevronRight className="w-3 h-3 mr-2" /> Đấu với Bot (Offline)
                          </button>
                          <button
                            onClick={() => setSelectedMode("FRIEND")}
                            className={`pixel-btn justify-start text-[10px] py-2 ${selectedMode === "FRIEND" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                          >
                            <ChevronRight className="w-3 h-3 mr-2" /> Đấu với bạn bè (Mã phòng)
                          </button>
                          <button
                            onClick={() => setSelectedMode("RANDOM")}
                            className={`pixel-btn justify-start text-[10px] py-2 ${selectedMode === "RANDOM" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                          >
                            <ChevronRight className="w-3 h-3 mr-2" /> Ghép ngẫu nhiên (Online)
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Mode Details config */}
                    <div className="pixel-box-nested p-4">
                      {selectedMode === "BOT" && (
                        <div>
                          <span className="block text-[8px] text-gray-400 uppercase mb-2">Độ khó của Bot:</span>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => setBotDifficulty("RANDOM")}
                              className={`pixel-btn text-[9px] py-2 ${botDifficulty === "RANDOM" ? "pixel-btn-blue" : "pixel-btn-gray"}`}
                            >
                              Ngẫu nhiên
                            </button>
                            <button
                              onClick={() => setBotDifficulty("EASY")}
                              className={`pixel-btn text-[9px] py-2 ${botDifficulty === "EASY" ? "pixel-btn-blue" : "pixel-btn-gray"}`}
                            >
                              Dễ (Chặn)
                            </button>
                            {(selectedGame === "TIC_TAC_TOE" || selectedGame === "BATTLESHIP") && (
                              <button
                                onClick={() => setBotDifficulty("HARD")}
                                className={`pixel-btn text-[9px] py-2 ${botDifficulty === "HARD" ? "pixel-btn-blue" : "pixel-btn-gray"}`}
                              >
                                {selectedGame === "BATTLESHIP" ? "Khó (Săn Lùng)" : "Khó (Minimax)"}
                              </button>
                            )}
                          </div>
                          <button 
                            onClick={handlePlayBot}
                            className="w-full pixel-btn pixel-btn-yellow py-3 mt-4 text-xs uppercase font-bold gap-2"
                          >
                            <Play className="w-4 h-4 fill-black" /> Bắt đầu chơi
                          </button>
                        </div>
                      )}

                      {selectedMode === "FRIEND" && (
                        <div>
                          <span className="block text-[8px] text-gray-400 uppercase mb-2">Đặt mức cược trận đấu (Coin):</span>
                          <div className="grid grid-cols-4 gap-2 mb-4">
                            {[0, 10, 50, 100].map((c) => (
                              <button
                                key={c}
                                onClick={() => setMatchWager(c)}
                                className={`pixel-btn text-[10px] py-2 ${matchWager === c ? "pixel-btn-blue" : "pixel-btn-gray"}`}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={handleCreateFriendRoom}
                            disabled={creatingFriendLobby}
                            className="w-full pixel-btn pixel-btn-yellow py-3 text-xs uppercase font-bold gap-2"
                          >
                            <Swords className="w-4 h-4" />
                            {creatingFriendLobby ? "Đang tạo phòng..." : "Tạo phòng & nhận link mời"}
                          </button>
                        </div>
                      )}

                      {selectedMode === "RANDOM" && (
                        <div>
                          <span className="block text-[8px] text-gray-400 uppercase mb-2">Chọn cược đấu hạng (Coin):</span>
                          <div className="grid grid-cols-4 gap-2 mb-4">
                            {[0, 10, 50, 100].map((c) => (
                              <button
                                key={c}
                                onClick={() => setMatchWager(c)}
                                className={`pixel-btn text-[10px] py-2 ${matchWager === c ? "pixel-btn-blue" : "pixel-btn-gray"}`}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={handleStartMatchmaking}
                            className="w-full pixel-btn pixel-btn-yellow py-3 text-xs uppercase font-bold gap-2"
                          >
                            <Swords className="w-4 h-4" />
                            Tìm trận ngay
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PHẦN DƯỚI: BẢNG XẾP HẠNG */}
                  <div className="border-t border-white/5 pt-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-black pb-2">
                      <h3 className="text-xs text-pixel-yellow uppercase tracking-wider flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-pixel-yellow fill-pixel-yellow" />
                        Bảng Xếp Hạng Cao Thủ
                      </h3>
                      <button 
                        onClick={fetchLeaderboard}
                        className={`text-gray-400 hover:text-white p-1 rounded transition-colors ${loadingLeaderboard ? "animate-spin" : ""}`}
                        disabled={loadingLeaderboard}
                        title="Tải lại"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    </div>

                    {loadingLeaderboard ? (
                      <div className="flex flex-col items-center justify-center py-10 space-y-2">
                        <RefreshCw className="w-6 h-6 text-pixel-blue animate-spin" />
                        <span className="text-[7px] text-gray-500 uppercase tracking-widest">Đang tải xếp hạng...</span>
                      </div>
                    ) : leaderboard.length === 0 ? (
                      <div className="text-center py-10 text-[8px] text-gray-500 uppercase">Chưa có người chơi</div>
                    ) : (
                      <div className="space-y-6">
                        {/* 1. BỤC VINH QUANG TOP 3 (PODIUM) */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end max-w-xl mx-auto pt-4 px-2">
                          
                          {/* TOP 2 (BÊN TRÁI) */}
                          <div className="flex flex-col items-center">
                            {leaderboard[1] ? (
                              <>
                                <div className="text-center mb-2 space-y-0.5">
                                  <div className={`w-10 h-10 bg-pixel-gray-light border border-white/10 rounded-xl relative flex items-center justify-center mx-auto ${
                                    SHOP_ITEMS.find((i) => i.id === leaderboard[1].avatarFrame)?.visuals?.className || ""
                                  }`}>
                                    <UserIcon className="w-4 h-4 text-pixel-blue" />
                                  </div>
                                  <span className="block text-[8px] sm:text-[9px] truncate max-w-[80px] font-bold text-gray-300 uppercase tracking-wide flex items-center justify-center gap-0.5">
                                    {leaderboard[1].username}
                                    {leaderboard[1].isPremium && <span title="Premium">👑</span>}
                                  </span>
                                  <span className="block text-[7px] text-pixel-blue font-mono font-bold">Lv.{leaderboard[1].level}</span>
                                </div>
                                <div className="w-full bg-gradient-to-t from-gray-500/10 to-gray-500/30 border-t border-x border-gray-400/20 rounded-t-xl flex flex-col items-center justify-center h-20 shadow-md">
                                  <span className="text-sm font-bold text-gray-300">🥈</span>
                                  <span className="text-[7px] text-gray-400 font-mono mt-0.5">{leaderboard[1].coins} C</span>
                                </div>
                              </>
                            ) : (
                              <div className="h-20 w-full"></div>
                            )}
                          </div>

                          {/* TOP 1 (Ở GIỮA) */}
                          <div className="flex flex-col items-center">
                            {leaderboard[0] ? (
                              <>
                                <div className="text-center mb-2 space-y-0.5 relative z-10">
                                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs animate-bounce">👑</span>
                                  <div className={`w-12 h-12 bg-pixel-gray-light border-2 border-yellow-500/30 rounded-xl relative flex items-center justify-center mx-auto shadow-md shadow-yellow-500/10 ${
                                    SHOP_ITEMS.find((i) => i.id === leaderboard[0].avatarFrame)?.visuals?.className || ""
                                  }`}>
                                    <UserIcon className="w-5 h-5 text-pixel-yellow" />
                                  </div>
                                  <span className="block text-[9px] sm:text-[10px] truncate max-w-[90px] font-bold text-pixel-yellow uppercase tracking-wide flex items-center justify-center gap-0.5">
                                    {leaderboard[0].username}
                                    {leaderboard[0].isPremium && <span title="Premium">👑</span>}
                                  </span>
                                  <span className="block text-[7px] text-yellow-400 font-mono font-bold">Lv.{leaderboard[0].level}</span>
                                </div>
                                <div className="w-full bg-gradient-to-t from-yellow-500/10 to-yellow-500/30 border-t border-x border-yellow-400/20 rounded-t-xl flex flex-col items-center justify-center h-28 shadow-lg shadow-yellow-500/5 relative">
                                  <span className="text-base font-bold text-yellow-400">🏆</span>
                                  <span className="text-[7px] text-yellow-300 font-mono mt-0.5">{leaderboard[0].coins} C</span>
                                </div>
                              </>
                            ) : (
                              <div className="h-28 w-full"></div>
                            )}
                          </div>

                          {/* TOP 3 (BÊN PHẢI) */}
                          <div className="flex flex-col items-center">
                            {leaderboard[2] ? (
                              <>
                                <div className="text-center mb-2 space-y-0.5">
                                  <div className={`w-10 h-10 bg-pixel-gray-light border border-white/10 rounded-xl relative flex items-center justify-center mx-auto ${
                                    SHOP_ITEMS.find((i) => i.id === leaderboard[2].avatarFrame)?.visuals?.className || ""
                                  }`}>
                                    <UserIcon className="w-4 h-4 text-pixel-blue" />
                                  </div>
                                  <span className="block text-[8px] sm:text-[9px] truncate max-w-[80px] font-bold text-amber-500 uppercase tracking-wide flex items-center justify-center gap-0.5">
                                    {leaderboard[2].username}
                                    {leaderboard[2].isPremium && <span title="Premium">👑</span>}
                                  </span>
                                  <span className="block text-[7px] text-pixel-blue font-mono font-bold">Lv.{leaderboard[2].level}</span>
                                </div>
                                <div className="w-full bg-gradient-to-t from-amber-700/10 to-amber-700/30 border-t border-x border-amber-600/20 rounded-t-xl flex flex-col items-center justify-center h-14 shadow-md">
                                  <span className="text-sm font-bold text-amber-600">🥉</span>
                                  <span className="text-[7px] text-amber-400 font-mono mt-0.5">{leaderboard[2].coins} C</span>
                                </div>
                              </>
                            ) : (
                              <div className="h-14 w-full"></div>
                            )}
                          </div>

                        </div>

                        {/* 2. DANH SÁCH CÒN LẠI (TOP 4 - 10) */}
                        {leaderboard.length > 3 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1 border-t border-white/5 pt-4">
                            {leaderboard.slice(3).map((player, index) => {
                              const rank = index + 4;
                              const isMe = player.id === profile.id;
                              const playerFrame = SHOP_ITEMS.find((i) => i.id === player.avatarFrame);

                              return (
                                <div 
                                  key={player.id} 
                                  className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                                    isMe 
                                      ? "bg-pixel-yellow/10 border border-pixel-yellow/20" 
                                      : "bg-black/30 border border-white/5 hover:bg-black/45"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-[10px] w-5 text-center text-gray-400 font-bold">{rank}</span>
                                    <div className={`w-8 h-8 bg-pixel-gray-light border border-white/10 rounded-lg relative flex items-center justify-center shrink-0 ${playerFrame?.visuals?.className || ""}`}>
                                      <UserIcon className="w-4 h-4 text-pixel-blue" />
                                    </div>
                                    <div className="overflow-hidden">
                                      <span className={`block text-[10px] truncate max-w-[120px] uppercase font-bold tracking-wide ${isMe ? "text-pixel-yellow" : "text-white"} flex items-center gap-1`}>
                                        {player.username}
                                        {player.isPremium && <span title="Premium">👑</span>}
                                      </span>
                                      {player.isGuest && (
                                        <span className="inline-block text-[6px] text-pixel-red border border-pixel-red/20 rounded px-1 scale-90 origin-left">Guest</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-4 text-right">
                                    <div>
                                      <span className="block text-[7px] text-gray-500 font-mono">Cấp độ</span>
                                      <span className="text-[10px] text-pixel-blue font-bold">Lv.{player.level}</span>
                                    </div>
                                    <div className="min-w-[50px]">
                                      <span className="block text-[7px] text-gray-500 font-mono">Coin</span>
                                      <span className="text-[10px] text-pixel-yellow font-bold flex items-center justify-end gap-0.5">
                                        {player.coins} <Coins className="w-3 h-3 text-pixel-yellow fill-pixel-yellow" />
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ADS BANNER PLACEHOLDER (Only show if NOT premium) */}
                  {!profile.isPremium && (
                    <div className="w-full bg-[#111116] border border-red-500/10 rounded-2xl p-4 mt-6 text-center relative overflow-hidden group">
                      <span className="absolute top-1 left-2 text-[5px] text-gray-500 uppercase tracking-widest">Sponsored Ad</span>
                      <button 
                        onClick={() => setActiveTab("SETTINGS")}
                        className="absolute top-1 right-2 text-[6.5px] text-pixel-yellow hover:underline uppercase"
                      >
                        Tắt QC với Premium
                      </button>
                      
                      <div className="flex flex-col md:flex-row items-center gap-4 pt-2">
                        {/* Mock Ad Image using highly stylized CSS/SVG (crisp pixel look) */}
                        <div className="w-full md:w-36 h-20 bg-gradient-to-br from-indigo-950 to-purple-950 border border-white/10 rounded-lg relative flex items-center justify-center overflow-hidden shrink-0">
                          {/* Retro game console grid */}
                          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%]"></div>
                          {/* Pixel Art keyboard console drawing */}
                          <svg className="w-10 h-10 text-pixel-yellow drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="2" y="6" width="20" height="12" rx="2" fill="rgba(0,0,0,0.4)" stroke="currentColor" />
                            <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M10 14h8" strokeLinecap="round" />
                          </svg>
                          <span className="absolute bottom-1 text-[7px] text-pixel-yellow font-bold uppercase tracking-wider animate-pulse">BOARDVERSE GEAR</span>
                        </div>

                        <div className="text-left flex-grow">
                          <h4 className="text-[10px] text-pixel-yellow uppercase font-bold tracking-wide">BÀN PHÍM CƠ CHUYÊN GAME BOARDVERSE</h4>
                          <p className="text-[8px] text-gray-400 mt-1 leading-relaxed">
                            Bàn phím cơ Pixel-Art độc quyền phiên bản giới hạn! Switch quang học phản hồi siêu tốc 0.1ms, hành trình ngắn giúp đi cờ nhanh chóng.
                          </p>
                        </div>
                        <a 
                          href="https://github.com/google-deepmind" 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pixel-btn pixel-btn-yellow py-1.5 px-4 text-[8px] uppercase font-bold whitespace-nowrap shrink-0 scale-90 md:scale-100 group-hover:scale-105 transition-all"
                        >
                          Mua ngay
                        </a>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

          {/* TAB 2: SHOP COSMETICS (CỬA HÀNG) */}
          {activeTab === "SHOP" && (
            <div>
              <h2 className="text-xs text-pixel-yellow uppercase border-b border-black pb-2 mb-4 tracking-wider flex justify-between items-center">
                <span>Cửa hàng trang trí</span>
                <span className="text-[10px] text-gray-400 lowercase font-normal flex items-center gap-1">
                  Số dư: <span className="text-pixel-yellow font-bold">{profile.coins}</span> <Coins className="w-3 h-3 text-pixel-yellow fill-pixel-yellow inline" />
                </span>
              </h2>

              <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
                {/* 1. SYMBOLS */}
                <div>
                  <h3 className="text-[10px] text-pixel-blue uppercase mb-3 tracking-wide">== Quân cờ độc quyền ==</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {SHOP_ITEMS.filter(i => i.type === "SYMBOL").map(item => {
                      const owned = profile.purchasedItems.includes(item.id);
                      const isEquippedX = profile.selectedSymbolX === item.id;
                      const isEquippedO = profile.selectedSymbolO === item.id;
                      
                      return (
                        <div key={item.id} className="pixel-box-nested p-3 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-bold text-white flex items-center gap-1">
                                {item.name}
                                {item.isPremiumOnly && (
                                  <span className="text-[6px] bg-amber-500/20 border border-amber-500/30 px-1 rounded text-amber-500 font-bold uppercase tracking-wider">👑 VIP</span>
                                )}
                              </span>
                              {!owned && (
                                <div className="text-right flex flex-col items-end">
                                  {profile.isPremium ? (
                                    <div className="flex flex-col items-end">
                                      <span className="text-[7.5px] text-gray-500 line-through flex items-center gap-0.5">
                                        {item.price} <Coins className="w-2.5 h-2.5 text-gray-500 fill-gray-500" />
                                      </span>
                                      <span className="text-[9.5px] text-pixel-green flex items-center gap-0.5 font-bold animate-pulse">
                                        {Math.floor(item.price * 0.8)} <Coins className="w-2.5 h-2.5 text-pixel-green fill-pixel-green" />
                                        <span className="text-[6px] bg-pixel-green/20 border border-pixel-green/30 px-1 rounded text-pixel-green uppercase font-mono tracking-wider ml-1">VIP -20%</span>
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-end">
                                      <span className="text-[9.5px] text-pixel-yellow flex items-center gap-0.5 font-bold">
                                        {item.price} <Coins className="w-2.5 h-2.5 text-pixel-yellow fill-pixel-yellow" />
                                      </span>
                                      <span 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveTab("SETTINGS");
                                        }}
                                        className="text-[6px] text-pixel-blue hover:underline cursor-pointer uppercase font-mono mt-0.5 tracking-wider bg-pixel-blue/15 border border-pixel-blue/20 px-1 rounded hover:bg-pixel-blue/25"
                                      >
                                        -20% với Premium
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <p className="text-[8px] text-gray-400 mt-1">{item.description}</p>
                            <div className="bg-black/60 border border-black p-2 mt-2 text-center text-xs">
                              Quân: <span className="text-pixel-yellow font-bold">{item.visuals.symbolX}</span> vs <span className="text-pixel-blue font-bold">{item.visuals.symbolO}</span>
                            </div>
                          </div>

                          <div className="mt-3 flex gap-2">
                            {owned ? (
                              <>
                                <button
                                  onClick={() => handleEquipItem(item.id, "X")}
                                  className={`flex-grow pixel-btn text-[8px] py-1 px-2 ${isEquippedX ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                                >
                                  {isEquippedX ? "Đã Chọn X" : "Đặt X"}
                                </button>
                                <button
                                  onClick={() => handleEquipItem(item.id, "O")}
                                  className={`flex-grow pixel-btn text-[8px] py-1 px-2 ${isEquippedO ? "pixel-btn-blue text-white" : "pixel-btn-gray"}`}
                                >
                                  {isEquippedO ? "Đã Chọn O" : "Đặt O"}
                                </button>
                              </>
                            ) : (
                              item.isPremiumOnly && !profile.isPremium ? (
                                <button
                                  onClick={() => setActiveTab("SETTINGS")}
                                  className="w-full pixel-btn pixel-btn-blue text-[9px] py-1 flex items-center justify-center gap-1"
                                >
                                  Mở khóa với VIP 👑
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleBuyItem(item.id)}
                                  className="w-full pixel-btn pixel-btn-yellow text-[9px] py-1"
                                >
                                  Mua Vật Phẩm
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. FRAMES */}
                <div>
                  <h3 className="text-[10px] text-pixel-blue uppercase mb-3 tracking-wide">== Khung avatar ==</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {SHOP_ITEMS.filter(i => i.type === "FRAME").map(item => {
                      const owned = profile.purchasedItems.includes(item.id);
                      const isEquipped = profile.avatarFrame === item.id;
                      
                      return (
                        <div key={item.id} className="pixel-box-nested p-3 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-bold text-white flex items-center gap-1">
                                {item.name}
                                {item.isPremiumOnly && (
                                  <span className="text-[6px] bg-amber-500/20 border border-amber-500/30 px-1 rounded text-amber-500 font-bold uppercase tracking-wider">👑 VIP</span>
                                )}
                              </span>
                              {!owned && (
                                <div className="text-right flex flex-col items-end">
                                  {profile.isPremium ? (
                                    <div className="flex flex-col items-end">
                                      <span className="text-[7.5px] text-gray-500 line-through flex items-center gap-0.5">
                                        {item.price} <Coins className="w-2.5 h-2.5 text-gray-500 fill-gray-500" />
                                      </span>
                                      <span className="text-[9.5px] text-pixel-green flex items-center gap-0.5 font-bold animate-pulse">
                                        {Math.floor(item.price * 0.8)} <Coins className="w-2.5 h-2.5 text-pixel-green fill-pixel-green" />
                                        <span className="text-[6px] bg-pixel-green/20 border border-pixel-green/30 px-1 rounded text-pixel-green uppercase font-mono tracking-wider ml-1">VIP -20%</span>
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-end">
                                      <span className="text-[9.5px] text-pixel-yellow flex items-center gap-0.5 font-bold">
                                        {item.price} <Coins className="w-2.5 h-2.5 text-pixel-yellow fill-pixel-yellow" />
                                      </span>
                                      <span 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveTab("SETTINGS");
                                        }}
                                        className="text-[6px] text-pixel-blue hover:underline cursor-pointer uppercase font-mono mt-0.5 tracking-wider bg-pixel-blue/15 border border-pixel-blue/20 px-1 rounded hover:bg-pixel-blue/25"
                                      >
                                        -20% với Premium
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <p className="text-[8px] text-gray-400 mt-1">{item.description}</p>
                            
                            {/* Preview Frame */}
                            <div className="flex justify-center my-3">
                              <div className={`w-10 h-10 bg-pixel-gray-light border-4 border-black relative flex items-center justify-center ${item.visuals.className || ""}`}>
                                <UserIcon className="w-4 h-4 text-pixel-blue" />
                              </div>
                            </div>
                          </div>

                          <div className="mt-1">
                            {owned ? (
                              <button
                                onClick={() => handleEquipItem(item.id)}
                                className={`w-full pixel-btn text-[8px] py-1 ${isEquipped ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                                disabled={isEquipped}
                              >
                                {isEquipped ? "Đang Trang Bị" : "Trang Bị"}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleBuyItem(item.id)}
                                className="w-full pixel-btn pixel-btn-yellow text-[9px] py-1"
                              >
                                Mua Vật Phẩm
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. THEMES */}
                <div>
                  <h3 className="text-[10px] text-pixel-blue uppercase mb-3 tracking-wide">== Chủ đề bàn cờ ==</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {SHOP_ITEMS.filter(i => i.type === "THEME").map(item => {
                      const owned = profile.purchasedItems.includes(item.id);
                      const isEquipped = equippedThemeId === item.id;

                      const equipThemeClient = (themeId: string) => {
                        localStorage.setItem("board_theme", themeId);
                        window.dispatchEvent(new Event("theme_changed"));
                      };

                      return (
                        <div key={item.id} className="pixel-box-nested p-3 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-bold text-white flex items-center gap-1">
                                {item.name}
                                {item.isPremiumOnly && (
                                  <span className="text-[6px] bg-amber-500/20 border border-amber-500/30 px-1 rounded text-amber-500 font-bold uppercase tracking-wider">👑 VIP</span>
                                )}
                              </span>
                              {!owned && (
                                <div className="text-right flex flex-col items-end">
                                  {profile.isPremium ? (
                                    <div className="flex flex-col items-end">
                                      <span className="text-[7.5px] text-gray-500 line-through flex items-center gap-0.5">
                                        {item.price} <Coins className="w-2.5 h-2.5 text-gray-500 fill-gray-500" />
                                      </span>
                                      <span className="text-[9.5px] text-pixel-green flex items-center gap-0.5 font-bold animate-pulse">
                                        {Math.floor(item.price * 0.8)} <Coins className="w-2.5 h-2.5 text-pixel-green fill-pixel-green" />
                                        <span className="text-[6px] bg-pixel-green/20 border border-pixel-green/30 px-1 rounded text-pixel-green uppercase font-mono tracking-wider ml-1">VIP -20%</span>
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-end">
                                      <span className="text-[9.5px] text-pixel-yellow flex items-center gap-0.5 font-bold">
                                        {item.price} <Coins className="w-2.5 h-2.5 text-pixel-yellow fill-pixel-yellow" />
                                      </span>
                                      <span 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveTab("SETTINGS");
                                        }}
                                        className="text-[6px] text-pixel-blue hover:underline cursor-pointer uppercase font-mono mt-0.5 tracking-wider bg-pixel-blue/15 border border-pixel-blue/20 px-1 rounded hover:bg-pixel-blue/25"
                                      >
                                        -20% với Premium
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <p className="text-[8px] text-gray-400 mt-1">{item.description}</p>
                            
                            {/* Preview Theme color */}
                            <div className={`h-8 border border-black mt-2 ${item.visuals.className || ""}`}></div>
                          </div>

                          <div className="mt-3">
                            {owned ? (
                              <button
                                onClick={() => equipThemeClient(item.id)}
                                className={`w-full pixel-btn text-[8px] py-1 ${isEquipped ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                                disabled={isEquipped}
                              >
                                {isEquipped ? "Đang Sử Dụng" : "Áp Dụng"}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleBuyItem(item.id)}
                                className="w-full pixel-btn pixel-btn-yellow text-[9px] py-1"
                              >
                                Mua Vật Phẩm
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACCOUNT SETTINGS / UPGRADE */}
          {activeTab === "SETTINGS" && (
            <div className="space-y-6">
              <h2 className="text-xs text-pixel-yellow uppercase border-b border-black pb-2 mb-4 tracking-wider">
                Hồ sơ tài khoản
              </h2>

              <div className="space-y-6">
                
                {/* Nickname modification */}
                <div className="pixel-box-nested p-4">
                  <h3 className="text-[10px] text-pixel-blue uppercase mb-2">Thiết lập biệt danh:</h3>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="pixel-input flex-grow"
                      maxLength={15}
                    />
                    <button onClick={handleSaveUsername} className="pixel-btn pixel-btn-yellow text-xs py-2 px-6">
                      Cập nhật
                    </button>
                  </div>
                </div>

                {/* Premium Membership Activation */}
                <div className="pixel-box-nested p-4 border-2 border-amber-500/40 bg-amber-500/5">
                  <div className="flex items-center gap-2 mb-2 text-pixel-yellow">
                    <Sparkles className="w-4 h-4 text-pixel-yellow" />
                    <h3 className="text-[10px] uppercase font-bold">Gói VIP Premium (Ẩn quảng cáo)</h3>
                  </div>
                  
                  {profile.isPremium ? (
                    <div className="bg-pixel-green/10 border border-pixel-green/30 text-pixel-green text-[9px] p-3 rounded-lg font-mono flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 shrink-0 text-pixel-green" />
                        <span>Kích hoạt Premium thành công! Toàn bộ quảng cáo đã được ẩn.</span>
                      </div>
                      <div className="text-[8px] text-gray-400 pl-6 mt-1">
                        {profile.premiumUntil ? (
                          <>Thời hạn sử dụng (mua bằng Coin): <span className="text-pixel-yellow font-bold">{new Date(profile.premiumUntil).toLocaleString("vi-VN")}</span> (Thời hạn 3 ngày)</>
                        ) : (
                          <>Hình thức: <span className="text-yellow-400 font-bold">Premium Vĩnh Viễn 👑</span> (Mua bằng tiền thật)</>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-[8px] text-gray-400 leading-relaxed">
                        Nâng cấp tài khoản của bạn lên Premium để tắt toàn bộ quảng cáo hiển thị trên website, nhận nhãn <span className="text-pixel-yellow font-bold">👑 PREMIUM</span> lấp lánh bên cạnh tên trong bảng xếp hạng và giao diện sảnh đấu.
                      </p>
                      
                      {premiumError && (
                        <div className="bg-pixel-red/20 border border-pixel-red text-pixel-red text-[8px] p-2 font-mono">
                          {premiumError}
                        </div>
                      )}

                      {premiumSuccess && (
                        <div className="bg-pixel-green/20 border border-pixel-green text-pixel-green text-[8px] p-2 font-mono">
                          Kích hoạt gói Premium thành công! Đã ẩn toàn bộ quảng cáo.
                        </div>
                      )}

                      {!premiumSuccess && (
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            onClick={handleBuyPremium}
                            disabled={buyingPremium}
                            className="pixel-btn pixel-btn-yellow py-2.5 px-6 text-[9px] uppercase font-bold flex items-center gap-2"
                          >
                            Kích hoạt bằng Coins (200 C) - 3 ngày
                          </button>
                          <button
                            onClick={() => {
                              setCashError("");
                              setShowQRPaymentModal(true);
                            }}
                            className="pixel-btn pixel-btn-blue py-2.5 px-6 text-[9px] uppercase font-bold flex items-center justify-center gap-2"
                          >
                            <CreditCard className="w-3.5 h-3.5" /> Kích hoạt bằng tiền mặt (20K VND)
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Anonymous Account Upgrade */}
                {profile.isGuest && (
                  <div className="pixel-box-nested p-4 border-2 border-pixel-yellow/60">
                    <div className="flex items-center gap-2 mb-2 text-pixel-yellow">
                      <Sparkles className="w-4 h-4" />
                      <h3 className="text-[10px] uppercase font-bold">Nâng cấp tài khoản vĩnh viễn</h3>
                    </div>
                    <p className="text-[8px] text-gray-400 leading-relaxed mb-4">
                      Bạn đang sử dụng tài khoản Khách (Guest). Hãy nhập email và mật khẩu của bạn để nâng cấp thành tài khoản chính thức. Mọi số dư Coin, cấp độ, kinh nghiệm và vật phẩm đã mua của bạn sẽ được chuyển giao đầy đủ, không bị mất khi xóa bộ nhớ trình duyệt!
                    </p>

                    {upgradeSuccessMsg ? (
                      <div className="bg-pixel-green/20 border-2 border-pixel-green text-pixel-green text-[9px] p-3 mb-2 font-mono">
                        {upgradeSuccessMsg}
                      </div>
                    ) : (
                      <form onSubmit={handleUpgradeAccount} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[7px] text-gray-400 uppercase mb-1">Email:</label>
                            <input
                              type="email"
                              value={upgradeEmail}
                              onChange={(e) => setUpgradeEmail(e.target.value)}
                              placeholder="upgrade@example.com"
                              required
                              className="w-full pixel-input"
                            />
                          </div>
                          <div>
                            <label className="block text-[7px] text-gray-400 uppercase mb-1">Mật khẩu mới:</label>
                            <input
                              type="password"
                              value={upgradePassword}
                              onChange={(e) => setUpgradePassword(e.target.value)}
                              placeholder="Mật khẩu tối thiểu 6 ký tự"
                              required
                              minLength={6}
                              className="w-full pixel-input"
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={upgradeLoading}
                          className="pixel-btn pixel-btn-yellow py-2 px-6 text-[10px] uppercase font-bold"
                        >
                          {upgradeLoading ? "Đang nâng cấp..." : "Nâng cấp tài khoản"}
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* Account metadata statistics */}
                <div className="pixel-box-nested p-4 text-[9px] space-y-2 text-gray-400 font-mono">
                  <div>[ID NGƯỜI CHƠI]: <span className="text-white">{profile.id}</span></div>
                  <div>[TRẠNG THÁI]: <span className="text-white">{profile.isGuest ? "TÀI KHOẢN KHÁCH (GUEST)" : "TÀI KHOẢN CHÍNH THỨC"}</span></div>
                  <div>[NGÀY GIA NHẬP]: <span className="text-white">{new Date(profile.createdAt).toLocaleDateString("vi-VN")}</span></div>
                  <div>[SỐ VẬT PHẨM ĐÃ SỞ HỮU]: <span className="text-white">{profile.purchasedItems.length} / {SHOP_ITEMS.length}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* QR CODE PAYMENT MODAL (VIETQR MOCKUP) */}
      {showQRPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4 animate-fade-in">
          <div className="pixel-box bg-[#16161c] max-w-sm w-full p-6 space-y-6 relative border-4 border-black shadow-2xl shadow-pixel-yellow/10">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-black pb-2">
              <h3 className="text-xs text-pixel-yellow uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-pixel-yellow" />
                Thanh toán Premium (Chuyển khoản QR)
              </h3>
              <button 
                onClick={() => setShowQRPaymentModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Payment Details */}
            <div className="text-center space-y-4">
              <p className="text-[8px] text-gray-400 leading-relaxed uppercase">
                Quét mã QR dưới đây bằng ứng dụng ngân hàng hoặc ví điện tử (MoMo, ZaloPay...) để hoàn tất thanh toán.
              </p>

              {/* VietQR Mockup SVG container */}
              <div className="bg-white p-3 rounded-2xl inline-block shadow-lg mx-auto relative border border-white/20">
                <QRCodeSVG 
                  value={`00020101021138580010A00000072701240006970422011012345678900208QRIBFTTA53037045405200005802VN62280824BOARDVERSE PREMIUM_${profile.id.substring(0, 6)}6304`}
                  size={150}
                  level="H"
                  includeMargin={false}
                />
              </div>

              {/* VietQR details */}
              <div className="pixel-box-nested p-3 bg-black/60 text-left text-[9px] font-mono space-y-1.5 border border-white/5">
                <div>[NGÂN HÀNG]: <span className="text-white">MB BANK (970422)</span></div>
                <div>[SỐ TÀI KHOẢN]: <span className="text-white font-bold select-all">1903678999999</span></div>
                <div>[TÊN CHỦ TK]: <span className="text-white">BOARDVERSE CO-OP</span></div>
                <div>[SỐ TIỀN]: <span className="text-pixel-yellow font-bold">20.000 VND</span></div>
                <div>[NỘI DUNG CK]: <span className="text-pixel-blue font-bold select-all">BOARDVERSE PREMIUM {profile.id.substring(0, 6).toUpperCase()}</span></div>
              </div>

              <div className="text-[7px] text-gray-500 font-mono italic animate-pulse">
                Hệ thống tự động kích hoạt ngay lập tức sau khi xác nhận chuyển khoản.
              </div>

              {cashError && (
                <div className="bg-pixel-red/20 border border-pixel-red text-pixel-red text-[8px] p-2 font-mono text-left">
                  {cashError}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowQRPaymentModal(false)}
                className="pixel-btn pixel-btn-gray py-2 text-[9px] uppercase font-bold"
              >
                Hủy giao dịch
              </button>
              <button
                onClick={handleConfirmCashPayment}
                disabled={cashPaying}
                className="pixel-btn pixel-btn-yellow py-2 text-[9px] uppercase font-bold"
              >
                {cashPaying ? "Đang xác thực..." : "Đã chuyển khoản"}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
