"use client";

export const runtime = "edge";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Navigation,
  Car,
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
        <Navigation size={32} className="text-green-600" />
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
  vehicle: {
    marca: string;
    modelo: string;
    placa: string;
  } | null;
  alreadyStarted: boolean;
}

export default function IniciarRotaPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const osId = params.osId as string;
  const cycleIndex = searchParams.get("cycle_index");

  const [status, setStatus] = useState<
    "loading" | "confirm" | "submitting" | "success" | "already" | "error"
  >("loading");
  const [message, setMessage] = useState("Carregando dados da rota...");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [kmInitial, setKmInitial] = useState("");
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
      `/api/os-start-route?os_id=${encodeURIComponent(osId)}${cycleIndex !== null ? `&cycle_index=${encodeURIComponent(cycleIndex)}` : ""}`,
    )
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success) {
          setStatus("error");
          setMessage(data.error || "Erro ao carregar dados da rota.");
          return;
        }
        if (data.alreadyStarted) {
          const itineraryIndex =
            data.cycle?.itineraryIndex ??
            (cycleIndex !== null ? Number(cycleIndex) : 0);
          const finishUrl = `/finalizar-rota/${osId}?cycle_index=${itineraryIndex}`;
          window.location.replace(finishUrl);
          return;
        }
        setPreview(data);
        setStatus("confirm");
      })
      .catch(() => {
        setStatus("error");
        setMessage("Erro de conexão. Tente novamente mais tarde.");
      });
  }, [osId, cycleIndex]);

  const handleStart = async () => {
    setKmError("");

    const km = Number(kmInitial.replace(/\./g, ""));
    if (!kmInitial.trim() || Number.isNaN(km) || km < 0) {
      setKmError("Informe a quilometragem inicial do veículo.");
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/os-start-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          os_id: osId,
          km_initial: km,
          cycle_index: cycleIndex !== null ? Number(cycleIndex) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setMessage(
          data.message ||
            "Rota iniciada com sucesso! Boa viagem e dirija com segurança.",
        );
      } else {
        setStatus("error");
        setMessage(data.error || "Não foi possível iniciar a rota.");
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

        {status === "confirm" && preview && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleStart();
            }}
            className="space-y-6 text-left"
          >
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
              <Navigation size={32} className="text-blue-600" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-wider">
                {preview.cycleTitle || "Iniciar Rota"}
              </h1>
              <p className="text-sm font-semibold text-slate-500">
                Protocolo: {preview.os.protocolo || preview.os.os_number}
              </p>
            </div>
            {preview.vehicle && (
              <div className="bg-slate-50 rounded-2xl p-5 space-y-3 border border-slate-200">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">
                  Veículo Designado
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Car size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800">
                      {preview.vehicle.marca} {preview.vehicle.modelo}
                    </p>
                    <p className="text-xs font-bold text-slate-500">
                      Placa: {preview.vehicle.placa}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="km-initial"
                className="flex items-center gap-2 text-sm font-bold text-slate-700"
              >
                <Gauge size={18} className="text-blue-600" />
                Quilometragem Inicial
              </label>
              <input
                id="km-initial"
                type="text"
                inputMode="numeric"
                value={kmInitial}
                onChange={(e) => setKmInitial(formatKmInput(e.target.value))}
                placeholder="Ex: 45.230"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                required
              />
              <FormErrorMessage message={kmError} />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-black text-sm uppercase tracking-widest py-4 rounded-2xl shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
            >
              Confirmar Início da Rota
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
              Iniciando rota...
            </p>
          </>
        )}

        {status === "success" && (
          <SuccessScreen
            title="Rota Iniciada"
            message={message}
            subMessage="O sistema foi atualizado. Bom trabalho!"
          />
        )}

        {status === "already" && (
          <>
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-blue-600" />
            </div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-wider">
              Já Iniciada
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
