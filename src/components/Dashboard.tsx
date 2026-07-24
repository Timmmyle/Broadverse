"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "./providers/AuthProvider";
import { useAlert } from "./providers/AlertProvider";
import { SHOP_ITEMS, ShopItem, getShopItem } from "@/lib/shopItems";
import { createClient } from "@/lib/supabase/client";
import { 
  Coins, Trophy, LogOut, ShoppingBag, Settings, Play, 
  User as UserIcon, X, Swords, RefreshCw, Sparkles, Check, ChevronRight,
  CreditCard, Calendar, Gift, Volume2, Smile, Flame, ShieldAlert, Award, Star, Eye, UserPlus, Link2, Users,
  Crown, Music, Flag, Dice5, Lock, ChevronLeft, Gamepad2, Mail
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getExpNeededForLevel, DailyMission, getRankFromElo, getRankFromDb, ACHIEVEMENTS } from "@/lib/progression";
import confetti from "canvas-confetti";


interface DashboardProps {
  onSelectGame: (game: "TIC_TAC_TOE" | "CARO" | "BATTLESHIP" | "BAU_CUA", mode: "BOT" | "FRIEND" | "RANDOM", details: any) => void;
}

export default function Dashboard({ onSelectGame }: DashboardProps) {
  const { profile, signOutUser, refreshProfile, loginWithGoogle } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const supabase = createClient();

  // Tab chính trên PC: "PLAY" | "SHOP" | "SETTINGS"
  // Trên Mobile, 4 tab bottom bar sẽ map tới các view: "PLAY" (Đấu), "SHOP" (Cửa hàng), "BP" (Battle Pass), "SOCIAL" (Cá nhân & Bạn bè)
  const [activeTab, setActiveTab] = useState<"PLAY" | "SHOP" | "SETTINGS" | "BP" | "SOCIAL">("PLAY");
  const bpScrollRef = useRef<HTMLDivElement>(null);

  const scrollBP = (direction: "left" | "right") => {
    if (bpScrollRef.current) {
      const scrollAmount = 300;
      bpScrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };
  
  // Trạng thái lọc Cửa hàng
  const [shopCategory, setShopCategory] = useState<"ALL" | "SYMBOL" | "FRAME" | "THEME" | "SFX" | "EMOJI" | "SKIN">("ALL");

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
    gameType: "TIC_TAC_TOE" | "CARO" | "BATTLESHIP" | "BAU_CUA";
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
  const [selectedPremiumDuration, setSelectedPremiumDuration] = useState<1 | 6>(1);
  const [cashPaying, setCashPaying] = useState(false);
  const [sepayRedirecting, setSepayRedirecting] = useState(false);
  const [cashError, setCashError] = useState("");

  // Game Options
  const [selectedGame, setSelectedGame] = useState<"TIC_TAC_TOE" | "CARO" | "BATTLESHIP" | "BAU_CUA">("CARO");
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

  // Trạng thái hệ thống Bạn Bè (Friendship) & Tổ Đội (Party)
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingFriends, setPendingFriends] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [addFriendUsername, setAddFriendUsername] = useState("");
  const [addFriendLoading, setAddFriendLoading] = useState(false);

  // Tổ đội
  const [activeParty, setActiveParty] = useState<any | null>(null);
  const [partyMembers, setPartyMembers] = useState<any[]>([]);
  const [loadingParty, setLoadingParty] = useState(false);
  const [partyMessages, setPartyMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [showDiscordModal, setShowDiscordModal] = useState(false);
  const [showGuestLinkModal, setShowGuestLinkModal] = useState(false);
  const [claimingDiscord, setClaimingDiscord] = useState(false);

  
  // Lời mời tổ đội đang chờ
  const [activeInvite, setActiveInvite] = useState<{
    partyId: string;
    senderUsername: string;
    partyName?: string;
    gameType: string;
    wager: number;
  } | null>(null);

  // Lời mời trực tiếp vào phòng đấu đang chờ
  const [activeGameInvite, setActiveGameInvite] = useState<{
    roomId: string;
    senderUsername: string;
    gameType: string;
    wager: number;
  } | null>(null);

  // Tự động đồng bộ matchWager khi chọn Bầu Cua hoặc các game khác
  useEffect(() => {
    if (selectedGame === "BAU_CUA") {
      if (selectedMode === "RANDOM") {
        setMatchWager(999999);
      } else if (matchWager === 0 || matchWager === 999999) {
        setMatchWager(10); // mặc định giới hạn 10 cho Friend/Bot
      }
    } else {
      if (matchWager === 999999) {
        setMatchWager(0);
      }
    }
  }, [selectedGame, selectedMode]);

  const fetchFriends = async () => {
    setLoadingFriends(true);
    try {
      const res = await fetch("/api/friends/list");
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
        setPendingFriends(data.pendingRequests || []);
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách bạn bè:", err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleAcceptFriendRequest = async (friendId: string) => {
    if (!profile) return;
    try {
      const res = await fetch("/api/friends/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ACCEPT", friendId })
      });
      const data = await res.json();
      if (res.ok) {
        // Gửi thông báo real-time tới người gửi kết bạn
        const senderUserId = data.friendship.userId;
        const channel = supabase.channel(`user_notifications_${senderUserId}`);
        await channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.send({
              type: "broadcast",
              event: "friend_accept",
              payload: {
                accepterId: profile.id,
                accepterUsername: profile.username
              }
            });
            supabase.removeChannel(channel);
          }
        });

        showAlert(data.message || "Đã chấp nhận kết bạn!");
        fetchFriends();
      } else {
        showAlert(data.error || "Không thể chấp nhận kết bạn");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectFriendRequest = async (friendId: string) => {
    try {
      const res = await fetch("/api/friends/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REMOVE", friendId })
      });
      if (res.ok) {
        showAlert("Đã từ chối yêu cầu kết bạn!");
        fetchFriends();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!profile || !addFriendUsername.trim()) return;
    setAddFriendLoading(true);
    try {
      const res = await fetch("/api/friends/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SEND", friendUsername: addFriendUsername.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        // Gửi thông báo real-time tới người nhận kết bạn
        const targetUserId = data.friendship.friendId;
        const channel = supabase.channel(`user_notifications_${targetUserId}`);
        await channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.send({
              type: "broadcast",
              event: "friend_request",
              payload: {
                senderId: profile.id,
                senderUsername: profile.username
              }
            });
            supabase.removeChannel(channel);
          }
        });

        showAlert(data.message || "Đã gửi yêu cầu kết bạn!");
        setAddFriendUsername("");
        fetchFriends();
      } else {
        showAlert(data.error || "Không thể gửi yêu cầu kết bạn");
      }
    } catch (err) {
      console.error(err);
      showAlert("Lỗi kết nối gửi kết bạn");
    } finally {
      setAddFriendLoading(false);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!confirm("Bạn có chắc chắn muốn hủy kết bạn?")) return;
    try {
      const res = await fetch("/api/friends/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REMOVE", friendId })
      });
      if (res.ok) {
        showAlert("Đã hủy kết bạn thành công");
        fetchFriends();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBlockUser = async (friendId: string) => {
    if (!confirm("Bạn có chắc chắn muốn chặn người chơi này?")) return;
    try {
      const res = await fetch("/api/friends/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "BLOCK", friendId })
      });
      if (res.ok) {
        showAlert("Đã chặn thành công. Bạn sẽ không bị ghép trận với người này nữa.");
        fetchFriends();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCurrentParty = async () => {
    setLoadingParty(true);
    try {
      const res = await fetch("/api/party/current");
      if (res.ok) {
        const data = await res.json();
        setActiveParty(data.party);
        setPartyMembers(data.party?.members || []);
        setPartyMessages(data.party?.messages || []);

      }
    } catch (err) {
      console.error("Lỗi lấy thông tin tổ đội:", err);
    } finally {
      setLoadingParty(false);
    }
  };

  const handleCreateParty = async () => {
    try {
      const res = await fetch("/api/party/create", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setActiveParty(data.party);
        fetchCurrentParty();
        showAlert("Khởi tạo tổ đội thành công!");
      } else {
        showAlert(data.error || "Không thể tạo tổ đội");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoinParty = async (partyId: string) => {
    try {
      const res = await fetch("/api/party/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyId })
      });
      const data = await res.json();
      if (res.ok) {
        setActiveParty(data.party);
        fetchCurrentParty();
        showAlert("Đã gia nhập tổ đội thành công!");
      } else {
        showAlert(data.error || "Không thể gia nhập tổ đội");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeaveParty = () => {
    if (!profile) return;
    showConfirm({
      title: "Rời Chuồng Gà",
      message: "Bạn có chắc chắn muốn rời Chuồng Gà (tổ đội) này không?",
      confirmText: "Rời Chuồng",
      cancelText: "Hủy",
      onConfirm: async () => {
        try {
          const res = await fetch("/api/party/leave", { method: "POST" });
          if (res.ok) {
            if (activeParty && activeParty.leaderId === profile.id) {
              const channel = supabase.channel(`party_${activeParty.id}`);
              await channel.subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                  await channel.send({
                    type: "broadcast",
                    event: "party_disband",
                    payload: {}
                  });
                  supabase.removeChannel(channel);
                }
              });
            } else if (activeParty) {
              const channel = supabase.channel(`party_${activeParty.id}`);
              await channel.subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                  await channel.send({
                    type: "broadcast",
                    event: "party_update",
                    payload: {}
                  });
                  supabase.removeChannel(channel);
                }
              });
            }
            setActiveParty(null);
            setPartyMembers([]);
            showAlert("Đã rời tổ đội");
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const handleKickMember = (targetUserId: string) => {
    showConfirm({
      title: "Trục Xuất Thành Viên",
      message: "Bạn có chắc chắn muốn trục xuất thành viên này khỏi Chuồng Gà?",
      confirmText: "Trục Xuất",
      cancelText: "Hủy",
      onConfirm: async () => {
        try {
          const res = await fetch("/api/party/kick", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId })
          });
          if (res.ok) {
            const channel = supabase.channel(`party_${activeParty.id}`);
            await channel.subscribe(async (status) => {
              if (status === "SUBSCRIBED") {
                await channel.send({
                  type: "broadcast",
                  event: "party_update",
                  payload: {}
                });
                supabase.removeChannel(channel);
              }
            });
            fetchCurrentParty();
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const handleUpdatePartyConfig = async (gameType: string, wager: number) => {
    try {
      const res = await fetch("/api/party/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType, wager })
      });
      if (res.ok) {
        const channel = supabase.channel(`party_${activeParty.id}`);
        await channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.send({
              type: "broadcast",
              event: "party_update",
              payload: {}
            });
            supabase.removeChannel(channel);
          }
        });
        fetchCurrentParty();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleInviteFriend = async (friendId: string, friendUsername: string) => {
    if (!profile) return;
    try {
      let currentPartyId = activeParty?.id;
      if (!currentPartyId) {
        const createRes = await fetch("/api/party/create", { method: "POST" });
        if (createRes.ok) {
          const createData = await createRes.json();
          currentPartyId = createData.party.id;
          setActiveParty(createData.party);
          fetchCurrentParty();
        } else {
          showAlert("Không thể tạo tổ đội để mời bạn bè");
          return;
        }
      }
      
      const channel = supabase.channel(`user_notifications_${friendId}`);
      await channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.send({
            type: "broadcast",
            event: "party_invite",
            payload: {
              partyId: currentPartyId,
              senderUsername: profile.username,
              partyName: activeParty?.name || `Tổ đội của @${profile.username}`,
              gameType: activeParty?.gameType || "CARO",
              wager: activeParty?.wager || 0
            }
          });
          showAlert(`Đã gửi lời mời tham gia tổ đội tới @${friendUsername}`);
          supabase.removeChannel(channel);
        }
      });
    } catch (err) {
      console.error(err);
      showAlert("Lỗi kết nối mời bạn");
    }
  };

  const handleStartPartyMatchmaking = async () => {
    if (!activeParty) return;
    try {
      const createRes = await fetch("/api/match/create-friend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: activeParty.gameType || "CARO",
          wager: activeParty.wager || 0
        })
      });
      
      if (createRes.ok) {
        const roomData = await createRes.json();
        const roomId = roomData.id;
        
        const channel = supabase.channel(`party_${activeParty.id}`);
        await channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.send({
              type: "broadcast",
              event: "party_match_start",
              payload: {
                roomId,
                gameType: activeParty.gameType || "CARO"
              }
            });
            supabase.removeChannel(channel);
          }
        });
        
        onSelectGame(activeParty.gameType as any, "FRIEND", { roomId });
      } else {
        const errData = await createRes.json();
        showAlert(errData.error || "Không thể bắt đầu ghép trận");
      }
    } catch (err) {
      console.error(err);
      showAlert("Lỗi kết nối bắt đầu trận tổ đội");
    }
  };

  const handleSendPartyChat = async () => {
    if (!profile || !chatInput.trim() || !activeParty) return;
    const textToSend = chatInput.trim();
    setChatInput(""); // Xóa input ngay lập tức để tạo cảm giác mượt mà
    try {
      // Lưu tin nhắn vào Database
      await fetch("/api/party/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend })
      });

      // Phát Realtime broadcast cho các thành viên
      const partyChannel = supabase.channel(`party_${activeParty.id}`);
      await partyChannel.send({
        type: "broadcast",
        event: "party_chat",
        payload: {
          senderUsername: profile.username,
          message: textToSend,
          timestamp: new Date().toISOString()
        }
      });
      setPartyMessages((prev) => [...prev, {
        senderUsername: profile.username,
        message: textToSend,
        timestamp: new Date().toISOString()
      }]);
    } catch (err) {
      console.error("Lỗi gửi tin nhắn:", err);
    }
  };


  const handleAcceptGameInvite = async () => {
    if (!activeGameInvite) return;
    try {
      const res = await fetch("/api/match/join-friend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: activeGameInvite.roomId })
      });
      if (res.ok) {
        const gameType = activeGameInvite.gameType as any;
        const roomId = activeGameInvite.roomId;
        setActiveGameInvite(null);
        onSelectGame(gameType, "FRIEND", { roomId });
      } else {
        const errData = await res.json();
        showAlert(errData.error || "Không thể tham gia phòng đấu này");
        setActiveGameInvite(null);
      }
    } catch (err) {
      console.error(err);
      showAlert("Lỗi kết nối khi tham gia phòng đấu");
      setActiveGameInvite(null);
    }
  };

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

  // 1. Theo dõi thay đổi activeParty để lắng nghe sự kiện Realtime của tổ đội
  useEffect(() => {
    if (!activeParty) return;

    const partyChannel = supabase.channel(`party_${activeParty.id}`);
    partyChannel
      .on("broadcast", { event: "party_update" }, () => {
        fetchCurrentParty();
      })
      .on("broadcast", { event: "party_disband" }, () => {
        setActiveParty(null);
        setPartyMembers([]);
        showAlert("Tổ đội đã bị giải tán");
      })
      .on("broadcast", { event: "party_match_start" }, (payload: any) => {
        const { roomId, gameType } = payload.payload;
        fetch("/api/match/join-friend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId })
        })
          .then(res => {
            if (res.ok) {
              onSelectGame(gameType, "FRIEND", { roomId });
            }
          })
          .catch(err => console.error(err));
      })
      .on("broadcast", { event: "party_chat" }, (payload: any) => {
        setPartyMessages((prev) => [...prev, payload.payload]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(partyChannel);
    };
  }, [activeParty]);

  // 2. Lắng nghe lời mời tổ đội, yêu cầu kết bạn real-time & quản lý Presence (trực tuyến)
  useEffect(() => {
    if (!profile) return;

    // Tải dữ liệu ban đầu
    fetchCurrentParty();
    fetchFriends();

    // Lắng nghe các thông báo real-time cá nhân
    const inviteChannel = supabase.channel(`user_notifications_${profile.id}`);
    inviteChannel
      .on("broadcast", { event: "party_invite" }, (payload: any) => {
        setActiveInvite(payload.payload);
      })
      .on("broadcast", { event: "friend_request" }, () => {
        // Tải lại danh sách bạn bè thời gian thực khi có người gửi kết bạn
        fetchFriends();
      })
      .on("broadcast", { event: "friend_accept" }, (payload: any) => {
        // Tải lại danh sách bạn bè khi đối phương đồng ý kết bạn
        fetchFriends();
        showAlert(`@${payload.payload.accepterUsername} đã đồng ý kết bạn!`);
      })
      .on("broadcast", { event: "game_invite" }, (payload: any) => {
        setActiveGameInvite(payload.payload);
      })
      .subscribe();

    // Đồng bộ Presence trực tuyến bằng cách cấu hình key là profile.id
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
      supabase.removeChannel(inviteChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [profile]);

  // 2b. Kiểm tra xem người chơi có vừa chơi xong không
  useEffect(() => {
    if (profile) {
      const justFinished = localStorage.getItem("game_played");
      if (justFinished === "true") {
        localStorage.removeItem("game_played");
        if (profile.isGuest) {
          // Khách vừa chơi xong -> hiện popup gợi ý Liên kết Gmail để lưu lại tài khoản
          setShowGuestLinkModal(true);
        } else if (!profile.claimedDiscordReward) {
          // Đã đăng nhập -> hiện popup Tham gia Discord nhận quà nếu chưa nhận
          setShowDiscordModal(true);
        }
      }
    }
  }, [profile]);

  const handleClaimDiscord = async () => {
    if (!profile || profile.isGuest || claimingDiscord) return;
    setClaimingDiscord(true);
    try {
      // Mở link Discord trong tab mới
      window.open("https://discord.gg/nBEaascSY", "_blank");

      // Gọi API nhận thưởng
      const res = await fetch("/api/user/claim-discord", {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        await refreshProfile();
        setShowDiscordModal(false);
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        showAlert("Chúc mừng! Bạn đã nhận thành công 200 Trứng và Trang phục Gà Discord 👾!");
      } else {
        showAlert(data.error || "Có lỗi xảy ra khi nhận thưởng");
      }
    } catch (err) {
      console.error(err);
      showAlert("Lỗi kết nối máy chủ");
    } finally {
      setClaimingDiscord(false);
    }
  };

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
  const rankInfo = profile ? getRankFromDb(profile.rankTier, profile.rankDivision, profile.rankPoints) : null;

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
        showAlert(await res.text());
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
      showAlert("Lỗi nâng cấp: " + (err.message || "Thử lại sau"));
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
        showAlert(err.error || "Mua hàng thất bại!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Gửi tặng vật phẩm

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
        showAlert(err.error || "Trang bị thất bại!");
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
        showAlert(data.message);
        await refreshProfile();
      } else {
        showAlert(data.error);
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
        showAlert(data.message);
        await refreshProfile();
      } else {
        showAlert(data.error || "Reset thất bại");
      }
    } catch (err) {
      console.error(err);
      showAlert("Lỗi kết nối máy chủ");
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
        showAlert(data.message);
        await refreshProfile();
      } else {
        showAlert(data.error);
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
        showAlert(data.message);
        await refreshProfile();
        fetchMissions();
      } else {
        showAlert(data.error);
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
    const requiredEggs = selectedGame === "BAU_CUA" ? 1 : matchWager;
    if (profile.eggs < requiredEggs) {
      showAlert("Bạn không đủ Trứng cược để tham gia hàng chờ này!");
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
              { event: "*", schema: "public", table: "GameRoom" },
              (payload: any) => {
                const room = payload.new;
                if (room && (room.status === "PLAYING" || room.status === "WAITING") && (
                  room.playerXId === profile.id || 
                  room.playerOId === profile.id || 
                  room.player3Id === profile.id || 
                  room.player4Id === profile.id
                )) {
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
      showAlert("Bạn không đủ Trứng để đặt cược phòng cờ này!");
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
        showAlert(err.error || "Tạo phòng thất bại!");
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
  const handleBuyPremium = async (duration: 1 | 6) => {
    setSepayRedirecting(true);
    try {
      const res = await fetch("/api/user/sepay-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể tạo phiên thanh toán SePay");
      }

      const { checkoutURL, checkoutFormfields } = data;

      // Tạo form động để submit sang SePay
      const form = document.createElement("form");
      form.action = checkoutURL;
      form.method = "POST";

      Object.keys(checkoutFormfields).forEach((key) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = checkoutFormfields[key];
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (err: any) {
      console.error(err);
      showAlert(err.message || "Lỗi kết nối đến cổng SePay");
    } finally {
      setSepayRedirecting(false);
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
          <div className="w-14 h-14 overflow-hidden flex items-center justify-center">
            <img src="/logo.png" className="w-full h-full object-contain" alt="Vuiga" />
          </div>
          <div>
            <h1 className="text-md font-bold uppercase tracking-wider text-white">vuiga.com</h1>
            <p className="text-[7.5px] text-[#FF9F0A] tracking-wider uppercase font-semibold">Đấu Trí Trại Gà Vui Vẻ</p>
          </div>
        </div>

        {/* Cấu trúc Header Progress & Actions */}
        <div className="flex items-center gap-4">
          {/* Cấp độ & Thanh EXP mini trên Header */}
          <div className="hidden sm:flex items-center gap-2 bg-[#141412] px-3 py-1.5 rounded-lg border border-[#D4AF37]/10">
            <div className="text-left shrink-0">
              <span className="text-[12px] text-[#F3E5AB]/65 uppercase block">Cấp độ</span>
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
              <span className="text-[12px] text-[#F3E5AB]/60 uppercase block">Trứng Gà</span>
              <span className="text-xs text-white font-mono font-bold">{profile.eggs}</span>
            </div>
            <button 
              onClick={() => setShowTopupModal(true)}
              className="ml-1 w-4 h-4 rounded bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] flex items-center justify-center font-bold text-xs transition"
            >
              +
            </button>
          </div>



          {/* Premium tag */}
          {profile.isPremium ? (
            <span 
              title={profile.premiumUntil ? `Hạn dùng: ${new Date(profile.premiumUntil).toLocaleDateString("vi-VN")}` : "Hạn dùng: Vĩnh viễn"}
              className="hidden md:inline-flex items-center gap-1 text-[12px] bg-gradient-to-r from-[#D4AF37] to-[#FF9F0A] text-[#141412] px-2.5 py-1 rounded-full font-extrabold uppercase shadow-md cursor-help"
            >
              👑 Premium
            </span>
          ) : (
            <button
              onClick={() => setActiveTab("SETTINGS")}
              className="hidden md:flex items-center gap-1 text-[12px] bg-[#1C1C18] border border-[#D4AF37]/35 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#141412] px-2.5 py-1 rounded-full font-bold uppercase transition"
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
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 pt-6 pb-24 lg:pb-6 flex flex-col lg:grid lg:grid-cols-12 gap-6 relative">
        
        {/* Column 1: Navigation Sidebar (PC Only) */}
        <div className="hidden lg:flex lg:col-span-2 flex-col gap-2 shrink-0">
          <button 
            onClick={() => setActiveTab("PLAY")}
            className={`w-full flex items-center gap-3 py-3 px-4 rounded-lg text-xs font-semibold transition-all border-l-2 ${activeTab === "PLAY" ? "bg-[#232319] text-[#D4AF37] border-l-[#D4AF37] border-y-transparent border-r-transparent" : "bg-[#1C1C18]/40 hover:bg-[#1C1C18]/80 text-[#F3E5AB]/70 border-l-transparent border-y-transparent border-r-transparent"}`}
          >
            <Swords className="w-4 h-4" />
            Đấu trường
          </button>
          <button 
            onClick={() => setActiveTab("SHOP")}
            className={`w-full flex items-center gap-3 py-3 px-4 rounded-lg text-xs font-semibold transition-all border-l-2 ${activeTab === "SHOP" ? "bg-[#232319] text-[#D4AF37] border-l-[#D4AF37] border-y-transparent border-r-transparent" : "bg-[#1C1C18]/40 hover:bg-[#1C1C18]/80 text-[#F3E5AB]/70 border-l-transparent border-y-transparent border-r-transparent"}`}
          >
            <ShoppingBag className="w-4 h-4" />
            Cửa hàng
          </button>
          <button 
            onClick={() => setActiveTab("BP")}
            className={`w-full flex items-center gap-3 py-3 px-4 rounded-lg text-xs font-semibold transition-all border-l-2 ${activeTab === "BP" ? "bg-[#232319] text-[#D4AF37] border-l-[#D4AF37] border-y-transparent border-r-transparent" : "bg-[#1C1C18]/40 hover:bg-[#1C1C18]/80 text-[#F3E5AB]/70 border-l-transparent border-y-transparent border-r-transparent"}`}
          >
            <Award className="w-4 h-4" />
            Battle Pass
          </button>
          <button 
            onClick={() => setActiveTab("SOCIAL")}
            className={`w-full flex items-center gap-3 py-3 px-4 rounded-lg text-xs font-semibold transition-all border-l-2 ${activeTab === "SOCIAL" ? "bg-[#232319] text-[#D4AF37] border-l-[#D4AF37] border-y-transparent border-r-transparent" : "bg-[#1C1C18]/40 hover:bg-[#1C1C18]/80 text-[#F3E5AB]/70 border-l-transparent border-y-transparent border-r-transparent"}`}
          >
            <Users className="w-4 h-4" />
            Hồ sơ & chuồng gà
          </button>
          <button 
            onClick={() => setActiveTab("SETTINGS")}
            className={`w-full flex items-center gap-3 py-3 px-4 rounded-lg text-xs font-semibold transition-all border-l-2 ${activeTab === "SETTINGS" ? "bg-[#232319] text-[#D4AF37] border-l-[#D4AF37] border-y-transparent border-r-transparent" : "bg-[#1C1C18]/40 hover:bg-[#1C1C18]/80 text-[#F3E5AB]/70 border-l-transparent border-y-transparent border-r-transparent"}`}
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
                <div className="text-left">
                  <span className="inline-block mb-3 bg-[#FF9F0A]/10 text-[#FF9F0A] border border-[#FF9F0A]/30 text-[12px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                    Sự Kiện Đặc Biệt
                  </span>
                  <h3 className="text-base font-extrabold text-white mb-1">Đêm Hoàng Kim (Golden Night)</h3>
                  <p className="text-[12px] text-[#F3E5AB]/85 max-w-md leading-relaxed">
                    Đổi Visual vàng kim sang trọng, nhân đôi EXP vĩnh viễn cuối tuần, và mở khóa Event Shop vật phẩm đặc chế Obsidian Hoàng Gia.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("BP")}
                  className="bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] py-2 px-4 rounded-lg uppercase text-[12px] font-extrabold transition shrink-0 cursor-pointer"
                >
                  Khám phá ngay
                </button>
              </div>

              {/* Banner Liên Kết Gmail cho Tài Khoản Khách */}
              {profile.isGuest && (
                <div className="pixel-box-nested p-4 bg-gradient-to-r from-[#D4AF37]/20 via-[#141412] to-[#FF9F0A]/10 border border-[#D4AF37]/40 rounded-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-4 shadow-[0_0_25px_rgba(212,175,55,0.15)]">
                  <div className="text-left">
                    <span className="inline-block mb-3 bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 text-[12px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider font-mono">
                      🔒 BẢO VỆ TÀI KHOẢN
                    </span>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2 mb-1">
                      <span>📧</span> Đăng Nhập / Liên Kết Gmail Giúp Lưu Lại Tài Khoản
                    </h3>
                    <p className="text-[12px] text-[#F3E5AB]/85 max-w-md leading-relaxed">
                      Liên kết Gmail ngay để lưu giữ vĩnh viễn tiến trình chơi, vật phẩm và điểm số Rank của bạn khỏi bị mất!
                    </p>
                  </div>
                  <button
                    onClick={() => setShowGuestLinkModal(true)}
                    className="bg-gradient-to-r from-[#D4AF37] to-[#FF9F0A] hover:brightness-110 text-[#141412] py-2.5 px-5 rounded-lg uppercase text-[12px] font-extrabold transition shrink-0 shadow-lg cursor-pointer active:scale-95"
                  >
                    ĐĂNG NHẬP GMAIL LƯU TÀI KHOẢN
                  </button>
                </div>
              )}

              {/* Banner Discord cho Người Dùng Đã Đăng Nhập Gmail */}
              {!profile.isGuest && !profile.claimedDiscordReward && (
                <div className="pixel-box-nested p-4 bg-gradient-to-r from-[#5865F2]/20 via-[#141412] to-[#5865F2]/10 border border-[#5865F2]/40 rounded-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="text-left">
                    <span className="inline-block mb-3 bg-[#5865F2]/20 text-[#8ea1ff] border border-[#5865F2]/40 text-[12px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider font-mono">
                      SỰ KIỆN CỘNG ĐỒNG
                    </span>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2 mb-1">
                      <span>👾</span> Mở Khóa Quà Discord (200 🥚 + Skin Gà Discord)
                    </h3>
                    <p className="text-[12px] text-[#F3E5AB]/85 max-w-md leading-relaxed">
                      Tham gia nhóm Discord chính thức của Vuiga.com để nhận ngay phần quà độc quyền!
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDiscordModal(true)}
                    className="bg-[#5865F2] hover:bg-[#4752C4] text-white py-2 px-4 rounded-lg uppercase text-[12px] font-extrabold transition shrink-0 shadow-[0_0_15px_rgba(88,101,242,0.4)] cursor-pointer"
                  >
                    THAM GIA DISCORD & NHẬN QUÀ
                  </button>
                </div>
              )}

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
                    <p className="text-[12px] text-[#FF9F0A] mt-2 uppercase font-mono">
                      Game: {matchmaking.gameType === "CARO" ? "Gomoku" : matchmaking.gameType} | Cược: {matchmaking.wager} Coin
                    </p>
                  </div>
                  <button onClick={handleCancelMatchmaking} className="pixel-btn pixel-btn-red py-2 px-6 uppercase text-[12px]">
                    Hủy tìm trận
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Revenge Widget */}
                  {lastMatch && (
                    <div className="pixel-box-nested p-4 border-l-4 border-l-[#FF9F0A] bg-[#1C1C18]/60 flex justify-between items-center gap-4">
                      <div>
                        <span className="text-[12px] text-[#F3E5AB]/50 uppercase tracking-widest font-bold">LẦN ĐẤU TRƯỚC</span>
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
                        className="bg-[#FF9F0A] hover:bg-[#D4AF37] text-[#141412] px-4 py-2 rounded-lg text-[12px] font-extrabold uppercase transition"
                      >
                        Phục Hận Ngay
                      </button>
                    </div>
                  )}

                  {/* Sảnh cờ lựa chọn cấu hình đấu */}
                  <div className="space-y-4">
                    <h3 className="text-xs text-[#D4AF37] font-bold tracking-wider border-b border-[#D4AF37]/15 pb-2">
                      Sảnh đấu trí
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Chọn game */}
                      <div className="pixel-box-nested p-4 space-y-3">
                        <span className="block text-[12px] text-[#F3E5AB]/60 font-semibold">1. Chọn trò chơi:</span>
                        <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              setSelectedGame("CARO");
                              setMatchWager(0);
                            }}
                            className={`py-2 rounded-lg text-[12px] font-semibold transition border text-center ${selectedGame === "CARO" ? "border-[#D4AF37]/45 bg-[#232319] text-[#D4AF37]" : "border-transparent bg-[#1C1C18] text-[#F3E5AB]/60 hover:bg-[#1C1C18]/80 hover:text-white"}`}
                          >
                            Gomoku
                          </button>
                          <button
                            onClick={() => {
                              setSelectedGame("BATTLESHIP");
                              setMatchWager(0);
                            }}
                            className={`py-2 rounded-lg text-[12px] font-semibold transition border text-center ${selectedGame === "BATTLESHIP" ? "border-[#D4AF37]/45 bg-[#232319] text-[#D4AF37]" : "border-transparent bg-[#1C1C18] text-[#F3E5AB]/60 hover:bg-[#1C1C18]/80 hover:text-white"}`}
                          >
                            Battleship
                          </button>
                          <button
                            onClick={() => {
                              setSelectedGame("TIC_TAC_TOE");
                              setMatchWager(0);
                            }}
                            className={`py-2 rounded-lg text-[12px] font-semibold transition border text-center ${selectedGame === "TIC_TAC_TOE" ? "border-[#D4AF37]/45 bg-[#232319] text-[#D4AF37]" : "border-transparent bg-[#1C1C18] text-[#F3E5AB]/60 hover:bg-[#1C1C18]/80 hover:text-white"}`}
                          >
                            Caro 3x3
                          </button>
                          <button
                            onClick={() => {
                              setSelectedGame("BAU_CUA");
                              setMatchWager(10); // Mặc định giới hạn 10 coin cho Bầu Cua
                              if (selectedMode === "BOT") {
                                setSelectedMode("RANDOM");
                              }
                            }}
                            className={`py-2 rounded-lg text-[12px] font-semibold transition border text-center ${selectedGame === "BAU_CUA" ? "border-[#D4AF37]/45 bg-[#232319] text-[#D4AF37]" : "border-transparent bg-[#1C1C18] text-[#F3E5AB]/60 hover:bg-[#1C1C18]/80 hover:text-white"}`}
                          >
                            Bầu Cua
                          </button>
                        </div>
                      </div>

                      {/* Chọn chế độ */}
                      <div className="pixel-box-nested p-4 space-y-3">
                        <span className="block text-[12px] text-[#F3E5AB]/60 font-semibold">2. Chế độ chơi:</span>
                        <div className="flex flex-col gap-2">
                          {selectedGame !== "BAU_CUA" && (
                            <button
                              onClick={() => setSelectedMode("BOT")}
                              className={`flex items-center justify-start py-2 px-3 rounded-lg text-[12px] font-semibold transition border ${selectedMode === "BOT" ? "border-[#D4AF37]/45 bg-[#232319] text-[#D4AF37]" : "border-transparent bg-[#1C1C18] text-[#F3E5AB]/60 hover:bg-[#1C1C18]/80 hover:text-white"}`}
                            >
                              <ChevronRight className="w-3 h-3 mr-2" /> Đấu với Bot (Offline)
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedMode("FRIEND")}
                            className={`flex items-center justify-start py-2 px-3 rounded-lg text-[12px] font-semibold transition border ${selectedMode === "FRIEND" ? "border-[#D4AF37]/45 bg-[#232319] text-[#D4AF37]" : "border-transparent bg-[#1C1C18] text-[#F3E5AB]/60 hover:bg-[#1C1C18]/80 hover:text-white"}`}
                          >
                            <ChevronRight className="w-3 h-3 mr-2" /> Đấu với bạn (Mã phòng)
                          </button>
                          <button
                            onClick={() => setSelectedMode("RANDOM")}
                            className={`flex items-center justify-start py-2 px-3 rounded-lg text-[12px] font-semibold transition border ${selectedMode === "RANDOM" ? "border-[#D4AF37]/45 bg-[#232319] text-[#D4AF37]" : "border-transparent bg-[#1C1C18] text-[#F3E5AB]/60 hover:bg-[#1C1C18]/80 hover:text-white"}`}
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
                            <span className="block text-[12px] text-[#F3E5AB]/60 font-semibold mb-2">Độ khó của Bot:</span>
                            <div className="grid grid-cols-3 gap-2">
                              <button
                                onClick={() => setBotDifficulty("RANDOM")}
                                className={`py-2 rounded-lg text-[12px] font-semibold transition border text-center ${botDifficulty === "RANDOM" ? "border-[#D4AF37]/45 bg-[#232319] text-[#D4AF37]" : "border-transparent bg-[#1C1C18] text-[#F3E5AB]/60 hover:bg-[#1C1C18]/80 hover:text-white"}`}
                              >
                                Ngẫu nhiên
                              </button>
                              <button
                                onClick={() => setBotDifficulty("EASY")}
                                className={`py-2 rounded-lg text-[12px] font-semibold transition border text-center ${botDifficulty === "EASY" ? "border-[#D4AF37]/45 bg-[#232319] text-[#D4AF37]" : "border-transparent bg-[#1C1C18] text-[#F3E5AB]/60 hover:bg-[#1C1C18]/80 hover:text-white"}`}
                              >
                                Dễ (Chặn)
                              </button>
                              <button
                                onClick={() => setBotDifficulty("HARD")}
                                className={`py-2 rounded-lg text-[12px] font-semibold transition border text-center ${botDifficulty === "HARD" ? "border-[#D4AF37]/45 bg-[#232319] text-[#D4AF37]" : "border-transparent bg-[#1C1C18] text-[#F3E5AB]/60 hover:bg-[#1C1C18]/80 hover:text-white"}`}
                              >
                                Khó
                              </button>
                            </div>
                          </div>
                          <button 
                            onClick={handlePlayBot}
                            className="w-full pixel-btn pixel-btn-yellow py-3 text-xs font-bold gap-2"
                          >
                            <Play className="w-4 h-4 fill-black" /> Bắt đầu ngay
                          </button>
                        </div>
                      )}

                      {selectedMode === "FRIEND" && (
                        <div className="space-y-4">
                          <div>
                            <span className="block text-[12px] text-[#F3E5AB]/60 font-semibold mb-2">Mức cược Coin (Mỗi người):</span>
                            <div className="grid grid-cols-4 gap-2">
                              {(selectedGame === "BAU_CUA" ? [10, 50, 100, 999999] : [0, 10, 50, 100]).map((c) => (
                                <button
                                  key={c}
                                  onClick={() => setMatchWager(c)}
                                  className={`py-2 rounded-lg text-[12px] font-semibold transition border text-center ${matchWager === c ? "border-[#D4AF37]/45 bg-[#232319] text-[#D4AF37]" : "border-transparent bg-[#1C1C18] text-[#F3E5AB]/60 hover:bg-[#1C1C18]/80 hover:text-white"}`}
                                >
                                  {c === 999999 ? "K.Giới Hạn" : `${c} Coin`}
                                </button>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={handleCreateFriendRoom}
                            disabled={creatingFriendLobby}
                            className="w-full pixel-btn pixel-btn-yellow py-3 text-xs font-bold gap-2"
                          >
                            <Swords className="w-4 h-4" />
                            {creatingFriendLobby ? "Đang khởi tạo..." : "Tạo sảnh đợi & link mời"}
                          </button>
                        </div>
                      )}

                      {selectedMode === "RANDOM" && (
                        <div className="space-y-4">
                          {selectedGame !== "BAU_CUA" ? (
                            <div>
                              <span className="block text-[12px] text-[#F3E5AB]/60 font-semibold mb-2">Mức cược trận đấu (Coin):</span>
                              <div className="grid grid-cols-4 gap-2">
                                {[0, 10, 50, 100].map((c) => (
                                  <button
                                    key={c}
                                    onClick={() => setMatchWager(c)}
                                    className={`py-2 rounded-lg text-[12px] font-semibold transition border text-center ${matchWager === c ? "border-[#D4AF37]/45 bg-[#232319] text-[#D4AF37]" : "border-transparent bg-[#1C1C18] text-[#F3E5AB]/60 hover:bg-[#1C1C18]/80 hover:text-white"}`}
                                  >
                                    {c} Coin
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[9.5px] text-[#F3E5AB]/75 border border-[#D4AF37]/10 p-3 rounded bg-black/25 flex flex-col gap-1 text-left">
                              <span className="font-extrabold text-[#FF9F0A] uppercase tracking-wider block">🏆 CHẾ ĐỘ XẾP HẠNG BẦU CUA</span>
                              <span className="leading-relaxed">Không có mức cược cố định khi tìm trận. Bạn sẽ đặt cược trực tiếp trong trận đấu bằng số Coin hiện có của mình!</span>
                            </div>
                          )}
                          <button
                            onClick={handleStartMatchmaking}
                            className="w-full pixel-btn pixel-btn-yellow py-3 text-xs font-bold gap-2"
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
                      <div className="text-center py-6 text-[12px] text-[#F3E5AB]/60 uppercase animate-pulse">Đang tải lịch sử...</div>
                    ) : matchHistory.length === 0 ? (
                      <div className="text-center py-6 text-[12px] text-[#F3E5AB]/50 uppercase">Chưa tham gia đấu trận nào</div>
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
                                <span className="text-[#F3E5AB]/60 block text-[12px]">Đối thủ: @{opponent || "Bot"}</span>
                              </div>
                              <div className="text-right">
                                <span className={`font-extrabold uppercase ${win ? "text-green-400" : draw ? "text-gray-400" : "text-red-400"}`}>
                                  {win ? "Thắng" : draw ? "Hòa" : "Thua"}
                                </span>
                                {m.wager > 0 && (
                                  <span className="block font-mono text-[12px] text-[#D4AF37]">
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
                  {[
                    { id: "ALL", label: "Tất cả" },
                    { id: "SYMBOL", label: "Quân cờ" },
                    { id: "FRAME", label: "Khung ảnh" },
                    { id: "THEME", label: "Bàn cờ" },
                    { id: "SFX", label: "Hiệu ứng" },
                    { id: "EMOJI", label: "Biểu cảm" },
                    { id: "SKIN", label: "Skin Gà" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setShopCategory(cat.id as any)}
                      className={`text-[8.5px] uppercase px-2.5 py-1 rounded transition ${
                        shopCategory === cat.id 
                          ? "bg-[#D4AF37] text-[#141412] font-bold" 
                          : "bg-[#1C1C18] text-[#F3E5AB]/60 hover:text-white"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shop Items List / Category Dashboards */}
              {(() => {
                const renderShopCard = (item: ShopItem) => {
                  const isOwned = profile.purchasedItems.includes(item.id);
                  const isEquipped = 
                    item.type === "FRAME" ? profile.avatarFrame === item.id :
                    item.type === "SYMBOL" ? (profile.selectedSymbolX === item.id || profile.selectedSymbolO === item.id) :
                    item.type === "THEME" ? equippedThemeId === item.id :
                    item.type === "SFX" ? equippedSfxId === item.id :
                    item.type === "SKIN" ? profile.equippedChickenSkin === item.id :
                    item.type === "DICE" ? profile.equippedDiceSkin === item.id :
                    item.type === "CARDBACK" ? (item.id.startsWith("banner_") ? profile.equippedBanner === item.id : profile.equippedCardBack === item.id) :
                    item.type === "EMOJI" ? isOwned : false;
                  
                  return (
                    <div key={item.id} className="bg-[#1C1C18] border border-[#D4AF37]/15 p-4 rounded-xl flex flex-col justify-between space-y-3 shadow-md hover:border-[#D4AF37]/40 transition">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-[12px] bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded font-bold font-mono">
                            {item.type === "SYMBOL" ? "Quân cờ" :
                             item.type === "FRAME" ? "Khung ảnh" :
                             item.type === "THEME" ? "Bàn cờ" :
                             item.type === "SFX" ? "Hiệu ứng" :
                             item.type === "SKIN" ? "Ngoại hình Gà" :
                             item.type === "EMOJI" ? "Biểu cảm" : item.type}
                          </span>
                          {!isOwned && (
                            <span className="text-[12px] text-white font-mono font-bold flex items-center gap-0.5">
                              <Coins className="w-3 h-3 text-[#D4AF37]" /> {item.price}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-white text-sm mt-2">{item.name}</h4>
                        <p className="text-[12px] text-[#F3E5AB]/75 leading-relaxed mt-1">{item.description}</p>
                      </div>

                      <div className="flex gap-2">
                        {isOwned ? (
                          isEquipped ? (
                            <button className="w-full bg-[#1C1C18] border border-green-500/30 text-green-400 text-[12px] font-bold py-2 rounded-lg flex items-center justify-center gap-1 cursor-not-allowed">
                              <Check className="w-3.5 h-3.5" /> Đang dùng
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (item.type === "SYMBOL") {
                                  showConfirm({
                                    title: "Trang Bị Vị Trí Cờ",
                                    message: "Bạn có muốn trang bị mẫu cờ này cho Quân Đen (Đi trước - X) hay Quân Trắng (Đi sau - O)?",
                                    confirmText: "Quân Đen (X)",
                                    cancelText: "Quân Trắng (O)",
                                    onConfirm: () => handleEquipItem(item.id, "X"),
                                    onCancel: () => handleEquipItem(item.id, "O")
                                  });
                                } else {
                                  handleEquipItem(item.id);
                                }
                              }}
                              className="w-full pixel-btn pixel-btn-secondary text-[12px] font-bold py-2 rounded-lg transition"
                            >
                              Trang bị
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => handleBuyItem(item.id)}
                            className="w-full pixel-btn pixel-btn-yellow text-[12px] font-bold py-2 rounded-lg transition"
                          >
                            Mua ngay
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
                };

                if (shopCategory === "ALL") {
                  const CATEGORY_SECTIONS = [
                    { id: "SYMBOL", title: "Quân cờ", icon: "⚔️" },
                    { id: "FRAME", title: "Khung ảnh Avatar", icon: "🖼️" },
                    { id: "THEME", title: "Giao diện Bàn cờ", icon: "🎨" },
                    { id: "SFX", title: "Hiệu ứng & Âm thanh", icon: "🔊" },
                    { id: "EMOJI", title: "Biểu cảm Vui vẻ", icon: "😀" },
                    { id: "SKIN", title: "Ngoại hình Gà", icon: "🐔" },
                  ];

                  return (
                    <div className="space-y-8">
                      {CATEGORY_SECTIONS.map((sec) => {
                        const items = SHOP_ITEMS.filter((item) => item.type === sec.id);
                        if (items.length === 0) return null;
                        const visibleItems = items.slice(0, 3);
                        const hasMore = items.length > 3;

                        return (
                          <div key={sec.id} className="bg-[#181814] border border-[#D4AF37]/20 p-5 rounded-2xl space-y-4 shadow-lg">
                            <div className="flex justify-between items-center border-b border-[#D4AF37]/10 pb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{sec.icon}</span>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-white">{sec.title}</h3>
                                <span className="text-[12px] font-mono text-[#D4AF37]/60">({items.length} vật phẩm)</span>
                              </div>
                              <button
                                onClick={() => setShopCategory(sec.id as any)}
                                className="text-[11px] font-bold text-[#D4AF37] hover:text-white bg-[#D4AF37]/10 hover:bg-[#D4AF37]/25 px-3 py-1.5 rounded-lg border border-[#D4AF37]/30 transition flex items-center gap-1"
                              >
                                Xem thêm {hasMore ? `(+${items.length - 3})` : ""} &rarr;
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                              {visibleItems.map(renderShopCard)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // Chế độ xem theo danh mục cụ thể
                const catItems = SHOP_ITEMS.filter((item) => item.type === shopCategory);
                return (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-[#181814] border border-[#D4AF37]/20 p-4 rounded-xl">
                      <h3 className="text-sm font-bold uppercase text-[#D4AF37] flex items-center gap-2">
                        <span>Danh mục:</span>
                        <span className="text-white">
                          {shopCategory === "SYMBOL" ? "Quân cờ" :
                           shopCategory === "FRAME" ? "Khung ảnh" :
                           shopCategory === "THEME" ? "Giao diện Bàn cờ" :
                           shopCategory === "SFX" ? "Hiệu ứng & Âm thanh" :
                           shopCategory === "SKIN" ? "Ngoại hình Gà" :
                           shopCategory === "EMOJI" ? "Biểu cảm" : shopCategory}
                        </span>
                        <span className="text-[12px] font-mono text-[#F3E5AB]/60">({catItems.length} vật phẩm)</span>
                      </h3>
                      <button
                        onClick={() => setShopCategory("ALL")}
                        className="text-[11px] font-bold text-[#F3E5AB] hover:text-white bg-[#1C1C18] border border-[#D4AF37]/30 hover:border-[#D4AF37] px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                      >
                        &larr; Tất cả danh mục
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {catItems.map(renderShopCard)}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB: BATTLE PASS (BẢN TIẾN TRÌNH THEO MÙA) */}
          {activeTab === "BP" && (
            <div className="space-y-6 animate-fadeIn">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-[#D4AF37]/15 pb-4 gap-4">
                <div>
                  <span className="inline-block bg-[#FF9F0A]/10 text-[#FF9F0A] border border-[#FF9F0A]/30 text-[12px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Mùa Giải 1
                  </span>
                  <h2 className="text-xl font-bold uppercase text-white mt-1">Battle Pass: Đêm Hoàng Kim</h2>
                  
                  {/* Progress overview */}
                  <div className="mt-4 min-w-[280px] md:w-[380px] space-y-1.5">
                    <div className="flex justify-between items-end text-[12px]">
                      <span className="font-medium text-[#F3E5AB]/75">
                        Cấp Battle Pass: <strong className="text-white font-mono text-xs">{profile.battlePassLevel} / 50</strong>
                      </span>
                      <span className="font-mono text-[#D4AF37]/90">{profile.battlePassExp} / {bpExpNeeded} XP</span>
                    </div>
                    <div className="w-full bg-black/50 h-1.5 rounded-full overflow-hidden border border-[#D4AF37]/10">
                      <div 
                        className="bg-gradient-to-r from-[#D4AF37] to-[#FF9F0A] h-full transition-all duration-500 rounded-full" 
                        style={{ width: `${bpExpPercent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {profile.isPremium ? (
                    <button
                      disabled
                      className="bg-gradient-to-r from-[#D4AF37]/20 to-[#FF9F0A]/20 border border-[#D4AF37]/45 text-[#D4AF37]/60 text-[10.5px] uppercase font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 cursor-not-allowed"
                    >
                      <Crown className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Đã kích hoạt Golden Chicken 👑
                    </button>
                  ) : (
                    <button
                      onClick={() => setActiveTab("SETTINGS")}
                      className="bg-gradient-to-r from-[#D4AF37] to-[#FF9F0A] hover:brightness-110 text-[#141412] text-[10.5px] uppercase font-extrabold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition shadow-lg active:scale-95 shadow-[#FF9F0A]/10"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      Kích hoạt Golden Chicken
                    </button>
                  )}
                </div>
              </div>

              {/* Rewards Path Layout */}
              <div className="bg-[#1C1C18]/60 p-5 rounded-2xl border border-[#D4AF37]/10 space-y-4">
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>🎁</span> LỘ TRÌNH PHẦN THƯỞNG MÙA GIẢI
                </h3>
                
                {/* Desktop Layout (Horizontal Scroll Track) */}
                <div className="hidden md:flex gap-4 items-stretch select-none mt-2">
                  {/* Left Fixed Labels */}
                  <div className="flex flex-col justify-between py-1 w-28 flex-shrink-0">
                    {/* Golden Chicken card label */}
                    <div className="h-[80px] bg-gradient-to-br from-[#232319] to-[#1C1C18] border border-[#D4AF37]/35 rounded-xl flex flex-col justify-center items-center text-center p-2 shadow-inner">
                      <Crown className="w-4 h-4 text-[#D4AF37] mb-1 animate-pulse" />
                      <span className="text-[12px] uppercase tracking-wider font-black text-[#D4AF37]">Golden Chicken</span>
                    </div>

                    {/* Spacer matching level label height */}
                    <div className="h-8 flex items-center justify-center">
                      <span className="text-[12px] text-[#F3E5AB]/40 uppercase tracking-widest font-extrabold">Cấp Độ</span>
                    </div>

                    {/* Free card label */}
                    <div className="h-[80px] bg-[#141412] border border-white/5 rounded-xl flex flex-col justify-center items-center text-center p-2">
                      <span className="text-[12px] uppercase tracking-wider text-gray-400 font-bold mb-1">Miễn Phí</span>
                      <span className="text-[12px] uppercase tracking-wide font-black text-[#F3E5AB]/70">Free</span>
                    </div>
                  </div>

                  {/* Right Scrollable Rewards */}
                  <div className="relative flex-grow overflow-hidden">
                    <div 
                      ref={bpScrollRef}
                      className="flex gap-3.5 overflow-x-auto pb-3 scrollbar-none scroll-smooth pr-10"
                      style={{ 
                        scrollbarWidth: "none", 
                        msOverflowStyle: "none"
                      }}
                    >
                      {[
                        { level: 1, freeVal: "50", freeIcon: "🥚", premiumTitle: "Khung Đêm", icon: <Crown className="w-5 h-5 text-[#D4AF37]" /> },
                        { level: 2, freeVal: "100", freeIcon: "🥚", premiumTitle: "Beach Club", icon: <Music className="w-5 h-5 text-[#D4AF37]" /> },
                        { level: 5, freeVal: "150", freeIcon: "🥚", premiumTitle: "Tinh Vân", icon: <Flag className="w-5 h-5 text-[#D4AF37]" /> },
                        { level: 10, freeVal: "Khung Cát", freeIcon: "🦊", premiumTitle: "Chiến Binh", icon: <Gamepad2 className="w-5 h-5 text-[#D4AF37]" /> },
                        { level: 15, freeVal: "200", freeIcon: "🥚", premiumTitle: "Xúc xắc", icon: <Dice5 className="w-5 h-5 text-[#D4AF37]" /> },
                        { level: 20, freeVal: "Dưa Hấu", freeIcon: "🍉", premiumTitle: "Gà Hiệp Sĩ", icon: <ShieldAlert className="w-5 h-5 text-[#D4AF37]" /> },
                        { level: 30, freeVal: "300", freeIcon: "🥚", premiumTitle: "Cyber Neon", icon: <Flag className="w-5 h-5 text-[#D4AF37]" /> },
                        { level: 40, freeVal: "400", freeIcon: "🥚", premiumTitle: "Tối Thượng", icon: <Smile className="w-5 h-5 text-[#D4AF37]" /> },
                        { level: 50, freeVal: "500", freeIcon: "🥚", premiumTitle: "VIP Skin", icon: <Crown className="w-5 h-5 text-[#FF9F0A]" />, extra: "Hoàn tiền" }
                      ].map((reward) => {
                        const isLevelUnlocked = profile.battlePassLevel >= reward.level;
                        const isPremiumUnlocked = profile.isPremium && isLevelUnlocked;
                        
                        // Check if it's the current closest tier reached
                        const reachedTiers = [1, 2, 5, 10, 15, 20, 30, 40, 50].filter(l => l <= profile.battlePassLevel);
                        const activeTier = reachedTiers.length > 0 ? reachedTiers[reachedTiers.length - 1] : 1;
                        const isActive = reward.level === activeTier;

                        return (
                          <div key={reward.level} className="flex flex-col justify-between items-center w-[96px] flex-shrink-0">
                            {/* PREMIUM REWARD CARD */}
                            <div 
                              className={`w-full h-[80px] rounded-xl border flex flex-col justify-center items-center relative transition-all duration-300 ${
                                isPremiumUnlocked
                                  ? "bg-[#232319] border-[#D4AF37]/75 shadow-md shadow-[#D4AF37]/5"
                                  : isLevelUnlocked
                                    ? "bg-[#1C1C18] border-[#D4AF37]/25 opacity-80"
                                    : "bg-[#1C1C18]/40 border-white/5 opacity-50"
                              }`}
                            >
                              {/* Status Badge */}
                              <div className="absolute top-1.5 right-1.5">
                                {isPremiumUnlocked ? (
                                  <div className="w-4 h-4 bg-green-500/10 text-green-400 border border-green-500/30 rounded-full flex items-center justify-center">
                                    <Check className="w-2.5 h-2.5 font-bold" />
                                  </div>
                                ) : (
                                  <div className="w-4 h-4 bg-gray-500/10 text-gray-400 border border-white/10 rounded-full flex items-center justify-center">
                                    <Lock className="w-2.5 h-2.5" />
                                  </div>
                                )}
                              </div>

                              {/* Reward Icon */}
                              <div className={`mb-1 ${isPremiumUnlocked ? "scale-105 transition-transform" : "opacity-60"}`}>
                                {reward.icon}
                              </div>

                              {/* Title */}
                              <span className={`text-[8.5px] font-bold tracking-tight text-center px-1 ${
                                isPremiumUnlocked ? "text-white" : "text-gray-400"
                              }`}>
                                {reward.premiumTitle}
                              </span>
                            </div>

                            {/* LEVEL DIVISION INDICATOR */}
                            <div className="h-8 flex flex-col justify-center items-center text-center">
                              <span className={`text-[12px] font-extrabold uppercase font-mono tracking-wider ${
                                isActive ? "text-[#D4AF37]" : isLevelUnlocked ? "text-gray-300" : "text-gray-500"
                              }`}>
                                Cấp {reward.level}
                              </span>
                              {isActive && (
                                <span className="text-[12px] text-[#D4AF37] font-bold -mt-0.5 tracking-tight">bạn ở đây</span>
                              )}
                            </div>

                            {/* FREE REWARD CARD */}
                            <div 
                              className={`w-full h-[80px] rounded-xl border flex flex-col justify-center items-center relative transition-all duration-300 ${
                                isLevelUnlocked
                                  ? "bg-[#141412] border-green-500/30"
                                  : "bg-[#1C1C18]/40 border-white/5 opacity-50"
                              }`}
                            >
                              {/* Coin Circle Icon */}
                              <div className="w-6 h-6 bg-[#FF9F0A]/10 border border-[#FF9F0A]/30 rounded-full flex items-center justify-center text-[12px] mb-1">
                                {reward.freeIcon}
                              </div>
                              
                              {/* Reward Value */}
                              <span className="text-[12px] font-mono font-bold text-white">
                                {reward.freeVal}
                              </span>
                              
                              {reward.extra && (
                                <span className="text-[12px] text-[#D4AF37] uppercase font-bold leading-none mt-0.5">
                                  {reward.extra}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Mobile Layout (Vertical Grid List of Levels) */}
                <div className="md:hidden space-y-3.5 mt-2">
                  {[
                    { level: 1, freeVal: "50", freeIcon: "🥚", premiumTitle: "Khung Đêm", icon: <Crown className="w-4 h-4 text-[#D4AF37]" /> },
                    { level: 2, freeVal: "100", freeIcon: "🥚", premiumTitle: "Beach Club", icon: <Music className="w-4 h-4 text-[#D4AF37]" /> },
                    { level: 5, freeVal: "150", freeIcon: "🥚", premiumTitle: "Tinh Vân", icon: <Flag className="w-4 h-4 text-[#D4AF37]" /> },
                    { level: 10, freeVal: "Khung Cát", freeIcon: "🦊", premiumTitle: "Chiến Binh", icon: <Gamepad2 className="w-4 h-4 text-[#D4AF37]" /> },
                    { level: 15, freeVal: "200", freeIcon: "🥚", premiumTitle: "Xúc xắc", icon: <Dice5 className="w-4 h-4 text-[#D4AF37]" /> },
                    { level: 20, freeVal: "Dưa Hấu", freeIcon: "🍉", premiumTitle: "Gà Hiệp Sĩ", icon: <ShieldAlert className="w-4 h-4 text-[#D4AF37]" /> },
                    { level: 30, freeVal: "300", freeIcon: "🥚", premiumTitle: "Cyber Neon", icon: <Flag className="w-4 h-4 text-[#D4AF37]" /> },
                    { level: 40, freeVal: "400", freeIcon: "🥚", premiumTitle: "Tối Thượng", icon: <Smile className="w-4 h-4 text-[#D4AF37]" /> },
                    { level: 50, freeVal: "500", freeIcon: "🥚", premiumTitle: "VIP Skin", icon: <Crown className="w-4 h-4 text-[#FF9F0A]" />, extra: "Hoàn tiền" }
                  ].map((reward) => {
                    const isLevelUnlocked = profile.battlePassLevel >= reward.level;
                    const isPremiumUnlocked = profile.isPremium && isLevelUnlocked;
                    
                    const reachedTiers = [1, 2, 5, 10, 15, 20, 30, 40, 50].filter(l => l <= profile.battlePassLevel);
                    const activeTier = reachedTiers.length > 0 ? reachedTiers[reachedTiers.length - 1] : 1;
                    const isActive = reward.level === activeTier;

                    return (
                      <div 
                        key={reward.level} 
                        className={`rounded-xl border p-3 flex flex-col gap-2.5 transition-all duration-300 ${
                          isActive
                            ? "bg-[#232319]/80 border-[#D4AF37]/50 shadow-md shadow-[#D4AF37]/5"
                            : isLevelUnlocked
                              ? "bg-[#1C1C18] border-[#D4AF37]/15"
                              : "bg-[#1C1C18]/40 border-white/5 opacity-60"
                        }`}
                      >
                        {/* Level Header Row */}
                        <div className="flex justify-between items-center pb-1.5 border-b border-[#D4AF37]/10">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10.5px] font-extrabold uppercase font-mono tracking-wider ${
                              isActive ? "text-[#D4AF37]" : "text-white"
                            }`}>
                              CẤP {reward.level}
                            </span>
                            {isActive && (
                              <span className="text-[7.5px] bg-[#D4AF37]/20 border border-[#D4AF37]/45 text-[#D4AF37] px-1.5 py-0.5 rounded font-black uppercase tracking-tight">
                                Bạn ở đây
                              </span>
                            )}
                          </div>
                          
                          <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            isLevelUnlocked ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-gray-500/10 text-gray-400 border border-white/5"
                          }`}>
                            {isLevelUnlocked ? "Đã Đạt ✓" : "Chưa Đạt 🔒"}
                          </span>
                        </div>

                        {/* Grid with 2 Tracks */}
                        <div className="grid grid-cols-2 gap-2.5">
                          {/* Free Track Reward */}
                          <div 
                            className={`flex items-center gap-2.5 p-2 rounded-lg border bg-[#141412] ${
                              isLevelUnlocked ? "border-green-500/10" : "border-white/5 opacity-50"
                            }`}
                          >
                            <div className="w-7 h-7 bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 rounded-full flex items-center justify-center text-xs">
                              {reward.freeIcon}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[12px] text-gray-400 uppercase tracking-widest font-bold">Miễn Phí</span>
                              <span className="text-[9.5px] font-mono font-bold text-white leading-none mt-0.5">
                                {reward.freeVal}
                              </span>
                            </div>
                          </div>

                          {/* Golden Chicken Reward */}
                          <div 
                            className={`flex items-center justify-between p-2 rounded-lg border relative ${
                              isPremiumUnlocked
                                ? "bg-[#232319] border-[#D4AF37]/40"
                                : "border-white/5 opacity-50 bg-[#1C1C18]"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full flex items-center justify-center ${
                                isPremiumUnlocked ? "opacity-100" : "opacity-50"
                              }`}>
                                {reward.icon}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[12px] text-[#D4AF37] uppercase tracking-widest font-black">Golden Chicken</span>
                                <span className={`text-[9.5px] font-bold leading-none mt-0.5 ${
                                  isPremiumUnlocked ? "text-white" : "text-gray-400"
                                }`}>
                                  {reward.premiumTitle}
                                </span>
                              </div>
                            </div>
                            
                            {/* Status indicator */}
                            <div className="flex-shrink-0 ml-1">
                              {isPremiumUnlocked ? (
                                <Check className="w-3.5 h-3.5 text-green-400" />
                              ) : (
                                <Lock className="w-3.5 h-3.5 text-gray-500" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Navigation scroll control - Desktop Only */}
                <div className="hidden md:flex justify-between items-center border-t border-[#D4AF37]/10 pt-4 mt-2">
                  <span className="text-[8.5px] text-[#F3E5AB]/40 uppercase tracking-widest font-extrabold">
                    * Mở khóa các cấp để nhận thưởng
                  </span>
                  
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => scrollBP("left")}
                      className="p-1.5 rounded-lg border border-[#D4AF37]/35 bg-[#1C1C18] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#141412] transition duration-200 active:scale-90"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    
                    <button 
                      onClick={() => scrollBP("right")}
                      className="p-1.5 rounded-lg border border-[#D4AF37]/35 bg-[#1C1C18] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#141412] transition duration-200 active:scale-90"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
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
                    <label className="block text-[12px] uppercase text-[#F3E5AB]/60 mb-2">Tên hiển thị (Username):</label>
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
                        <button onClick={() => setEditingUsername(true)} className="text-[#FF9F0A] text-[12px] uppercase font-bold hover:underline">Đổi Tên</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* VIP Premium Status Info */}
              {profile.isPremium && (
                <div className="pixel-box-nested p-4 border border-[#D4AF37]/35 bg-gradient-to-r from-[#1C1C18] to-[#D4AF37]/5 space-y-2">
                  <h3 className="text-xs font-bold text-[#D4AF37] uppercase flex items-center gap-1.5">
                    👑 Trạng thái Premium Membership
                  </h3>
                  <p className="text-[12px] text-[#F3E5AB]/85">
                    Bạn đang là VIP Premium. Thời hạn sử dụng đến ngày:{" "}
                    <strong className="text-white font-mono">
                      {profile.premiumUntil
                        ? new Date(profile.premiumUntil).toLocaleString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        : "Vĩnh viễn"}
                    </strong>
                  </p>
                </div>
              )}

              {/* VIP Premium purchase options */}
              <div className="pixel-box-nested p-4 space-y-4 border border-[#D4AF37]/35 bg-gradient-to-br from-[#1C1C18] to-[#D4AF37]/5">
                <h3 className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5">
                  👑 Đăng Ký Premium Membership
                </h3>
                <p className="text-[12px] text-[#F3E5AB]/85 leading-relaxed">
                  Trở thành VIP để nhận các quyền lợi: Tắt quảng cáo, +15% EXP mỗi trận đấu, giảm 10% giá Cửa hàng, và nhận ngay Premium Track của Battle Pass mùa này.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-[#141412] p-3 rounded-lg border border-[#D4AF37]/10 text-center">
                    <span className="block text-[12px] text-[#F3E5AB]/50 uppercase font-semibold">Gói 1 Tháng</span>
                    <span className="text-sm font-bold text-white font-mono block mt-1">69,000 VNĐ</span>
                    <button
                      onClick={() => handleBuyPremium(1)}
                      disabled={sepayRedirecting}
                      className="bg-[#D4AF37] text-[#141412] text-[8.5px] uppercase font-extrabold w-full py-2 rounded-lg mt-3 transition hover:brightness-110 disabled:opacity-50"
                    >
                      {sepayRedirecting ? "Đang xử lý..." : "Đăng ký ngay"}
                    </button>
                  </div>

                  <div className="bg-[#141412] p-3 rounded-lg border border-[#D4AF37]/10 text-center">
                    <span className="block text-[12px] text-[#F3E5AB]/50 uppercase font-semibold">Gói 6 Tháng</span>
                    <span className="text-sm font-bold text-white font-mono block mt-1">349,000 VNĐ</span>
                    <button
                      onClick={() => handleBuyPremium(6)}
                      disabled={sepayRedirecting}
                      className="bg-gradient-to-r from-[#D4AF37] to-[#FF9F0A] text-[#141412] text-[8.5px] uppercase font-extrabold w-full py-2 rounded-lg mt-3 transition hover:brightness-110 disabled:opacity-50"
                    >
                      {sepayRedirecting ? "Đang xử lý..." : "Tiết kiệm 15%"}
                    </button>
                  </div>
                </div>
              </div>


              {/* Guest account links */}
              {profile.isGuest && (
                <div className="pixel-box-nested p-4 space-y-4 border border-red-500/20 bg-[#1C1C18]">
                  <h3 className="text-xs font-bold text-red-400 uppercase flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    Bảo Vệ Tài Khoản Khách
                  </h3>
                  <p className="text-[12px] text-[#F3E5AB]/75 leading-relaxed">
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
                      className="bg-red-500 hover:bg-red-600 text-white text-[12px] uppercase font-bold py-2 px-6 rounded-lg transition"
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
                    className={`px-3 py-1.5 rounded-lg text-[12px] uppercase font-bold border transition ${
                      socialSubTab === "FRIENDS" 
                        ? "bg-[#D4AF37] border-[#D4AF37] text-[#141412]" 
                        : "bg-[#1C1C18] border-[#D4AF37]/15 text-[#F3E5AB]/75 hover:border-[#D4AF37]"
                    }`}
                  >
                    Bạn Bè
                  </button>
                  <button 
                    onClick={() => setSocialSubTab("ACHIEVEMENTS")}
                    className={`px-3 py-1.5 rounded-lg text-[12px] uppercase font-bold border transition ${
                      socialSubTab === "ACHIEVEMENTS" 
                        ? "bg-[#D4AF37] border-[#D4AF37] text-[#141412]" 
                        : "bg-[#1C1C18] border-[#D4AF37]/15 text-[#F3E5AB]/75 hover:border-[#D4AF37]"
                    }`}
                  >
                    Thành Tựu
                  </button>
                  <button 
                    onClick={() => setSocialSubTab("GUILD")}
                    className={`px-3 py-1.5 rounded-lg text-[12px] uppercase font-bold border transition ${
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
                    <span className="block text-[12px] text-[#F3E5AB]/60 uppercase tracking-wider font-semibold border-b border-[#D4AF37]/5 pb-2">
                      Danh Sách Bạn Bè (Giới hạn 30 bạn)
                    </span>
                    
                    <div className="space-y-3">
                      {friends.length === 0 ? (
                        <p className="text-[12px] text-[#F3E5AB]/50 text-center py-4">Chưa có bạn bè nào. Hãy gửi lời mời kết bạn bên dưới!</p>
                      ) : (
                        friends.map((f) => {
                          const isOnline = onlineUsers.has(f.id);
                          return (
                            <div key={f.id} className="flex justify-between items-center text-xs bg-black/20 p-2.5 rounded-lg border border-[#D4AF37]/5 animate-fade-in">
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOnline ? "bg-green-400 animate-pulse" : "bg-gray-500"}`}></span>
                                <div>
                                  <span className="font-bold text-white block">@{f.username}</span>
                                  <span className="text-[9.5px] text-[#F3E5AB]/60 block">
                                    {isOnline ? "Trực tuyến" : "Ngoại tuyến"} • ELO: {f.eloGomoku || 1000} • Lv.{f.level || 1}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-1.5">
                                {isOnline && (
                                  <button
                                    onClick={() => handleInviteFriend(f.id, f.username)}
                                    className="bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] py-1 px-3 rounded-lg text-[12px] font-bold transition"
                                  >
                                    Mời
                                  </button>
                                )}
                                <button
                                  onClick={() => handleBlockUser(f.id)}
                                  className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 py-1 px-2 rounded-lg text-[12px] font-bold transition"
                                >
                                  Chặn
                                </button>
                                <button
                                  onClick={() => handleRemoveFriend(f.id)}
                                  className="bg-black/30 hover:bg-black/70 text-[#F3E5AB]/60 hover:text-white border border-[#D4AF37]/10 py-1 px-2 rounded-lg text-[12px] font-bold transition"
                                >
                                  Hủy
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Lời mời kết bạn chờ duyệt */}
                    {pendingFriends.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[#D4AF37]/10 space-y-2">
                        <span className="block text-[12px] text-yellow-500 uppercase tracking-wider font-semibold animate-pulse">Lời mời kết bạn đang chờ ({pendingFriends.length})</span>
                        <div className="space-y-2">
                          {pendingFriends.map((req) => (
                            <div key={req.id} className="flex justify-between items-center text-xs bg-[#D4AF37]/5 p-2.5 rounded-lg border border-[#D4AF37]/15">
                              <div>
                                <span className="font-bold text-white block">@{req.username}</span>
                                <span className="text-[12px] text-[#F3E5AB]/50 block">Lv.{req.level || 1} • ELO: {req.eloGomoku || 1000}</span>
                              </div>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleAcceptFriendRequest(req.id)}
                                  className="bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] py-1 px-3 rounded-lg text-[12px] font-bold transition"
                                >
                                  Đồng ý
                                </button>
                                <button
                                  onClick={() => handleRejectFriendRequest(req.id)}
                                  className="bg-black/40 hover:bg-black/80 text-red-400 py-1 px-3 rounded-lg text-[12px] font-bold transition"
                                >
                                  Từ chối
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Form Kết bạn bằng Username */}
                    <div className="mt-4 pt-4 border-t border-[#D4AF37]/10 space-y-2">
                      <span className="block text-[12px] text-[#F3E5AB]/60 uppercase tracking-wider font-semibold">Kết bạn bằng Username</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={addFriendUsername}
                          onChange={(e) => setAddFriendUsername(e.target.value)}
                          placeholder="Nhập chính xác username người chơi..."
                          className="flex-1 pixel-input text-xs py-1.5 px-3 rounded-lg"
                        />
                        <button
                          onClick={handleSendFriendRequest}
                          disabled={addFriendLoading}
                          className="pixel-btn pixel-btn-yellow text-[12px] py-1.5 px-4 font-bold"
                        >
                          {addFriendLoading ? "Đang gửi..." : "Gửi lời mời"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Trạng thái Chuồng Gà (Tổ đội) của tôi */}
                  {activeParty ? (
                    <div className="bg-[#1C1C18] p-4 rounded-xl border border-[#D4AF37]/10 text-center space-y-3">
                      <h4 className="text-xs font-bold text-white uppercase flex items-center justify-center gap-1.5">
                        <Users className="w-4 h-4 text-[#D4AF37]" />
                        Chuồng Gà Đang Hoạt Động
                      </h4>
                      <p className="text-[12px] text-[#F3E5AB]/75 leading-relaxed">
                        Bạn đang ở trong Chuồng Gà. Hãy chuyển qua trang quản lý Chuồng Gà để mời bạn bè, cày nhiệm vụ nâng cấp và bắt đầu đấu cờ!
                      </p>
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => setSocialSubTab("GUILD")}
                          className="pixel-btn pixel-btn-yellow py-2 px-6 text-[12px] font-bold"
                        >
                          Vào Chuồng Gà
                        </button>
                        <button
                          onClick={handleLeaveParty}
                          className="pixel-btn pixel-btn-secondary border-red-500/30 text-red-500 hover:bg-red-500/10 py-2 px-4 text-[12px] font-bold"
                        >
                          Rời Chuồng
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#1C1C18] p-4 rounded-xl border border-[#D4AF37]/10 text-center space-y-3">
                      <h4 className="text-xs font-bold text-white uppercase flex items-center justify-center gap-1.5">
                        <UserPlus className="w-4 h-4 text-[#D4AF37]" />
                        Tạo Chuồng Gà
                      </h4>
                      <p className="text-[12px] text-[#F3E5AB]/75 leading-relaxed">
                        Tạo Chuồng Gà để cùng bạn bè nhận EXP thưởng thêm, làm nhiệm vụ thăng cấp và thách đấu cược Trứng!
                      </p>
                      <button
                        onClick={handleCreateParty}
                        className="pixel-btn pixel-btn-yellow py-2 px-6 text-[12px] font-bold"
                      >
                        Tạo Chuồng Gà
                      </button>
                    </div>
                  )}
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
                            <p className="text-[12px] text-[#F3E5AB]/65 leading-tight mt-0.5">
                              {ach.description}
                            </p>
                            <span className="text-[12px] text-[#D4AF37] font-mono block mt-1">
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
                <div className="space-y-6 animate-fade-in">
                  {/* Guild overview */}
                  <div className="bg-[#1C1C18] p-4 rounded-xl border border-[#D4AF37]/20 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gradient-to-br from-[#1C1C18] to-[#D4AF37]/5">
                    <div className="text-left space-y-1">
                      <span className="bg-[#FF9F0A]/10 text-[#FF9F0A] border border-[#FF9F0A]/30 text-[12px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        BẢNG ĐIỀU KHIỂN CHUỒNG GÀ (TỔ ĐỘI)
                      </span>
                      <h3 className="text-base font-extrabold text-white">🏡 Chuồng Gà Đồng Đội</h3>
                      <p className="text-[12px] text-[#F3E5AB]/75 leading-relaxed">
                        Nơi các chiến hữu cùng Chuồng tụ họp, trò chuyện thời gian thực và cày cuốc nâng cấp Chuồng!
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {activeParty && (
                        <div className="text-center bg-black/40 px-3 py-1.5 rounded-lg border border-[#D4AF37]/10 shrink-0 font-mono">
                          <span className="text-[8.5px] text-[#F3E5AB]/50 block">CẤP CHUỒNG</span>
                          <span className="text-md font-bold text-[#D4AF37]">Lv.{activeParty.level || 1}</span>
                        </div>
                      )}
                      {activeParty && (
                        <button
                          onClick={handleLeaveParty}
                          className="bg-black/40 hover:bg-[#FF3B30]/10 border border-[#FF3B30]/30 hover:border-[#FF3B30] text-red-500 hover:text-white px-3 py-2 rounded-lg text-[9.5px] font-bold uppercase transition"
                        >
                          Rời Chuồng
                        </button>
                      )}
                    </div>
                  </div>

                  {!activeParty ? (
                    /* CHƯA CÓ CHUỒNG */
                    <div className="bg-[#1C1C18] p-6 rounded-xl border border-[#D4AF37]/10 text-center space-y-4">
                      <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 flex items-center justify-center mx-auto">
                        <UserPlus className="w-6 h-6 text-[#D4AF37]" />
                      </div>
                      <div className="space-y-2 max-w-sm mx-auto">
                        <h4 className="text-xs font-bold text-white uppercase">Bạn Chưa Gia Nhập Chuồng Gà</h4>
                        <p className="text-[12px] text-[#F3E5AB]/70 leading-relaxed">
                          Tạo ngay một Chuồng Gà mới và mời bạn bè vào cày chung để nâng cấp Chuồng và mở khóa nhiều phần quà!
                        </p>
                      </div>
                      <button
                        onClick={handleCreateParty}
                        className="pixel-btn pixel-btn-yellow py-2.5 px-8 text-xs font-bold"
                      >
                        Khởi Tạo Chuồng Gà Mới
                      </button>
                    </div>
                  ) : (
                    /* ĐÃ GIA NHẬP CHUỒNG GÀ */
                    <div className="space-y-6">
                      {/* EXP & Cấp độ */}
                      <div className="bg-[#1C1C18] p-4 rounded-xl border border-[#D4AF37]/10 space-y-2">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-white">Điểm EXP tích lũy Chuồng Gà</span>
                          <span className="text-[#D4AF37] font-mono">
                            {activeParty.exp || 0} / {(activeParty.level || 1) * 100} EXP
                          </span>
                        </div>
                        <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-[#D4AF37]/10">
                          <div 
                            className="bg-gradient-to-r from-[#D4AF37] to-[#FF9F0A] h-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.floor(((activeParty.exp || 0) / ((activeParty.level || 1) * 100)) * 100))}%` }}
                          ></div>
                        </div>
                        <p className="text-[8.5px] text-[#F3E5AB]/50">Cày các ván đấu cờ tại Đấu Trường để tích lũy EXP. Mỗi cấp Chuồng Gà tăng thêm +10% EXP cá nhân nhận được!</p>
                      </div>

                      {/* Hai cột: Chat thời gian thực & Thành viên */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Cột 1: Khung chat Chuồng Gà thời gian thực */}
                        <div className="bg-[#1C1C18] p-4 rounded-xl border border-[#D4AF37]/10 flex flex-col h-[280px] text-left animate-fade-in">
                          <span className="block text-[8.5px] text-[#F3E5AB]/60 uppercase tracking-wider font-semibold border-b border-[#D4AF37]/5 pb-1 shrink-0">
                            💬 Trò chuyện trong Chuồng
                          </span>
                          
                          {/* Messages list */}
                          <div className="flex-grow overflow-y-auto my-3 space-y-2 pr-1 text-xs">
                            {partyMessages.length === 0 ? (
                              <div className="text-[12px] text-[#F3E5AB]/30 text-center py-12">Chưa có tin nhắn nào trong Chuồng. Hãy gáy lên nào! 🐔</div>
                            ) : (
                              partyMessages.map((msg, i) => (
                                <div key={i} className="space-y-0.5 bg-black/15 p-2 rounded border border-[#D4AF37]/5">
                                  <div className="flex justify-between items-center text-[12px] text-[#F3E5AB]/50 font-bold">
                                    <span>@{msg.senderUsername}</span>
                                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  <p className="text-white break-words leading-tight">{msg.message}</p>
                                </div>
                              ))
                            )}
                          </div>
                          
                          {/* Chat input box */}
                          <div className="flex gap-1.5 shrink-0 pt-2 border-t border-[#D4AF37]/5">
                            <input
                              type="text"
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSendPartyChat();
                              }}
                              placeholder="Nhập tin nhắn..."
                              className="flex-1 pixel-input text-xs py-1.5 px-3 rounded-lg"
                            />
                            <button
                              onClick={handleSendPartyChat}
                              className="bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] px-4 rounded-lg text-xs font-bold transition shrink-0"
                            >
                              Gửi
                            </button>
                          </div>
                        </div>

                        {/* Cột 2: Thành viên & Mời bạn */}
                        <div className="bg-[#1C1C18] p-4 rounded-xl border border-[#D4AF37]/10 space-y-4 text-left">
                          <span className="block text-[8.5px] text-[#F3E5AB]/60 uppercase tracking-wider font-semibold border-b border-[#D4AF37]/5 pb-1">
                            Thành Viên Trong Chuồng ({partyMembers.length}/5)
                          </span>
                          
                          <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                            {partyMembers.map((member) => {
                              const isLeader = activeParty.leaderId === member.userId;
                              const memberProfile = member.profile;
                              return (
                                <div key={member.id} className="flex justify-between items-center text-xs bg-black/20 p-2 rounded-lg border border-[#D4AF37]/5">
                                  <div className="flex items-center gap-2">
                                    <div className="relative">
                                      <div className="w-8 h-8 rounded-full bg-[#1C1C18] border border-[#D4AF37]/20 flex items-center justify-center text-white text-[12px] font-bold">
                                        {memberProfile?.username?.substring(0, 2).toUpperCase() || "..."}
                                      </div>
                                      {isLeader && (
                                        <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[12px] font-extrabold px-1 rounded-full border border-black" title="Chủ chuồng">
                                          👑
                                        </span>
                                      )}
                                    </div>
                                    <div>
                                      <span className="font-bold text-white block">@{memberProfile?.username || "Đang tải..."}</span>
                                      <span className="text-[12px] text-[#F3E5AB]/50 block">Lv.{memberProfile?.level || 1} • ELO: {memberProfile?.eloGomoku || 1000}</span>
                                    </div>
                                  </div>
                                  
                                  {activeParty.leaderId === profile.id && member.userId !== profile.id && (
                                    <button
                                      onClick={() => handleKickMember(member.userId)}
                                      className="text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/20 rounded p-1 transition"
                                      title="Trục xuất khỏi chuồng"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Mời nhanh bạn bè online vào chuồng */}
                          {activeParty.leaderId === profile.id && (
                            <div className="pt-2 border-t border-[#D4AF37]/5 space-y-2">
                              <span className="block text-[12px] text-[#F3E5AB]/50 uppercase font-semibold">Mời bạn vào Chuồng:</span>
                              <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full">
                                {friends.filter(f => onlineUsers.has(f.id)).length === 0 ? (
                                  <span className="text-[12px] text-[#F3E5AB]/40">Không có bạn bè trực tuyến</span>
                                ) : (
                                  friends.filter(f => onlineUsers.has(f.id)).map(f => (
                                    <button
                                      key={f.id}
                                      onClick={() => handleInviteFriend(f.id, f.username)}
                                      className="bg-[#D4AF37]/10 hover:bg-[#D4AF37] border border-[#D4AF37]/25 text-[#D4AF37] hover:text-[#141412] py-1 px-2.5 rounded text-[12px] font-bold shrink-0 transition"
                                    >
                                      + Mời @{f.username}
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Nhiệm vụ Chuồng Gà tuần */}
                      <div className="bg-[#1C1C18] p-4 rounded-xl border border-[#D4AF37]/10 space-y-3 text-left">
                        <span className="block text-[8.5px] text-[#F3E5AB]/60 uppercase tracking-wider font-semibold border-b border-[#D4AF37]/5 pb-1">
                          Nhiệm Vụ Chuồng Gà Tuần
                        </span>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {activeParty.missions && activeParty.missions.length > 0 ? (
                            activeParty.missions.map((mission: any) => {
                              const progressPercent = Math.min(100, Math.floor((mission.currentValue / mission.targetValue) * 100));
                              return (
                                <div key={mission.id} className="bg-black/30 p-3 rounded-lg border border-[#D4AF37]/5 flex flex-col justify-between space-y-2">
                                  <div>
                                    <span className="text-[12px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded font-bold uppercase">
                                      {mission.type === "WIN_GAMES" ? "Chung Sức" : "Kiên Trì"}
                                    </span>
                                    <h5 className="text-xs font-bold text-white mt-1">{mission.title}</h5>
                                    <p className="text-[12px] text-[#F3E5AB]/60">
                                      {mission.type === "WIN_GAMES" 
                                        ? "Đấu co-op cược Trứng để hoàn tất." 
                                        : "Chơi hoàn thành game không kể thắng thua."}
                                    </p>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-[12px] font-bold">
                                      <span className="text-[#F3E5AB]/50">Tiến độ: {mission.currentValue} / {mission.targetValue}</span>
                                      <span className="text-[#D4AF37]">+{mission.rewardExp} EXP • +{mission.rewardCoins} Trứng</span>
                                    </div>
                                    <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                                      <div className="bg-gradient-to-r from-[#D4AF37] to-[#FF9F0A] h-full" style={{ width: `${progressPercent}%` }}></div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-[12px] text-[#F3E5AB]/30 text-center py-6 col-span-2">
                              Không có nhiệm vụ tổ đội nào. Các nhiệm vụ sẽ tự động được tải khi bạn kết thúc trận đấu.
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Column 3: Progression Sidebar (Right Side - Desktop Only) */}
        <div className="flex lg:col-span-3 flex-col gap-6 shrink-0 text-left w-full lg:w-auto mt-6 lg:mt-0">
          
          {/* Profile Overview Card */}
          <div className={`pixel-box p-4 flex flex-col gap-4 relative overflow-hidden ${bannerItem?.visuals?.className || ""}`}>
            <div className="flex items-center gap-3 relative z-10">
              <div className={`w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center border border-[#D4AF37]/20 relative ${frameItem?.visuals?.className || ""} ${skinItem?.visuals?.className || "bg-[#141412] p-2"}`}>
                <img src={profile.avatarUrl || "/logo.png"} className="w-full h-full object-contain" alt="Vuiga avatar" />
              </div>
              <div>
                <h3 className="font-bold text-white flex items-center gap-1 drop-shadow-md">
                  {profile.prestigeLevel > 0 && <Star className="w-4 h-4 text-[#FF9F0A] fill-[#FF9F0A]" />}
                  {profile.username}
                </h3>
                <div className="flex items-center gap-1.5 text-[12px] drop-shadow">
                  <span className={`${rankInfo?.className || "text-gray-400"} font-extrabold`}>
                    {rankInfo?.icon} {rankInfo?.name} {rankInfo?.divisionName}
                  </span>
                  <span className="text-[#F3E5AB]/60 font-mono">| Cấp {profile.level}</span>
                </div>
              </div>
            </div>

            {/* EXP bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[12px] font-mono">
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
                className="w-full bg-gradient-to-r from-[#D4AF37] to-[#FF9F0A] text-[#141412] py-2 rounded-lg text-[10px] font-extrabold uppercase transition hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-1.5 shadow"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {prestigeLoading ? "Đang tiến hành..." : "Kích Hoạt Danh Vọng"}
              </button>
            )}

            {/* Mastery Stats / Game Ranks (Hiển thị EXP Rank từng trò) */}
            <div className="border-t border-[#D4AF37]/10 pt-3 space-y-2.5">
              <span className="text-[12px] text-[#F3E5AB]/70 font-bold block mb-1">Xếp Hạng & Tiến Trình Rank</span>
              
              <div className="space-y-2">
                {[
                  {
                    name: "Caro 3x3",
                    tier: profile.rankTierTicTacToe || 1,
                    division: profile.rankDivisionTicTacToe || 3,
                    points: profile.rankPointsTicTacToe || 0,
                    elo: profile.eloTicTacToe || 1000,
                  },
                  {
                    name: "Gomoku (Caro 5)",
                    tier: profile.rankTierCaro || 1,
                    division: profile.rankDivisionCaro || 3,
                    points: profile.rankPointsCaro || 0,
                    elo: profile.eloGomoku || 1000,
                  },
                  {
                    name: "Battleship (Bắn Tàu)",
                    tier: profile.rankTierBattleship || 1,
                    division: profile.rankDivisionBattleship || 3,
                    points: profile.rankPointsBattleship || 0,
                    elo: profile.eloBattleship || 1000,
                  },
                  {
                    name: "Bầu Cua Tôm Cá",
                    tier: profile.rankTierBauCua || 1,
                    division: profile.rankDivisionBauCua || 3,
                    points: profile.rankPointsBauCua || 0,
                    elo: profile.eloBauCua || 1000,
                  },
                ].map((gameRank, idx) => {
                  const r = getRankFromDb(gameRank.tier, gameRank.division, gameRank.points);
                  const rpPercent = Math.min(100, Math.max(0, gameRank.points));
                  return (
                    <div key={idx} className="bg-[#141412] p-2.5 rounded-xl border border-[#D4AF37]/10 space-y-1.5">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#F3E5AB]/80 font-bold font-mono">{gameRank.name}</span>
                        <span className="text-[#F3E5AB]/50 font-mono text-[10px]">ELO: {gameRank.elo}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className={`text-[12px] font-bold ${r.className}`}>
                          {r.icon} {r.name} {r.divisionName}
                        </span>
                        <span className="text-[11px] font-mono text-[#D4AF37] font-bold">
                          {gameRank.points} / 100 RP
                        </span>
                      </div>

                      {/* Mini progress bar for game rank */}
                      <div className="w-full bg-black/60 h-2 rounded-full overflow-hidden border border-[#D4AF37]/15">
                        <div 
                          className="bg-gradient-to-r from-[#D4AF37] to-[#FF9F0A] h-full transition-all duration-300 rounded-full" 
                          style={{ width: `${rpPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Daily Missions Card */}
          <div className="pixel-box p-4 space-y-4">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-[#D4AF37]/10 pb-2">
              <Trophy className="w-4 h-4 text-[#FF9F0A]" />
              Nhiệm vụ hàng ngày
            </h4>

            {loadingMissions ? (
              <div className="text-center text-[12px] text-gray-400 uppercase py-3">Đang cập nhật...</div>
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
                              className="pixel-btn pixel-btn-yellow text-[12px] px-2 py-1 rounded transition shrink-0"
                            >
                              Nhận
                            </button>
                          )}
                        </div>
                      )}
                      
                      {m.claimed && (
                        <span className="text-[12px] text-green-400 font-mono block">✓ Đã nhận thưởng (+{m.rewardCoins} 🥚)</span>
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
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#FF9F0A]" />
                Điểm danh 7 ngày
              </h4>
              <span className="text-[12px] bg-[#FF9F0A]/10 border border-[#FF9F0A]/35 text-[#FF9F0A] px-2 py-0.5 rounded font-mono font-bold">
                Chuỗi: {profile.loginStreak}
              </span>
            </div>

            {/* Streak freezes */}
            <div className="flex justify-between items-center text-[12px] bg-[#141412] p-2 rounded-lg border border-[#D4AF37]/5">
              <span>Đóng băng chuỗi: <strong className="font-mono text-[#D4AF37]">{profile.streakFreezes}</strong></span>
              <button
                onClick={handleBuyStreakFreeze}
                className="text-[12px] font-bold text-[#FF9F0A] hover:underline"
              >
                Mua (+10 🥚)
              </button>
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const isCurrent = profile.dailyStreakDay === day;
                const claimCoins = [10, 15, 20, 25, 30, 40, 50][day - 1];
                return (
                  <div 
                    key={day} 
                    className={`flex flex-col justify-center items-center py-2.5 px-1 rounded-xl border relative transition ${
                      isCurrent 
                        ? "bg-[#D4AF37]/20 border-[#D4AF37] text-white font-bold shadow-[0_0_10px_rgba(212,175,55,0.25)]" 
                        : "bg-[#141412] border-[#D4AF37]/10 text-gray-400"
                    }`}
                  >
                    <span className="text-[11px] text-[#F3E5AB]/80 font-semibold block mb-1">Ngày {day}</span>
                    <span className="font-mono text-xs text-[#FF9F0A] font-bold">+{claimCoins} 🥚</span>
                  </div>
                );
              })}
            </div>

            {dailyClaimMessage && <p className="text-[12px] text-green-400 font-mono">{dailyClaimMessage}</p>}
            {dailyClaimError && <p className="text-[12px] text-red-400 font-mono">{dailyClaimError}</p>}

            <button
              onClick={handleClaimDaily}
              disabled={claimingDaily}
              className="w-full pixel-btn pixel-btn-yellow py-2 text-[12px] font-bold transition"
            >
              {claimingDaily ? "Đang nhận..." : "Điểm danh ngày"}
            </button>
          </div>

          {/* Friends list sidebar (PC Only) */}
          <div className="pixel-box p-4 space-y-4">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-[#D4AF37]/10 pb-2">
              <Users className="w-4 h-4 text-[#FF9F0A]" />
              Bạn bè trực tuyến
            </h4>

            <div className="space-y-3">
              {friends.length === 0 ? (
                <div className="text-[12px] text-[#F3E5AB]/40 text-center py-2">Chưa có bạn bè</div>
              ) : (
                friends.slice(0, 10).map((f) => {
                  const isOnline = onlineUsers.has(f.id);
                  return (
                    <div key={f.id} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? "bg-green-500" : "bg-gray-500"}`}></span>
                        <div className="max-w-[100px]">
                          <span className="font-bold text-white block truncate">@{f.username}</span>
                          <span className="text-[8.5px] text-[#F3E5AB]/50 block truncate">
                            {isOnline ? "Trực tuyến" : "Ngoại tuyến"}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {isOnline && (
                          <button
                            onClick={() => handleInviteFriend(f.id, f.username)}
                            className="pixel-btn pixel-btn-yellow px-2 py-1 text-[12px] font-bold transition"
                          >
                            Mời
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Invite Party link creation */}
            <div className="border-t border-[#D4AF37]/10 pt-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/?joinRoom=room-party-id`);
                  showAlert("Đã sao chép Link mời tổ đội!");
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
          className={`flex flex-col items-center gap-0.5 flex-1 ${activeTab === "PLAY" ? "text-[#D4AF37]" : "text-[#F3E5AB]/55"}`}
        >
          <Swords className="w-5 h-5" />
          <span className="text-[12px] font-medium">Đấu trường</span>
        </button>

        <button
          onClick={() => setActiveTab("SHOP")}
          className={`flex flex-col items-center gap-0.5 flex-1 ${activeTab === "SHOP" ? "text-[#D4AF37]" : "text-[#F3E5AB]/55"}`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span className="text-[12px] font-medium">Cửa hàng</span>
        </button>

        <button
          onClick={() => setActiveTab("BP")}
          className={`flex flex-col items-center gap-0.5 flex-1 ${activeTab === "BP" ? "text-[#D4AF37]" : "text-[#F3E5AB]/55"}`}
        >
          <Award className="w-5 h-5" />
          <span className="text-[12px] font-medium">Battle Pass</span>
        </button>

        <button
          onClick={() => setActiveTab("SOCIAL")}
          className={`flex flex-col items-center gap-0.5 flex-1 ${activeTab === "SOCIAL" ? "text-[#D4AF37]" : "text-[#F3E5AB]/55"}`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[12px] font-medium">Bạn bè</span>
        </button>

        <button
          onClick={() => setActiveTab("SETTINGS")}
          className={`flex flex-col items-center gap-0.5 flex-1 ${activeTab === "SETTINGS" ? "text-[#D4AF37]" : "text-[#F3E5AB]/55"}`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[12px] font-medium">Cài đặt</span>
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
              <span className="block text-[12px] text-[#F3E5AB]/65 uppercase font-semibold">Chọn gói nạp:</span>
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
                    <span className="text-[12px] text-[#D4AF37] font-bold mt-1 font-mono">+{pkg.coins} Coins</span>
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
                <p className="text-[12px] text-white font-bold">NGÂN HÀNG QUÂN ĐỘI (MB)</p>
                <p className="text-[10.5px] text-[#D4AF37] font-mono font-bold mt-0.5">Số tài khoản: 0999999999999</p>
                <p className="text-[12px] text-[#F3E5AB]/65 mt-1">Nội dung CK: <strong className="font-mono text-[#FF9F0A]">{profile.username} NAPCOIN</strong></p>
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


      {/* MODAL: PARTY INVITATION */}
      {activeInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="pixel-box p-6 w-full max-w-sm bg-[#1C1C18] border-2 border-[#D4AF37]/50 text-left space-y-4 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
            <div className="flex justify-between items-center border-b border-[#D4AF37]/15 pb-2">
              <h3 className="text-xs font-bold text-white uppercase flex items-center gap-1.5 animate-pulse">
                <Swords className="w-4 h-4 text-[#D4AF37]" />
                Thách Đấu Tổ Đội
              </h3>
              <button onClick={() => setActiveInvite(null)} className="text-gray-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-[#F3E5AB] leading-relaxed">
                <span className="text-[#D4AF37] font-bold">@{activeInvite.senderUsername}</span> đã mời bạn vào tổ đội <span className="text-white font-bold">{activeInvite.partyName || `Tổ đội của @${activeInvite.senderUsername}`}</span>.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  handleJoinParty(activeInvite.partyId);
                  setActiveInvite(null);
                }}
                className="flex-1 pixel-btn pixel-btn-yellow py-2.5 text-xs font-bold transition"
              >
                Tham gia
              </button>
              <button
                onClick={() => setActiveInvite(null)}
                className="flex-1 pixel-btn pixel-btn-secondary border-red-500/30 text-red-500 hover:bg-red-500/10 py-2.5 text-xs font-bold transition"
              >
                Từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      {activeGameInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="pixel-box p-6 w-full max-w-sm bg-[#1C1C18] border border-[#FF9F0A]/30 text-left space-y-4">
            <div className="flex justify-between items-center border-b border-[#FF9F0A]/15 pb-2">
              <h3 className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5">
                <Swords className="w-4 h-4 text-[#FF9F0A]" />
                Thách Đấu Trực Tiếp
              </h3>
              <button onClick={() => setActiveGameInvite(null)} className="text-gray-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-[#F3E5AB] leading-relaxed">
                Người chơi <span className="text-[#FF9F0A] font-bold">@{activeGameInvite.senderUsername}</span> thách đấu bạn chơi cờ <span className="text-white font-bold">{activeGameInvite.gameType === "CARO" ? "Gomoku" : activeGameInvite.gameType === "BATTLESHIP" ? "Battleship" : "Caro 3x3"}</span>.
              </p>
              <div className="bg-black/30 p-2 rounded border border-[#FF9F0A]/10 flex justify-between items-center text-xs">
                <span className="text-[#F3E5AB]/60">Mức cược trận đấu:</span>
                <span className="text-yellow-500 font-mono font-bold">{activeGameInvite.wager} Coin</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAcceptGameInvite}
                className="flex-1 pixel-btn pixel-btn-yellow py-2.5 text-xs font-bold transition"
              >
                Chấp nhận
              </button>
              <button
                onClick={() => setActiveGameInvite(null)}
                className="flex-1 pixel-btn pixel-btn-secondary border-red-500/30 text-red-500 hover:bg-red-500/10 py-2.5 text-xs font-bold transition"
              >
                Từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hộp thoại Quà Tặng Discord (Chỉ hiển thị khi đã đăng nhập Gmail - không phải Guest) */}
      {showDiscordModal && !profile.isGuest && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#18181b] border-2 border-[#5865F2]/45 rounded-2xl w-full max-w-sm p-6 relative overflow-hidden shadow-[0_0_40px_rgba(88,101,242,0.3)] text-center">
            {/* Background glowing ambient */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#5865F2]/10 rounded-full blur-3xl pointer-events-none"></div>
            
            {/* Mascot header */}
            <div className="flex flex-col items-center space-y-4 pt-2">
              <div className="w-16 h-16 bg-[#5865F2] rounded-2xl flex items-center justify-center shadow-lg border border-[#5865F2]/30 shadow-[#5865F2]/20 animate-bounce">
                <span className="text-4xl">👾</span>
              </div>
              <div>
                <span className="inline-block mb-2.5 bg-[#5865F2]/15 text-[#5865F2] border border-[#5865F2]/30 text-[12px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest font-mono">
                  SỰ KIỆN CỘNG ĐỒNG
                </span>
                <h3 className="text-base font-extrabold text-white mb-1">Gia Nhập Nhóm Discord</h3>
                <p className="text-[12px] text-[#F3E5AB]/75 px-4 leading-relaxed">
                  Nhận ngay phần quà độc quyền khi tham gia kênh Discord chính thức của vuiga.com!
                </p>
              </div>
            </div>

            {/* Gift details card */}
            <div className="my-5 bg-black/45 p-4 rounded-xl border border-[#5865F2]/10 space-y-2 text-left font-mono">
              <span className="block text-[12px] text-[#F3E5AB]/40 uppercase tracking-wider">Quà tặng của bạn:</span>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#F3E5AB]/90 font-bold flex items-center gap-1.5">
                  🥚 200 Trứng (Coin)
                </span>
                <span className="text-[#D4AF37] font-bold">+200</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-[#5865F2]/10 pt-2">
                <span className="text-[#F3E5AB]/90 font-bold flex items-center gap-1.5">
                  👾 Skin Gà Discord Độc Quyền
                </span>
                <span className="bg-[#5865F2]/30 text-[#8ea1ff] text-[12px] px-2 py-0.5 rounded uppercase font-bold tracking-wider">ĐẶC BIỆT</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleClaimDiscord}
                disabled={claimingDiscord}
                className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white py-3 rounded-xl text-xs font-bold transition-all shadow-[0_4px_12px_rgba(88,101,242,0.3)] flex items-center justify-center gap-2 cursor-pointer"
              >
                {claimingDiscord ? (
                  <>
                    <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                    <span>Đang gửi quà...</span>
                  </>
                ) : (
                  <>
                    <span>Tham Gia Discord & Nhận Quà</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setShowDiscordModal(false)}
                className="w-full bg-transparent hover:bg-white/5 border border-white/10 text-white/50 hover:text-white py-2 rounded-xl text-[12px] font-bold transition cursor-pointer"
              >
                Bỏ qua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hộp thoại Đăng Nhập / Liên Kết Gmail Cho Tài Khoản Khách */}
      {showGuestLinkModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#1C1C18] border-2 border-[#D4AF37]/50 rounded-2xl w-full max-w-md p-6 relative overflow-hidden shadow-[0_0_40px_rgba(212,175,55,0.2)] text-center">
            {/* Background ambient */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none"></div>
            
            {/* Close button */}
            <button 
              onClick={() => setShowGuestLinkModal(false)}
              className="absolute top-4 right-4 text-[#F3E5AB]/60 hover:text-[#D4AF37] transition p-1 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex flex-col items-center space-y-3 pt-2">
              <div className="w-14 h-14 bg-gradient-to-br from-[#D4AF37] to-[#FF9F0A] rounded-2xl flex items-center justify-center shadow-lg border border-white/20 shadow-[#D4AF37]/20 animate-bounce">
                <Mail className="w-7 h-7 text-[#141412]" />
              </div>
              <div className="space-y-1">
                <span className="bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 text-[12px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-widest font-mono">
                  BẢO VỆ TẠI KHỎAN
                </span>
                <h3 className="text-base font-extrabold text-white">Đăng Nhập Gmail Giúp Lưu Lại Tài Khoản</h3>
                <p className="text-[12px] text-[#F3E5AB]/75 px-2 leading-relaxed">
                  Nhập Email / Gmail của bạn để lưu giữ vĩnh viễn dữ liệu, cấp độ, Skin và số Trứng 🥚 khỏi bị mất!
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleUpgradeAccount} className="my-5 space-y-3 text-left">
              <div className="space-y-1">
                <label className="block text-[12px] text-[#F3E5AB]/70 font-semibold">Email / Gmail của bạn:</label>
                <input
                  type="email"
                  value={upgradeEmail}
                  onChange={(e) => setUpgradeEmail(e.target.value)}
                  placeholder="nhap-email-cua-ban@gmail.com"
                  required
                  className="w-full pixel-input py-2 px-3 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[12px] text-[#F3E5AB]/70 font-semibold">Tạo mật khẩu bảo vệ:</label>
                <input
                  type="password"
                  value={upgradePassword}
                  onChange={(e) => setUpgradePassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  required
                  className="w-full pixel-input py-2 px-3 text-xs"
                />
              </div>

              {upgradeSuccessMsg ? (
                <p className="text-xs text-green-400 font-mono text-center pt-1">{upgradeSuccessMsg}</p>
              ) : null}

              <button
                type="submit"
                disabled={upgradeLoading}
                className="w-full pixel-btn pixel-btn-yellow py-3 text-xs font-extrabold uppercase tracking-wider mt-2 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {upgradeLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang lưu tài khoản...</span>
                  </>
                ) : (
                  <span>Xác Nhận Lưu Lại Tài Khoản</span>
                )}
              </button>
            </form>

            <button
              onClick={() => setShowGuestLinkModal(false)}
              className="text-[12px] text-[#F3E5AB]/50 hover:text-white transition cursor-pointer"
            >
              Bỏ qua (Tiếp tục chơi với tư cách Khách)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
