"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "./providers/AuthProvider";
import { SHOP_ITEMS, ShopItem, getShopItem } from "@/lib/shopItems";
import { createClient } from "@/lib/supabase/client";
import { 
  Coins, Trophy, LogOut, ShoppingBag, Settings, Play, 
  User as UserIcon, X, Swords, RefreshCw, Sparkles, Check, ChevronRight,
  CreditCard, Calendar, Gift, Volume2, Smile
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface DashboardProps {
  onSelectGame: (game: "TIC_TAC_TOE" | "CARO" | "BATTLESHIP", mode: "BOT" | "FRIEND" | "RANDOM", details: any) => void;
}

export default function Dashboard({ onSelectGame }: DashboardProps) {
  const { profile, signOutUser, refreshProfile } = useAuth();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"PLAY" | "SHOP" | "SETTINGS" | "EVENT">("PLAY");
  
  // Trạng thái lọc Cửa hàng
  const [shopCategory, setShopCategory] = useState<"ALL" | "SYMBOL" | "FRAME" | "THEME" | "SFX" | "EMOJI">("ALL");

  // Trạng thái nạp tiền bằng VietQR động
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [selectedTopupPackage, setSelectedTopupPackage] = useState<string>("package_20k");
  const [topupPaying, setTopupPaying] = useState(false);
  const [topupSuccess, setTopupSuccess] = useState(false);
  const [topupError, setTopupError] = useState("");

  // Trạng thái tặng quà
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftItemId, setGiftItemId] = useState("");
  const [giftUsername, setGiftUsername] = useState("");
  const [gifting, setGifting] = useState(false);
  const [giftSuccessMsg, setGiftSuccessMsg] = useState("");
  const [giftError, setGiftError] = useState("");

  // Trạng thái Điểm danh nhận Coin
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [dailyClaimMessage, setDailyClaimMessage] = useState("");
  const [dailyClaimError, setDailyClaimError] = useState("");

  // Trạng thái Sự kiện Mùa Hè
  const [claimingQuestId, setClaimingQuestId] = useState("");
  const [questMessage, setQuestMessage] = useState("");
  const [questError, setQuestError] = useState("");

  const [openingBox, setOpeningBox] = useState(false);
  const [boxMessage, setBoxMessage] = useState("");
  const [boxError, setBoxError] = useState("");
  const [boxReward, setBoxReward] = useState<any>(null);
  
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

  // 4b. Điểm danh nhận Coin hàng ngày
  const handleClaimDaily = async () => {
    setClaimingDaily(true);
    setDailyClaimMessage("");
    setDailyClaimError("");
    try {
      const res = await fetch("/api/user/claim-daily", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setDailyClaimMessage(data.message);
        await refreshProfile();
      } else {
        setDailyClaimError(data.error || "Điểm danh thất bại!");
      }
    } catch (err) {
      console.error(err);
      setDailyClaimError("Lỗi kết nối máy chủ");
    } finally {
      setClaimingDaily(false);
    }
  };

  // 4c. Nạp Coin bằng tiền thật (Chuyển khoản QR)
  const handleConfirmTopupCoin = async () => {
    setTopupPaying(true);
    setTopupError("");
    setTopupSuccess(false);
    try {
      const res = await fetch("/api/user/coins/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: selectedTopupPackage })
      });
      const data = await res.json();
      if (res.ok) {
        setTopupSuccess(true);
        await refreshProfile();
        // Tự động tắt sau 2 giây
        setTimeout(() => {
          setShowTopupModal(false);
          setTopupSuccess(false);
        }, 2000);
      } else {
        setTopupError(data.error || "Nạp coin thất bại!");
      }
    } catch (err) {
      console.error(err);
      setTopupError("Lỗi kết nối máy chủ");
    } finally {
      setTopupPaying(false);
    }
  };

  // 4d. Tặng quà cho người chơi khác
  const handleGiftItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftUsername.trim()) return;
    setGifting(true);
    setGiftError("");
    setGiftSuccessMsg("");
    try {
      const res = await fetch("/api/user/shop/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: giftItemId, targetUsername: giftUsername.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setGiftSuccessMsg(data.message);
        await refreshProfile();
        setTimeout(() => {
          setShowGiftModal(false);
          setGiftSuccessMsg("");
          setGiftUsername("");
        }, 2500);
      } else {
        setGiftError(data.error || "Tặng quà thất bại!");
      }
    } catch (err) {
      console.error(err);
      setGiftError("Lỗi kết nối máy chủ");
    } finally {
      setGifting(false);
    }
  };

  // 4e. Nhận thưởng nhiệm vụ sự kiện
  const handleClaimQuest = async (questId: string) => {
    setClaimingQuestId(questId);
    setQuestMessage("");
    setQuestError("");
    try {
      const res = await fetch("/api/user/event/claim-quest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId })
      });
      const data = await res.json();
      if (res.ok) {
        setQuestMessage(data.message);
        await refreshProfile();
      } else {
        setQuestError(data.error || "Lỗi khi nhận thưởng");
      }
    } catch (err) {
      console.error(err);
      setQuestError("Lỗi kết nối máy chủ");
    } finally {
      setClaimingQuestId("");
    }
  };

  // 4f. Mở hộp quà mùa hè (Lootbox)
  const handleOpenSummerBox = async () => {
    setOpeningBox(true);
    setBoxMessage("");
    setBoxError("");
    setBoxReward(null);
    try {
      const res = await fetch("/api/user/event/open-box", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setBoxMessage(data.message);
        setBoxReward(data.itemReward || { name: `${data.coinsReward} Coins` });
        await refreshProfile();
      } else {
        setBoxError(data.error || "Mở hộp thất bại!");
      }
    } catch (err) {
      console.error(err);
      setBoxError("Lỗi kết nối máy chủ");
    } finally {
      setOpeningBox(false);
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
      <style>{`
        @keyframes rgbGlow {
          0% { color: #ff007f; text-shadow: 0 0 3px rgba(255, 0, 127, 0.4); }
          20% { color: #ffae00; text-shadow: 0 0 3px rgba(255, 174, 0, 0.4); }
          40% { color: #00f0ff; text-shadow: 0 0 3px rgba(0, 240, 255, 0.4); }
          60% { color: #50ff00; text-shadow: 0 0 3px rgba(80, 255, 0, 0.4); }
          80% { color: #bf00ff; text-shadow: 0 0 3px rgba(191, 0, 255, 0.4); }
          100% { color: #ff007f; text-shadow: 0 0 3px rgba(255, 0, 127, 0.4); }
        }
        .premium-glow-text {
          animation: rgbGlow 5s linear infinite;
          font-weight: bold;
        }
      `}</style>
      
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
                  <span className={`text-sm font-bold uppercase tracking-wide ${profile.isPremium ? "premium-glow-text" : "text-pixel-yellow"}`}>{profile.username}</span>
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
              <Coins className="w-5 h-5 text-pixel-yellow fill-pixel-yellow animate-pulse" />
              <div className="text-right">
                <span className="block text-[8px] text-gray-400 uppercase">Số dư</span>
                <span className="text-xs text-pixel-yellow font-bold flex items-center gap-1">
                  {profile.coins}
                  <button 
                    onClick={() => {
                      setSelectedTopupPackage("package_20k");
                      setTopupError("");
                      setTopupSuccess(false);
                      setShowTopupModal(true);
                    }}
                    className="ml-1 bg-pixel-green hover:bg-emerald-600 border border-black text-black font-bold text-[8px] w-3.5 h-3.5 flex items-center justify-center cursor-pointer select-none active:translate-y-0.5 rounded-sm"
                    title="Nạp Coin"
                  >
                    +
                  </button>
                </span>
              </div>
            </div>

            {/* Hiển thị số lượng Vỏ sò sự kiện */}
            <div className="flex items-center gap-2 border-l border-white/10 pl-3">
              <span className="text-sm">🐚</span>
              <div className="text-right">
                <span className="block text-[8px] text-gray-400 uppercase">Vỏ Sò</span>
                <span className="text-xs text-orange-400 font-bold">{profile.shells ?? 0}</span>
              </div>
            </div>

            {!profile.isPremium && (
              <button 
                onClick={() => setActiveTab("SETTINGS")}
                className="pixel-btn pixel-btn-yellow text-[8px] py-1.5 px-3 uppercase tracking-wider animate-pulse flex items-center gap-1 shrink-0 ml-2"
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
          <button 
            onClick={() => setActiveTab("EVENT")}
            className={`flex-grow md:flex-grow-0 pixel-btn justify-start py-3 px-4 uppercase text-[10px] gap-3 ${activeTab === "EVENT" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
          >
            <Calendar className="w-4 h-4 text-pixel-yellow animate-pulse" />
            Sự kiện hè 🍉
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
              
              {/* Banner Điểm danh nhận Coin hàng ngày */}
              <div className="pixel-box-nested p-3.5 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-2 border-amber-500/40 relative overflow-hidden flex flex-col sm:flex-row justify-between items-center gap-3">
                <div>
                  <h3 className="text-[10px] text-pixel-yellow uppercase font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-pixel-yellow" />
                    ĐIỂM DANH HÀ HỮU COIN MỖI NGÀY
                  </h3>
                  <p className="text-[7.5px] text-gray-400 mt-1">
                    Nhận Coin miễn phí hàng ngày! Thành viên <span className="text-pixel-yellow font-bold">Premium 👑</span> được nhận <span className="text-pixel-green font-bold font-mono">50 Coins</span> (Người dùng thường nhận 10 Coins).
                  </p>
                  {dailyClaimMessage && <span className="text-[8px] text-pixel-green font-mono block mt-1">✓ {dailyClaimMessage}</span>}
                  {dailyClaimError && <span className="text-[8px] text-pixel-red font-mono block mt-1">✗ {dailyClaimError}</span>}
                </div>
                <button
                  onClick={handleClaimDaily}
                  disabled={claimingDaily}
                  className="pixel-btn pixel-btn-yellow py-2 px-4 uppercase text-[9px] font-bold shrink-0"
                >
                  {claimingDaily ? "Đang nhận..." : "Nhận Coin ngay"}
                </button>
              </div>
              
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
                                  <span className={`block text-[8px] sm:text-[9px] truncate max-w-[80px] font-bold uppercase tracking-wide flex items-center justify-center gap-0.5 ${leaderboard[1].isPremium ? "premium-glow-text" : "text-gray-300"}`}>
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
                                  <span className={`block text-[9px] sm:text-[10px] truncate max-w-[90px] font-bold uppercase tracking-wide flex items-center justify-center gap-0.5 ${leaderboard[0].isPremium ? "premium-glow-text" : "text-pixel-yellow"}`}>
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
                                  <span className={`block text-[8px] sm:text-[9px] truncate max-w-[80px] font-bold uppercase tracking-wide flex items-center justify-center gap-0.5 ${leaderboard[2].isPremium ? "premium-glow-text" : "text-amber-500"}`}>
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
                                      <span className={`block text-[10px] truncate max-w-[120px] uppercase font-bold tracking-wide flex items-center gap-1 ${player.isPremium ? "premium-glow-text" : (isMe ? "text-pixel-yellow" : "text-white")}`}>
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

              {/* Shop sub-tabs */}
              <div className="flex flex-wrap gap-1.5 mb-6 border-b border-white/5 pb-3">
                {([
                  { cat: "ALL", label: "Tất cả" },
                  { cat: "SYMBOL", label: "Quân cờ" },
                  { cat: "FRAME", label: "Khung viền" },
                  { cat: "THEME", label: "Bàn cờ" },
                  { cat: "SFX", label: "Âm thanh" },
                  { cat: "EMOJI", label: "Biểu cảm" }
                ] as const).map(({ cat, label }) => (
                  <button
                    key={cat}
                    onClick={() => setShopCategory(cat)}
                    className={`pixel-btn text-[8px] py-1.5 px-3 uppercase tracking-wider ${shopCategory === cat ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {SHOP_ITEMS.filter(item => !item.isEventOnly && (shopCategory === "ALL" || item.type === shopCategory)).map(item => {
                    const owned = profile.purchasedItems.includes(item.id);
                    
                    // Logic trang bị đặc thù
                    const isEquippedX = profile.selectedSymbolX === item.id;
                    const isEquippedO = profile.selectedSymbolO === item.id;
                    const isEquippedFrame = profile.avatarFrame === item.id;
                    
                    const clientTheme = typeof window !== "undefined" ? localStorage.getItem("board_theme") || "theme_classic" : "theme_classic";
                    const isEquippedTheme = clientTheme === item.id;

                    const clientSfx = typeof window !== "undefined" ? localStorage.getItem("equipped_sfx") || "sfx_classic" : "sfx_classic";
                    const isEquippedSfx = clientSfx === item.id;

                    const equipThemeClient = (themeId: string) => {
                      localStorage.setItem("board_theme", themeId);
                      setEquippedThemeId(themeId);
                      window.dispatchEvent(new Event("theme_changed"));
                    };

                    const equipSfxClient = (sfxId: string) => {
                      localStorage.setItem("equipped_sfx", sfxId);
                      window.dispatchEvent(new Event("sfx_changed"));
                      // Chạy âm thanh thử nghiệm bằng Web Audio
                      playPreviewSFX(item.visuals.sfxType);
                    };

                    const playPreviewSFX = (type: any) => {
                      if (typeof window === "undefined") return;
                      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                      const osc = ctx.createOscillator();
                      const gain = ctx.createGain();
                      osc.connect(gain);
                      gain.connect(ctx.destination);

                      if (type === "retro") {
                        osc.type = "square";
                        osc.frequency.setValueAtTime(300, ctx.currentTime);
                        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
                        gain.gain.setValueAtTime(0.1, ctx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
                        osc.start();
                        osc.stop(ctx.currentTime + 0.15);
                      } else if (type === "laser") {
                        osc.type = "sawtooth";
                        osc.frequency.setValueAtTime(1200, ctx.currentTime);
                        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
                        gain.gain.setValueAtTime(0.08, ctx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
                        osc.start();
                        osc.stop(ctx.currentTime + 0.2);
                      } else if (type === "epic") {
                        osc.type = "sine";
                        osc.frequency.setValueAtTime(440, ctx.currentTime);
                        osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.08);
                        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.16);
                        gain.gain.setValueAtTime(0.12, ctx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
                        osc.start();
                        osc.stop(ctx.currentTime + 0.35);
                      } else {
                        // Mặc định beep nhẹ
                        osc.type = "sine";
                        osc.frequency.setValueAtTime(600, ctx.currentTime);
                        gain.gain.setValueAtTime(0.1, ctx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
                        osc.start();
                        osc.stop(ctx.currentTime + 0.08);
                      }
                    };

                    const actualPrice = profile.isPremium ? Math.floor(item.price * 0.8) : item.price;

                    return (
                      <div key={item.id} className="pixel-box-nested p-3.5 flex flex-col justify-between relative group hover:border-pixel-yellow/30 transition-all">
                        
                        {/* Nhãn loại vật phẩm */}
                        <span className="absolute top-2 right-2 text-[5.5px] bg-black/50 border border-white/10 px-1 py-0.5 rounded text-gray-400 font-mono uppercase tracking-widest scale-90">
                          {item.type}
                        </span>

                        <div>
                          <div className="flex justify-between items-start pr-8">
                            <span className="text-[10px] font-bold text-white flex items-center gap-1">
                              {item.name}
                              {item.isPremiumOnly && (
                                <span className="text-[5.5px] bg-amber-500/20 border border-amber-500/30 px-1 rounded text-amber-500 font-bold uppercase tracking-wider">👑 VIP</span>
                              )}
                            </span>
                          </div>
                          
                          <p className="text-[7.5px] text-gray-400 mt-1 leading-normal pr-4">{item.description}</p>
                          
                          {/* Visual Preview Panel */}
                          <div className="mt-3 bg-black/45 border border-black/80 rounded p-2 text-center flex items-center justify-center min-h-[44px]">
                            {item.type === "SYMBOL" && (
                              <div className="text-xs">
                                Quân cờ: <span className="text-pixel-yellow font-bold">{item.visuals.symbolX}</span> vs <span className="text-pixel-blue font-bold">{item.visuals.symbolO}</span>
                              </div>
                            )}
                            {item.type === "FRAME" && (
                              <div className="flex justify-center">
                                <div className={`w-8 h-8 bg-pixel-gray-light border-2 border-black relative flex items-center justify-center ${item.visuals.className || ""}`}>
                                  <UserIcon className="w-3.5 h-3.5 text-pixel-blue" />
                                </div>
                              </div>
                            )}
                            {item.type === "THEME" && (
                              <div className="w-full text-[8px] flex flex-col items-center gap-1.5">
                                <div className={`w-full h-4 border border-black rounded ${item.visuals.className || ""}`}></div>
                                <span className="text-[6.5px] text-gray-400">Xem trước chủ đề bàn cờ</span>
                              </div>
                            )}
                            {item.type === "SFX" && (
                              <button 
                                onClick={() => playPreviewSFX(item.visuals.sfxType)}
                                className="pixel-btn pixel-btn-gray py-1 px-3 text-[7.5px] uppercase font-mono flex items-center gap-1 cursor-pointer hover:bg-black/50"
                              >
                                <Volume2 className="w-3 h-3 text-pixel-blue" /> Nghe thử SFX
                              </button>
                            )}
                            {item.type === "EMOJI" && (
                              <div className="text-xl animate-bounce">
                                {item.visuals.emoji}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Mua/Trang bị/Tặng quà */}
                        <div className="mt-4">
                          {owned ? (
                            <div className="flex gap-1.5">
                              {item.type === "SYMBOL" && (
                                <>
                                  <button
                                    onClick={() => handleEquipItem(item.id, "X")}
                                    className={`flex-grow pixel-btn text-[7.5px] py-1 ${isEquippedX ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                                  >
                                    {isEquippedX ? "X (Đã chọn)" : "Đặt X"}
                                  </button>
                                  <button
                                    onClick={() => handleEquipItem(item.id, "O")}
                                    className={`flex-grow pixel-btn text-[7.5px] py-1 ${isEquippedO ? "pixel-btn-blue text-white" : "pixel-btn-gray"}`}
                                  >
                                    {isEquippedO ? "O (Đã chọn)" : "Đặt O"}
                                  </button>
                                </>
                              )}
                              {item.type === "FRAME" && (
                                <button
                                  onClick={() => handleEquipItem(item.id)}
                                  className={`w-full pixel-btn text-[7.5px] py-1 ${isEquippedFrame ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                                  disabled={isEquippedFrame}
                                >
                                  {isEquippedFrame ? "Đang Trang Bị" : "Trang Bị"}
                                </button>
                              )}
                              {item.type === "THEME" && (
                                <button
                                  onClick={() => equipThemeClient(item.id)}
                                  className={`w-full pixel-btn text-[7.5px] py-1 ${isEquippedTheme ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                                  disabled={isEquippedTheme}
                                >
                                  {isEquippedTheme ? "Đang sử dụng" : "Áp dụng"}
                                </button>
                              )}
                              {item.type === "SFX" && (
                                <button
                                  onClick={() => equipSfxClient(item.id)}
                                  className={`w-full pixel-btn text-[7.5px] py-1 ${isEquippedSfx ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                                  disabled={isEquippedSfx}
                                >
                                  {isEquippedSfx ? "Đang chọn SFX" : "Sử dụng SFX"}
                                </button>
                              )}
                              {item.type === "EMOJI" && (
                                <span className="w-full text-center text-[7.5px] text-pixel-green font-mono py-1 block">
                                  ✓ Đã sở hữu
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              {item.isPremiumOnly && !profile.isPremium ? (
                                <button
                                  onClick={() => setActiveTab("SETTINGS")}
                                  className="w-full pixel-btn pixel-btn-blue text-[8.5px] py-1 flex items-center justify-center gap-1 uppercase font-bold"
                                >
                                  Mở khóa với VIP 👑
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleBuyItem(item.id)}
                                    className="flex-grow pixel-btn pixel-btn-yellow text-[8.5px] py-1 font-bold flex justify-center items-center gap-1"
                                  >
                                    Mua: {actualPrice} <Coins className="w-2.5 h-2.5 text-black fill-black" />
                                    {profile.isPremium && <span className="text-[5px] bg-pixel-green/30 border border-pixel-green/30 px-0.5 rounded text-pixel-green uppercase tracking-wide">VIP -20%</span>}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setGiftItemId(item.id);
                                      setGiftUsername("");
                                      setGiftError("");
                                      setGiftSuccessMsg("");
                                      setShowGiftModal(true);
                                    }}
                                    className="pixel-btn pixel-btn-gray py-1 px-2.5 text-[8.5px] flex items-center justify-center"
                                    title="Tặng cho bạn bè"
                                  >
                                    <Gift className="w-3.5 h-3.5 text-pixel-blue" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
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

          {/* TAB 4: SUMMER EVENT (SỰ KIỆN MÙA HÈ) */}
          {activeTab === "EVENT" && (
            <div className="space-y-6 animate-fade-in">
              <div className="relative border-2 border-orange-400 bg-orange-400/5 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
                <span className="absolute -top-3 left-4 bg-orange-500 text-white font-mono text-[7px] font-bold px-2 py-0.5 rounded border border-orange-400 uppercase tracking-widest animate-pulse">SỰ KIỆN GIỚI HẠN</span>
                <div>
                  <h2 className="text-sm font-bold text-orange-400 uppercase tracking-wide flex items-center gap-1.5">
                    🌊 ĐẠI CHIẾN MÙA HÈ - SĂN HỘP QUÀ HÈ 🍉
                  </h2>
                  <p className="text-[7.5px] text-gray-400 leading-relaxed mt-2 max-w-xl">
                    Hoàn thành các nhiệm vụ đặc biệt bên dưới để thu thập <span className="text-orange-400 font-bold">Vỏ Sò Mùa Hè 🐚</span>. 
                    Dùng Vỏ Sò để đổi lấy **Hộp Quà Mùa Hè** mở ra quân cờ Dưa hấu 🍉, Khung cát biển, hoặc chủ đề bàn cờ Blue Ocean cực độc quyền!
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-black/60 border border-orange-400/30 p-2.5 rounded-lg shrink-0">
                  <span className="text-2xl animate-bounce">🐚</span>
                  <div className="text-left font-mono">
                    <div className="text-[6.5px] text-gray-500 uppercase">[VỎ SÒ HIỆN CÓ]</div>
                    <div className="text-lg font-bold text-orange-400">{profile.shells ?? 0}</div>
                  </div>
                </div>
              </div>

              {/* Grid 2 cột: Nhiệm vụ và Gacha Hộp Quà */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Cột trái: Nhiệm vụ */}
                <div className="md:col-span-7 space-y-4">
                  <h3 className="text-[10px] text-pixel-blue uppercase tracking-wider border-b border-black pb-1.5 mb-2">== NHIỆM VỤ SỰ KIỆN ==</h3>
                  
                  {questMessage && <div className="bg-pixel-green/20 border border-pixel-green text-pixel-green text-[8px] p-2 font-mono">✓ {questMessage}</div>}
                  {questError && <div className="bg-pixel-red/20 border border-pixel-red text-pixel-red text-[8px] p-2 font-mono font-bold">✗ {questError}</div>}

                  {[
                    { id: "quest_daily", name: "Đăng nhập ngày", desc: "Đăng nhập game hôm nay", coins: 20, shells: 15 },
                    { id: "quest_win_3", name: "Thắng 3 trận cờ", desc: "Giành chiến thắng trong 3 trận đấu bất kỳ", coins: 50, shells: 40 },
                    { id: "quest_play_5", name: "Chơi đủ 5 trận cờ", desc: "Tham gia đấu đủ 5 trận cờ (Bot hoặc Online)", coins: 40, shells: 30 },
                    { id: "quest_invite", name: "Mời bạn cùng chơi", desc: "Mời thành công 1 người bạn đạt Cấp 3", coins: 150, shells: 100 }
                  ].map(quest => (
                    <div key={quest.id} className="pixel-box-nested p-3 flex justify-between items-center bg-black/30">
                      <div>
                        <h4 className="text-[9.5px] font-bold text-white uppercase">{quest.name}</h4>
                        <p className="text-[7px] text-gray-400 mt-0.5">{quest.desc}</p>
                        <div className="flex gap-2 mt-2">
                          <span className="text-[6.5px] bg-pixel-yellow/10 text-pixel-yellow border border-pixel-yellow/20 px-1 rounded flex items-center gap-0.5 font-mono">
                            +{quest.coins} C
                          </span>
                          <span className="text-[6.5px] bg-orange-400/10 text-orange-400 border border-orange-400/20 px-1 rounded flex items-center gap-0.5 font-mono">
                            +{quest.shells} 🐚
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleClaimQuest(quest.id)}
                        disabled={claimingQuestId === quest.id}
                        className="pixel-btn pixel-btn-yellow py-1.5 px-3.5 text-[8.5px] uppercase font-bold"
                      >
                        {claimingQuestId === quest.id ? "Đang nhận..." : "Nhận quà"}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Cột phải: Hộp Quà Mùa Hè Gacha */}
                <div className="md:col-span-5 space-y-4">
                  <h3 className="text-[10px] text-pixel-blue uppercase tracking-wider border-b border-black pb-1.5 mb-2">== HỘP QUÀ MÙA HÈ ==</h3>
                  
                  <div className="pixel-box-nested p-4 bg-gradient-to-b from-orange-400/5 to-yellow-500/5 border-2 border-orange-400/30 text-center space-y-4">
                    <div className="text-4xl animate-bounce my-2">🎁</div>
                    <div>
                      <h4 className="text-[10px] font-bold text-pixel-yellow uppercase">Summer Mystery Box</h4>
                      <p className="text-[7px] text-gray-400 mt-1 leading-normal">
                        Mỗi lượt mở tốn <span className="text-orange-400 font-bold">80 Vỏ Sò 🐚</span>. Có cơ hội trúng quân cờ, khung viền, hoặc theme bàn cờ Mùa Hè giới hạn. Nếu trùng sẽ hoàn trả <span className="text-pixel-green font-bold">120 Coins</span>!
                      </p>
                    </div>

                    {boxError && <div className="bg-pixel-red/20 border border-pixel-red text-pixel-red text-[8px] p-2 font-mono text-left font-bold">✗ {boxError}</div>}
                    {boxMessage && <div className="bg-pixel-green/20 border border-pixel-green text-pixel-green text-[8px] p-2 font-mono text-left">✓ {boxMessage}</div>}

                    <button
                      onClick={handleOpenSummerBox}
                      disabled={openingBox || (profile.shells ?? 0) < 80}
                      className="pixel-btn pixel-btn-yellow w-full py-2.5 text-[9.5px] uppercase font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-orange-500/10"
                    >
                      {openingBox ? "Đang mở quà..." : "Mở: 80 Vỏ Sò 🐚"}
                    </button>

                    <div className="border-t border-black pt-3 text-left">
                      <span className="text-[6.5px] text-gray-400 uppercase font-mono block mb-1">Tỷ lệ rơi vật phẩm sự kiện:</span>
                      <div className="text-[6px] text-gray-400 font-mono space-y-1">
                        <div>• Quân cờ dưa hấu 🍉: <span className="text-white">40%</span></div>
                        <div>• Khung cát vàng 🏖️: <span className="text-white">30%</span></div>
                        <div>• Bàn cờ đại dương 🌊: <span className="text-white">20%</span></div>
                        <div>• 150 Coins may mắn 💰: <span className="text-white">10%</span></div>
                      </div>
                    </div>
                  </div>
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

      {/* MOCKUP COIN TOPUP MODAL (VIETQR) */}
      {showTopupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md px-4 animate-fade-in">
          <div className="pixel-box bg-[#16161c] max-w-sm w-full p-6 space-y-5 relative border-4 border-black shadow-2xl">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-black pb-2">
              <h3 className="text-xs text-pixel-yellow uppercase tracking-wider flex items-center gap-2">
                <Coins className="w-4 h-4 text-pixel-yellow" />
                Nạp xu qua Chuyển Khoản QR
              </h3>
              <button 
                onClick={() => setShowTopupModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Select coin package */}
            <div>
              <label className="block text-[7.5px] text-gray-400 uppercase mb-2 font-mono">[1. Chọn gói Coins nạp]</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "package_10k", price: 10000, coins: 100, promo: "" },
                  { id: "package_20k", price: 20000, coins: 220, promo: "+10% VIP" },
                  { id: "package_50k", price: 50000, coins: 600, promo: "+20% VIP" },
                  { id: "package_100k", price: 100000, coins: 1300, promo: "+30% VIP" }
                ].map(pkg => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => {
                      setSelectedTopupPackage(pkg.id);
                      setTopupSuccess(false);
                      setTopupError("");
                    }}
                    className={`pixel-box-nested p-2.5 text-center flex flex-col justify-center items-center cursor-pointer transition-all ${
                      selectedTopupPackage === pkg.id 
                        ? "border-pixel-yellow bg-pixel-yellow/10" 
                        : "border-white/5 bg-black/20 hover:bg-black/30"
                    }`}
                  >
                    <span className="text-[10px] font-bold text-white">{pkg.coins} Coins</span>
                    <span className="text-[8px] text-pixel-yellow mt-0.5">{pkg.price.toLocaleString("vi-VN")}đ</span>
                    {pkg.promo && (
                      <span className="text-[5.5px] bg-pixel-green/20 border border-pixel-green/30 text-pixel-green px-1 mt-1 rounded scale-90 font-mono font-bold uppercase">{pkg.promo}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* QR payment dynamic display */}
            {(() => {
              const selectedPkg = [
                { id: "package_10k", price: 10000, coins: 100 },
                { id: "package_20k", price: 20000, coins: 220 },
                { id: "package_50k", price: 50000, coins: 600 },
                { id: "package_100k", price: 100000, coins: 1300 }
              ].find(p => p.id === selectedTopupPackage) || { id: "package_20k", price: 20000, coins: 220 };

              return (
                <div className="text-center space-y-4 pt-1">
                  <div className="bg-white p-2 rounded-xl inline-block shadow-lg mx-auto border border-white/20">
                    <QRCodeSVG 
                      value={`00020101021138580010A00000072701240006970422011012345678900208QRIBFTTA53037045405200005802VN62280824BOARDVERSE COINS_${profile.id.substring(0, 6)}_${selectedPkg.price}6304`}
                      size={110}
                      level="H"
                      includeMargin={false}
                    />
                  </div>

                  <div className="pixel-box-nested p-2.5 bg-black/60 text-left text-[8.5px] font-mono space-y-1 border border-white/5">
                    <div>[NGÂN HÀNG]: <span className="text-white">MB BANK</span></div>
                    <div>[SỐ TÀI KHOẢN]: <span className="text-white font-bold select-all">1903678999999</span></div>
                    <div>[SỐ TIỀN]: <span className="text-pixel-yellow font-bold">{selectedPkg.price.toLocaleString("vi-VN")} VND</span></div>
                    <div>[NỘI DUNG CK]: <span className="text-pixel-blue font-bold select-all">BOARDVERSE COIN {profile.id.substring(0, 6).toUpperCase()} {selectedPkg.coins}</span></div>
                  </div>

                  {topupError && <div className="bg-pixel-red/20 border border-pixel-red text-pixel-red text-[8px] p-2 font-mono text-left font-bold">✗ {topupError}</div>}
                  {topupSuccess && <div className="bg-pixel-green/20 border border-pixel-green text-pixel-green text-[8px] p-2 font-mono text-left font-bold">✓ Cộng xu thành công! Đã nạp +{selectedPkg.coins} Coins.</div>}

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowTopupModal(false)}
                      className="pixel-btn pixel-btn-gray py-2 text-[9px] uppercase font-bold"
                    >
                      Hủy nạp
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmTopupCoin}
                      disabled={topupPaying || topupSuccess}
                      className="pixel-btn pixel-btn-yellow py-2 text-[9px] uppercase font-bold"
                    >
                      {topupPaying ? "Đang xác thực..." : "Đã chuyển khoản"}
                    </button>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* GIFT ITEM MODAL */}
      {showGiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md px-4 animate-fade-in">
          <div className="pixel-box bg-[#16161c] max-w-sm w-full p-6 space-y-4 relative border-4 border-black shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-black pb-2">
              <h3 className="text-xs text-pixel-yellow uppercase tracking-wider flex items-center gap-2">
                <Gift className="w-4 h-4 text-pixel-yellow" />
                Tặng quà cho bạn bè
              </h3>
              <button 
                type="button"
                onClick={() => setShowGiftModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const giftItem = SHOP_ITEMS.find(i => i.id === giftItemId);
              if (!giftItem) return null;
              const giftPrice = profile.isPremium ? Math.floor(giftItem.price * 0.8) : giftItem.price;

              return (
                <form onSubmit={handleGiftItem} className="space-y-4">
                  <div className="bg-black/40 p-3 border border-white/5 rounded-lg flex items-center gap-3">
                    <span className="text-2xl font-bold font-mono">🎁</span>
                    <div>
                      <div className="text-[10px] font-bold text-white">{giftItem.name}</div>
                      <div className="text-[8px] text-pixel-yellow mt-0.5">
                        Giá tặng: {giftPrice} Coins 
                        {profile.isPremium && <span className="text-pixel-green font-bold ml-1">(VIP -20%)</span>}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[8px] text-gray-400 uppercase mb-1 font-mono">Biệt danh người nhận:</label>
                    <input
                      type="text"
                      value={giftUsername}
                      onChange={(e) => setGiftUsername(e.target.value)}
                      required
                      placeholder="Nhập tên người nhận quà..."
                      className="w-full pixel-input text-[10px]"
                    />
                  </div>

                  {giftError && <div className="bg-pixel-red/20 border border-pixel-red text-pixel-red text-[8px] p-2 font-mono">✗ {giftError}</div>}
                  {giftSuccessMsg && <div className="bg-pixel-green/20 border border-pixel-green text-pixel-green text-[8px] p-2 font-mono">✓ {giftSuccessMsg}</div>}

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowGiftModal(false)}
                      className="pixel-btn pixel-btn-gray py-2 text-[9px] uppercase font-bold"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={gifting || giftSuccessMsg.length > 0}
                      className="pixel-btn pixel-btn-yellow py-2 text-[9px] uppercase font-bold flex items-center justify-center gap-1.5"
                    >
                      {gifting ? "Đang gửi..." : "Gửi tặng"}
                    </button>
                  </div>
                </form>
              );
            })()}

          </div>
        </div>
      )}
    </div>
  );
}
