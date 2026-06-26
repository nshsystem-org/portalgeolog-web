"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Pencil, ArrowUpCircle, Eye, X } from "lucide-react";
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";

interface DraftWarningItem {
  id: string;
  protocolo: string;
  os: string;
  clienteNome: string;
  data: string;
  createdAt: string;
  ageDays: number;
}

interface DraftWarningsProps {
  className?: string;
}

export default function DraftWarnings({ className }: DraftWarningsProps) {
  const { osList, clientes } = useData();
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const userDrafts = useMemo(() => {
    const drafts = osList.filter(
      (os) =>
        os.tipo === "rascunho" &&
        !os.arquivado &&
        user &&
        (!os.createdBy || os.createdBy === user.id),
    );
    const now = new Date();
    return drafts
      .map((os) => {
        const createdAt = os.createdAt ? new Date(os.createdAt) : new Date();
        const ageDays = Math.floor(
          (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        return {
          id: os.id,
          protocolo: os.protocolo || "",
          os: os.os || "",
          clienteNome:
          clientes.find((c) => c.id === os.clienteId)?.nome ||
          "Cliente não informado",
          data: os.data,
          createdAt: os.createdAt || "",
          ageDays,
        };
      })
      .sort((a, b) => b.ageDays - a.ageDays);
  }, [osList, user, clientes]);

  const warnings: DraftWarningItem[] = useMemo(() => {
    return userDrafts.filter((d) => d.ageDays >= 1);
  }, [userDrafts]);

  const totalDrafts = userDrafts.length;
  const warningCount = warnings.length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleReviewAll = () => {
    setOpen(false);
    router.push("/portal/os?filter=rascunho");
  };

  const handleEdit = (draftId: string) => {
    setOpen(false);
    router.push(`/portal/os?editDraftId=${draftId}`);
  };

  const handlePromote = (draftId: string) => {
    setOpen(false);
    // Redirecionar para a página de OS onde a validação completa é feita
    router.push(`/portal/os?editDraftId=${draftId}`);
  };

  if (totalDrafts === 0) return null;

  return (
    <div className={`relative ${className || ""}`}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-3 text-[#a06418] hover:bg-[rgb(255,248,235)] hover:text-[#a06418] rounded-xl relative transition-all border border-[rgb(255,212,146)] cursor-pointer bg-white"
        title={
          warningCount > 0
            ? `Você tem ${warningCount} rascunho${warningCount > 1 ? "s" : ""} pendente${warningCount > 1 ? "s" : ""}`
            : `Você tem ${totalDrafts} rascunho${totalDrafts > 1 ? "s" : ""}`
        }
      >
        <FileText size={20} />
        {warningCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#a06418] text-white text-xs font-black rounded-full flex items-center justify-center border-2 border-white">
            {warningCount > 9 ? "9+" : warningCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-[420px] bg-white border border-[rgb(255,212,146)] rounded-2xl shadow-2xl z-[9999] overflow-hidden"
        >
          <div className="p-4 border-b border-[rgb(255,212,146)] bg-[rgb(255,248,235)]">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-[#a06418]">Avisos de Rascunho</h3>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-[#a06418]/60 hover:text-[#a06418] hover:bg-[rgb(255,234,208)] rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {warnings.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                <p className="text-sm font-bold">
                  Nenhum rascunho pendente. Ótimo!
                </p>
                {totalDrafts > 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    {totalDrafts} rascunho
                    {totalDrafts > 1 ? "s" : ""} recente
                    {totalDrafts > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {warnings.map((draft) => (
                  <div key={draft.id} className="p-4 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-800 truncate">
                          Rascunho #{draft.protocolo || draft.os || draft.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-slate-500 font-bold truncate">
                          {draft.clienteNome}
                        </p>
                        <p className="text-xs text-[#a06418] font-black mt-1">
                          {draft.ageDays === 1
                            ? "Há 1 dia"
                            : `Há ${draft.ageDays} dias`}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => handleEdit(draft.id)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                          title="Editar rascunho"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handlePromote(draft.id)}
                          className="p-1.5 text-slate-400 hover:text-[#a06418] hover:bg-[rgb(255,248,235)] rounded-lg cursor-pointer"
                          title="Promover para OS"
                        >
                          <ArrowUpCircle size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <button
              onClick={handleReviewAll}
              className="w-full px-4 py-2 text-sm font-black text-[#a06418] bg-[rgb(255,248,235)] hover:bg-[rgb(255,234,208)] rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <Eye size={14} />
              Revisar todos os rascunhos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
