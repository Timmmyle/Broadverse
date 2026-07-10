"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, Swords, Award, AlertTriangle, Clock, RefreshCw, Copy, Check, 
  Coins, RotateCw, Shield, Target, Zap, HelpCircle, Eye
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { 
  validateShipPlacement, checkBattleshipShot, BATTLESHIP_SHIPS_CONFIG, BattleshipShip 
} from "@/lib/gameLogic";
import { getBattleshipBotMove } from "@/lib/botAi";
import { SHOP_ITEMS } from "@/lib/shopItems";
import confetti from "canvas-confetti";
import { QRCodeSVG } from "qrcode.react";

interface BattleshipViewProps {
  mode: "BOT" | "FRIEND" | "RANDOM";
  details: {
    roomId?: string;
    isCreator?: boolean;
    difficulty?: "RANDOM" | "EASY" | "HARD";
  };
  profile: any;
  onBack: () => void;
  refreshProfile: () => void;
}

const DEFAULT_SHIPS: BattleshipShip[] = [
  { id: "carrier", name: "Tàu sân bay", size: 5, x: 0, y: 0, vertical: false },
  { id: "battleship", name: "Thiết giáp hạm", size: 4, x: 0, y: 2, vertical: false },
  { id: "destroyer", name: "Tàu khu trục", size: 3, x: 0, y: 4, vertical: false },
  { id: "submarine", name: "Tàu ngầm", size: 3, x: 0, y: 6, vertical: false },
  { id: "patrol", name: "Tàu tuần tra", size: 2, x: 0, y: 8, vertical: false }
];

const getShipColorClasses = (shipId: string, isSunk: boolean) => {
  if (isSunk) {
    return {
      cellBg: "bg-red-950 bg-opacity-35 border-red-800 text-red-500",
      shipBadge: "border-red-600 bg-red-650 bg-opacity-25 text-red-400"
    };
  }
  switch (shipId) {
    case "carrier": // Tàu sân bay - Purple
      return {
        cellBg: "bg-purple-950 bg-opacity-35 border-purple-800 text-purple-400",
        shipBadge: "border-purple-500 bg-purple-600 bg-opacity-25 text-purple-300"
      };
    case "battleship": // Thiết giáp hạm - Amber/Orange
      return {
        cellBg: "bg-amber-950 bg-opacity-35 border-amber-800 text-amber-400",
        shipBadge: "border-amber-500 bg-amber-600 bg-opacity-25 text-amber-300"
      };
    case "destroyer": // Tàu khu trục - Cyan/Teal
      return {
        cellBg: "bg-teal-950 bg-opacity-35 border-teal-800 text-teal-400",
        shipBadge: "border-teal-500 bg-teal-600 bg-opacity-25 text-teal-300"
      };
    case "submarine": // Tàu ngầm - Green
      return {
        cellBg: "bg-emerald-950 bg-opacity-35 border-emerald-800 text-emerald-400",
        shipBadge: "border-emerald-500 bg-emerald-600 bg-opacity-25 text-emerald-300"
      };
    case "patrol": // Tàu tuần tra - Rose/Pink
      return {
        cellBg: "bg-rose-950 bg-opacity-35 border-rose-800 text-rose-400",
        shipBadge: "border-rose-500 bg-rose-600 bg-opacity-25 text-rose-300"
      };
    default:
      return {
        cellBg: "bg-blue-950 bg-opacity-35 border-blue-800 text-blue-400",
        shipBadge: "border-blue-500 bg-blue-600 bg-opacity-25 text-blue-300"
      };
  }
};

