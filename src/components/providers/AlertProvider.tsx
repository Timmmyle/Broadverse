"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { X, ShieldAlert, Check, Swords, Info } from "lucide-react";

interface AlertContextType {
  showAlert: (message: string) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  
  // Use a ref to store queue of pending alerts
  const queueRef = useRef<string[]>([]);
  
  // Use a ref for isOpen to access it in the global alert interceptor without stale closures
  const isOpenRef = useRef(false);
  
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const showAlert = (msg: string) => {
    if (isOpenRef.current) {
      queueRef.current.push(msg);
    } else {
      setMessage(msg);
      isOpenRef.current = true;
      setIsOpen(true);
    }
  };

  const handleClose = () => {
    isOpenRef.current = false;
    setIsOpen(false);
    if (queueRef.current.length > 0) {
      const nextMsg = queueRef.current.shift()!;
      // Small timeout to allow transition to complete
      setTimeout(() => {
        setMessage(nextMsg);
        isOpenRef.current = true;
        setIsOpen(true);
      }, 150);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const originalAlert = window.alert;
      
      window.alert = (msg: any) => {
        console.warn("Intercepted alert:", msg);
        showAlert(msg !== undefined && msg !== null ? String(msg) : "");
      };

      return () => {
        window.alert = originalAlert;
      };
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Determine design elements based on content
  let icon = <Info className="w-8 h-8 text-[#D4AF37]" />;
  let title = "THÔNG BÁO";
  
  const msgLower = message.toLowerCase();
  if (
    msgLower.includes("lỗi") || 
    msgLower.includes("thất bại") || 
    msgLower.includes("error") || 
    msgLower.includes("invalid") || 
    msgLower.includes("cấm") || 
    msgLower.includes("sai") ||
    msgLower.includes("không đủ")
  ) {
    icon = <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />;
    title = "CẢNH BÁO";
  } else if (
    msgLower.includes("thành công") || 
    msgLower.includes("cảm ơn") || 
    msgLower.includes("chính xác") || 
    msgLower.includes("nhận")
  ) {
    icon = <Check className="w-8 h-8 text-green-500 animate-bounce" />;
    title = "THÀNH CÔNG";
  } else if (
    msgLower.includes("mời") || 
    msgLower.includes("phòng") || 
    msgLower.includes("tổ đội")
  ) {
    icon = <Swords className="w-8 h-8 text-blue-400" />;
    title = "ĐẤU TRƯỜNG";
  }

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md transition-all duration-300">
          <div 
            className="pixel-box relative max-w-md w-full mx-4 overflow-hidden border border-[#D4AF37]/30 bg-[#1C1C18] p-6 shadow-2xl transition-all duration-300 scale-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={handleClose}
              className="absolute top-4 right-4 text-[#F3E5AB]/60 hover:text-[#D4AF37] transition-colors p-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon Header */}
            <div className="mt-2 mb-4 p-3 bg-white/5 rounded-full border border-white/10 shadow-inner">
              {icon}
            </div>

            {/* Title */}
            <h3 className="text-base font-bold tracking-widest text-[#D4AF37] mb-3 uppercase pixel-text-shadow">
              {title}
            </h3>

            {/* Message content */}
            <div className="w-full max-h-[250px] overflow-y-auto mb-6 px-2 text-center">
              <pre className="text-sm font-sans text-[#F3E5AB] leading-relaxed whitespace-pre-wrap select-text font-medium">
                {message}
              </pre>
            </div>

            {/* CTA Confirm Button */}
            <button
              onClick={handleClose}
              className="pixel-btn pixel-btn-yellow w-full py-2.5 font-bold uppercase tracking-wider text-xs cursor-pointer"
            >
              Xác Nhận
            </button>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
}
