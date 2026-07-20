"use client";

import React, { useState } from "react";
import { useAuth } from "./providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { useAlert } from "./providers/AlertProvider";
import { 
  Gamepad2, Mail, Lock, UserPlus, LogIn, Sparkles, 
  Trophy, Users, Flame, Award, ChevronRight, Compass,
  MessageSquare, HelpCircle, Check, Send
} from "lucide-react";

export default function LoginScreen() {
  const { loginGuest, loginWithGoogle, loading } = useAuth();
  const { showAlert } = useAlert();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeForm, setActiveForm] = useState<"GUEST" | "EMAIL">("GUEST");
  const [votes, setVotes] = useState({ chess: 342, connectFour: 219 });
  const [voted, setVoted] = useState(false);

  const supabase = createClient();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setAuthLoading(true);
    setErrorMsg("");

    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        showAlert("Đăng ký thành công! Bạn có thể đăng nhập ngay.");
        setIsRegistering(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Xác thực thất bại");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVote = (game: "chess" | "connectFour") => {
    if (voted) return;
    setVotes(prev => ({ ...prev, [game]: prev[game] + 1 }));
    setVoted(true);
    showAlert("Cảm ơn bạn đã bình chọn! Hãy tạo tài khoản để nhận thông báo khi game ra mắt.");
    setActiveForm("EMAIL");
    setIsRegistering(true);
  };

  return (
    <div className="min-h-screen w-full bg-[#141412] text-[#F3E5AB] font-sans selection:bg-[#D4AF37] selection:text-black relative overflow-y-auto">
      {/* Background neon grid effect - Muted */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1c1c18_1px,transparent_1px),linear-gradient(to_bottom,#1c1c18_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-5 pointer-events-none"></div>

      {/* Navigation Header */}
      <header className="border-b border-[#D4AF37]/15 py-4 px-6 md:px-12 flex justify-between items-center relative z-20 bg-[#141412]/80 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-[#1C1C18] border border-[#D4AF37]/20 flex items-center justify-center shadow-lg shadow-[#D4AF37]/10">
            <img src="/logo.png" className="w-full h-full object-cover" alt="Vuiga" />
          </div>
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider text-white">Vuiga.com</h1>
            <p className="text-[8px] text-[#FF9F0A] tracking-widest uppercase">Trứng đến Phượng Hoàng</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveForm("EMAIL")}
            className="text-xs text-[#F3E5AB] hover:text-[#D4AF37] transition font-medium"
          >
            Đăng nhập
          </button>
          <button 
            onClick={() => { setActiveForm("EMAIL"); setIsRegistering(true); }}
            className="pixel-btn pixel-btn-yellow text-xs px-4 py-2 font-bold transition"
          >
            Đăng ký
          </button>
        </div>
      </header>

      {/* Hero & Authenticate Box Row */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        {/* Hero Section */}
        <div className="lg:col-span-7 text-left space-y-6">
          <div className="inline-flex items-center gap-2 bg-[#1C1C18] border border-[#D4AF37]/20 px-3 py-1 rounded-full text-xs text-[#FF9F0A]">
            <Flame className="w-3.5 h-3.5" />
            <span>Mùa giải 1: Vuiga Pass khởi tranh (60 ngày)</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Đấu trường cờ <br />
            <span className="text-[#D4AF37]">
              Kê vương hội tụ
            </span>
          </h2>
          <p className="text-[#F3E5AB]/85 text-base md:text-lg max-w-xl leading-relaxed">
            Hành trình tiến hóa từ Quả trứng 🥚 đến Phượng hoàng lửa 🔥. Trải nghiệm xếp hạng Gomoku, Tic Tac Toe, và Battleship cùng hệ thống rương Egg Box hấp dẫn!
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
            <button
              onClick={loginGuest}
              disabled={loading}
              className="pixel-btn pixel-btn-yellow py-3.5 px-8 text-sm font-bold flex items-center justify-center gap-3 transition disabled:opacity-50"
            >
              <Gamepad2 className="w-5 h-5 stroke-[2.5px]" />
              {loading ? "Đang kết nối..." : "Chơi ngay trong 3 giây"}
            </button>
            <p className="text-[10px] text-[#F3E5AB]/50 max-w-[200px] text-center sm:text-left">
              Chế độ Khách (Guest Mode) không cần đăng ký, lưu tiến trình trên trình duyệt này!
            </p>
          </div>
        </div>

        {/* Auth Forms */}
        <div className="lg:col-span-5">
          <div className="pixel-box p-8 w-full relative z-20">
            <div className="flex border-b border-[#D4AF37]/15 pb-4 mb-6 gap-4">
              <button
                onClick={() => setActiveForm("GUEST")}
                className={`flex-1 text-center py-2 text-xs font-bold border-b-2 transition ${
                  activeForm === "GUEST" 
                    ? "border-[#D4AF37] text-white" 
                    : "border-transparent text-[#F3E5AB]/50 hover:text-white"
                }`}
              >
                Chơi nhanh
              </button>
              <button
                onClick={() => setActiveForm("EMAIL")}
                className={`flex-1 text-center py-2 text-xs font-bold border-b-2 transition ${
                  activeForm === "EMAIL" 
                    ? "border-[#D4AF37] text-white" 
                    : "border-transparent text-[#F3E5AB]/50 hover:text-white"
                }`}
              >
                {isRegistering ? "Đăng ký" : "Đăng nhập"}
              </button>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg mb-6 font-mono">
                [Lỗi]: {errorMsg}
              </div>
            )}

            {activeForm === "GUEST" ? (
              <div className="space-y-6 text-center">
                <div className="w-16 h-16 rounded-full bg-[#141412] border border-[#D4AF37]/20 flex items-center justify-center mx-auto text-[#D4AF37]">
                  <Gamepad2 className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-white">Bắt đầu như khách vô danh</h3>
                  <p className="text-[11px] text-[#F3E5AB]/70 leading-relaxed">
                    Trải nghiệm đầy đủ các tính năng đấu trí. Sau này bạn có thể nâng cấp lên tài khoản chính thức bất kỳ lúc nào để lưu vĩnh viễn tiến trình!
                  </p>
                </div>
                <button
                  onClick={loginGuest}
                  disabled={loading}
                  className="w-full pixel-btn pixel-btn-yellow py-3 flex items-center justify-center gap-3 font-bold text-xs transition disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-[#141412]" />
                  {loading ? "Đang kết nối..." : "Bắt đầu chiến đấu"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="block text-[10px] text-[#F3E5AB]/60 font-semibold">Email:</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ten@vi-du.com"
                      required
                      className="w-full pixel-input pl-10 pr-4"
                    />
                    <Mail className="absolute left-3.5 top-[10px] w-4 h-4 text-[#D4AF37]/75" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] text-[#F3E5AB]/60 font-semibold">Mật khẩu:</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="******"
                      required
                      className="w-full pixel-input pl-10 pr-4"
                    />
                    <Lock className="absolute left-3.5 top-[10px] w-4 h-4 text-[#D4AF37]/75" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full pixel-btn pixel-btn-yellow py-3 flex items-center justify-center gap-3 font-bold text-xs transition mt-6 disabled:opacity-50"
                >
                  {isRegistering ? (
                    <>
                      <UserPlus className="w-4 h-4" />
                      {authLoading ? "Đang đăng ký..." : "Đăng ký tài khoản"}
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      {authLoading ? "Đang đăng nhập..." : "Vào đấu trường"}
                    </>
                  )}
                </button>

                <div className="flex items-center my-4">
                  <div className="flex-grow border-t border-[#D4AF37]/15"></div>
                  <span className="mx-3 text-[9px] text-[#F3E5AB]/40 uppercase tracking-widest font-mono">Hoặc</span>
                  <div className="flex-grow border-t border-[#D4AF37]/15"></div>
                </div>

                <button
                  type="button"
                  onClick={loginWithGoogle}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-[#D4AF37]/30 rounded bg-[#1C1C18] text-[#F3E5AB] hover:text-white text-xs font-bold transition hover:bg-[#252520]"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.535 0-6.402-2.867-6.402-6.402s2.867-6.402 6.402-6.402c1.778 0 3.39.724 4.562 1.895l3.056-3.056C19.742 2.712 16.14 1.197 12.24 1.197c-5.96 0-10.793 4.834-10.793 10.794s4.833 10.793 10.793 10.793c5.565 0 10.37-3.957 10.37-10.793 0-.6-.056-1.173-.17-1.706H12.24z"/>
                  </svg>
                  Đăng nhập bằng Google
                </button>

                <div className="text-center pt-4">
                  <button
                    type="button"
                    onClick={() => setIsRegistering(!isRegistering)}
                    className="text-[10px] text-[#FF9F0A] hover:underline font-bold"
                  >
                    {isRegistering ? "<< Trở lại đăng nhập" : "Chưa có tài khoản? Đăng ký tại đây >>"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Featured Games Section */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 relative z-10 border-t border-[#D4AF37]/10">
        <div className="text-center space-y-3 mb-12">
          <h3 className="text-xs uppercase tracking-widest text-[#FF9F0A] font-bold">Danh sách trò chơi</h3>
          <h2 className="text-3xl font-extrabold text-white">Đấu Trường 3 Thể Loại Cực Đỉnh</h2>
          <p className="text-[#F3E5AB]/60 text-sm max-w-lg mx-auto">
            Vuiga.com xây dựng hệ thống bàn cờ chất lượng cao, phản hồi chuyển động tactile cực đỉnh.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Gomoku */}
          <div className="pixel-box p-6 hover:translate-y-[-8px] transition duration-300 flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#FF9F0A] flex items-center justify-center shadow-md">
                <span className="font-bold text-[#141412] text-xl font-mono">五</span>
              </div>
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-bold text-white group-hover:text-[#D4AF37] transition">Gomoku (Caro 5 Quân)</h4>
                <span className="text-[10px] bg-[#FF9F0A]/10 text-[#FF9F0A] px-2.5 py-0.5 rounded-full font-bold">
                  ● 482 Đang chơi
                </span>
              </div>
              <p className="text-xs text-[#F3E5AB]/75 leading-relaxed">
                Đấu trí caro đỉnh cao. Lên rank Bạch Kim để mở khóa Luật Renju quốc tế (cấm nước đi đôi 3-3, 4-4 cho quân Đen) để cân bằng tỷ lệ thắng hoàn hảo.
              </p>
            </div>
            <button onClick={loginGuest} className="text-xs uppercase font-bold text-[#FF9F0A] flex items-center gap-1 mt-6 hover:text-white transition">
              Chiến ngay <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Battleship */}
          <div className="pixel-box p-6 hover:translate-y-[-8px] transition duration-300 flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#FF9F0A] flex items-center justify-center shadow-md">
                <span className="font-bold text-[#141412] text-xl font-mono">⚓</span>
              </div>
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-bold text-white group-hover:text-[#D4AF37] transition">Battleship (Hạm Đội)</h4>
                <span className="text-[10px] bg-[#FF9F0A]/10 text-[#FF9F0A] px-2.5 py-0.5 rounded-full font-bold">
                  ● 312 Đang chơi
                </span>
              </div>
              <p className="text-xs text-[#F3E5AB]/75 leading-relaxed">
                Tích lũy Năng lượng bằng các cú bắn trúng để kích hoạt kỹ năng đặc biệt: Rada 3x3, Bom chùm 3 ô, Đội bay do thám. Xóa bỏ yếu tố may rủi thuần túy.
              </p>
            </div>
            <button onClick={loginGuest} className="text-xs uppercase font-bold text-[#FF9F0A] flex items-center gap-1 mt-6 hover:text-white transition">
              Chiến ngay <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Tic Tac Toe */}
          <div className="pixel-box p-6 hover:translate-y-[-8px] transition duration-300 flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#FF9F0A] flex items-center justify-center shadow-md">
                <span className="font-bold text-[#141412] text-xl font-mono">X</span>
              </div>
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-bold text-white group-hover:text-[#D4AF37] transition">Tic Tac Toe (3x3)</h4>
                <span className="text-[10px] bg-[#FF9F0A]/10 text-[#FF9F0A] px-2.5 py-0.5 rounded-full font-bold">
                  ● 129 Đang chơi
                </span>
              </div>
              <p className="text-xs text-[#F3E5AB]/75 leading-relaxed">
                Lối chơi cổ điển, siêu tốc. Chế độ Xếp hạng áp dụng Sudden Death Grid: Nếu hòa, lưới tự mở rộng thành 4x4/5x5, đòi hỏi tạo chuỗi 4 để kết liễu trận đấu!
              </p>
            </div>
            <button onClick={loginGuest} className="text-xs uppercase font-bold text-[#FF9F0A] flex items-center gap-1 mt-6 hover:text-white transition">
              Chiến ngay <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Roadmap & Voting */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 relative z-10 border-t border-[#D4AF37]/10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-1 bg-[#1C1C18] border border-[#FF9F0A]/20 px-3 py-1 rounded-full text-xs text-[#FF9F0A] font-bold">
            <span>BẢN ĐỒ PHÁT TRIỂN</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white">Bình chọn Board Game tiếp theo bạn muốn chơi!</h2>
          <p className="text-xs text-[#F3E5AB]/75 leading-relaxed">
            Chúng tôi liên tục cập nhật kho tàng cờ thế giới. Quyết định nằm trong tay bạn. Hãy bình chọn ngay game tiếp theo để đội ngũ lập trình ưu tiên hoàn thiện.
          </p>
          <div className="space-y-4">
            {/* Connect Four */}
            <div className="bg-[#1C1C18] border border-[#D4AF37]/10 p-4 rounded-xl flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white">Connect Four (Cờ Thả 4 Quân)</h4>
                <p className="text-[10px] text-[#F3E5AB]/60">Lối chơi Gomoku thêm yếu tố vật lý trọng lực cực kỳ kịch tính</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#D4AF37]">{votes.connectFour} phiếu</span>
                <button
                  onClick={() => handleVote("connectFour")}
                  className="bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] px-3.5 py-1.5 rounded-lg text-xs font-bold transition uppercase"
                >
                  Bình Chọn
                </button>
              </div>
            </div>

            {/* Chess */}
            <div className="bg-[#1C1C18] border border-[#D4AF37]/10 p-4 rounded-xl flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white">Chess (Cờ Vua Cổ Điển)</h4>
                <p className="text-[10px] text-[#F3E5AB]/60">Trận chiến tư duy sâu sắc nhất mọi thời đại</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#D4AF37]">{votes.chess} phiếu</span>
                <button
                  onClick={() => handleVote("chess")}
                  className="bg-[#D4AF37] hover:bg-[#FF9F0A] text-[#141412] px-3.5 py-1.5 rounded-lg text-xs font-bold transition uppercase"
                >
                  Bình Chọn
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Platform Features / Skins showcase */}
        <div className="bg-[#1C1C18] border border-[#D4AF37]/15 p-8 rounded-2xl space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-[#FF9F0A]" />
            Tính năng Nổi bật trên Vuiga.com
          </h3>
          <ul className="space-y-4">
            <li className="flex gap-3">
              <div className="w-5 h-5 rounded bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 flex items-center justify-center text-[#FF9F0A] shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 stroke-[3px]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Tiến trình Dài hạn & Reset Mùa giải</h4>
                <p className="text-[10px] text-[#F3E5AB]/75">Lên cấp, tích lũy chỉ số Master và reset mùa giải 60 ngày nhận thưởng Trứng 🥚 và Trứng Vàng ✨.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <div className="w-5 h-5 rounded bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 flex items-center justify-center text-[#FF9F0A] shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 stroke-[3px]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Cửa Hàng Skin Gà Độc Quyền & Khung</h4>
                <p className="text-[10px] text-[#F3E5AB]/75">Sở hữu các skin Samurai, Ninja, Cyber Chicken cực độc, khung gỗ, sắt, vàng và âm thanh gõ cờ sinh động.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <div className="w-5 h-5 rounded bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 flex items-center justify-center text-[#FF9F0A] shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 stroke-[3px]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Đấu Xếp Hạng & Bảng Vinh Danh</h4>
                <p className="text-[10px] text-[#F3E5AB]/75">Chu kỳ giải đấu xếp hạng kéo dài 2-3 tháng. Bảng xếp hạng cập nhật mỗi giờ vinh danh các cao thủ.</p>
              </div>
            </li>
          </ul>

          {/* Stats Bar */}
          <div className="pt-6 border-t border-[#D4AF37]/10 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold font-mono text-white">100K+</p>
              <p className="text-[9px] text-[#F3E5AB]/50 uppercase font-semibold">Trận Đấu</p>
            </div>
            <div>
              <p className="text-lg font-bold font-mono text-white">50K+</p>
              <p className="text-[9px] text-[#F3E5AB]/50 uppercase font-semibold">Kỳ Thủ</p>
            </div>
            <div>
              <p className="text-lg font-bold font-mono text-white">99.9%</p>
              <p className="text-[9px] text-[#F3E5AB]/50 uppercase font-semibold">Thời Gian Chờ &lt; 5s</p>
            </div>
          </div>
        </div>
      </section>

      {/* Community / Socials Section */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 relative z-10 border-t border-[#D4AF37]/10 text-center space-y-6">
        <h2 className="text-2xl md:text-3xl font-extrabold text-white">Gia Nhập Cộng Đồng Kỳ Thủ Toàn Cầu</h2>
        <p className="text-xs text-[#F3E5AB]/70 max-w-md mx-auto leading-relaxed">
          Tụ họp bạn bè, tìm đồng đội giao lưu, thảo luận các nước đi chiến thuật và tham gia giải đấu do cộng đồng tổ chức trên Discord và Telegram.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="https://discord.gg/nBEaascSY"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-bold uppercase transition"
          >
            <MessageSquare className="w-4 h-4 fill-white" />
            Discord Community
          </a>

          <a
            href="https://telegram.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0088cc] hover:bg-[#0077b3] text-white text-xs font-bold uppercase transition"
          >
            <Send className="w-4 h-4 fill-white" />
            Telegram Chat
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#D4AF37]/10 py-12 px-6 md:px-12 bg-[#10100d] relative z-20 text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <div className="w-6 h-6 rounded overflow-hidden bg-[#1C1C18] border border-[#D4AF37]/20 flex items-center justify-center">
            <img src="/logo.png" className="w-full h-full object-cover" alt="Vuiga" />
          </div>
          <span className="text-sm font-bold uppercase tracking-wider text-white">Vuiga.com</span>
        </div>
        <p className="text-[10px] text-[#F3E5AB]/50 uppercase tracking-widest leading-relaxed">
          © 2026 Vuiga.com Board Games. Bảo lưu mọi quyền.<br />
          Thiết kế bởi Product & Game Design Team (Steam, Discord, Chess.com, Plato inspiration).
        </p>
      </footer>
    </div>
  );
}
