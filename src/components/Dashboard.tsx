"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "./providers/AuthProvider";
import { SHOP_ITEMS, ShopItem, getShopItem } from "@/lib/shopItems";
import { createClient } from "@/lib/supabase/client";
import { 
  Coins, Trophy, LogOut, ShoppingBag, Settings, Play, 
  User as UserIcon, X, Swords, RefreshCw, Sparkles, Check, ChevronRight,
  CreditCard, Calendar, Gift, Volume2, Smile, Flame, ShieldAlert, Award, Star, Eye, UserPlus, Link2, Users
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getExpNeededForLevel, DailyMission, getRankFromElo, ACHIEVEMENTS } from "@/lib/progression";

interface DashboardProps {
  onSelectGame: (game: "TIC_TAC_TOE" | "CARO" | "BATTLESHIP", mode: "BOT" | "FRIEND" | "RANDOM", details: any) => void;
}

export default function Dashboard({ onSelectGame }: DashboardProps) {
  const { profile, signOutUser, refreshProfile } = useAuth();
  const supabase = createClient();

  // Tab chính trên PC: "PLAY" | "SHOP" | "SETTINGS" | "EVENT"
  // Trên Mobile, 4 tab bottom bar sẽ map tới các view: "PLAY" (Đấu), "SHOP" (Cửa hàng), "BP" (Battle Pass), "SOCIAL" (Cá nhân & Bạn bè)
  const [activeTab, setActiveTab] = useState<"PLAY" | "SHOP" | "SETTINGS" | "EVENT" | "BP" | "SOCIAL">("PLAY");
  
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

  const [socialSubTab, setSocialSubTab] = useState<"FRIENDS" | "ACHIEVEMENTS" | "GUILD">("FRIENDS");
  const [resetSeasonLoading, setResetSeasonLoading] = useState(false);

  // Trạng thái Nhiệm vụ hàng ngày
  const [missions, setMissions] = useState<DailyMission[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(false);

  // Trạng thái Điểm danh & Tiến trình
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [dailyClaimMessage, setDailyClaimMessage] = useState("");
  const [dailyClaimError, setDailyClaimError] = useState("");
  const [prestigeLoading, setPrestigeLoading] = useState(false);

  // Lịch sử đấu
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // State tìm kiếm trận ngẫu nhiên
  const [matchmaking, setMatchmaking] = useState<{
    active: boolean;
    gameType: "TIC_TAC_TOE" | "CARO" | "BATTLESHIP";
    wager: number;
  } | null>(null);

  const matchmakingIntervalRef = useRef<any>(null);

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
  const [selectedGame, setSelectedGame] = useState<"TIC_TAC_TOE" | "CARO" | "BATTLESHIP">("CARO");
  const [selectedMode, setSelectedMode] = useState<"BOT" | "FRIEND" | "RANDOM">("BOT");
  const [botDifficulty, setBotDifficulty] = useState<"RANDOM" | "EASY" | "HARD">("EASY");
  const [matchWager, setMatchWager] = useState<number>(0);

  // Friend lobby state
  const [creatingFriendLobby, setCreatingFriendLobby] = useState(false);

  // Theme bàn cờ được chọn ở client
  const [equippedThemeId, setEquippedThemeId] = useState("theme_classic");
  const [equippedSfxId, setEquippedSfxId] = useState("sfx_retro");

  // Bảng xếp hạng
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Mock Friends list (đơn giản hóa theo tài liệu)
  const [friendsList] = useState([
    { username: "KỳThủPro", status: "Đang đấu Gomoku", online: true, roomId: "mock-gomoku-room-id" },
    { username: "BoardKing", status: "Đang ở sảnh chờ", online: true, canParty: true },
    { username: "LãoNgoanĐồng", status: "Ngoại tuyến 2 giờ", online: false },
    { username: "Guest_4920", status: "Ngoại tuyến", online: false }
  ]);

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

  const fetchMissions = async () => {
    setLoadingMissions(true);
    try {
      const res = await fetch("/api/user/progression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "GET_MISSIONS" })
      });
      if (res.ok) {
        const data = await res.json();
        setMissions(data.missions || []);
      }
    } catch (err) {
      console.error("Lỗi lấy nhiệm vụ:", err);
    } finally {
      setLoadingMissions(false);
    }
  };

  const fetchMatchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/match/history");
      if (res.ok) {
        const data = await res.json();
        setMatchHistory(data.matches || []);
      }
    } catch (err) {
      console.error("Lỗi lấy lịch sử:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setEquippedThemeId(localStorage.getItem("board_theme") || "theme_classic");
      setEquippedSfxId(localStorage.getItem("equipped_sfx") || localStorage.getItem("board_sfx") || "sfx_retro");
    }

    const handleThemeChange = () => {
      setEquippedThemeId(localStorage.getItem("board_theme") || "theme_classic");
    };
    const handleSfxChange = () => {
      setEquippedSfxId(localStorage.getItem("equipped_sfx") || localStorage.getItem("board_sfx") || "sfx_retro");
    };

    window.addEventListener("theme_changed", handleThemeChange);
    window.addEventListener("sfx_changed", handleSfxChange);
    
    // Tải dữ liệu ban đầu
    fetchLeaderboard();
    fetchMissions();
    fetchMatchHistory();

    return () => {
      window.removeEventListener("theme_changed", handleThemeChange);
      window.removeEventListener("sfx_changed", handleSfxChange);
    };
  }, []);

  useEffect(() => {
    if (profile) {
      setNewUsername(profile.username);
    }
  }, [profile]);

  useEffect(() => {
    return () => {
      if (matchmakingIntervalRef.current) {
        clearInterval(matchmakingIntervalRef.current);
      }
    };
  }, []);

  if (!profile) return null;

  // Lấy các trang bị hiện tại
  const frameItem = SHOP_ITEMS.find((i) => i.id === profile.avatarFrame);
  const symbolXItem = SHOP_ITEMS.find((i) => i.id === profile.selectedSymbolX);
  const symbolOItem = SHOP_ITEMS.find((i) => i.id === profile.selectedSymbolO);
  const skinItem = SHOP_ITEMS.find((i) => i.id === profile.equippedChickenSkin);
  const bannerItem = SHOP_ITEMS.find((i) => i.id === profile.equippedBanner);

  // Phép tính kinh nghiệm cần để lên cấp theo công thức mới
  const expNeeded = getExpNeededForLevel(profile.level);
  const expPercent = Math.min(100, Math.floor((profile.exp / expNeeded) * 100));
  const rankInfo = profile ? getRankFromElo(profile.eloGomoku) : null;

  // Tỷ lệ hoàn thành Battle Pass
  const bpExpNeeded = 1000;
  const bpExpPercent = Math.min(100, Math.floor((profile.battlePassExp / bpExpNeeded) * 100));

  // Lấy trận đấu gần nhất để làm Revenge Widget (nếu có)
  const lastMatch = matchHistory[0];

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
      const { data, error } = await supabase.auth.updateUser({
        email: upgradeEmail,
        password: upgradePassword,
      });

      if (error) throw error;

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

  // Trạng thái sự kiện hè & Gửi tặng vật phẩm
  const [boxMessage, setBoxMessage] = useState("");

  const handleClaimQuest = async (questId: string) => {
    try {
      const res = await fetch("/api/user/event/claim-quest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        await refreshProfile();
      } else {
        alert(data.error || "Nhận thưởng thất bại!");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối máy chủ.");
    }
  };

  const handleOpenSummerBox = async () => {
    try {
      const res = await fetch("/api/user/event/open-box", {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setBoxMessage(data.message);
        await refreshProfile();
      } else {
        alert(data.error || "Mở rương thất bại!");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối máy chủ.");
    }
  };

  const handleGiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftUsername) return;
    setGiftSuccessMsg(`Đã gửi tặng vật phẩm thành công cho người chơi ${giftUsername}!`);
    setTimeout(() => {
      setShowGiftModal(false);
      setGiftUsername("");
      setGiftSuccessMsg("");
    }, 1500);
  };

  // 4. Trang bị vật phẩm đã mua
  const handleEquipItem = async (itemId: string, slot?: "X" | "O") => {
    try {
      const item = SHOP_ITEMS.find(i => i.id === itemId);
      
      const res = await fetch("/api/user/shop/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, slot }),
      });
      if (res.ok) {
        if (item?.type === "THEME") {
          localStorage.setItem("board_theme", itemId);
          setEquippedThemeId(itemId);
          window.dispatchEvent(new Event("theme_changed"));
        } else if (item?.type === "SFX") {
          localStorage.setItem("board_sfx", itemId);
          localStorage.setItem("equipped_sfx", itemId);
          setEquippedSfxId(itemId);
          window.dispatchEvent(new Event("sfx_changed"));
        }
        await refreshProfile();
      } else {
        const err = await res.json();
        alert(err.error || "Trang bị thất bại!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 5. Điểm danh nhận Coin hàng ngày (7-day calendar)
  const handleClaimDaily = async () => {
    setClaimingDaily(true);
    setDailyClaimMessage("");
    setDailyClaimError("");
    try {
      const res = await fetch("/api/user/progression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CLAIM_DAILY" })
      });
      const data = await res.json();
      if (res.ok) {
        setDailyClaimMessage(data.message);
        await refreshProfile();
        fetchMissions(); // Làm mới tiến trình nhiệm vụ đăng nhập
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

  // 5b. Mua thẻ Đóng Băng Chuỗi
  const handleBuyStreakFreeze = async () => {
    try {
      const res = await fetch("/api/user/progression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "BUY_FREEZE" })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        await refreshProfile();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 5c. Reset Mùa Giải
  const handleResetSeason = async () => {
    if (!confirm("Bạn có chắc chắn muốn reset mùa giải ngay lập tức để thử nghiệm? Tiến trình Rank của bạn sẽ lùi 2 cấp, Battle Pass về 1 và nhận quà kết thúc mùa giải.")) return;
    setResetSeasonLoading(true);
    try {
      const res = await fetch("/api/user/season-reset", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        await refreshProfile();
      } else {
        alert(data.error || "Reset thất bại");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối máy chủ");
    } finally {
      setResetSeasonLoading(false);
    }
  };

  // 5c. Kích hoạt Prestige
  const handlePrestige = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn kích hoạt Prestige? Cấp độ của bạn sẽ được đặt lại về 1, toàn bộ Skin được giữ nguyên và bạn sẽ nhận được Huy hiệu Danh Vọng mới!")) return;
    setPrestigeLoading(true);
    try {
      const res = await fetch("/api/user/progression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "PRESTIGE" })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        await refreshProfile();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPrestigeLoading(false);
    }
  };

  // 5d. Nhận thưởng nhiệm vụ hàng ngày
  const handleClaimMission = async (missionId: string) => {
    try {
      const res = await fetch("/api/user/progression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CLAIM_MISSION", missionId })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        await refreshProfile();
        fetchMissions();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 6. Nạp Coin bằng tiền thật (Chuyển khoản QR)
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

  // 7. Bắt đầu ghép trận ngẫu nhiên (Matchmaking)
  const handleStartMatchmaking = async () => {
    if (profile.eggs < matchWager) {
      alert("Bạn không đủ Trứng cược để tham gia hàng chờ này!");
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
          setMatchmaking(null);
          onSelectGame(selectedGame, "RANDOM", { roomId: data.room.id });
        } else if (data.retry) {
          setTimeout(handleStartMatchmaking, 1000);
        } else {
          // Lắng nghe Supabase Realtime
          const channel = supabase
            .channel(`matchmaking_${profile.id}`)
            .on(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "GameRoom" },
              (payload: any) => {
                const room = payload.new;
                if ((room.status === "PLAYING" || room.status === "WAITING") && (room.playerXId === profile.id || room.playerOId === profile.id)) {
                  if (matchmakingIntervalRef.current) {
                    clearInterval(matchmakingIntervalRef.current);
                    matchmakingIntervalRef.current = null;
                  }
                  supabase.removeChannel(channel);
                  setMatchmaking(null);
                  onSelectGame(room.gameType as any, "RANDOM", { roomId: room.id });
                }
              }
            )
            .subscribe();

          // Polling dự phòng (Tự động kích hoạt Bot sau 4 giây)
          const queueStartTime = Date.now();
          matchmakingIntervalRef.current = setInterval(async () => {
            try {
              const elapsed = Date.now() - queueStartTime;
              const forceBot = elapsed >= 4000;
              const pollRes = await fetch("/api/matchmaking/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ gameType: selectedGame, wager: matchWager, forceBot }),
              });
              if (pollRes.ok) {
                const pollData = await pollRes.json();
                if (pollData.matched) {
                  clearInterval(matchmakingIntervalRef.current);
                  matchmakingIntervalRef.current = null;
                  supabase.removeChannel(channel);
                  setMatchmaking(null);
                  onSelectGame(selectedGame, "RANDOM", { roomId: pollData.room.id });
                }
              }
            } catch (err) {
              console.error("Lỗi polling matchmaking:", err);
            }
          }, 3000);
        }
      }
    } catch (err) {
      console.error(err);
      setMatchmaking(null);
    }
  };

  const handleCancelMatchmaking = async () => {
    if (matchmakingIntervalRef.current) {
      clearInterval(matchmakingIntervalRef.current);
      matchmakingIntervalRef.current = null;
    }
    setMatchmaking(null);
    try {
      await fetch("/api/matchmaking/leave", { method: "POST" });
    } catch (err) {
      console.error(err);
    }
  };

  const handlePlayBot = () => {
    onSelectGame(selectedGame, "BOT", { difficulty: botDifficulty });
  };

  const handleCreateFriendRoom = async () => {
    if (profile.eggs < matchWager) {
      alert("Bạn không đủ Trứng để đặt cược phòng cờ này!");
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
        const room = await res.json();
        onSelectGame(selectedGame, "FRIEND", { roomId: room.id, isCreator: true });
      } else {
        const err = await res.json();
        alert(err.error || "Tạo phòng thất bại!");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingFriendLobby(false);
    }
  };

  const handleBuyPremiumCoins = async () => {
    setBuyingPremium(true);
    setPremiumError("");
    setPremiumSuccess(false);
    try {
      const res = await fetch("/api/user/premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 3 })
      });
      const data = await res.json();
      if (res.ok) {
        setPremiumSuccess(true);
        await refreshProfile();
        setTimeout(() => setPremiumSuccess(false), 3000);
      } else {
        setPremiumError(data.error || "Mua Premium thất bại");
      }
    } catch (err) {
      console.error(err);
      setPremiumError("Lỗi kết nối");
    } finally {
      setBuyingPremium(false);
    }
  };

  const handleBuyPremiumCash = async () => {
    setCashPaying(true);
    setCashError("");
    try {
      const res = await fetch("/api/user/premium-cash", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        await refreshProfile();
        setShowQRPaymentModal(false);
        alert("Gia hạn Premium thành công! Xin cảm ơn!");
      } else {
        setCashError(data.error || "Lỗi xử lý thanh toán");
      }
    } catch (err) {
      console.error(err);
      setCashError("Lỗi mạng");
    } finally {
      setCashPaying(false);
    }
  };

  const handleSpectate = (roomId: string) => {
    // Chế độ khán giả: truyền { isSpectator: true }
    onSelectGame("CARO", "FRIEND", { roomId, isSpectator: true });
  };

  // Quét danh sách các gói nạp xu
  const topupPackages = [
    { id: "package_20k", label: "20,000đ", coins: 100, desc: "Gói cơ bản" },
    { id: "package_50k", label: "50,000đ", coins: 300, desc: "Gói tiết kiệm" },
    { id: "package_100k", label: "100,000đ", coins: 650, desc: "Gói phổ biến" }
  ];

  return (
    <div className="flex-grow flex flex-col bg-[#141412] text-[#F3E5AB]">
      {/* Top Header */}
      <header className="border-b border-[#D4AF37]/15 py-4 px-6 bg-[#1C1C18] flex justify-between items-center sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-[#D4AF37] to-[#FF9F0A] flex items-center justify-center">
            <span className="font-bold text-[#141412] text-lg font-mono">G</span>
          </div>
          <div>
            <h1 className="text-md font-bold uppercase tracking-wider text-white">Gridline</h1>
            <p className="text-[7.5px] text-[#FF9F0A] tracking-wider uppercase font-semibold">Chạm Lưới, Đấu Trí</p>
          </div>
        </div>

        {/* Cấu trúc Header Progress & Actions */}
        <div className="flex items-center gap-4">
          {/* Cấp độ & Thanh EXP mini trên Header */}
          <div className="hidden sm:flex items-center gap-2 bg-[#141412] px-3 py-1.5 rounded-lg border border-[#D4AF37]/10">
            <div className="text-left shrink-0">
              <span className="text-[7px] text-[#F3E5AB]/65 uppercase block">Cấp độ</span>
              <span className="text-xs font-bold text-white flex items-center gap-0.5">
                {profile.prestigeLevel > 0 && <Star className="w-3 h-3 text-[#FF9F0A] fill-[#FF9F0A]" />}
                {profile.level}
              </span>
            </div>
            <div className="w-20 bg-black/40 h-2 rounded-full overflow-hidden border border-[#D4AF37]/10">
              <div className="bg-[#D4AF37] h-full" style={{ width: `${expPercent}%` }}></div>
            </div>
          </div>

          {/* Tiền tệ: Eggs */}
          <div className="flex items-center gap-2 bg-[#141412] px-3 py-1.5 rounded-lg border border-[#D4AF37]/10">
            <span className="text-sm">🥚</span>
            <div className="text-right">
              <span className="text-[6.5px] text-[#F3E5AB]/60 uppercase block">Trứng Gà</span>
              <span className="text-xs text-white font-mono font-bold">{profile.eggs}</span>
            </div>
            <button 
              onClick={() => setShowTopupModal(true)}
              className="ml-1 w-4 h-4 rounded bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] flex items-center justify-center font-bold text-xs transition"
            >
              +
            </button>
          </div>

          {/* Tiền tệ: Golden Eggs */}
          <div className="flex items-center gap-2 bg-[#141412] px-3 py-1.5 rounded-lg border border-[#D4AF37]/10">
            <span className="text-sm">✨</span>
            <div className="text-right">
              <span className="text-[6.5px] text-[#F3E5AB]/60 uppercase block">Trứng Vàng</span>
              <span className="text-xs text-[#FF9F0A] font-mono font-bold">{profile.goldenEggs ?? 0}</span>
            </div>
          </div>

          {/* Premium tag */}
          {profile.isPremium ? (
            <span className="hidden md:inline-flex items-center gap-1 text-[8px] bg-gradient-to-r from-[#D4AF37] to-[#FF9F0A] text-[#141412] px-2.5 py-1 rounded-full font-extrabold uppercase shadow-md">
              👑 Premium
            </span>
          ) : (
            <button
              onClick={() => setActiveTab("SETTINGS")}
              className="hidden md:flex items-center gap-1 text-[8px] bg-[#1C1C18] border border-[#D4AF37]/35 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#141412] px-2.5 py-1 rounded-full font-bold uppercase transition"
            >
              👑 Nâng Cấp
            </button>
          )}

          <button onClick={signOutUser} className="text-[#F3E5AB]/60 hover:text-red-400 p-1.5 transition">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main 3-Column Layout Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-6 flex flex-col lg:grid lg:grid-cols-12 gap-6 relative">
        
        {/* Column 1: Navigation Sidebar (PC Only) */}
        <div className="hidden lg:flex lg:col-span-2 flex-col gap-2 shrink-0">
          <button 
            onClick={() => setActiveTab("PLAY")}
            className={`pixel-btn justify-start py-3 px-4 uppercase text-[10px] gap-3 ${activeTab === "PLAY" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
          >
            <Swords className="w-4 h-4" />
            Đấu trường
          </button>
          <button 
            onClick={() => setActiveTab("SHOP")}
            className={`pixel-btn justify-start py-3 px-4 uppercase text-[10px] gap-3 ${activeTab === "SHOP" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
          >
            <ShoppingBag className="w-4 h-4" />
            Cửa hàng
          </button>
          <button 
            onClick={() => setActiveTab("BP")}
            className={`pixel-btn justify-start py-3 px-4 uppercase text-[10px] gap-3 ${activeTab === "BP" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
          >
            <Award className="w-4 h-4" />
            Battle Pass
          </button>
          <button 
            onClick={() => setActiveTab("EVENT")}
            className={`pixel-btn justify-start py-3 px-4 uppercase text-[10px] gap-3 ${activeTab === "EVENT" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
          >
            <Calendar className="w-4 h-4 text-[#FF9F0A] animate-pulse" />
            Sự kiện hè 🍉
          </button>
          <button 
            onClick={() => setActiveTab("SOCIAL")}
            className={`pixel-btn justify-start py-3 px-4 uppercase text-[10px] gap-3 ${activeTab === "SOCIAL" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
          >
            <Users className="w-4 h-4" />
            Hồ Sơ & Chuồng Gà
          </button>
          <button 
            onClick={() => setActiveTab("SETTINGS")}
            className={`pixel-btn justify-start py-3 px-4 uppercase text-[10px] gap-3 ${activeTab === "SETTINGS" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
          >
            <Settings className="w-4 h-4" />
            Cài đặt
          </button>
        </div>

        {/* Column 2: Main Content Panel (Middle) */}
        <div className="lg:col-span-7 flex-grow pixel-box p-6 min-h-[500px]">
          
          {/* TAB: PLAY (ĐẤU TRƯỜNG) */}
          {activeTab === "PLAY" && (
            <div className="space-y-6">
              
              {/* Event Banner */}
              <div className="pixel-box-nested p-4 bg-gradient-to-br from-[#1C1C18] via-[#141412] to-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-left space-y-1">
                  <span className="bg-[#FF9F0A]/10 text-[#FF9F0A] border border-[#FF9F0A]/30 text-[8px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Sự Kiện Đặc Biệt
                  </span>
                  <h3 className="text-base font-extrabold text-white">Đêm Hoàng Kim (Golden Night)</h3>
                  <p className="text-[10px] text-[#F3E5AB]/85 max-w-md leading-relaxed">
                    Đổi Visual vàng kim sang trọng, nhân đôi EXP vĩnh viễn cuối tuần, và mở khóa Event Shop vật phẩm đặc chế Obsidian Hoàng Gia.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("BP")}
                  className="bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] py-2 px-4 rounded-lg uppercase text-[10px] font-extrabold transition shrink-0"
                >
                  Khám phá ngay
                </button>
              </div>

              {/* Matchmaking Active Overlay */}
              {matchmaking?.active ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-6">
                  <div className="relative w-14 h-14 flex items-center justify-center border border-[#D4AF37]/20 rounded-full bg-[#1C1C18]">
                    <RefreshCw className="w-8 h-8 text-[#D4AF37] animate-spin" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-xs text-white uppercase tracking-widest font-extrabold animate-pulse">
                      Đang tìm đối thủ xếp hạng...
                    </h3>
                    <p className="text-[10px] text-[#FF9F0A] mt-2 uppercase font-mono">
                      Game: {matchmaking.gameType === "CARO" ? "Gomoku" : matchmaking.gameType} | Cược: {matchmaking.wager} Coin
                    </p>
                  </div>
                  <button onClick={handleCancelMatchmaking} className="pixel-btn pixel-btn-red py-2 px-6 uppercase text-[9px]">
                    Hủy tìm trận
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Revenge Widget */}
                  {lastMatch && (
                    <div className="pixel-box-nested p-4 border-l-4 border-l-[#FF9F0A] bg-[#1C1C18]/60 flex justify-between items-center gap-4">
                      <div>
                        <span className="text-[8px] text-[#F3E5AB]/50 uppercase tracking-widest font-bold">LẦN ĐẤU TRƯỚC</span>
                        <h4 className="text-xs font-bold text-white mt-0.5">
                          {lastMatch.winnerId === profile.id ? "Thắng" : lastMatch.winnerId ? "Thua" : "Hòa"} game {lastMatch.gameType === "CARO" ? "Gomoku" : lastMatch.gameType} vs{" "}
                          <span className="text-[#D4AF37]">
                            @{lastMatch.playerXId === profile.id ? lastMatch.playerO?.username : lastMatch.playerX?.username}
                          </span>
                        </h4>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedGame(lastMatch.gameType as any);
                          setSelectedMode("RANDOM");
                          setMatchWager(lastMatch.wager);
                          handleStartMatchmaking();
                        }}
                        className="bg-[#FF9F0A] hover:bg-[#D4AF37] text-[#141412] px-4 py-2 rounded-lg text-[9px] font-extrabold uppercase transition"
                      >
                        Phục Hận Ngay
                      </button>
                    </div>
                  )}

                  {/* Sảnh cờ lựa chọn cấu hình đấu */}
                  <div className="space-y-4">
                    <h3 className="text-xs text-[#D4AF37] uppercase font-bold tracking-wider border-b border-[#D4AF37]/15 pb-2">
                      Sảnh Đấu Trí
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Chọn game */}
                      <div className="pixel-box-nested p-4 space-y-3">
                        <span className="block text-[8px] text-[#F3E5AB]/60 uppercase tracking-wider font-semibold">1. Chọn trò chơi:</span>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => setSelectedGame("CARO")}
                            className={`pixel-btn text-[10px] py-2.5 ${selectedGame === "CARO" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                          >
                            Gomoku
                          </button>
                          <button
                            onClick={() => setSelectedGame("BATTLESHIP")}
                            className={`pixel-btn text-[10px] py-2.5 ${selectedGame === "BATTLESHIP" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                          >
                            Battleship
                          </button>
                          <button
                            onClick={() => setSelectedGame("TIC_TAC_TOE")}
                            className={`pixel-btn text-[10px] py-2.5 ${selectedGame === "TIC_TAC_TOE" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                          >
                            Caro 3x3
                          </button>
                        </div>
                      </div>

                      {/* Chọn chế độ */}
                      <div className="pixel-box-nested p-4 space-y-3">
                        <span className="block text-[8px] text-[#F3E5AB]/60 uppercase tracking-wider font-semibold">2. Chế độ chơi:</span>
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
                            <ChevronRight className="w-3 h-3 mr-2" /> Đấu với bạn (Mã phòng)
                          </button>
                          <button
                            onClick={() => setSelectedMode("RANDOM")}
                            className={`pixel-btn justify-start text-[10px] py-2 ${selectedMode === "RANDOM" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                          >
                            <ChevronRight className="w-3 h-3 mr-2" /> Xếp hạng (Online)
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Cấu hình chi tiết */}
                    <div className="pixel-box-nested p-4">
                      {selectedMode === "BOT" && (
                        <div className="space-y-4">
                          <div>
                            <span className="block text-[8px] text-[#F3E5AB]/60 uppercase tracking-wider font-semibold mb-2">Độ khó của Bot:</span>
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
                              <button
                                onClick={() => setBotDifficulty("HARD")}
                                className={`pixel-btn text-[9px] py-2 ${botDifficulty === "HARD" ? "pixel-btn-blue" : "pixel-btn-gray"}`}
                              >
                                Khó
                              </button>
                            </div>
                          </div>
                          <button 
                            onClick={handlePlayBot}
                            className="w-full pixel-btn pixel-btn-yellow py-3 text-xs uppercase font-extrabold gap-2"
                          >
                            <Play className="w-4 h-4 fill-black" /> Bắt đầu ngay
                          </button>
                        </div>
                      )}

                      {selectedMode === "FRIEND" && (
                        <div className="space-y-4">
                          <div>
                            <span className="block text-[8px] text-[#F3E5AB]/60 uppercase tracking-wider font-semibold mb-2">Mức cược Coin (Mỗi người):</span>
                            <div className="grid grid-cols-4 gap-2">
                              {[0, 10, 50, 100].map((c) => (
                                <button
                                  key={c}
                                  onClick={() => setMatchWager(c)}
                                  className={`pixel-btn text-[10px] py-2 ${matchWager === c ? "pixel-btn-blue" : "pixel-btn-gray"}`}
                                >
                                  {c} Coin
                                </button>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={handleCreateFriendRoom}
                            disabled={creatingFriendLobby}
                            className="w-full pixel-btn pixel-btn-yellow py-3 text-xs uppercase font-extrabold gap-2"
                          >
                            <Swords className="w-4 h-4" />
                            {creatingFriendLobby ? "Đang khởi tạo..." : "Tạo Sảnh Đợi & Link Mời"}
                          </button>
                        </div>
                      )}

                      {selectedMode === "RANDOM" && (
                        <div className="space-y-4">
                          <div>
                            <span className="block text-[8px] text-[#F3E5AB]/60 uppercase tracking-wider font-semibold mb-2">Mức cược trận đấu (Coin):</span>
                            <div className="grid grid-cols-4 gap-2">
                              {[0, 10, 50, 100].map((c) => (
                                <button
                                  key={c}
                                  onClick={() => setMatchWager(c)}
                                  className={`pixel-btn text-[10px] py-2 ${matchWager === c ? "pixel-btn-blue" : "pixel-btn-gray"}`}
                                >
                                  {c} Coin
                                </button>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={handleStartMatchmaking}
                            className="w-full pixel-btn pixel-btn-yellow py-3 text-xs uppercase font-extrabold gap-2"
                          >
                            <Swords className="w-4 h-4" />
                            Tìm đối thủ xếp hạng
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lịch sử trận đấu gần đây */}
                  <div className="space-y-3">
                    <h3 className="text-xs text-[#D4AF37] uppercase font-bold tracking-wider border-b border-[#D4AF37]/15 pb-2">
                      Lịch Sử Đấu Gần Nhất
                    </h3>
                    {loadingHistory ? (
                      <div className="text-center py-6 text-[10px] text-[#F3E5AB]/60 uppercase animate-pulse">Đang tải lịch sử...</div>
                    ) : matchHistory.length === 0 ? (
                      <div className="text-center py-6 text-[10px] text-[#F3E5AB]/50 uppercase">Chưa tham gia đấu trận nào</div>
                    ) : (
                      <div className="space-y-2">
                        {matchHistory.map((m) => {
                          const isX = m.playerXId === profile.id;
                          let opponent = isX ? m.playerO?.username : m.playerX?.username;
                          if (isX && m.playerOId === "bot") {
                            const names = ["KỳVươngĐấtBắc", "ThầnCờ9x", "VuaĐấuCờ", "SátThủGà", "MâyTrắng", "GàLửa99", "ĐộcCôCầuBại", "KêVươngChiến", "ThíchCáo", "ThợSănGà", "GàNhàLành", "TrứngBáchNhật", "GàChiếnThuật"];
                            const charSum = m.id.split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
                            opponent = names[charSum % names.length];
                          }
                          const win = m.winnerId === profile.id;
                          const draw = m.draw;
                          return (
                            <div key={m.id} className="bg-[#1C1C18] border border-[#D4AF37]/10 p-3 rounded-xl flex justify-between items-center text-xs">
                              <div>
                                <span className="font-bold text-white uppercase">{m.gameType === "CARO" ? "Gomoku" : m.gameType}</span>
                                <span className="text-[#F3E5AB]/60 block text-[10px]">Đối thủ: @{opponent || "Bot"}</span>
                              </div>
                              <div className="text-right">
                                <span className={`font-extrabold uppercase ${win ? "text-green-400" : draw ? "text-gray-400" : "text-red-400"}`}>
                                  {win ? "Thắng" : draw ? "Hòa" : "Thua"}
                                </span>
                                {m.wager > 0 && (
                                  <span className="block font-mono text-[9px] text-[#D4AF37]">
                                    {win ? `+${m.wager}` : `-${m.wager}`} 🥚
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: SHOP (CỬA HÀNG) */}
          {activeTab === "SHOP" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-[#D4AF37]/15 pb-3">
                <h2 className="text-md font-bold uppercase text-white">Cửa Hàng Skin & Soundpack</h2>
                <div className="flex gap-1.5 flex-wrap">
                  {["ALL", "SYMBOL", "FRAME", "THEME", "SFX", "EMOJI"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setShopCategory(cat as any)}
                      className={`text-[8.5px] uppercase px-2.5 py-1 rounded transition ${
                        shopCategory === cat 
                          ? "bg-[#D4AF37] text-[#141412] font-bold" 
                          : "bg-[#1C1C18] text-[#F3E5AB]/60 hover:text-white"
                      }`}
                    >
                      {cat === "ALL" ? "Tất cả" : cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {SHOP_ITEMS.filter((item) => shopCategory === "ALL" || item.type === shopCategory).map((item) => {
                  const isOwned = profile.purchasedItems.includes(item.id);
                  const isEquipped = 
                    item.type === "FRAME" ? profile.avatarFrame === item.id :
                    item.type === "SYMBOL" ? (profile.selectedSymbolX === item.id || profile.selectedSymbolO === item.id) :
                    item.type === "THEME" ? equippedThemeId === item.id :
                    item.type === "SFX" ? equippedSfxId === item.id : false;
                  
                  return (
                    <div key={item.id} className="bg-[#1C1C18] border border-[#D4AF37]/15 p-4 rounded-xl flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-[7.5px] bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded uppercase font-bold font-mono">
                            {item.type}
                          </span>
                          {!isOwned && (
                            <span className="text-[10px] text-white font-mono font-bold flex items-center gap-0.5">
                              <Coins className="w-3 h-3 text-[#D4AF37]" /> {item.price}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-white text-sm mt-2">{item.name}</h4>
                        <p className="text-[10px] text-[#F3E5AB]/75 leading-relaxed mt-1">{item.description}</p>
                      </div>

                      <div className="flex gap-2">
                        {isOwned ? (
                          isEquipped ? (
                            <button className="w-full bg-[#D4AF37]/20 border border-[#D4AF37]/45 text-[#D4AF37] text-[9px] uppercase font-bold py-2 rounded-lg cursor-not-allowed">
                              Đang dùng
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (item.type === "SYMBOL") {
                                  const slot = confirm("Bạn có muốn trang bị làm Quân Đen (đi trước - X) không? Chọn Cancel (Hủy) để trang bị làm Quân Trắng (đi sau - O).") ? "X" : "O";
                                  handleEquipItem(item.id, slot);
                                } else {
                                  handleEquipItem(item.id);
                                }
                              }}
                              className="w-full bg-[#1C1C18] border border-[#D4AF37]/30 hover:border-[#D4AF37] text-white text-[9px] uppercase font-bold py-2 rounded-lg transition"
                            >
                              Trang bị
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => handleBuyItem(item.id)}
                            className="w-full bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] text-[9px] uppercase font-extrabold py-2 rounded-lg transition"
                          >
                            Mua Ngay
                          </button>
                        )}
                        <button
                          onClick={() => { setGiftItemId(item.id); setShowGiftModal(true); }}
                          className="bg-[#1C1C18] border border-[#D4AF37]/15 p-2 rounded-lg hover:border-[#D4AF37] transition"
                          title="Tặng cho bạn bè"
                        >
                          <Gift className="w-3.5 h-3.5 text-[#D4AF37]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: BATTLE PASS (BẢN TIẾN TRÌNH THEO MÙA) */}
          {activeTab === "BP" && (
            <div className="space-y-6">
              <div className="border-b border-[#D4AF37]/15 pb-3">
                <span className="bg-[#FF9F0A]/10 text-[#FF9F0A] border border-[#FF9F0A]/30 text-[8px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Mùa Giải 1
                </span>
                <h2 className="text-lg font-bold uppercase text-white mt-1">Battle Pass: Đêm Hoàng Kim</h2>
                <p className="text-[10px] text-[#F3E5AB]/75">
                  Cày cuốc EXP thông qua hoàn thành Nhiệm vụ Hàng ngày & Hàng tuần để mở khóa 50 cấp độ phần thưởng độc quyền!
                </p>
              </div>

              {/* Progress overview */}
              <div className="bg-[#1C1C18] p-4 rounded-xl border border-[#D4AF37]/15 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-white">CẤP BATTLE PASS: {profile.battlePassLevel} / 50</span>
                  <span className="font-mono text-[#D4AF37]">{profile.battlePassExp} / {bpExpNeeded} XP</span>
                </div>
                <div className="w-full bg-black/40 h-3 rounded-full overflow-hidden border border-[#D4AF37]/10">
                  <div className="bg-gradient-to-r from-[#D4AF37] to-[#FF9F0A] h-full" style={{ width: `${bpExpPercent}%` }}></div>
                </div>
              </div>

              {/* Tracks information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#141412] p-4 rounded-xl border border-[#D4AF37]/10 text-left space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase">Nhánh Miễn Phí (Free Track)</h3>
                  <p className="text-[10.5px] text-[#F3E5AB]/70 leading-relaxed">
                    Nhận Xu thường, Avatar cơ bản, và danh hiệu vui nhộn ở các cấp độ chẵn (10, 20, 30, 40, 50).
                  </p>
                  <span className="text-[9px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded uppercase font-bold">
                    Đã mở khóa vĩnh viễn
                  </span>
                </div>

                <div className="bg-[#1C1C18] p-4 rounded-xl border border-[#FF9F0A]/30 text-left space-y-3">
                  <h3 className="text-xs font-bold text-[#FF9F0A] uppercase">Nhánh Cao Cấp (Premium Track)</h3>
                  <p className="text-[10.5px] text-[#F3E5AB]/70 leading-relaxed">
                    Mở khóa skin quân cờ mạ vàng 24K, hiệu ứng nổ pháo hoa hoàng kim, nhạc nền sảnh chờ, và hoàn lại 500 Coins khi đạt cấp 50.
                  </p>
                  <button
                    onClick={handleBuyPremiumCoins}
                    className="bg-gradient-to-r from-[#D4AF37] to-[#FF9F0A] text-[#141412] text-[10px] uppercase font-extrabold py-2 px-4 rounded-lg transition hover:brightness-110 shadow"
                  >
                    Kích hoạt ($4.99 / 99 xu)
                  </button>
                </div>
              </div>

              {/* Lộ trình phần thưởng */}
              <div className="bg-[#1C1C18] p-4 rounded-xl border border-[#D4AF37]/10 space-y-4">
                <h3 className="text-xs font-extrabold text-white uppercase border-b border-[#D4AF37]/10 pb-2">
                  🎁 Lộ Trình Phần Thưởng Mùa Giải
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1">
                  {[
                    { level: 1, free: "50 🥚", premium: "🎨 Khung Đêm Hoàng Kim" },
                    { level: 2, free: "100 🥚", premium: "🔊 Âm thanh Beach Club" },
                    { level: 5, free: "150 🥚", premium: "🌌 Tinh Vân Gà Banner" },
                    { level: 10, free: "🦊 Khung Cát Vàng", premium: "🪶 Gà Chiến Binh Skin" },
                    { level: 15, free: "200 🥚", premium: "🎲 Xúc Xắc Kim Cương" },
                    { level: 20, free: "🍉 Quân cờ Dưa Hấu", premium: "⚔️ Gà Hiệp Sĩ Skin" },
                    { level: 30, free: "300 🥚", premium: "⚡ Banner Cyber Neon" },
                    { level: 40, free: "400 🥚", premium: "✨ Biểu cảm Tối Thượng" },
                    { level: 50, free: "500 🥚 (Hoàn tiền)", premium: "👑 Gà Hoàng Gia Skin (VIP)" }
                  ].map((reward) => {
                    const isUnlocked = profile.battlePassLevel >= reward.level;
                    const hasPremium = profile.isPremium;
                    return (
                      <div 
                        key={reward.level} 
                        className={`p-3 rounded-xl border flex flex-col gap-2 relative overflow-hidden transition duration-200 ${
                          isUnlocked 
                            ? "bg-[#141412] border-[#D4AF37]/35 shadow" 
                            : "bg-[#1C1C18]/60 border-white/5 opacity-70"
                        }`}
                      >
                        <div className="flex justify-between items-center border-b border-[#D4AF37]/10 pb-1.5">
                          <span className="text-[10px] font-extrabold text-[#D4AF37] font-mono">CẤP {reward.level}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            isUnlocked ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"
                          }`}>
                            {isUnlocked ? "Đã đạt ✓" : "Chưa đạt 🔒"}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-[9.5px]">
                          {/* Free Reward */}
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">Miễn phí:</span>
                            <span className="font-semibold text-white">{reward.free}</span>
                          </div>

                          {/* Premium Reward */}
                          <div className="flex justify-between items-center">
                            <span className="text-[#FF9F0A]">Cao cấp:</span>
                            <span className={`font-semibold ${hasPremium ? "text-[#FF9F0A]" : "text-gray-500 font-normal"}`}>
                              {reward.premium} {!hasPremium && "🔒"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB: EVENT (SỰ KIỆN LIVEOP) */}
          {activeTab === "EVENT" && (
            <div className="space-y-6">
              <div className="border-b border-[#D4AF37]/15 pb-3">
                <h2 className="text-lg font-bold uppercase text-white">Sự Kiện Lễ Hội Mùa Hè 🍉</h2>
                <p className="text-[10px] text-[#F3E5AB]/75">
                  Làm các nhiệm vụ đặc thù để thu thập vỏ sò 🐚 đổi lấy Rương Quà May Mắn chứa Skin phiên bản giới hạn!
                </p>
              </div>

              {/* Event quests */}
              <div className="bg-[#1C1C18] p-4 rounded-xl border border-[#D4AF37]/10 space-y-4">
                <h3 className="text-xs font-extrabold text-white uppercase border-b border-[#D4AF37]/10 pb-2">
                  Chuỗi Nhiệm Vụ Kiếm Vỏ Sò
                </h3>

                <div className="space-y-3 text-xs">
                  {/* Quest 1 */}
                  <div className="flex justify-between items-center bg-[#141412] p-3 rounded-lg border border-[#D4AF37]/5">
                    <div>
                      <h4 className="font-bold text-white">1. Đăng nhập ngày lễ</h4>
                      <p className="text-[10px] text-[#F3E5AB]/60">Phần thưởng: 20 Coins, 15 Vỏ sò 🐚</p>
                    </div>
                    <button
                      onClick={() => handleClaimQuest("quest_daily")}
                      className="bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] text-[9.5px] uppercase font-bold py-1.5 px-3 rounded transition"
                    >
                      Nhận
                    </button>
                  </div>

                  {/* Quest 2 */}
                  <div className="flex justify-between items-center bg-[#141412] p-3 rounded-lg border border-[#D4AF37]/5">
                    <div>
                      <h4 className="font-bold text-white">2. Thắng 3 trận cờ bất kỳ</h4>
                      <p className="text-[10px] text-[#F3E5AB]/60">Phần thưởng: 50 Coins, 40 Vỏ sò 🐚</p>
                    </div>
                    <button
                      onClick={() => handleClaimQuest("quest_win_3")}
                      className="bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] text-[9.5px] uppercase font-bold py-1.5 px-3 rounded transition"
                    >
                      Nhận
                    </button>
                  </div>
                </div>
              </div>

              {/* Lootbox redemption */}
              <div className="bg-[#1C1C18] p-6 rounded-xl border border-[#FF9F0A]/20 text-center space-y-4">
                <h3 className="text-sm font-extrabold text-white uppercase">Cửa Hàng Sự Kiện: Rương Thần Kỳ</h3>
                <p className="text-[11px] text-[#F3E5AB]/75 max-w-sm mx-auto leading-relaxed">
                  Tiêu hao <span className="text-[#FF9F0A] font-bold">80 Vỏ sò 🐚</span> để quay thưởng mở Rương Thần Kỳ nhận ngay skin quân cờ Hổ phách hoặc soundpack MC ảo.
                </p>
                <button
                  onClick={handleOpenSummerBox}
                  className="bg-[#FF9F0A] hover:bg-[#D4AF37] text-[#141412] py-2.5 px-8 rounded-lg uppercase text-xs font-extrabold transition"
                >
                  Mở Rương (80 Vỏ sò)
                </button>
                {boxMessage && <p className="text-xs text-green-400 font-mono mt-2">{boxMessage}</p>}
              </div>
            </div>
          )}

          {/* TAB: SETTINGS (TÀI KHOẢN & CÀI ĐẶT) */}
          {activeTab === "SETTINGS" && (
            <div className="space-y-6">
              <h2 className="text-md font-bold uppercase text-white border-b border-[#D4AF37]/15 pb-3">Cài đặt tài khoản</h2>
              
              <div className="pixel-box-nested p-4 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase">Hồ sơ công khai</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] uppercase text-[#F3E5AB]/60 mb-2">Tên hiển thị (Username):</label>
                    {editingUsername ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          className="pixel-input flex-grow py-1 px-3"
                        />
                        <button onClick={handleSaveUsername} className="bg-[#D4AF37] text-[#141412] px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase">Lưu</button>
                        <button onClick={() => setEditingUsername(false)} className="bg-red-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase">Hủy</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-[#141412] p-3 rounded-lg border border-[#D4AF37]/10">
                        <span className="font-mono font-bold text-white">{profile.username}</span>
                        <button onClick={() => setEditingUsername(true)} className="text-[#FF9F0A] text-[9px] uppercase font-bold hover:underline">Đổi Tên</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* VIP Premium purchase options */}
              <div className="pixel-box-nested p-4 space-y-4 border border-[#D4AF37]/35 bg-gradient-to-br from-[#1C1C18] to-[#D4AF37]/5">
                <h3 className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5">
                  👑 Đăng Ký Premium Membership
                </h3>
                <p className="text-[10px] text-[#F3E5AB]/85 leading-relaxed">
                  Trở thành VIP để nhận các quyền lợi: Tắt quảng cáo, +15% EXP mỗi trận đấu, giảm 10% giá Cửa hàng, và nhận ngay Premium Track của Battle Pass mùa này.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-[#141412] p-3 rounded-lg border border-[#D4AF37]/10 text-center">
                    <span className="block text-[8px] text-[#F3E5AB]/50 uppercase font-semibold">Gói 1 Tháng</span>
                    <span className="text-sm font-bold text-white font-mono block mt-1">69,000 VNĐ / $2.99</span>
                    <button
                      onClick={() => setShowQRPaymentModal(true)}
                      className="bg-[#D4AF37] text-[#141412] text-[8.5px] uppercase font-extrabold w-full py-2 rounded-lg mt-3 transition hover:brightness-110"
                    >
                      Đăng ký ngay
                    </button>
                  </div>

                  <div className="bg-[#141412] p-3 rounded-lg border border-[#D4AF37]/10 text-center">
                    <span className="block text-[8px] text-[#F3E5AB]/50 uppercase font-semibold">Gói 6 Tháng</span>
                    <span className="text-sm font-bold text-white font-mono block mt-1">349,000 VNĐ / $14.99</span>
                    <button
                      onClick={() => setShowQRPaymentModal(true)}
                      className="bg-gradient-to-r from-[#D4AF37] to-[#FF9F0A] text-[#141412] text-[8.5px] uppercase font-extrabold w-full py-2 rounded-lg mt-3 transition hover:brightness-110"
                    >
                      Tiết kiệm 15%
                    </button>
                  </div>
                </div>
              </div>

              {/* Reset Mùa Giải Card (Test) */}
              <div className="pixel-box-nested p-4 space-y-4 border border-[#FF9F0A]/35 bg-[#1C1C18]">
                <h3 className="text-xs font-extrabold text-[#FF9F0A] uppercase flex items-center gap-1.5">
                  🔄 Chu Kỳ Mùa Giải & Đua Rank
                </h3>
                <p className="text-[10px] text-[#F3E5AB]/85 leading-relaxed">
                  Mùa giải kéo dài **60 ngày**. Khi kết thúc mùa, rank hiện tại của bạn sẽ bị **giảm đi 2 cấp**, Battle Pass reset về cấp 1, đồng thời nhận thưởng hạt giống Trứng 🥚 và Trứng Vàng ✨ dựa trên thành tích cao nhất.
                </p>
                <button
                  onClick={handleResetSeason}
                  disabled={resetSeasonLoading}
                  className="bg-gradient-to-r from-[#FF9F0A]/20 to-[#E53935]/20 hover:from-[#FF9F0A] hover:to-[#E53935] hover:text-[#141412] text-white border border-[#FF9F0A]/35 text-[9px] uppercase font-bold py-2 px-6 rounded-lg transition"
                >
                  {resetSeasonLoading ? "Đang tiến hành..." : "Reset Thử Nghiệm Mùa Giải (Lùi 2 Rank)"}
                </button>
              </div>

              {/* Guest account links */}
              {profile.isGuest && (
                <div className="pixel-box-nested p-4 space-y-4 border border-red-500/20 bg-[#1C1C18]">
                  <h3 className="text-xs font-bold text-red-400 uppercase flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    Bảo Vệ Tài Khoản Khách
                  </h3>
                  <p className="text-[10px] text-[#F3E5AB]/75 leading-relaxed">
                    Bạn đang chơi bằng tài khoản Khách vô danh. Liên kết với Email chính thức để tránh bị mất tiến trình, Skin và điểm số khi xóa cache trình duyệt!
                  </p>
                  <form onSubmit={handleUpgradeAccount} className="space-y-3">
                    <input
                      type="email"
                      value={upgradeEmail}
                      onChange={(e) => setUpgradeEmail(e.target.value)}
                      placeholder="Email liên kết"
                      required
                      className="w-full pixel-input py-1.5 px-3"
                    />
                    <input
                      type="password"
                      value={upgradePassword}
                      onChange={(e) => setUpgradePassword(e.target.value)}
                      placeholder="Mật khẩu tạo mới"
                      required
                      className="w-full pixel-input py-1.5 px-3"
                    />
                    <button
                      type="submit"
                      disabled={upgradeLoading}
                      className="bg-red-500 hover:bg-red-600 text-white text-[10px] uppercase font-bold py-2 px-6 rounded-lg transition"
                    >
                      {upgradeLoading ? "Đang xử lý..." : "Xác nhận Liên Kết"}
                    </button>
                  </form>
                  {upgradeSuccessMsg && <p className="text-xs text-green-400 font-mono mt-2">{upgradeSuccessMsg}</p>}
                </div>
              )}
            </div>
          )}

          {/* TAB: SOCIAL (Bạn Bè, Thành Tựu & Chuồng Gà) */}
          {activeTab === "SOCIAL" && (
            <div className="space-y-6">
              <div className="flex border-b border-[#D4AF37]/15 pb-3 justify-between items-center">
                <h2 className="text-md font-bold uppercase text-white">Nông Trại & Social</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSocialSubTab("FRIENDS")}
                    className={`px-3 py-1.5 rounded-lg text-[9px] uppercase font-bold border transition ${
                      socialSubTab === "FRIENDS" 
                        ? "bg-[#D4AF37] border-[#D4AF37] text-[#141412]" 
                        : "bg-[#1C1C18] border-[#D4AF37]/15 text-[#F3E5AB]/75 hover:border-[#D4AF37]"
                    }`}
                  >
                    Bạn Bè
                  </button>
                  <button 
                    onClick={() => setSocialSubTab("ACHIEVEMENTS")}
                    className={`px-3 py-1.5 rounded-lg text-[9px] uppercase font-bold border transition ${
                      socialSubTab === "ACHIEVEMENTS" 
                        ? "bg-[#D4AF37] border-[#D4AF37] text-[#141412]" 
                        : "bg-[#1C1C18] border-[#D4AF37]/15 text-[#F3E5AB]/75 hover:border-[#D4AF37]"
                    }`}
                  >
                    Thành Tựu
                  </button>
                  <button 
                    onClick={() => setSocialSubTab("GUILD")}
                    className={`px-3 py-1.5 rounded-lg text-[9px] uppercase font-bold border transition ${
                      socialSubTab === "GUILD" 
                        ? "bg-[#D4AF37] border-[#D4AF37] text-[#141412]" 
                        : "bg-[#1C1C18] border-[#D4AF37]/15 text-[#F3E5AB]/75 hover:border-[#D4AF37]"
                    }`}
                  >
                    Chuồng Gà
                  </button>
                </div>
              </div>

              {/* Sub-tab: FRIENDS (Bạn bè & Tổ đội) */}
              {socialSubTab === "FRIENDS" && (
                <div className="space-y-6">
                  {/* Friends lists */}
                  <div className="space-y-3 bg-[#1C1C18] p-4 rounded-xl border border-[#D4AF37]/10">
                    <span className="block text-[8px] text-[#F3E5AB]/60 uppercase tracking-wider font-semibold border-b border-[#D4AF37]/5 pb-2">
                      Danh Sách Bạn Bè (Giới hạn 30 bạn)
                    </span>
                    
                    <div className="space-y-3.5">
                      {friendsList.map((f, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${f.online ? "bg-green-400 animate-pulse" : "bg-gray-500"}`}></span>
                            <div>
                              <span className="font-bold text-white">@{f.username}</span>
                              <span className="text-[10px] text-[#F3E5AB]/60 block">{f.status}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {f.online && f.roomId && (
                              <button
                                onClick={() => handleSpectate(f.roomId)}
                                className="bg-gradient-to-r from-[#D4AF37]/20 to-[#FF9F0A]/20 hover:from-[#D4AF37] hover:to-[#FF9F0A] hover:text-[#141412] text-white border border-[#D4AF37]/35 py-1 px-3 rounded-lg text-[9px] font-bold uppercase transition flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" /> Xem
                              </button>
                            )}
                            {f.online && f.canParty && (
                              <button
                                onClick={() => alert(`Đã gửi lời mời tới @${f.username}`)}
                                className="bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] py-1 px-3 rounded-lg text-[9px] font-extrabold uppercase transition"
                              >
                                Mời
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Party creation */}
                  <div className="bg-[#1C1C18] p-4 rounded-xl border border-[#D4AF37]/10 text-center space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase flex items-center justify-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-[#D4AF37]" />
                      Tạo Tổ Đội Nhanh
                    </h4>
                    <p className="text-[10px] text-[#F3E5AB]/75 leading-relaxed">
                      Sao chép liên kết sảnh chờ chia sẻ cho bạn bè để gia nhập phòng đấu tức thì trên trình duyệt!
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/?joinRoom=room-party-id`);
                        alert("Đã sao chép Link mời tổ đội!");
                      }}
                      className="bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] py-2 px-6 rounded-lg text-[10px] font-extrabold uppercase transition flex items-center justify-center gap-2 mx-auto"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Sao chép Link Mời
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-tab: ACHIEVEMENTS (Thành tựu) */}
              {socialSubTab === "ACHIEVEMENTS" && (
                <div className="space-y-4">
                  {/* Achievements progress */}
                  <div className="bg-[#1C1C18] p-4 rounded-xl border border-[#D4AF37]/10 space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-white">Tiến trình Thành tựu</span>
                      <span className="text-[#D4AF37] font-mono">
                        {profile.achievementsUnlocked?.length || 0} / {ACHIEVEMENTS.length} ({Math.round(((profile.achievementsUnlocked?.length || 0) / ACHIEVEMENTS.length) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-[#D4AF37]/10">
                      <div 
                        className="bg-gradient-to-r from-[#D4AF37] to-[#FF9F0A] h-full transition-all duration-300"
                        style={{ width: `${((profile.achievementsUnlocked?.length || 0) / ACHIEVEMENTS.length) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Achievements list */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
                    {ACHIEVEMENTS.map(ach => {
                      const unlocked = profile.achievementsUnlocked?.includes(ach.id);
                      return (
                        <div 
                          key={ach.id} 
                          className={`p-3 rounded-xl border flex gap-3 items-center transition duration-200 ${
                            unlocked 
                              ? "bg-[#1C1C18] border-[#D4AF37]/35 shadow-md shadow-[#D4AF37]/5" 
                              : "bg-[#1C1C18]/40 border-white/5 opacity-55"
                          }`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-black/40 flex items-center justify-center text-xl shrink-0">
                            {ach.icon}
                          </div>
                          <div className="overflow-hidden">
                            <h4 className={`text-xs font-bold truncate ${unlocked ? "text-white" : "text-gray-400"}`}>
                              {ach.name}
                            </h4>
                            <p className="text-[9px] text-[#F3E5AB]/65 leading-tight mt-0.5">
                              {ach.description}
                            </p>
                            <span className="text-[8px] text-[#D4AF37] font-mono block mt-1">
                              {unlocked ? "✓ Đã mở" : `Thưởng: +${ach.rewardEggs} 🥚`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sub-tab: GUILD (Chuồng Gà - Chicken Coop) */}
              {socialSubTab === "GUILD" && (
                <div className="space-y-6">
                  {/* Guild overview */}
                  <div className="bg-[#1C1C18] p-4 rounded-xl border border-[#D4AF37]/20 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gradient-to-br from-[#1C1C18] to-[#D4AF37]/5">
                    <div className="text-left space-y-1">
                      <span className="bg-[#FF9F0A]/10 text-[#FF9F0A] border border-[#FF9F0A]/30 text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Chicken Coop (Guild)
                      </span>
                      <h3 className="text-base font-extrabold text-white">🏡 Kê Vương Đất Việt</h3>
                      <p className="text-[10px] text-[#F3E5AB]/75 leading-relaxed">
                        Cùng đồng đội chuồng gà cày cuốc, hoàn thành nhiệm vụ chuồng và đua top thế giới!
                      </p>
                    </div>
                    <div className="text-center bg-black/40 px-4 py-2 rounded-lg border border-[#D4AF37]/10 shrink-0 font-mono">
                      <span className="text-[9px] text-[#F3E5AB]/50 block">CẤP CHUỒNG</span>
                      <span className="text-lg font-bold text-[#D4AF37]">Lvl 12</span>
                    </div>
                  </div>

                  {/* Guild Stats & Missions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#1C1C18] p-4 rounded-xl border border-[#D4AF37]/10 space-y-3">
                      <h4 className="text-xs font-bold text-white uppercase border-b border-[#D4AF37]/5 pb-1">Nhiệm Vụ Chuồng Gà</h4>
                      <div className="space-y-2 text-[10.5px]">
                        <div className="flex justify-between">
                          <span>Tổng thắng 50 trận cờ tuần:</span>
                          <span className="font-mono text-[#D4AF37]">34/50</span>
                        </div>
                        <div className="w-full bg-black/30 h-1.5 rounded-full overflow-hidden border border-[#D4AF37]/5">
                          <div className="bg-[#D4AF37] h-full" style={{ width: "68%" }}></div>
                        </div>
                        <span className="text-[8px] text-[#F3E5AB]/50 block mt-1">Phần thưởng tuần: +200 🥚 & +20 ✨ cho mỗi thành viên.</span>
                      </div>
                    </div>

                    <div className="bg-[#1C1C18] p-4 rounded-xl border border-[#D4AF37]/10 space-y-3">
                      <h4 className="text-xs font-bold text-white uppercase border-b border-[#D4AF37]/5 pb-1">Xếp Hạng Thành Viên</h4>
                      <div className="space-y-2 text-[10.5px] max-h-[120px] overflow-y-auto">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[#FF9F0A] font-bold">🥇 @KỳThủGà (Chủ chuồng)</span>
                          <span className="font-mono">2500 elo</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-300 font-bold">🥈 @GàLửa99 (Phó chuồng)</span>
                          <span className="font-mono">2200 elo</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-[#D4AF37] bg-black/30 px-1 py-0.5 rounded">
                          <span>🥉 @{profile.username} (Bạn)</span>
                          <span className="font-mono">{profile.eloGomoku} elo</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Column 3: Progression Sidebar (Right Side - Desktop Only) */}
        <div className="hidden lg:flex lg:col-span-3 flex-col gap-6 shrink-0 text-left">
          
          {/* Profile Overview Card */}
          <div className={`pixel-box p-4 flex flex-col gap-4 relative overflow-hidden ${bannerItem?.visuals?.className || ""}`}>
            <div className="flex items-center gap-3 relative z-10">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border border-[#D4AF37]/20 relative ${frameItem?.visuals?.className || ""} ${skinItem?.visuals?.className || "bg-[#141412]"}`}>
                <span className="text-xl">🐔</span>
              </div>
              <div>
                <h3 className="font-bold text-white flex items-center gap-1 drop-shadow-md">
                  {profile.prestigeLevel > 0 && <Star className="w-4 h-4 text-[#FF9F0A] fill-[#FF9F0A]" />}
                  {profile.username}
                </h3>
                <div className="flex items-center gap-1.5 text-[9px] drop-shadow">
                  <span className={`${rankInfo?.className || "text-gray-400"} font-extrabold`}>
                    {rankInfo?.icon} {rankInfo?.name} {rankInfo?.divisionName}
                  </span>
                  <span className="text-[#F3E5AB]/60 font-mono">| Cấp {profile.level}</span>
                </div>
              </div>
            </div>

            {/* EXP bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] font-mono">
                <span>Kinh nghiệm:</span>
                <span>{profile.exp} / {expNeeded} XP</span>
              </div>
              <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-[#D4AF37]/10">
                <div className="bg-[#D4AF37] h-full transition-all duration-300" style={{ width: `${expPercent}%` }}></div>
              </div>
            </div>

            {/* Prestige Leveling Trigger Button */}
            {profile.level >= 50 && (
              <button
                onClick={handlePrestige}
                disabled={prestigeLoading}
                className="w-full bg-gradient-to-r from-[#D4AF37] to-[#FF9F0A] text-[#141412] py-2 rounded-lg text-[9.5px] font-extrabold uppercase transition hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5 shadow"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {prestigeLoading ? "Đang tiến hành..." : "Kích Hoạt Danh Vọng"}
              </button>
            )}

            {/* Mastery Stats */}
            <div className="border-t border-[#D4AF37]/10 pt-3 space-y-1.5">
              <span className="text-[8px] text-[#F3E5AB]/50 uppercase tracking-widest font-bold block mb-1">Chỉ Số Kỳ Thủ</span>
              <div className="flex justify-between text-[10px]">
                <span className="text-[#F3E5AB]/75">Thắng trước Gomoku:</span>
                <span className="font-mono font-bold text-white">54.2%</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-[#F3E5AB]/75">Chính xác Battleship:</span>
                <span className="font-mono font-bold text-white">78.5%</span>
              </div>
            </div>
          </div>

          {/* Daily Missions Card */}
          <div className="pixel-box p-4 space-y-4">
            <h4 className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5 border-b border-[#D4AF37]/10 pb-2">
              <Trophy className="w-4 h-4 text-[#FF9F0A]" />
              Nhiệm Vụ Hàng Ngày
            </h4>

            {loadingMissions ? (
              <div className="text-center text-[10px] text-gray-400 uppercase py-3">Đang cập nhật...</div>
            ) : (
              <div className="space-y-3">
                {missions.map((m) => {
                  const done = m.progress >= m.target;
                  return (
                    <div key={m.id} className="space-y-1">
                      <div className="flex justify-between text-[10.5px] leading-snug">
                        <span className={m.claimed ? "text-gray-500 line-through" : "text-white font-medium"}>
                          {m.description}
                        </span>
                        <span className="font-mono text-[9.5px] text-[#D4AF37]">
                          {m.progress}/{m.target}
                        </span>
                      </div>
                      
                      {!m.claimed && (
                        <div className="flex items-center gap-2">
                          <div className="flex-grow bg-black/40 h-1.5 rounded-full overflow-hidden border border-[#D4AF37]/5">
                            <div 
                              className="bg-[#D4AF37] h-full" 
                              style={{ width: `${Math.min(100, (m.progress / m.target) * 100)}%` }}
                            ></div>
                          </div>
                          {done && (
                            <button
                              onClick={() => handleClaimMission(m.id)}
                              className="bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] text-[8px] font-extrabold uppercase px-2 py-0.5 rounded transition shrink-0"
                            >
                              Nhận
                            </button>
                          )}
                        </div>
                      )}
                      
                      {m.claimed && (
                        <span className="text-[8px] text-green-400 font-mono block">✓ Đã nhận thưởng (+{m.rewardCoins} 🥚)</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Daily 7-day Login Claim calendar */}
          <div className="pixel-box p-4 space-y-4">
            <div className="flex justify-between items-center border-b border-[#D4AF37]/10 pb-2">
              <h4 className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#FF9F0A]" />
                Điểm Danh 7 Ngày
              </h4>
              <span className="text-[9px] bg-[#FF9F0A]/10 border border-[#FF9F0A]/35 text-[#FF9F0A] px-2 py-0.5 rounded font-mono font-bold">
                Chuỗi: {profile.loginStreak}
              </span>
            </div>

            {/* Streak freezes */}
            <div className="flex justify-between items-center text-[10px] bg-[#141412] p-2 rounded-lg border border-[#D4AF37]/5">
              <span>Đóng Băng Chuỗi: <strong className="font-mono text-[#D4AF37]">{profile.streakFreezes}</strong></span>
              <button
                onClick={handleBuyStreakFreeze}
                className="text-[8.5px] uppercase font-bold text-[#FF9F0A] hover:underline"
              >
                Mua (+10 🥚)
              </button>
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const isCurrent = profile.dailyStreakDay === day;
                const claimCoins = [10, 15, 20, 25, 30, 40, 50][day - 1];
                return (
                  <div 
                    key={day} 
                    className={`aspect-square flex flex-col justify-between items-center p-1 rounded border text-[8.5px] relative ${
                      isCurrent 
                        ? "bg-[#D4AF37]/15 border-[#D4AF37] text-white font-extrabold" 
                        : "bg-[#141412] border-[#D4AF37]/10 text-gray-500"
                    }`}
                  >
                    <span>Ng{day}</span>
                    <span className="font-mono text-[7px] text-[#D4AF37] font-semibold">+{claimCoins}🥚</span>
                  </div>
                );
              })}
            </div>

            {dailyClaimMessage && <p className="text-[9px] text-green-400 font-mono">{dailyClaimMessage}</p>}
            {dailyClaimError && <p className="text-[9px] text-red-400 font-mono">{dailyClaimError}</p>}

            <button
              onClick={handleClaimDaily}
              disabled={claimingDaily}
              className="w-full bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] py-2 rounded-lg text-[9.5px] font-extrabold uppercase transition"
            >
              {claimingDaily ? "Đang nhận..." : "Điểm Danh Ngày"}
            </button>
          </div>

          {/* Friends list sidebar (PC Only) */}
          <div className="pixel-box p-4 space-y-4">
            <h4 className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5 border-b border-[#D4AF37]/10 pb-2">
              <Users className="w-4 h-4 text-[#FF9F0A]" />
              Bạn Bè trực tuyến
            </h4>

            <div className="space-y-3">
              {friendsList.map((f, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${f.online ? "bg-green-400" : "bg-gray-500"}`}></span>
                    <div className="max-w-[100px]">
                      <span className="font-bold text-white block truncate">@{f.username}</span>
                      <span className="text-[8.5px] text-[#F3E5AB]/50 block truncate">{f.status}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {f.online && f.roomId && (
                      <button
                        onClick={() => handleSpectate(f.roomId)}
                        className="bg-[#141412] hover:bg-[#D4AF37] hover:text-[#141412] border border-[#D4AF37]/20 p-1.5 rounded transition"
                        title="Xem trận"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                    )}
                    {f.online && f.canParty && (
                      <button
                        onClick={() => alert(`Đã gửi lời mời tới @${f.username}`)}
                        className="bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] px-2 py-0.5 rounded text-[8px] font-bold uppercase transition"
                      >
                        Mời
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Invite Party link creation */}
            <div className="border-t border-[#D4AF37]/10 pt-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/?joinRoom=room-party-id`);
                  alert("Đã sao chép Link mời tổ đội!");
                }}
                className="w-full bg-[#1C1C18] border border-[#D4AF37]/20 hover:border-[#D4AF37] text-white py-1.5 rounded text-[8.5px] font-bold uppercase transition flex items-center justify-center gap-1"
              >
                <Link2 className="w-3 h-3" /> Tạo Tổ Đội
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation Bar (Mobile Only) */}
      <nav className="lg:hidden border-t border-[#D4AF37]/15 bg-[#1C1C18] py-2 px-4 flex justify-between items-center fixed bottom-0 left-0 right-0 z-40 shadow-inner">
        <button
          onClick={() => setActiveTab("PLAY")}
          className={`flex flex-col items-center gap-0.5 flex-1 ${activeTab === "PLAY" ? "text-[#D4AF37] font-bold" : "text-[#F3E5AB]/55"}`}
        >
          <Swords className="w-5 h-5" />
          <span className="text-[8px] uppercase">Đấu</span>
        </button>

        <button
          onClick={() => setActiveTab("SHOP")}
          className={`flex flex-col items-center gap-0.5 flex-1 ${activeTab === "SHOP" ? "text-[#D4AF37] font-bold" : "text-[#F3E5AB]/55"}`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span className="text-[8px] uppercase">Cửa hàng</span>
        </button>

        <button
          onClick={() => setActiveTab("BP")}
          className={`flex flex-col items-center gap-0.5 flex-1 ${activeTab === "BP" ? "text-[#D4AF37] font-bold" : "text-[#F3E5AB]/55"}`}
        >
          <Award className="w-5 h-5" />
          <span className="text-[8px] uppercase">BP</span>
        </button>

        <button
          onClick={() => setActiveTab("SOCIAL")}
          className={`flex flex-col items-center gap-0.5 flex-1 ${activeTab === "SOCIAL" ? "text-[#D4AF37] font-bold" : "text-[#F3E5AB]/55"}`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[8px] uppercase">Bạn bè</span>
        </button>

        <button
          onClick={() => setActiveTab("SETTINGS")}
          className={`flex flex-col items-center gap-0.5 flex-1 ${activeTab === "SETTINGS" ? "text-[#D4AF37] font-bold" : "text-[#F3E5AB]/55"}`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[8px] uppercase">Cài đặt</span>
        </button>
      </nav>

      {/* MODAL 1: COIN TOPUP */}
      {showTopupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="pixel-box p-6 w-full max-w-md bg-[#1C1C18] border border-[#D4AF37]/30 text-left space-y-4">
            <div className="flex justify-between items-center border-b border-[#D4AF37]/15 pb-2">
              <h3 className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-[#D4AF37]" />
                Nạp Coin Bằng VietQR Động
              </h3>
              <button onClick={() => setShowTopupModal(false)} className="text-gray-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="block text-[8px] text-[#F3E5AB]/65 uppercase font-semibold">Chọn gói nạp:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {topupPackages.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedTopupPackage(pkg.id)}
                    className={`p-3 rounded-lg border text-center transition flex flex-col items-center justify-between ${
                      selectedTopupPackage === pkg.id 
                        ? "bg-[#D4AF37]/10 border-[#D4AF37] text-white" 
                        : "bg-[#141412] border-[#D4AF37]/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    <span className="text-xs font-bold font-mono">{pkg.label}</span>
                    <span className="text-[9px] text-[#D4AF37] font-bold mt-1 font-mono">+{pkg.coins} Coins</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Generated QR details */}
            <div className="bg-[#141412] p-4 rounded-xl border border-[#D4AF37]/10 flex flex-col items-center space-y-4 text-center">
              <QRCodeSVG 
                value={`2afcb910-vietqr-payload-${selectedTopupPackage}-${profile.id}`} 
                size={140}
                bgColor="#141412"
                fgColor="#F3E5AB"
              />
              <div>
                <p className="text-[10px] text-white font-bold">NGÂN HÀNG QUÂN ĐỘI (MB)</p>
                <p className="text-[10.5px] text-[#D4AF37] font-mono font-bold mt-0.5">Số tài khoản: 0999999999999</p>
                <p className="text-[9px] text-[#F3E5AB]/65 mt-1">Nội dung CK: <strong className="font-mono text-[#FF9F0A]">{profile.username} NAPCOIN</strong></p>
              </div>
            </div>

            {topupSuccess && <p className="text-xs text-green-400 font-mono text-center">✓ Đã nhận thanh toán! +{topupPackages.find(p => p.id === selectedTopupPackage)?.coins} Coins.</p>}
            {topupError && <p className="text-xs text-red-400 font-mono text-center">✗ Lỗi: {topupError}</p>}

            <button
              onClick={handleConfirmTopupCoin}
              disabled={topupPaying}
              className="w-full bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] py-2.5 rounded-lg text-xs font-extrabold uppercase transition"
            >
              {topupPaying ? "Đang xác thực giao dịch..." : "Giả lập Đã chuyển khoản"}
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: GIFT ITEM */}
      {showGiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
          <div className="pixel-box p-6 w-full max-w-sm bg-[#1C1C18] border border-[#D4AF37]/30 text-left space-y-4">
            <div className="flex justify-between items-center border-b border-[#D4AF37]/15 pb-2">
              <h3 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-[#D4AF37]" />
                Tặng Trang Bị Cho Bạn Bè
              </h3>
              <button onClick={() => setShowGiftModal(false)} className="text-gray-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGiftSubmit} className="space-y-4">
              <div>
                <label className="block text-[8.5px] uppercase text-[#F3E5AB]/60 mb-2">Nhập Username người nhận:</label>
                <input
                  type="text"
                  value={giftUsername}
                  onChange={(e) => setGiftUsername(e.target.value)}
                  placeholder="Viết đúng tên kỳ thủ..."
                  required
                  className="w-full pixel-input py-2 px-3"
                />
              </div>

              {giftSuccessMsg && <p className="text-xs text-green-400 font-mono">{giftSuccessMsg}</p>}
              {giftError && <p className="text-xs text-red-400 font-mono">✗ {giftError}</p>}

              <button
                type="submit"
                disabled={gifting}
                className="w-full bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] py-2.5 rounded-lg text-xs font-extrabold uppercase transition"
              >
                {gifting ? "Đang gửi..." : "Xác Nhận Tặng Quà"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: QR PAYMENT PREMIUM */}
      {showQRPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
          <div className="pixel-box p-6 w-full max-w-sm bg-[#1C1C18] border border-[#D4AF37]/30 text-left space-y-4">
            <div className="flex justify-between items-center border-b border-[#D4AF37]/15 pb-2">
              <h3 className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5">
                👑 Mua Gói VIP Premium
              </h3>
              <button onClick={() => setShowQRPaymentModal(false)} className="text-gray-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center space-y-4 text-center">
              <QRCodeSVG 
                value={`vietqr-premium-payload-${profile.id}`} 
                size={140}
                bgColor="#141412"
                fgColor="#F3E5AB"
              />
              <div>
                <p className="text-[10px] text-white font-bold">NGÂN HÀNG QUÂN ĐỘI (MB)</p>
                <p className="text-[10.5px] text-[#D4AF37] font-mono font-bold mt-0.5">Số tài khoản: 0999999999999</p>
                <p className="text-[9px] text-[#F3E5AB]/65 mt-1">Nội dung CK: <strong className="font-mono text-[#FF9F0A]">{profile.username} PREMIUM</strong></p>
              </div>
            </div>

            {cashError && <p className="text-xs text-red-400 font-mono text-center">✗ Lỗi: {cashError}</p>}

            <button
              onClick={handleBuyPremiumCash}
              disabled={cashPaying}
              className="w-full bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] py-2.5 rounded-lg text-xs font-extrabold uppercase transition"
            >
              {cashPaying ? "Đang xử lý..." : "Giả lập Đã chuyển khoản VIP"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