export default function BattleshipView({ mode, details, profile, onBack, refreshProfile }: BattleshipViewProps) {
  const supabase = createClient();
  const roomId = details.roomId;

  // --- TRẠNG THÁI GAME CHUNG ---
  const [phase, setPhase] = useState<"PLACEMENT" | "PLAYING" | "FINISHED">("PLACEMENT");
  const [loading, setLoading] = useState(mode !== "BOT");
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [boardThemeClass, setBoardThemeClass] = useState("bg-[#1e1e22]");
  const [isReady, setIsReady] = useState(false);

  // --- TRẠNG THÁI CHO CHẾ ĐỘ BOT (OFFLINE) ---
  const [myShips, setMyShips] = useState<BattleshipShip[]>(DEFAULT_SHIPS);
  const [botShips, setBotShips] = useState<BattleshipShip[]>([]);
  const [myShots, setMyShots] = useState<any[]>([]); // { x, y, hit, shipId, sunk }
  const [botShots, setBotShots] = useState<any[]>([]);
  const [sunkShipsMy, setSunkShipsMy] = useState<string[]>([]);
  const [sunkShipsBot, setSunkShipsBot] = useState<string[]>([]);
  const [energy, setEnergy] = useState(50); // Năng lượng chiến thuật (0 - 100, khởi đầu từ 50)
  const [radarResults, setRadarResults] = useState<any[]>([]); // { x, y, count }
  const [localTurn, setLocalTurn] = useState<"PLAYER" | "BOT">("PLAYER");
  const [localStatus, setLocalStatus] = useState<"PLAYING" | "FINISHED">("PLAYING");

  // --- TRẠNG THÁI CHO CHẾ ĐỘ ONLINE (SUPABASE REALTIME) ---
  const [room, setRoom] = useState<any>(null);
  const roomRef = useRef<any>(null);
  const [myOnlineShips, setMyOnlineShips] = useState<BattleshipShip[]>([]);

  // Trạng thái Biểu cảm Emoji thời gian thực cho Battleship
  const [activeEmojiX, setActiveEmojiX] = useState<string | null>(null);
  const [activeEmojiO, setActiveEmojiO] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  // --- TRẠNG THÁI GIAO DIỆN ĐẶT TÀU ---
  const [selectedShipId, setSelectedShipId] = useState<string>("carrier");
  const [placementOrientation, setPlacementOrientation] = useState<"H" | "V">("H");
  const [hoverCell, setHoverCell] = useState<number | null>(null);

  // --- LỰA CHỌN VŨ KHÍ ---
  const [activeWeapon, setActiveWeapon] = useState<"NORMAL" | "CLUSTER" | "CROSS" | "RADAR">("NORMAL");

  // --- KẾT QUẢ HIỂN THỊ TRẬN ĐẤU ---
  const [gameResult, setGameResult] = useState<{
    finished: boolean;
    outcome?: "WIN" | "LOSE" | "DRAW";
    coinsGained?: number;
    expGained?: number;
    levelUp?: boolean;
  } | null>(null);

  // 1. Tải theme bàn cờ từ LocalStorage
  useEffect(() => {
    const savedThemeId = localStorage.getItem("board_theme") || "theme_classic";
    const savedTheme = SHOP_ITEMS.find(i => i.id === savedThemeId);
    if (savedTheme?.visuals?.className) {
      setBoardThemeClass(savedTheme.visuals.className);
    }
  }, []);

  // 2. Khởi tạo Bot Offline
  useEffect(() => {
    if (mode === "BOT") {
      setMyShips(JSON.parse(JSON.stringify(DEFAULT_SHIPS))); // clone
      setBotShips(generateRandomShips());
      setMyShots([]);
      setBotShots([]);
      setSunkShipsMy([]);
      setSunkShipsBot([]);
      setEnergy(50);
      setRadarResults([]);
      setLocalTurn("PLAYER");
      setLocalStatus("PLAYING");
      setPhase("PLACEMENT");
      setIsReady(false);
      setLoading(false);
    }
  }, [mode]);

  // 3. Quản lý đồng bộ Supabase cho game Online (FRIEND / RANDOM)
  useEffect(() => {
    if (mode === "BOT" || !roomId) return;

    const fetchRoom = async () => {
      try {
        setLoading(true);
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
          setErrorMsg("Không tìm thấy phòng game này.");
        } else {
          setRoom(data);
          roomRef.current = data;
          const boardObj = JSON.parse(data.board);
          setPhase(boardObj.phase);
          
          // Kiểm tra xem mình đã sẵn sàng chưa dựa vào boardObj
          const isPlayerX = profile.id === data.playerXId;
          setIsReady(isPlayerX ? boardObj.readyX : boardObj.readyO);

          // Lấy vị trí tàu của bản thân từ API bảo mật
          fetchMyOnlineShips();

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

    const fetchMyOnlineShips = async () => {
      try {
        const res = await fetch(`/api/match/ships?roomId=${roomId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.ships) {
            setMyOnlineShips(data.ships);
          }
        }
      } catch (err) {
        console.error("Lỗi lấy vị trí tàu online:", err);
      }
    };

    fetchRoom();

    // Đăng ký Realtime
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
            const currentRoom = roomRef.current;
            const opponentJoined = updatedRoom.playerOId && (!currentRoom || !currentRoom.playerOId);

            if (opponentJoined) {
              fetchRoom();
              return;
            }

            setRoom((prevRoom: any) => {
              if (!prevRoom) return null;
              const newRoom = {
                ...prevRoom,
                ...updatedRoom,
                playerX: prevRoom.playerX,
                playerO: prevRoom.playerO
              };
              
              const boardObj = JSON.parse(newRoom.board);
              setPhase(boardObj.phase);
              
              if (newRoom.status === "FINISHED" && prevRoom.status !== "FINISHED") {
                showOnlineResult(newRoom);
              }

              return newRoom;
            });
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
  }, [roomId, mode, profile.id]);

  // Show online game outcomes
  const showOnlineResult = (updatedRoom: any) => {
    const isPlayerX = profile.id === updatedRoom.playerXId;
    const outcome = updatedRoom.winnerId === profile.id ? "WIN" : "LOSE";
    
    // Calculate estimated coins and exp
    const myLevel = profile.level;
    const wager = updatedRoom.wager || 0;
    
    let coinsGained = outcome === "WIN" ? (10 + 2 * myLevel + wager * 2) : Math.round(5 + 1.5 * myLevel);
    let expGained = outcome === "WIN" ? (5 + Math.round(myLevel * 0.2)) : 2;

    setGameResult({
      finished: true,
      outcome,
      coinsGained,
      expGained,
      levelUp: profile.exp + expGained >= 100 + profile.level * 5
    });

    if (outcome === "WIN") {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
    
    refreshProfile();
  };

  // Generate random ship positions (for Bot or for player autofill)
  const generateRandomShips = (): BattleshipShip[] => {
    const ships: BattleshipShip[] = [];
    const occupied = new Set<string>();

    for (const config of BATTLESHIP_SHIPS_CONFIG) {
      let placed = false;
      while (!placed) {
        const vertical = Math.random() > 0.5;
        const x = Math.floor(Math.random() * (vertical ? 10 : 10 - config.size + 1));
        const y = Math.floor(Math.random() * (vertical ? 10 - config.size + 1 : 10));

        let overlaps = false;
        for (let i = 0; i < config.size; i++) {
          const cx = vertical ? x : x + i;
          const cy = vertical ? y + i : y;
          if (occupied.has(`${cx},${cy}`)) {
            overlaps = true;
            break;
          }
        }

        if (!overlaps) {
          for (let i = 0; i < config.size; i++) {
            const cx = vertical ? x : x + i;
            const cy = vertical ? y + i : y;
            occupied.add(`${cx},${cy}`);
          }
          ships.push({ id: config.id, name: config.name, size: config.size, x, y, vertical });
          placed = true;
        }
      }
    }
    return ships;
  };

  // --- ĐẶT TÀU CHI TIẾT ---
  const handlePlacementClick = (x: number, y: number) => {
    if (isReady) return;

    const shipConfig = BATTLESHIP_SHIPS_CONFIG.find(s => s.id === selectedShipId);
    if (!shipConfig) return;

    // Kiểm tra xem tàu có tràn viền hay không
    const size = shipConfig.size;
    const isVertical = placementOrientation === "V";

    if (isVertical) {
      if (y + size > 10) return;
    } else {
      if (x + size > 10) return;
    }

    // Clone danh sách tàu đang chỉnh sửa
    const shipsClone = JSON.parse(JSON.stringify(mode === "BOT" ? myShips : myOnlineShips.length > 0 ? myOnlineShips : DEFAULT_SHIPS));
    
    // Tìm hoặc thêm tàu
    const shipIdx = shipsClone.findIndex((s: any) => s.id === selectedShipId);
    const newShip: BattleshipShip = {
      id: selectedShipId,
      name: shipConfig.name,
      size: size,
      x,
      y,
      vertical: isVertical
    };

    if (shipIdx !== -1) {
      shipsClone[shipIdx] = newShip;
    } else {
      shipsClone.push(newShip);
    }

    // Validate xem vị trí đặt tàu này có chồng lấn không
    // Bằng cách validate toàn bộ danh sách tàu mới
    if (validateShipPlacement(shipsClone)) {
      if (mode === "BOT") {
        setMyShips(shipsClone);
      } else {
        setMyOnlineShips(shipsClone);
      }
    }
  };

  const handleAutofillShips = () => {
    if (isReady) return;
    const randoms = generateRandomShips();
    if (mode === "BOT") {
      setMyShips(randoms);
    } else {
      setMyOnlineShips(randoms);
    }
  };

  const handleCommitPlacement = async () => {
    const currentShips = mode === "BOT" ? myShips : myOnlineShips;
    if (currentShips.length !== 5 || !validateShipPlacement(currentShips)) {
      setErrorMsg("Bạn phải đặt đầy đủ 5 loại tàu hợp lệ trước khi sẵn sàng.");
      return;
    }

    setErrorMsg("");
    if (mode === "BOT") {
      setIsReady(true);
      setPhase("PLAYING");
    } else {
      try {
        setLoading(true);
        const res = await fetch("/api/match/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId,
            ships: currentShips
          })
        });

        if (res.ok) {
          setIsReady(true);
        } else {
          const err = await res.json();
          setErrorMsg(err.error || "Không thể đặt tàu.");
        }
      } catch (err) {
        console.error("Lỗi đặt tàu online:", err);
        setErrorMsg("Lỗi kết nối máy chủ.");
      } finally {
        setLoading(false);
      }
    }
  };

  // --- CHƠI BẮN PHÁ (OFFLINE BOT) ---
  const handleBotModeShot = (index: number) => {
    if (localTurn !== "PLAYER" || localStatus === "FINISHED" || phase !== "PLAYING") return;

    const x = index % 10;
    const y = Math.floor(index / 10);

    // Kiểm tra xem ô này đã bắn trước đó chưa
    if (myShots.some(s => s.x === x && s.y === y)) return;

    // Kiểm tra vũ khí đặc biệt và trừ năng lượng tương ứng
    let currentEnergy = energy;
    if (activeWeapon === "CLUSTER") {
      if (currentEnergy < 50) return;
      currentEnergy -= 50;
    } else if (activeWeapon === "CROSS") { // Đội bay thám thính
      if (currentEnergy < 40) return;
      currentEnergy -= 40;
    } else if (activeWeapon === "RADAR") {
      if (currentEnergy < 30) return;
      currentEnergy -= 30;
    }

    // Tính các ô bị tác động
    const targetCoords: { x: number; y: number }[] = [];
    if (activeWeapon === "NORMAL") {
      targetCoords.push({ x, y });
    } else if (activeWeapon === "CLUSTER") {
      // Bom chùm ảnh hưởng 2x2
      for (let dx = 0; dx < 2; dx++) {
        for (let dy = 0; dy < 2; dy++) {
          const cx = x + dx;
          const cy = y + dy;
          if (cx < 10 && cy < 10) targetCoords.push({ x: cx, y: cy });
        }
      }
    } else if (activeWeapon === "CROSS") {
      // Đội bay thám thính quét 3 ô ngang
      const offsets = [
        { dx: 0, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 }
      ];
      for (const offset of offsets) {
        const cx = x + offset.dx;
        const cy = y + offset.dy;
        if (cx >= 0 && cx < 10 && cy >= 0 && cy < 10) targetCoords.push({ x: cx, y: cy });
      }
    } else if (activeWeapon === "RADAR") {
      // Radar Sweep 3x3
      let radarHitCount = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const cx = x + dx;
          const cy = y + dy;
          if (cx >= 0 && cx < 10 && cy >= 0 && cy < 10) {
            const hitCheck = botShips.some(ship => {
              for (let i = 0; i < ship.size; i++) {
                const sx = ship.vertical ? ship.x : ship.x + i;
                const sy = ship.vertical ? ship.y + i : ship.y;
                if (sx === cx && sy === cy) return true;
              }
              return false;
            });
            if (hitCheck) radarHitCount++;
          }
        }
      }
      setRadarResults(prev => [...prev, { x, y, count: radarHitCount }]);
      setEnergy(currentEnergy);
      // Radar chuyển lượt đi
      setLocalTurn("BOT");
      triggerBotMove(myShots, botShots, sunkShipsMy);
      setActiveWeapon("NORMAL");
      return;
    }

    // Thực hiện bắn
    let anyHit = false;
    const newShots = [...myShots];
    const sunkList = [...sunkShipsBot];

    for (const coord of targetCoords) {
      if (newShots.some(s => s.x === coord.x && s.y === coord.y)) continue;

      const shotResult = checkBattleshipShot(coord.x, coord.y, botShips, newShots);
      newShots.push({
        x: coord.x,
        y: coord.y,
        hit: shotResult.hit,
        shipId: shotResult.shipId,
        sunk: shotResult.sunk
      });

      if (shotResult.hit) {
        anyHit = true;
        
        // Hồi năng lượng (+15 khi bắn trúng)
        currentEnergy = Math.min(100, currentEnergy + 15);

        if (shotResult.sunk && shotResult.shipId) {
          sunkList.push(shotResult.shipId);
          newShots.forEach(s => {
            if (s.shipId === shotResult.shipId) s.sunk = true;
          });
          // Hồi năng lượng (+30 khi chìm tàu)
          currentEnergy = Math.min(100, currentEnergy + 30);
        }
      }
    }

    setEnergy(currentEnergy);
    setMyShots(newShots);
    setSunkShipsBot(sunkList);
    setActiveWeapon("NORMAL");

    // Kiểm tra thắng
    if (sunkList.length === 5) {
      setLocalStatus("FINISHED");
      handleEndBotMatch("WIN");
      return;
    }

    // Chuyển lượt đi
    if (!anyHit) {
      setLocalTurn("BOT");
      triggerBotMove(newShots, botShots, sunkShipsMy);
    }
  };

  // Bot logic shoot
  const triggerBotMove = (currentMyShots: any[], currentBotShots: any[], currentSunkMy: string[]) => {
    setTimeout(() => {
      setLocalStatus(currStatus => {
        if (currStatus === "FINISHED") return currStatus;

        // Xây dựng mảng kiến thức 1D 100 ô của Bot về bàn cờ của Player
        const botKnowledge = Array(100).fill("");
        currentBotShots.forEach(s => {
          const idx = s.y * 10 + s.x;
          if (s.sunk) {
            botKnowledge[idx] = "S";
          } else if (s.hit) {
            botKnowledge[idx] = "H";
          } else {
            botKnowledge[idx] = "M";
          }
        });

        // Tính nước bắn của Bot
        const botMoveIdx = getBattleshipBotMove(botKnowledge, details.difficulty === "HARD" ? "HARD" : "EASY");
        if (botMoveIdx === -1) return currStatus;

        const bx = botMoveIdx % 10;
        const by = Math.floor(botMoveIdx / 10);

        const newBotShots = [...currentBotShots];
        const playerShips = myShips;
        const shotResult = checkBattleshipShot(bx, by, playerShips, newBotShots);

        newBotShots.push({
          x: bx,
          y: by,
          hit: shotResult.hit,
          shipId: shotResult.shipId,
          sunk: shotResult.sunk
        });

        const sunkList = [...currentSunkMy];
        if (shotResult.hit) {
          if (shotResult.sunk && shotResult.shipId) {
            sunkList.push(shotResult.shipId);
            newBotShots.forEach(s => {
              if (s.shipId === shotResult.shipId) s.sunk = true;
            });
          }
        }

        setBotShots(newBotShots);
        setSunkShipsMy(sunkList);

        // Kiểm tra xem Bot thắng chưa
        if (sunkList.length === 5) {
          handleEndBotMatch("LOSE");
          return "FINISHED";
        }

        if (shotResult.hit) {
          // Bot tiếp tục bắn
          triggerBotMove(currentMyShots, newBotShots, sunkList);
        } else {
          // Trả lại lượt chơi cho Player
          setLocalTurn("PLAYER");
        }

        return currStatus;
      });
    }, 1000);
  };

  const handleEndBotMatch = async (outcome: "WIN" | "LOSE" | "DRAW") => {
    // Gọi API lưu điểm giống TicTacToe
    try {
      const res = await fetch("/api/match/bot-end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome })
      });
      if (res.ok) {
        const data = await res.json();
        setGameResult({
          finished: true,
          outcome,
          coinsGained: data.rewards.coins,
          expGained: data.rewards.exp,
          levelUp: data.profile.level > profile.level
        });

        if (outcome === "WIN") {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
        refreshProfile();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- CHƠI BẮN PHÁ (ONLINE MULTIPLAYER) ---
  const handleOnlineShot = async (index: number) => {
    if (loading || phase !== "PLAYING" || !room) return;

    // Kiểm tra xem có đúng lượt đi không
    if (room.turnPlayerId !== profile.id) return;

    const x = index % 10;
    const y = Math.floor(index / 10);

    const isPlayerX = profile.id === room.playerXId;
    const boardObj = JSON.parse(room.board);
    const myShots = isPlayerX ? boardObj.shotsX : boardObj.shotsO;

    if (myShots.some((s: any) => s.x === x && s.y === y)) return;

    try {
      setLoading(true);
      setErrorMsg("");
      const res = await fetch("/api/match/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          position: index,
          weaponType: activeWeapon
        })
      });

      if (res.ok) {
        setActiveWeapon("NORMAL");
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Không thể thực hiện phát bắn.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Lỗi kết nối mạng.");
    } finally {
      setLoading(false);
    }
  };

  // Copy link mời chơi
  const handleCopyLink = () => {
    const link = `${window.location.origin}/?joinRoom=${roomId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const sendEmoji = (emoji: string) => {
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

  // Reset chơi lại với Bot
  const handleRestartBotMatch = () => {
    setMyShips(JSON.parse(JSON.stringify(DEFAULT_SHIPS)));
    setBotShips(generateRandomShips());
    setMyShots([]);
    setBotShots([]);
    setSunkShipsMy([]);
    setSunkShipsBot([]);
    setEnergy(50);
    setRadarResults([]);
    setLocalTurn("PLAYER");
    setLocalStatus("PLAYING");
    setPhase("PLACEMENT");
    setIsReady(false);
    setGameResult(null);
  };

  // --- TRÌNH BÀY DỮ LIỆU ĐỂ RENDER ---
  const isMyTurn = mode === "BOT" 
    ? (localTurn === "PLAYER" && localStatus === "PLAYING")
    : (room && room.turnPlayerId === profile.id && room.status === "PLAYING");

  // Danh sách các phát bắn của bản thân bắn sang lưới đối thủ
  const currentMyShots = mode === "BOT" 
    ? myShots 
    : (room ? (profile.id === room.playerXId ? JSON.parse(room.board).shotsX : JSON.parse(room.board).shotsO) : []);

  // Danh sách phát bắn của đối thủ bắn sang lưới của mình
  const currentOpponentShots = mode === "BOT"
    ? botShots
    : (room ? (profile.id === room.playerXId ? JSON.parse(room.board).shotsO : JSON.parse(room.board).shotsX) : []);

  // Vị trí tàu của bản thân đặt trên lưới
  const currentMyShips = mode === "BOT" ? myShips : myOnlineShips;

  // Danh sách tàu chìm của bản thân
  const currentSunkMy = mode === "BOT" 
    ? sunkShipsMy 
    : (room ? (profile.id === room.playerXId ? JSON.parse(room.board).sunkX : JSON.parse(room.board).sunkO) : []);

  // Danh sách tàu chìm của đối thủ
  const currentSunkBot = mode === "BOT"
    ? sunkShipsBot
    : (room ? (profile.id === room.playerXId ? JSON.parse(room.board).sunkO : JSON.parse(room.board).sunkX) : []);

  // Dữ liệu Năng lượng đặc biệt (Online & Offline)
  const currentEnergy = mode === "BOT" 
    ? energy 
    : (room ? (profile.id === room.playerXId ? (JSON.parse(room.board).energyX ?? 50) : (JSON.parse(room.board).energyO ?? 50)) : 50);

  const currentRadarResults = mode === "BOT"
    ? radarResults
    : (room ? (profile.id === room.playerXId ? JSON.parse(room.board).radarResultsX : JSON.parse(room.board).radarResultsO) : []);

  // Thông tin đối thủ hiển thị
  const opponentProfile = mode === "BOT"
    ? { username: `BOT [${details.difficulty || "EASY"}]`, level: 1, avatarFrame: "frame_default" }
    : (room ? (profile.id === room.playerXId ? room.playerO : room.playerX) : null);

  // Kiểm tra xem ô có phải là vùng ảnh hưởng của đạn hover hay không
  const isHoveredByWeapon = (x: number, y: number) => {
    if (hoverCell === null || !isMyTurn) return false;
    const hx = hoverCell % 10;
    const hy = Math.floor(hoverCell / 10);

    if (activeWeapon === "NORMAL") {
      return hx === x && hy === y;
    } else if (activeWeapon === "CLUSTER") {
      return x >= hx && x < hx + 2 && y >= hy && y < hy + 2;
    } else if (activeWeapon === "CROSS") { // Đội bay thám thính quét 3 ô ngang
      return y === hy && Math.abs(x - hx) <= 1;
    } else if (activeWeapon === "RADAR") {
      return Math.abs(x - hx) <= 1 && Math.abs(y - hy) <= 1;
    }
    return false;
  };

  // --- RENDER 10X10 GRID CELL ---
  // Lưới Đặt tàu & Hiển thị tàu của mình
  const renderMyGridCell = (idx: number) => {
    const x = idx % 10;
    const y = Math.floor(idx / 10);

    // Tìm xem có tàu nào nằm ở ô này không
    const ship = currentMyShips.find(s => {
      for (let i = 0; i < s.size; i++) {
        const sx = s.vertical ? s.x : s.x + i;
        const sy = s.vertical ? s.y + i : s.y;
        if (sx === x && sy === y) return true;
      }
      return false;
    });

    // Tìm vết bắn của đối thủ tại ô này
    const shot = currentOpponentShots.find((s: any) => s.x === x && s.y === y);

    // Xem ô này có bị hover khi đặt tàu hay không
    let isHoveredPlacement = false;
    if (phase === "PLACEMENT" && hoverCell !== null && !isReady) {
      const hx = hoverCell % 10;
      const hy = Math.floor(hoverCell / 10);
      const shipConfig = BATTLESHIP_SHIPS_CONFIG.find(s => s.id === selectedShipId);
      if (shipConfig) {
        const isVertical = placementOrientation === "V";
        if (isVertical) {
          isHoveredPlacement = x === hx && y >= hy && y < hy + shipConfig.size;
        } else {
          isHoveredPlacement = y === hy && x >= hx && x < hx + shipConfig.size;
        }
      }
    }

    // Màu sắc ô cờ nền
    let cellBg = "bg-opacity-20 bg-slate-900 border-slate-800";
    let shipBadgeClass = "";

    if (isHoveredPlacement) {
      // Validate xem hover có hợp lệ không
      const shipConfig = BATTLESHIP_SHIPS_CONFIG.find(s => s.id === selectedShipId);
      const isVertical = placementOrientation === "V";
      const outOfBounds = isVertical ? (Math.floor(hoverCell! / 10) + shipConfig!.size > 10) : ((hoverCell! % 10) + shipConfig!.size > 10);
      cellBg = outOfBounds ? "bg-red-500 bg-opacity-40 border-red-500" : "bg-green-500 bg-opacity-40 border-green-500";
    } else if (ship) {
      // Đã đặt tàu
      const isSunk = currentSunkMy.includes(ship.id);
      const colors = getShipColorClasses(ship.id, isSunk);
      cellBg = colors.cellBg;
      shipBadgeClass = colors.shipBadge;
    }

    return (
      <div
        key={`my-${idx}`}
        onClick={() => handlePlacementClick(x, y)}
        onMouseEnter={() => setHoverCell(idx)}
        onMouseLeave={() => setHoverCell(null)}
        className={`w-full aspect-square border text-[7px] font-mono flex items-center justify-center cursor-pointer relative transition-all duration-150 ${cellBg}`}
      >
        {ship && (
          <div className={`absolute inset-1 border rounded-sm flex items-center justify-center text-[7px] uppercase font-bold tracking-tighter ${shipBadgeClass}`}>
            {ship.name[0]}
          </div>
        )}
        {shot && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            {shot.hit ? (
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping absolute" />
            ) : null}
            <span className={`w-1.5 h-1.5 rounded-full ${shot.hit ? "bg-red-600" : "bg-gray-400 opacity-60"}`} />
          </div>
        )}
      </div>
    );
  };

  // Lưới Bắn tàu (Bàn cờ của đối thủ)
  const renderOpponentGridCell = (idx: number) => {
    const x = idx % 10;
    const y = Math.floor(idx / 10);

    // Xem phát bắn của mình
    const shot = currentMyShots.find((s: any) => s.x === x && s.y === y);

    // Xem rada quét
    const radar = currentRadarResults.find((r: any) => Math.abs(r.x - x) <= 1 && Math.abs(r.y - y) <= 1);

    // Kiểm tra hover vũ khí
    const isHovered = isHoveredByWeapon(x, y);

    let cellBg = "bg-opacity-20 bg-slate-900 border-slate-800 hover:bg-slate-800";
    let shipBadgeClass = "";

    if (isHovered) {
      cellBg = activeWeapon === "RADAR" ? "bg-cyan-500 bg-opacity-40 border-cyan-400" : "bg-yellow-500 bg-opacity-40 border-yellow-400";
    } else if (shot) {
      if (shot.hit) {
        if (shot.sunk && shot.shipId) {
          const colors = getShipColorClasses(shot.shipId, true);
          cellBg = colors.cellBg;
          shipBadgeClass = colors.shipBadge;
        } else {
          cellBg = "bg-red-500 bg-opacity-20 border-red-800";
        }
      } else {
        cellBg = "bg-blue-900 bg-opacity-20 border-slate-800";
      }
    } else if (radar) {
      // Nếu có rada quét qua
      cellBg = "bg-cyan-900 bg-opacity-10 border-cyan-950";
    }

    return (
      <div
        key={`opp-${idx}`}
        onClick={() => {
          if (mode === "BOT") handleBotModeShot(idx);
          else handleOnlineShot(idx);
        }}
        onMouseEnter={() => setHoverCell(idx)}
        onMouseLeave={() => setHoverCell(null)}
        className={`w-full aspect-square border text-[7px] font-mono flex items-center justify-center cursor-pointer relative transition-all duration-150 ${cellBg}`}
      >
        {shot && shot.hit && shot.sunk && shot.shipId && (
          <div className={`absolute inset-1 border rounded-sm flex items-center justify-center text-[7px] uppercase font-bold tracking-tighter ${shipBadgeClass}`}>
            {BATTLESHIP_SHIPS_CONFIG.find(c => c.id === shot.shipId)?.name[0]}
          </div>
        )}
        {shot && !(shot.hit && shot.sunk) && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            {shot.hit ? (
              <span className="w-2 h-2 flex items-center justify-center font-bold text-[10px] text-red-600">X</span>
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 opacity-40" />
            )}
          </div>
        )}
        
        {/* Radar Center indicator */}
        {currentRadarResults.some((r: any) => r.x === x && r.y === y) && (
          <div className="absolute inset-0 flex items-center justify-center bg-cyan-500 bg-opacity-10 pointer-events-none">
            <span className="text-[9px] font-bold text-cyan-400 font-sans">
              {currentRadarResults.find((r: any) => r.x === x && r.y === y).count}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#0c0c0e] text-gray-200 scanlines select-none font-mono">
      {/* 1. TOP HEADER */}
      <header className="border-b border-black bg-[#121215] py-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-1 border border-black pixel-btn pixel-btn-gray rounded-sm text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xs font-bold text-pixel-yellow uppercase tracking-widest flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5" /> BATTLESHIP (Tàu chiến)
            </h1>
            <p className="text-[7px] text-gray-400">
              {mode === "BOT" ? `ĐẤU BOT [${details.difficulty || "EASY"}]` : `ĐẤU ONLINE - PHÒNG: ${roomId?.substring(0, 8)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-black bg-opacity-40 px-2.5 py-1 border border-[#1e1e24] rounded-sm">
            <Coins className="w-3.5 h-3.5 text-pixel-yellow" />
            <span className="text-xs font-bold text-pixel-yellow">{profile.coins}</span>
          </div>
        </div>
      </header>

      {/* ERROR MESSAGE BAR */}
      {errorMsg && (
        <div className="bg-red-950 border-b border-red-800 text-red-400 text-[9px] py-1.5 px-4 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. MAIN BODY */}
      <main className="flex-1 p-4 flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto w-full relative">
        
        {/* Floating Emoji Bubbles for Battleship */}
        {activeEmojiX && (
          <div className="absolute top-2 left-2 bg-[#121215] border border-black text-lg p-1.5 rounded-md animate-bounce shadow-lg z-50 font-mono">
            <span className="text-[5px] text-gray-500 block uppercase font-sans">X:</span>
            {activeEmojiX}
          </div>
        )}
        {activeEmojiO && (
          <div className="absolute top-2 right-2 bg-[#121215] border border-black text-lg p-1.5 rounded-md animate-bounce shadow-lg z-50 font-mono">
            <span className="text-[5px] text-gray-500 block uppercase font-sans">O:</span>
            {activeEmojiO}
          </div>
        )}
        
        {/* LOBBY CHỜ BẠN BÈ CHO BATTLESHIP */}
        {mode === "FRIEND" && room && room.status === "WAITING" && !room.playerOId ? (
          <div className="max-w-md w-full mx-auto px-4 py-8 flex flex-col items-center justify-center space-y-6">
            <div className="pixel-box bg-[#16161c] p-6 w-full text-center space-y-6 border-4 border-black">
              <h2 className="text-xs text-pixel-yellow uppercase tracking-wider border-b border-black pb-3">Phòng Đấu Bạn Bè (Battleship)</h2>
              
              <p className="text-[9px] text-gray-400 leading-relaxed uppercase">
                Hãy gửi link mời bên dưới cho bạn bè để cùng tham gia đấu tàu cược {room.wager} Coin.
              </p>

              <div className="pixel-box-nested p-4 flex flex-col items-center justify-center bg-black">
                {/* QR Code */}
                <div className="bg-white p-2 border-4 border-black mb-4">
                  <QRCodeSVG value={typeof window !== "undefined" ? `${window.location.origin}?joinRoom=${room.id}` : room.id} size={128} />
                </div>
                <span className="text-[8px] text-gray-500 font-mono select-all">ID: {room.id}</span>
              </div>

              <div className="space-y-2">
                <button 
                  onClick={handleCopyLink} 
                  className="w-full pixel-btn pixel-btn-blue py-3 text-[10px] uppercase font-bold flex items-center justify-center gap-2"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedLink ? "Đã copy link mời!" : "Copy Link Mời Trực Tiếp"}
                </button>
              </div>
              
              <div className="text-[8px] text-pixel-blue animate-pulse uppercase tracking-wider">
                === Đang chờ bạn bè kết nối ===
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* PHASE A: PLACEMENT */}
            {phase === "PLACEMENT" && (
          <div className="w-full flex flex-col md:flex-row gap-6 items-start">
            {/* Cột trái: Lưới của mình */}
            <div className="w-full md:w-[450px] shrink-0">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] text-pixel-blue font-bold uppercase tracking-wider">
                  Bản đồ của bạn
                </span>
                <span className="text-[8px] text-gray-400">
                  {isReady ? "ĐÃ SẴN SÀNG" : "ĐANG BỐ TRÍ"}
                </span>
              </div>
              
              <div className={`p-2 border border-black ${boardThemeClass} rounded-md shadow-2xl relative`}>
                <div className="grid grid-cols-10 gap-0.5 w-full">
                  {Array.from({ length: 100 }).map((_, idx) => renderMyGridCell(idx))}
                </div>
              </div>
            </div>

            {/* Cột phải: Control bố trí */}
            <div className="flex-1 w-full bg-[#121215] border border-black p-4 rounded-md space-y-4">
              <div>
                <h3 className="text-xs font-bold text-pixel-yellow uppercase mb-1">Thiết lập hạm đội</h3>
                <p className="text-[8px] text-gray-400">
                  Hãy xếp 5 chiếc tàu vào vùng biển của bạn. Click vào ô cờ để đặt tàu đầu.
                </p>
              </div>

              {!isReady ? (
                <>
                  {/* Hướng đặt tàu */}
                  <div className="pixel-box-nested p-3 space-y-2">
                    <span className="block text-[8px] text-gray-400 uppercase">HƯỚNG TÀU:</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPlacementOrientation("H")}
                        className={`pixel-btn text-[9px] py-1.5 flex-1 justify-center ${placementOrientation === "H" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                      >
                        Ngang (Horizontal)
                      </button>
                      <button
                        onClick={() => setPlacementOrientation("V")}
                        className={`pixel-btn text-[9px] py-1.5 flex-1 justify-center ${placementOrientation === "V" ? "pixel-btn-yellow" : "pixel-btn-gray"}`}
                      >
                        Dọc (Vertical)
                      </button>
                    </div>
                  </div>

                  {/* Chọn loại tàu đặt */}
                  <div className="pixel-box-nested p-3 space-y-2">
                    <span className="block text-[8px] text-gray-400 uppercase">CHỌN TÀU:</span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {BATTLESHIP_SHIPS_CONFIG.map((ship) => {
                        const isPlaced = (mode === "BOT" ? myShips : myOnlineShips).some(s => s.id === ship.id);
                        return (
                          <button
                            key={ship.id}
                            onClick={() => setSelectedShipId(ship.id)}
                            className={`pixel-btn text-[9px] py-2 px-3 justify-between ${selectedShipId === ship.id ? "pixel-btn-blue" : "pixel-btn-gray"}`}
                          >
                            <span className="flex items-center gap-2">
                              {ship.name} <span className="text-[7px] text-gray-400">({ship.size} ô)</span>
                            </span>
                            <span className={`text-[7px] px-1 py-0.5 rounded-sm ${isPlaced ? "bg-green-950 text-green-400 border border-green-800" : "bg-red-950 text-red-400 border border-red-800"}`}>
                              {isPlaced ? "Đã đặt" : "Chưa đặt"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action chính */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleAutofillShips}
                      className="pixel-btn pixel-btn-blue text-[10px] py-2.5 flex-1 justify-center gap-1.5 uppercase font-bold"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> Xếp ngẫu nhiên
                    </button>
                    
                    <button
                      onClick={handleCommitPlacement}
                      disabled={loading || (mode === "BOT" ? myShips.length !== 5 : myOnlineShips.length !== 5)}
                      className="pixel-btn pixel-btn-yellow text-[10px] py-2.5 flex-1 justify-center gap-1.5 uppercase font-bold disabled:opacity-50"
                    >
                      {loading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Sẵn sàng
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <div className="w-12 h-12 rounded-full border border-green-500 bg-green-500 bg-opacity-20 flex items-center justify-center mx-auto text-green-400 animate-pulse">
                    <Check className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-green-400 uppercase">ĐÃ SẴN SÀNG!</h4>
                    <p className="text-[8px] text-gray-400">
                      Đang đợi đối thủ xếp tàu hoàn tất để bắt đầu chiến đấu...
                    </p>
                  </div>
                  
                  {mode !== "BOT" && room && !room.playerOId && (
                    <div className="p-3 border border-slate-800 bg-[#0a0a0c] rounded-md space-y-2 mt-4">
                      <span className="text-[7px] text-gray-400 block uppercase">Chia sẻ mã mời để đấu online:</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={`${window.location.origin}/?joinRoom=${roomId}`}
                          className="flex-1 bg-[#121215] border border-black text-[8px] px-2.5 py-1.5 rounded-sm focus:outline-none font-sans"
                        />
                        <button
                          onClick={handleCopyLink}
                          className="pixel-btn pixel-btn-gray py-1.5 text-[8px]"
                        >
                          {copiedLink ? "Đã copy" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PHASE B: PLAYING / FINISHED */}
        {phase !== "PLACEMENT" && (
          <div className="w-full flex flex-col space-y-6">
            
            {/* LƯỢT ĐI / STATUS BAR */}
            <div className="flex flex-col md:flex-row items-center justify-between bg-[#121215] border border-black p-3.5 rounded-md gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isMyTurn ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                <div>
                  <h3 className="text-xs font-bold text-gray-300">
                    LƯỢT ĐI: <span className={isMyTurn ? "text-green-400" : "text-red-400"}>{isMyTurn ? "BẠN" : opponentProfile?.username}</span>
                  </h3>
                  <p className="text-[7px] text-gray-400">
                    {isMyTurn ? "Click vào lưới đối thủ để khai hoả đạn!" : "Đợi đối thủ nhắm bắn..."}
                  </p>
                </div>
              </div>

              {/* HỆ THỐNG NĂNG LƯỢNG & KỸ NĂNG */}
              <div className="flex flex-col space-y-3 w-full md:w-auto md:max-w-xs shrink-0">
                {/* Thanh tiến trình năng lượng */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[7px] font-extrabold text-[#F3E5AB] uppercase tracking-wider">
                    <span>Năng lượng chiến thuật</span>
                    <span className="text-[#FF9F0A]">{currentEnergy}/100</span>
                  </div>
                  <div className="w-full bg-[#141412] h-2.5 rounded-full border border-[#D4AF37]/15 overflow-hidden p-0.5">
                    <div 
                      className="bg-gradient-to-r from-[#D4AF37] to-[#FF9F0A] h-full rounded-full transition-all duration-300 shadow-[0_0_6px_#FF9F0A]"
                      style={{ width: `${currentEnergy}%` }}
                    />
                  </div>
                </div>

                {/* Các kỹ năng kích hoạt */}
                <div className="flex gap-2 justify-end">
                  {/* Rada quét 3x3 */}
                  <button
                    disabled={!isMyTurn || currentEnergy < 30}
                    onClick={() => setActiveWeapon(activeWeapon === "RADAR" ? "NORMAL" : "RADAR")}
                    className={`border p-1.5 rounded-lg flex flex-col items-center justify-center min-w-[70px] relative transition-all ${
                      activeWeapon === "RADAR" 
                        ? "border-cyan-400 bg-cyan-400/20 text-cyan-300 scale-105 shadow-[0_0_8px_rgba(34,211,238,0.3)] font-bold" 
                        : (currentEnergy >= 30 ? "border-cyan-600 bg-cyan-950/20 text-cyan-500 cursor-pointer hover:border-cyan-400" : "border-slate-900 text-slate-700 cursor-not-allowed opacity-50")
                    }`}
                  >
                    <span className="text-[6px] font-extrabold uppercase tracking-wide block">Quét Rada</span>
                    <div className="flex items-center gap-0.5 text-[7px] font-bold mt-1">
                      <Eye className="w-2.5 h-2.5" />
                      <span>30 NL</span>
                    </div>
                  </button>

                  {/* Scout plane / Thám thính 3 ô */}
                  <button
                    disabled={!isMyTurn || currentEnergy < 40}
                    onClick={() => setActiveWeapon(activeWeapon === "CROSS" ? "NORMAL" : "CROSS")}
                    className={`border p-1.5 rounded-lg flex flex-col items-center justify-center min-w-[70px] relative transition-all ${
                      activeWeapon === "CROSS" 
                        ? "border-[#FF9F0A] bg-[#FF9F0A]/20 text-[#FF9F0A] scale-105 shadow-[0_0_8px_rgba(255,159,10,0.3)] font-bold" 
                        : (currentEnergy >= 40 ? "border-[#FF9F0A]/60 bg-[#FF9F0A]/5 text-[#FF9F0A]/70 cursor-pointer hover:border-[#FF9F0A]" : "border-slate-900 text-slate-700 cursor-not-allowed opacity-50")
                    }`}
                  >
                    <span className="text-[6px] font-extrabold uppercase tracking-wide block">Thám Thính</span>
                    <div className="flex items-center gap-0.5 text-[7px] font-bold mt-1">
                      <Zap className="w-2.5 h-2.5 text-[#FF9F0A]" />
                      <span>40 NL</span>
                    </div>
                  </button>

                  {/* Cluster Bomb / Bom chùm */}
                  <button
                    disabled={!isMyTurn || currentEnergy < 50}
                    onClick={() => setActiveWeapon(activeWeapon === "CLUSTER" ? "NORMAL" : "CLUSTER")}
                    className={`border p-1.5 rounded-lg flex flex-col items-center justify-center min-w-[70px] relative transition-all ${
                      activeWeapon === "CLUSTER" 
                        ? "border-red-400 bg-red-400/20 text-red-300 scale-105 shadow-[0_0_8px_rgba(248,113,113,0.3)] font-bold" 
                        : (currentEnergy >= 50 ? "border-red-600 bg-red-950/20 text-red-500 cursor-pointer hover:border-red-400 animate-pulse" : "border-slate-900 text-slate-700 cursor-not-allowed opacity-50")
                    }`}
                  >
                    <span className="text-[6px] font-extrabold uppercase tracking-wide block">Bom Chùm</span>
                    <div className="flex items-center gap-0.5 text-[7px] font-bold mt-1">
                      <Zap className="w-2.5 h-2.5 text-red-500" />
                      <span>50 NL</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* HAI LƯỚI GRID BAN CO */}
            <div className="flex flex-col lg:flex-row gap-6 w-full items-start justify-center">
              
              {/* 1. LƯỚI ĐỐI THỦ (NƠI MÌNH BẮN) */}
              <div className="w-full max-w-[420px]">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] text-pixel-yellow font-bold uppercase tracking-wider flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-pixel-yellow" /> Hạm đội đối phương (Lưới tấn công)
                  </span>
                  <span className="text-[8px] text-red-500 font-bold">
                    Tàu đã chìm: {currentSunkBot.length}/5
                  </span>
                </div>
                
                <div className={`p-2 border border-black ${boardThemeClass} rounded-md shadow-2xl relative`}>
                  <div className="grid grid-cols-10 gap-0.5 w-full">
                    {Array.from({ length: 100 }).map((_, idx) => renderOpponentGridCell(idx))}
                  </div>
                </div>
              </div>

              {/* 2. LƯỚI CỦA BẢN THÂN (XEM ĐỐI THỦ BẮN MÌNH) */}
              <div className="w-full max-w-[420px]">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] text-pixel-blue font-bold uppercase tracking-wider flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-pixel-blue" /> Lãnh hải của bạn (Lưới phòng thủ)
                  </span>
                  <span className="text-[8px] text-red-500 font-bold">
                    Tàu của bạn chìm: {currentSunkMy.length}/5
                  </span>
                </div>
                
                <div className={`p-2 border border-black ${boardThemeClass} rounded-md shadow-2xl relative`}>
                  <div className="grid grid-cols-10 gap-0.5 w-full">
                    {Array.from({ length: 100 }).map((_, idx) => renderMyGridCell(idx))}
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}
      </>
    )}

        {/* EMOJI QUICK CHAT BAR FOR BATTLESHIP (placement & play) */}
        {mode !== "BOT" && room && room.status !== "FINISHED" && (
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 flex gap-2 bg-[#121215] border border-black p-1.5 px-3 rounded-full items-center select-none z-45 shadow-lg">
            <span className="text-[6.5px] text-gray-500 font-mono uppercase mr-1">Biểu cảm:</span>
            {SHOP_ITEMS.filter(item => item.type === "EMOJI" && (profile.purchasedItems.includes(item.id) || item.price === 0)).map(emojiItem => (
              <button
                key={emojiItem.id}
                onClick={() => sendEmoji(emojiItem.visuals.emoji!)}
                className="text-sm hover:scale-125 transition-transform p-0.5 cursor-pointer"
                title={emojiItem.name}
              >
                {emojiItem.visuals.emoji}
              </button>
            ))}
            {SHOP_ITEMS.filter(item => item.type === "EMOJI" && (profile.purchasedItems.includes(item.id) || item.price === 0)).length === 0 && (
              <span className="text-[6.5px] text-gray-400 italic">Chưa sở hữu biểu cảm nào</span>
            )}
          </div>
        )}

      </main>

      {/* 3. LỊCH SỬ TÀU CHÌM & THÔNG TIN */}
      {phase !== "PLACEMENT" && (
        <section className="bg-[#121215] border-t border-black p-4">
          <div className="max-w-4xl mx-auto w-full grid grid-cols-2 gap-6">
            {/* Tàu đối phương */}
            <div className="space-y-2">
              <span className="block text-[8px] text-gray-400 uppercase tracking-widest">Tình trạng hạm đội địch:</span>
              <div className="flex flex-wrap gap-2">
                {BATTLESHIP_SHIPS_CONFIG.map(ship => {
                  const isSunk = currentSunkBot.includes(ship.id);
                  return (
                    <span 
                      key={ship.id}
                      className={`text-[7px] px-2 py-1 border rounded-sm font-sans flex items-center gap-1 ${
                        isSunk 
                          ? "bg-red-950 text-red-400 border-red-800 line-through opacity-70" 
                          : "bg-slate-900 text-slate-300 border-slate-700"
                      }`}
                    >
                      {ship.name} ({ship.size} ô)
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Tàu của mình */}
            <div className="space-y-2">
              <span className="block text-[8px] text-gray-400 uppercase tracking-widest">Tình trạng tàu của bạn:</span>
              <div className="flex flex-wrap gap-2">
                {BATTLESHIP_SHIPS_CONFIG.map(ship => {
                  const isSunk = currentSunkMy.includes(ship.id);
                  return (
                    <span 
                      key={ship.id}
                      className={`text-[7px] px-2 py-1 border rounded-sm font-sans flex items-center gap-1 ${
                        isSunk 
                          ? "bg-red-950 text-red-400 border-red-800 line-through opacity-70" 
                          : "bg-blue-950 text-blue-400 border-blue-800"
                      }`}
                    >
                      {ship.name} ({ship.size} ô)
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. GAME END MODAL OVERLAY */}
      {gameResult?.finished && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm border-2 border-pixel-yellow bg-[#121216] p-6 rounded-md text-center space-y-6 shadow-2xl relative overflow-hidden">
            
            {/* Glow effect */}
            <div className="absolute -inset-10 bg-radial-gradient from-pixel-yellow opacity-10 blur-xl pointer-events-none" />

            <div className="space-y-2">
              {gameResult.outcome === "WIN" ? (
                <>
                  <h2 className="text-xl font-extrabold text-pixel-yellow uppercase tracking-widest animate-bounce">
                    CHIẾN THẮNG!
                  </h2>
                  <p className="text-[9px] text-gray-400">
                    Bắn nát hạm đội đối thủ thành tro bụi!
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-extrabold text-red-500 uppercase tracking-widest animate-pulse">
                    THẤT BẠI
                  </h2>
                  <p className="text-[9px] text-gray-400">
                    Hạm đội của bạn đã bị chìm sạch xuống đáy đại dương.
                  </p>
                </>
              )}
            </div>

            {/* Rewards Card */}
            <div className="border border-slate-800 bg-[#09090c] p-4 rounded-md space-y-3">
              <h4 className="text-[8px] text-gray-400 uppercase tracking-widest">Phần thưởng nhận được:</h4>
              <div className="flex justify-around">
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1 text-pixel-yellow font-bold text-sm">
                    <Coins className="w-4 h-4" />
                    <span>+{gameResult.coinsGained || 0}</span>
                  </div>
                  <span className="text-[7px] text-gray-400 font-sans mt-0.5">Coins</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1 text-pixel-blue font-bold text-sm">
                    <Award className="w-4 h-4" />
                    <span>+{gameResult.expGained || 0}</span>
                  </div>
                  <span className="text-[7px] text-gray-400 font-sans mt-0.5">Kinh nghiệm (EXP)</span>
                </div>
              </div>

              {gameResult.levelUp && (
                <div className="mt-2 text-[9px] text-pixel-yellow font-extrabold uppercase animate-pulse border border-pixel-yellow border-dashed py-1.5 px-3 bg-pixel-yellow bg-opacity-10 rounded-sm">
                  ★ THĂNG CẤP (LEVEL UP) ★
                </div>
              )}
            </div>

            {/* Restart Buttons */}
            <div className="flex flex-col gap-2">
              {mode === "BOT" ? (
                <button
                  onClick={handleRestartBotMatch}
                  className="w-full pixel-btn pixel-btn-yellow py-3 text-xs uppercase font-bold"
                >
                  Chơi ván mới
                </button>
              ) : null}
              <button
                onClick={onBack}
                className="w-full pixel-btn pixel-btn-gray py-2.5 text-xs uppercase"
              >
                Quay lại sảnh chính
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
