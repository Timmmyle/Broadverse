"use client";

import React, { useState } from "react";
import { useAuth } from "./providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { Gamepad2, Mail, Lock, UserPlus, LogIn, Sparkles } from "lucide-react";

export default function LoginScreen() {
  const { loginGuest, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
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
        alert("Đăng ký thành công! Bạn có thể đăng nhập ngay.");
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

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0a0a0c] scanlines px-4 relative overflow-hidden">
      {/* Background neon grid effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1b1b22_1px,transparent_1px),linear-gradient(to_bottom,#1b1b22_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none"></div>

      <div className="w-full max-w-md pixel-box p-8 relative z-20 bg-[#15151a] select-none text-center">
        {/* Arcade Cabinet Header */}
        <div className="border-b-4 border-black pb-6 mb-6">
          <h1 className="text-3xl md:text-4xl text-pixel-yellow font-bold uppercase tracking-wider pixel-text-shadow animate-pulse">
            Boardverse
          </h1>
          <p className="text-[9px] text-pixel-blue mt-2 tracking-widest uppercase">
            === INSERT COIN TO PLAY ===
          </p>
        </div>

        {/* Blinking start indicator */}
        <div className="my-6">
          <span className="text-[11px] text-pixel-green uppercase tracking-wide animate-[bounce_1s_infinite]">
            🎮 Sẵn sàng thách đấu cờ 🎮
          </span>
        </div>

        {errorMsg && (
          <div className="bg-pixel-red/20 border-2 border-pixel-red text-pixel-red text-[10px] p-3 mb-6 font-mono text-left">
            [ERROR]: {errorMsg}
          </div>
        )}

        <div className="space-y-6">
          {/* Guest Mode */}
          <div className="pixel-box-nested p-4">
            <h2 className="text-[11px] text-pixel-yellow uppercase mb-3 tracking-wide">Chế độ chơi nhanh</h2>
            <button
              onClick={loginGuest}
              disabled={loading || authLoading}
              className="w-full pixel-btn pixel-btn-yellow py-3 flex items-center justify-center gap-3 font-semibold uppercase text-xs disabled:opacity-50"
            >
              <Gamepad2 className="w-4 h-4 stroke-[3px]" />
              {loading ? "Đang kết nối..." : "Chơi với khách (Guest)"}
            </button>
            <p className="text-[8px] text-gray-400 mt-2 leading-relaxed text-left">
              * Lưu ý: Tiến trình chơi, số Coin và cấp độ của Khách vẫn được lưu trên trình duyệt này! Bạn có thể nâng cấp lên tài khoản chính thức sau.
            </p>
          </div>

          <div className="flex items-center justify-center my-4">
            <span className="h-[2px] bg-black flex-grow"></span>
            <span className="px-3 text-[9px] text-gray-500 uppercase">Hoặc</span>
            <span className="h-[2px] bg-black flex-grow"></span>
          </div>

          {/* Email Authentication */}
          <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
            <h2 className="text-[11px] text-pixel-blue uppercase tracking-wide text-center mb-1">
              {isRegistering ? "Đăng ký tài khoản" : "Đăng nhập chính thức"}
            </h2>

            <div>
              <label className="block text-[8px] uppercase text-gray-400 mb-2">Địa chỉ Email:</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full pixel-input pl-10 pr-4"
                />
                <Mail className="absolute left-3 top-[14px] w-4 h-4 text-gray-500" />
              </div>
            </div>

            <div>
              <label className="block text-[8px] uppercase text-gray-400 mb-2">Mật khẩu:</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="******"
                  required
                  className="w-full pixel-input pl-10 pr-4"
                />
                <Lock className="absolute left-3 top-[14px] w-4 h-4 text-gray-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || authLoading}
              className="w-full pixel-btn pixel-btn-blue py-3 flex items-center justify-center gap-3 font-semibold uppercase text-xs mt-2 disabled:opacity-50"
            >
              {isRegistering ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  {authLoading ? "Đang đăng ký..." : "Đăng ký ngay"}
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  {authLoading ? "Đang đăng nhập..." : "Vào Đấu trường"}
                </>
              )}
            </button>
          </form>

          {/* Toggle Register / Login */}
          <div className="pt-2">
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-[9px] text-pixel-yellow hover:underline uppercase tracking-wide"
            >
              {isRegistering ? "<< Trở lại Đăng nhập" : "Chưa có tài khoản? Đăng ký >>"}
            </button>
          </div>
        </div>
      </div>

      {/* Retro Footer details */}
      <div className="mt-8 text-center text-gray-600 text-[8px] uppercase tracking-widest relative z-20">
        <p>© 2026 Boardverse Games Studio</p>
        <p className="mt-1">Powered by Next.js & Supabase Realtime</p>
      </div>
    </div>
  );
}
