"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { X, ShieldAlert, Check, Swords, Info, AlertTriangle } from "lucide-react";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel?: () => void;
}

interface AlertContextType {
  showAlert: (message: string) => void;
  showConfirm: (options: ConfirmOptions) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmOptions | null>(null);

  // Queue for alerts
  const queueRef = useRef<string[]>([]);
  const isAlertOpenRef = useRef(false);

  useEffect(() => {
    isAlertOpenRef.current = alertOpen;
  }, [alertOpen]);

  const showAlert = (msg: string) => {
    if (isAlertOpenRef.current || confirmOpen) {
      queueRef.current.push(msg);
    } else {
      setAlertMessage(msg);
      isAlertOpenRef.current = true;
      setAlertOpen(true);
    }
  };

  const showConfirm = (options: ConfirmOptions) => {
    setConfirmConfig(options);
    setConfirmOpen(true);
  };

  const handleAlertClose = () => {
    isAlertOpenRef.current = false;
    setAlertOpen(false);
    if (queueRef.current.length > 0) {
      const nextMsg = queueRef.current.shift()!;
      setTimeout(() => {
        setAlertMessage(nextMsg);
        isAlertOpenRef.current = true;
        setAlertOpen(true);
      }, 150);
    }
  };

  const handleConfirmAction = () => {
    setConfirmOpen(false);
    if (confirmConfig?.onConfirm) {
      confirmConfig.onConfirm();
    }
    setConfirmConfig(null);
  };

  const handleCancelAction = () => {
    setConfirmOpen(false);
    if (confirmConfig?.onCancel) {
      confirmConfig.onCancel();
    }
    setConfirmConfig(null);
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
    if (!alertOpen && !confirmOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (confirmOpen) {
          handleCancelAction();
        } else if (alertOpen) {
          handleAlertClose();
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (confirmOpen) {
          handleConfirmAction();
        } else if (alertOpen) {
          handleAlertClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [alertOpen, confirmOpen, confirmConfig]);

  // Determine icon & title for alert
  let alertIcon = <Info className="w-8 h-8 text-[#D4AF37]" />;
  let alertTitle = "Thông báo";
  
  const msgLower = alertMessage.toLowerCase();
  if (
    msgLower.includes("lỗi") || 
    msgLower.includes("thất bại") || 
    msgLower.includes("error") || 
    msgLower.includes("invalid") || 
    msgLower.includes("cấm") || 
    msgLower.includes("sai") ||
    msgLower.includes("không đủ")
  ) {
    alertIcon = <ShieldAlert className="w-8 h-8 text-red-500" />;
    alertTitle = "Cảnh báo";
  } else if (
    msgLower.includes("thành công") || 
    msgLower.includes("cảm ơn") || 
    msgLower.includes("chính xác") || 
    msgLower.includes("nhận")
  ) {
    alertIcon = <Check className="w-8 h-8 text-green-500" />;
    alertTitle = "Thành công";
  } else if (
    msgLower.includes("mời") || 
    msgLower.includes("phòng") || 
    msgLower.includes("tổ đội")
  ) {
    alertIcon = <Swords className="w-8 h-8 text-blue-400" />;
    alertTitle = "Đấu trường";
  }

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      
      {/* ALERT MODAL */}
      {alertOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md transition-all duration-300">
          <div 
            className="pixel-box relative max-w-md w-full mx-4 overflow-hidden border border-[#D4AF37]/30 bg-[#1C1C18] p-6 shadow-2xl transition-all duration-300 scale-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={handleAlertClose}
              className="absolute top-4 right-4 text-[#F3E5AB]/60 hover:text-[#D4AF37] transition-colors p-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mt-2 mb-4 p-3 bg-white/5 rounded-full border border-white/10 shadow-inner">
              {alertIcon}
            </div>

            <h3 className="text-base font-bold tracking-widest text-[#D4AF37] mb-3 uppercase pixel-text-shadow">
              {alertTitle}
            </h3>

            <div className="w-full max-h-[250px] overflow-y-auto mb-6 px-2 text-center">
              <pre className="text-sm font-sans text-[#F3E5AB] leading-relaxed whitespace-pre-wrap select-text font-medium">
                {alertMessage}
              </pre>
            </div>

            <button
              onClick={handleAlertClose}
              className="pixel-btn pixel-btn-yellow w-full py-2.5 font-bold uppercase tracking-wider text-xs cursor-pointer"
            >
              Xác Nhận
            </button>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmOpen && confirmConfig && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md transition-all duration-300">
          <div 
            className="pixel-box relative max-w-md w-full mx-4 overflow-hidden border-2 border-[#D4AF37]/45 bg-[#1C1C18] p-6 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={handleCancelAction}
              className="absolute top-4 right-4 text-[#F3E5AB]/60 hover:text-[#D4AF37] transition-colors p-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mt-2 mb-4 p-3 bg-red-950/40 rounded-full border border-red-500/30 shadow-inner">
              <AlertTriangle className="w-8 h-8 text-red-500 animate-bounce" />
            </div>

            <h3 className="text-base font-extrabold tracking-widest text-[#D4AF37] mb-3 uppercase pixel-text-shadow">
              {confirmConfig.title || "Xác Nhận Hành Động"}
            </h3>

            <div className="w-full max-h-[250px] overflow-y-auto mb-6 px-2 text-center">
              <pre className="text-sm font-sans text-[#F3E5AB] leading-relaxed whitespace-pre-wrap select-text font-medium">
                {confirmConfig.message}
              </pre>
            </div>

            <div className="flex gap-3 w-full">
              <button
                onClick={handleCancelAction}
                className="w-1/2 bg-[#141412] hover:bg-[#272722] text-[#F3E5AB]/80 border border-[#D4AF37]/20 py-2.5 rounded-lg font-bold uppercase tracking-wider text-xs cursor-pointer transition"
              >
                {confirmConfig.cancelText || "Hủy"}
              </button>
              <button
                onClick={handleConfirmAction}
                className="w-1/2 pixel-btn pixel-btn-red py-2.5 font-extrabold uppercase tracking-wider text-xs cursor-pointer"
              >
                {confirmConfig.confirmText || "Xác Nhận"}
              </button>
            </div>
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
