"use client";

import React, { useRef, useState } from "react";
import { Camera, Trash2, Loader2 } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { useConfirm } from "@/hooks/useConfirm";
import { getThumbnailUrl } from "@/utils/avatar";
import { toast } from "sonner";

interface AvatarUploaderProps {
  avatarUrl: string | null;
  nome: string;
  onAvatarChange: (url: string | null) => void;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: {
    container: "w-16 h-16",
    text: "text-2xl",
    icon: 16,
    button: "w-6 h-6",
    badge: "w-6 h-6",
  },
  md: {
    container: "w-24 h-24",
    text: "text-4xl",
    icon: 20,
    button: "w-8 h-8",
    badge: "w-8 h-8",
  },
  lg: {
    container: "w-32 h-32",
    text: "text-5xl",
    icon: 24,
    button: "w-10 h-10",
    badge: "w-10 h-10",
  },
};

export function AvatarUploader({
  avatarUrl,
  nome,
  onAvatarChange,
  size = "md",
}: AvatarUploaderProps) {
  const { confirm, confirmState, closeConfirm, handleConfirm } = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const sizes = sizeClasses[size];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validações
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida (JPEG, PNG, WebP)");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 2MB.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/avatar", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao fazer upload");
      }

      onAvatarChange(data.publicUrl);
      toast.success("Foto de perfil atualizada!");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao fazer upload: " + errorMessage);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async () => {
    if (!avatarUrl) return;

    const confirmed = await confirm({
      title: "Remover Foto de Perfil",
      message: "Tem certeza que deseja remover sua foto de perfil?",
      confirmText: "Sim, remover",
      cancelText: "Cancelar",
      type: "danger",
    });

    if (!confirmed) return;

    setUploading(true);

    try {
      const response = await fetch("/api/avatar", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao remover foto");
      }

      onAvatarChange(null);
      toast.success("Foto removida com sucesso");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao remover foto: " + errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const thumbSize = size === "lg" ? 256 : size === "md" ? 192 : 128;
  const displayUrl = getThumbnailUrl(avatarUrl, thumbSize);

  return (
    <>
      <div className="relative inline-block">
        {/* Avatar Container */}
        <div
          className={`
          ${sizes.container} 
          bg-blue-600 
          rounded-[2.5rem] 
          flex items-center justify-center 
          ${sizes.text} font-black text-white 
          shadow-2xl shadow-blue-200 
          mx-auto 
          transform -rotate-6 
          overflow-hidden
          cursor-pointer
          transition-all hover:scale-105 hover:rotate-0
          ${uploading ? "opacity-70" : ""}
        `}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt={nome}
              className="w-full h-full object-cover"
            />
          ) : (
            getInitials(nome)
          )}

          {/* Overlay de upload */}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <Camera size={sizes.icon} className="text-white" />
          </div>

          {/* Loading spinner */}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2
                size={sizes.icon + 4}
                className="text-white animate-spin"
              />
            </div>
          )}
        </div>

        {/* Botão de deletar (apenas quando tem avatar) */}
        {avatarUrl && !uploading && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className={`
            absolute -bottom-2 -right-2 
            ${sizes.badge} 
            bg-red-500 
            rounded-2xl 
            border-4 border-white 
            flex items-center justify-center 
            text-white shadow-lg
            hover:bg-red-600 transition-colors
            cursor-pointer
          `}
            title="Remover foto"
          >
            <Trash2 size={sizes.icon * 0.6} />
          </button>
        )}

        {/* Input file escondido */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
      />
    </>
  );
}
