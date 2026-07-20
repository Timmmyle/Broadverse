"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { User } from "@prisma/client";
import { useAlert } from "./AlertProvider";

interface AuthContextType {
  user: any | null; // Supabase Auth User
  profile: User | null; // Prisma Profile User
  loading: boolean;
  loginGuest: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { showAlert } = useAlert();
  const supabase = createClient();

  // Đồng bộ user từ Supabase Auth sang Prisma DB
  const syncUser = async () => {
    try {
      const res = await fetch("/api/user/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else {
        console.error("Lỗi đồng bộ hồ sơ:", await res.text());
      }
    } catch (err) {
      console.error("Lỗi mạng đồng bộ user:", err);
    }
  };

  const refreshProfile = async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (err) {
      console.error("Lỗi refresh profile:", err);
    }
  };

  useEffect(() => {
    // 1. Kiểm tra session hiện có khi load trang
    const checkSession = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await syncUser();
        } else {
          // Tự động tạo tài khoản khách nếu chưa có tài khoản nào đăng nhập và không phải explicit_logout
          const isExplicitLogout = localStorage.getItem("explicit_logout") === "true";
          if (!isExplicitLogout) {
            await loginGuest();
          }
        }
      } catch (err) {
        console.error("Lỗi checkSession:", err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // 2. Lắng nghe thay đổi trạng thái đăng nhập
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await syncUser();
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Đăng nhập nhanh chế độ khách (Guest Anonymous Auth)
  const loginGuest = async () => {
    setLoading(true);
    try {
      localStorage.removeItem("explicit_logout");
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    } catch (error) {
      console.error("Lỗi đăng nhập Khách:", error);
      showAlert("Đăng nhập Khách thất bại, vui lòng thử lại!");
    } finally {
      setLoading(false);
    }
  };

  // Đăng nhập bằng Google / liên kết tài khoản
  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      localStorage.removeItem("explicit_logout");
      
      const { data: { session } } = await supabase.auth.getSession();
      const isGuest = session?.user?.app_metadata?.provider === "anonymous" || !session?.user?.email;

      if (isGuest && session?.user) {
        // Nếu là Guest, thử liên kết identity trước để giữ lại tiến trình
        const { error } = await supabase.auth.linkIdentity({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}`,
          },
        });
        if (!error) return; // Supabase sẽ tự động chuyển hướng
        console.warn("Không thể liên kết tài khoản Google (tài khoản đã tồn tại), tiến hành đăng nhập trực tiếp:", error);
      }

      // Đăng nhập Google trực tiếp
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}`,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error("Lỗi đăng nhập Google:", error);
      showAlert("Đăng nhập Google thất bại!");
    } finally {
      setLoading(false);
    }
  };

  // Đăng xuất
  const signOutUser = async () => {
    setLoading(true);
    try {
      localStorage.setItem("explicit_logout", "true");
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        loginGuest,
        loginWithGoogle,
        signOutUser,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth phải được bọc trong AuthProvider");
  }
  return context;
}
