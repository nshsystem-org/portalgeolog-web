"use client";

import { useState, useCallback, useRef } from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info" | "success";
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
}

export function useConfirm() {
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirmar",
    cancelText: "Cancelar",
    type: "danger",
  });

  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setConfirmState({
        ...options,
        isOpen: true,
      });
    });
  }, []);

  const closeConfirm = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setConfirmState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setConfirmState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  return {
    confirm,
    confirmState,
    closeConfirm,
    handleConfirm,
  };
}
