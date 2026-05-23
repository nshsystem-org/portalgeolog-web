import React, { useState, useEffect, useRef, useCallback } from "react";
import StandardModal from "@/components/StandardModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useConfirm } from "@/hooks/useConfirm";
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  Trash2,
  Loader2,
  Download,
  CheckCircle2,
  FolderOpen,
  FileVideo,
  FileArchive,
  FileCode,
  Music,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { FormErrorMessage } from "@/components/ui/FormErrorMessage";

interface DriverDoc {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  created_at: string;
  path: string;
}

interface DriverDocsModalProps {
  driver: {
    id: string;
    name?: string | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DriverDocsModal({
  driver,
  onClose,
}: DriverDocsModalProps) {
  const { confirm, confirmState, closeConfirm, handleConfirm } = useConfirm();
  const [documents, setDocuments] = useState<DriverDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const { user } = useAuth();

  const driverId = driver?.id;
  const driverName = driver?.name || "Motorista";

  const suggestedDocs = [
    {
      name: "CNH (Carteira Nacional de Habilitação)",
      icon: "license",
      required: true,
    },
    { name: "CPF", icon: "id", required: true },
    { name: "Comprovante de Residência", icon: "home", required: false },
    { name: "Exame Médico (ASO)", icon: "medical", required: false },
    { name: "Curso de Direção Defensiva", icon: "car", required: false },
  ];

  const fetchDocs = useCallback(async () => {
    const { data, error } = await supabase
      .from("driver_documents")
      .select("*")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(
        "Erro ao buscar documentos:",
        JSON.stringify(error, null, 2),
      );
      setError("Erro ao carregar documentos.");
    } else {
      setDocuments(data as DriverDoc[]);
    }
    setLoading(false);
  }, [driverId, supabase]);

  useEffect(() => {
    fetchDocs();

    // Set up real-time subscription
    const channel = supabase
      .channel(`driver-docs-${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_documents",
          filter: `driver_id=eq.${driverId}`,
        },
        () => {
          fetchDocs();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, supabase, fetchDocs]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!driverId) {
      setError("Motorista inválido.");
      return;
    }

    // Verificar se usuário está autenticado
    if (!user) {
      setError("Você precisa estar logado para fazer upload de documentos.");
      return;
    }

    // Basic validation
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError("O arquivo é muito grande. Máximo 10MB.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("driverId", driverId);
      formData.append("file", file);

      const response = await fetch("/api/driver-docs", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const result: unknown = await response.json();

      if (!response.ok) {
        const message =
          result &&
          typeof result === "object" &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Erro no upload.";
        throw new Error(message);
      }

      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchDocs();
    } catch (err: unknown) {
      console.error("Erro geral no upload:", err);
      const message =
        err instanceof Error ? err.message : "Ocorreu um erro inesperado.";
      setError(`Erro no upload: ${message}`);
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (docObj: DriverDoc) => {
    const confirmed = await confirm({
      title: "Excluir Documento",
      message: `Tem certeza que deseja excluir o documento "${docObj.type}"?`,
      confirmText: "Sim, excluir",
      cancelText: "Cancelar",
      type: "danger",
    });

    if (!confirmed) return;

    try {
      // Delete from Storage
      const { error: storageError } = await supabase.storage
        .from("driver-docs")
        .remove([docObj.path]);

      if (storageError) throw storageError;

      // Delete from Database
      const { error: dbError } = await supabase
        .from("driver_documents")
        .delete()
        .eq("id", docObj.id);

      if (dbError) throw dbError;

      // Atualizar lista de documentos após exclusão
      await fetchDocs();
    } catch (err: unknown) {
      console.error("Erro ao excluir:", err);
      const message =
        err instanceof Error ? err.message : "Erro ao excluir o documento.";
      setError(`Erro ao excluir: ${message}`);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes("pdf"))
      return <FileText className="text-red-500" size={24} />;
    if (
      type.includes("spreadsheet") ||
      type.includes("excel") ||
      type.includes("csv") ||
      type.includes("xls")
    )
      return <FileSpreadsheet className="text-emerald-500" size={24} />;
    if (type.includes("image"))
      return <ImageIcon className="text-blue-500" size={24} />;
    if (
      type.includes("video") ||
      type.includes("mp4") ||
      type.includes("avi") ||
      type.includes("mov")
    )
      return <FileVideo className="text-purple-500" size={24} />;
    if (
      type.includes("zip") ||
      type.includes("rar") ||
      type.includes("7z") ||
      type.includes("tar")
    )
      return <FileArchive className="text-orange-500" size={24} />;
    if (
      type.includes("code") ||
      type.includes("json") ||
      type.includes("xml") ||
      type.includes("html") ||
      type.includes("css") ||
      type.includes("js") ||
      type.includes("ts")
    )
      return <FileCode className="text-indigo-500" size={24} />;
    if (
      type.includes("audio") ||
      type.includes("mp3") ||
      type.includes("wav") ||
      type.includes("ogg")
    )
      return <Music className="text-pink-500" size={24} />;
    return <File className="text-slate-400" size={24} />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <>
      <StandardModal
        onClose={onClose}
        title="Documentações"
        subtitle={`Motorista: ${driverName} • ${documents.length} documento${documents.length !== 1 ? "s" : ""}`}
        icon={<FileText className="w-6 h-6 md:w-7 md:h-7" />}
        maxWidthClassName="max-w-6xl"
        bodyClassName="p-6 md:p-10 space-y-6"
        footer={
          <div className="p-6 md:p-8 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !user}
              title={
                !user ? "Faça login para anexar documentos" : "Anexar documento"
              }
              className="px-10 py-4 bg-[var(--color-geolog-blue)] text-white font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-[0.2em] shadow-lg shadow-blue-900/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {uploading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <UploadCloud size={18} />
              )}
              Anexar documento
            </button>
            <button
              onClick={onClose}
              className="px-10 py-4 bg-white border-2 border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all text-xs uppercase tracking-[0.2em] shadow-sm cursor-pointer"
            >
              Fechar Janela
            </button>
          </div>
        }
      >
        {error && (
          <FormErrorMessage
            message={error}
            variant="banner"
            className="animate-in fade-in slide-in-from-top-2"
          />
        )}

        {/* Input file escondido */}
        <input
          type="file"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png"
        />

        {/* Docs List */}
        <div className="space-y-6">
          <div
            className="flex items-center border-b-2 border-slate-100 pb-4"
            style={{ paddingBottom: "1.25rem" }}
          >
            <h3
              className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
              style={{ lineHeight: "1.3" }}
            >
              <FileText size={20} className="text-slate-500" /> Arquivos
              Enviados
            </h3>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 bg-slate-50/50 rounded-3xl border border-slate-100 border-dashed">
              <Loader2 className="animate-spin text-blue-500" size={32} />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                Carregando arquivos...
              </p>
            </div>
          ) : documents.length === 0 ? (
            <div className="py-16 text-center bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-6">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm">
                <FolderOpen size={40} />
              </div>
              <div className="space-y-2">
                <p className="text-slate-400 font-bold italic">
                  Nenhum documento anexado ainda.
                </p>
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                  Sugestões de documentos:
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-md">
                {suggestedDocs.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-left px-3 py-2 bg-white rounded-lg border border-slate-100"
                  >
                    {doc.required && (
                      <CheckCircle2 size={14} className="text-blue-500" />
                    )}
                    <span className="text-xs font-semibold text-slate-600">
                      {doc.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {documents.map((docObj) => (
                <div
                  key={docObj.id}
                  className="bg-white border-2 border-slate-100 p-5 rounded-2xl flex items-center justify-between group hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                      {getFileIcon(docObj.type)}
                    </div>
                    <div className="space-y-1">
                      <p className="font-black text-slate-800 text-[15px] line-clamp-1">
                        {docObj.name}
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-tight">
                          {formatSize(docObj.size)}
                        </span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-tight">
                          {new Date(docObj.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <a
                      href={docObj.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      title="Download"
                    >
                      <Download size={20} />
                    </a>
                    <button
                      onClick={() => handleDeleteDoc(docObj)}
                      className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </StandardModal>

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
