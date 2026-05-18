"use client";

export const runtime = "edge";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Flag,
  Gauge,
  MessageCircle,
} from "lucide-react";
import { FormErrorMessage } from "@/components/ui/FormErrorMessage";

function SuccessScreen({
  title,
  message,
  subMessage,
}: {
  title: string;
  message: string;
  subMessage: string;
}) {
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.close();
      } catch {
        // Navegador pode bloquear; usuário usa o botão
      }
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
        <Flag size={32} className="text-green-600" />
      </div>
      <h1 className="text-xl font-black text-slate-900 uppercase tracking-wider">
        {title}
      </h1>
      <p className="text-sm font-semibold text-slate-500">{message}</p>
      <p className="text-xs font-medium text-slate-400 pt-2">{subMessage}</p>
      <a
        href="https://wa.me/"
        className="inline-flex items-center gap-2 mt-4 bg-green-600 text-white font-black text-sm uppercase tracking-widest py-3 px-6 rounded-2xl shadow-lg shadow-green-600/20 hover:scale-[1.02] active:scale-95 transition-all"
      >
        <MessageCircle size={18} />
        Voltar ao WhatsApp
      </a>
    </>
  );
}

interface PreviewData {
  os: {
    id: string;
    protocolo: string;
    os_number: string;
  };
  cycleTitle?: string;
  alreadyFinished: boolean;
  canFinish: boolean;
}

export default function FinalizarRotaPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const osId = params.osId as string;
  const cycleIndex = searchParams.get("cycle_index");

  const [status, setStatus] = useState<
    "loading" | "form" | "submitting" | "success" | "already" | "error"
  >("loading");
  const [message, setMessage] = useState("Carregando dados da rota...");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [kmFinal, setKmFinal] = useState("");
  const [kmError, setKmError] = useState("");

  const formatKmInput = (raw: string): string => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    const num = Number(digits);
    return num.toLocaleString("pt-BR");
  };

  useEffect(() => {
    if (!osId) return;

    fetch(
      `/api/os-finish-route?os_id=${encodeURIComponent(osId)}${cycleIndex !== null ? `&cycle_index=${encodeURIComponent(cycleIndex)}` : ""}`,
    )
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success) {
          setStatus("error");
          setMessage(data.error || "Erro ao carregar dados da rota.");
          return;
        }
        if (data.alreadyFinished) {
          setStatus("already");
          setMessage(data.message || "Rota já finalizada anteriormente.");
          return;
        }
        if (!data.canFinish) {
          setStatus("error");
          setMessage("A viagem ainda não foi iniciada.");
          return;
        }
        setPreview(data);
        setStatus("form");
      })
      .catch(() => {
        setStatus("error");
        setMessage("Erro de conexão. Tente novamente mais tarde.");
      });
  }, [osId, cycleIndex]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setKmError("");

    const km = Number(kmFinal.replace(/\./g, ""));
    if (!kmFinal.trim() || Number.isNaN(km) || km < 0) {
      setKmError("Informe uma quilometragem final válida.");
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/os-finish-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          os_id: osId,
          km_final: km,
          cycle_index: cycleIndex !== null ? Number(cycleIndex) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setMessage(
          data.message || "Rota finalizada com sucesso! Obrigado pela viagem.",
        );
      } else {
        setStatus("error");
        setMessage(data.error || "Não foi possível finalizar a rota.");
      }
    } catch {
      setStatus("error");
      setMessage("Erro de conexão. Tente novamente mais tarde.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 p-8 text-center space-y-6">
        {status === "loading" && (
          <>
            <Loader2 size={48} className="animate-spin text-blue-600 mx-auto" />
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-wider">
              Aguarde
            </h1>
            <p className="text-sm font-semibold text-slate-500">{message}</p>
          </>
        )}

        {status === "form" && preview && (
          <form onSubmit={handleSubmit} className="space-y-6 text-left">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <Flag size={32} className="text-emerald-600" />
              </div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-wider">
                {preview.cycleTitle || "Finalizar Rota"}
              </h1>
              <p className="text-sm font-semibold text-slate-500">
                Protocolo: {preview.os.protocolo || preview.os.os_number}
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="km-final"
                className="flex items-center gap-2 text-sm font-bold text-slate-700"
              >
                <Gauge size={18} className="text-emerald-600" />
                Quilometragem Final
              </label>
              <input
                id="km-final"
                type="text"
                inputMode="numeric"
                value={kmFinal}
                onChange={(e) => setKmFinal(formatKmInput(e.target.value))}
                placeholder="Ex: 45.320"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                required
              />
              <FormErrorMessage message={kmError} />
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 text-white font-black text-sm uppercase tracking-widest py-4 rounded-2xl shadow-lg shadow-emerald-600/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
            >
              Finalizar Viagem
            </button>
          </form>
        )}

        {status === "submitting" && (
          <>
            <Loader2 size={48} className="animate-spin text-blue-600 mx-auto" />
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-wider">
              Processando
            </h1>
            <p className="text-sm font-semibold text-slate-500">
              Finalizando rota...
            </p>
          </>
        )}

        {status === "success" && (
          <SuccessScreen
            title="Rota Finalizada"
            message={message}
            subMessage="O sistema foi atualizado. Obrigado!"
          />
        )}

        {status === "already" && (
          <>
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-blue-600" />
            </div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-wider">
              Já Finalizada
            </h1>
            <p className="text-sm font-semibold text-slate-500">{message}</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <AlertCircle size={32} className="text-red-600" />
            </div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-wider">
              Erro
            </h1>
            <p className="text-sm font-semibold text-slate-500">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
