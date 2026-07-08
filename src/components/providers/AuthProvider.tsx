"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { User } from "@prisma/client";

interface AuthContextType {
  user: any | null; // Supabase Auth User
  profile: User | null; // Prisma Profile User
  loading: boolean;
  loginGuest: () => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await syncUser();
      }
      setLoading(false);
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
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    } catch (error) {
      console.error("Lỗi đăng nhập Khách:", error);
      alert("Đăng nhập Khách thất bại, vui lòng thử lại!");
    } finally {
      setLoading(false);
    }
  };

  // Đăng xuất
  const signOutUser = async () => {
    setLoading(true);
    try {
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
