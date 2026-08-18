"use client";

import type { ReactElement } from "react";

// Prédios ao fundo (parallax lento) — silhuetas azul-escuro
const BUILDINGS_FAR: { w: number; h: number; gap: number; windows: number }[] =
  [
    { w: 70, h: 120, gap: 8, windows: 9 },
    { w: 56, h: 90, gap: 6, windows: 6 },
    { w: 80, h: 150, gap: 8, windows: 12 },
    { w: 48, h: 70, gap: 6, windows: 4 },
    { w: 64, h: 110, gap: 8, windows: 8 },
    { w: 72, h: 135, gap: 8, windows: 10 },
    { w: 52, h: 80, gap: 6, windows: 5 },
    { w: 88, h: 165, gap: 10, windows: 15 },
    { w: 60, h: 100, gap: 8, windows: 7 },
    { w: 50, h: 75, gap: 6, windows: 4 },
  ];

// Prédios próximos (parallax rápido) — azul mais saturado
const BUILDINGS_NEAR: { w: number; h: number; gap: number; windows: number }[] =
  [
    { w: 90, h: 130, gap: 10, windows: 12 },
    { w: 70, h: 95, gap: 8, windows: 8 },
    { w: 110, h: 170, gap: 12, windows: 20 },
    { w: 60, h: 80, gap: 8, windows: 5 },
    { w: 84, h: 120, gap: 10, windows: 12 },
    { w: 96, h: 150, gap: 10, windows: 16 },
    { w: 68, h: 90, gap: 8, windows: 6 },
    { w: 120, h: 185, gap: 12, windows: 24 },
  ];

// Nuvens drifting ao fundo
const CLOUDS: {
  top: number;
  left: number;
  w: number;
  h: number;
  dur: number;
  delay: number;
}[] = [
  { top: 8, left: -20, w: 180, h: 50, dur: 60, delay: 0 },
  { top: 18, left: -40, w: 240, h: 60, dur: 80, delay: -20 },
  { top: 5, left: -10, w: 140, h: 40, dur: 70, delay: -45 },
  { top: 22, left: -30, w: 200, h: 55, dur: 90, delay: -60 },
];

// Carros na contra-mão (vindo da direita para esquerda)
const ONCOMING_CARS: {
  type: "hatchback" | "sedan" | "compact" | "suv" | "coupe";
  color: string;
  border: string;
  dur: number;
  delay: number;
  scale: number;
}[] = [
  {
    type: "hatchback",
    color: "#dc2626",
    border: "#7f1d1d",
    dur: 7,
    delay: 0,
    scale: 1,
  },
  {
    type: "sedan",
    color: "#16a34a",
    border: "#14532d",
    dur: 9,
    delay: -3,
    scale: 0.85,
  },
  {
    type: "compact",
    color: "#eab308",
    border: "#713f12",
    dur: 8,
    delay: -5,
    scale: 0.9,
  },
  {
    type: "suv",
    color: "#0891b2",
    border: "#164e63",
    dur: 10,
    delay: -1.5,
    scale: 0.8,
  },
  {
    type: "coupe",
    color: "#c026d3",
    border: "#701a75",
    dur: 8.5,
    delay: -6.5,
    scale: 0.95,
  },
];

// Silhuetas SVG dos carros (96x42, frente à esquerda)
const CAR_SILHOUETTES: Record<string, { body: string; glass: string }> = {
  hatchback: {
    body: "M 2 36 L 2 28 L 8 26 L 14 22 L 22 16 L 34 13 L 54 13 L 66 17 L 76 24 L 86 30 L 92 33 L 92 36 L 82 36 A 11 11 0 0 0 60 36 L 36 36 A 11 11 0 0 0 14 36 L 2 36 Z",
    glass: "M 24 18 L 34 15 L 52 15 L 62 19 L 56 23 L 26 23 Z",
  },
  sedan: {
    body: "M 2 36 L 2 28 L 8 26 L 14 23 L 20 17 L 30 13 L 48 12 L 56 13 L 62 15 L 66 17 L 72 15 L 78 17 L 84 22 L 90 28 L 92 32 L 92 36 L 82 36 A 11 11 0 0 0 60 36 L 36 36 A 11 11 0 0 0 14 36 L 2 36 Z",
    glass: "M 22 18 L 30 14 L 54 14 L 60 17 L 54 20 L 24 20 Z",
  },
  compact: {
    body: "M 2 36 L 2 26 L 6 22 L 10 14 L 16 11 L 62 11 L 70 14 L 80 20 L 88 26 L 92 30 L 92 36 L 82 36 A 11 11 0 0 0 60 36 L 36 36 A 11 11 0 0 0 14 36 L 2 36 Z",
    glass: "M 14 14 L 18 12 L 58 12 L 64 15 L 58 19 L 16 19 Z",
  },
  suv: {
    body: "M 2 36 L 2 24 L 6 20 L 10 12 L 16 10 L 66 10 L 74 13 L 82 18 L 88 24 L 92 28 L 92 36 L 82 36 A 11 11 0 0 0 60 36 L 36 36 A 11 11 0 0 0 14 36 L 2 36 Z",
    glass: "M 12 13 L 16 11 L 64 11 L 68 14 L 64 17 L 14 17 Z",
  },
  coupe: {
    body: "M 2 36 L 2 28 L 8 26 L 14 24 L 22 19 L 34 14 L 48 11 L 60 12 L 68 15 L 76 19 L 84 24 L 90 28 L 92 32 L 92 36 L 82 36 A 11 11 0 0 0 60 36 L 36 36 A 11 11 0 0 0 14 36 L 2 36 Z",
    glass: "M 24 20 L 34 15 L 56 12 L 64 14 L 60 19 L 26 23 Z",
  },
};

interface CaixaReportLoadingOverlayProps {
  title?: string;
  subtitle?: string;
}

export function CaixaReportLoadingOverlay({
  title = "Exportando relatório",
  subtitle = "Aguarde, estamos preparando seu documento...",
}: CaixaReportLoadingOverlayProps): ReactElement {
  return (
    <div className="absolute inset-0 z-[10000] overflow-hidden animate-in fade-in duration-200">
      {/* Céu — paleta azul do sistema */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #0b1220 0%, #0f1f3d 45%, #142b54 75%, #1e3a8a 100%)",
        }}
      />

      {/* Lua */}
      <div
        className="absolute rounded-full bg-slate-100/90"
        style={{
          top: "12%",
          right: "14%",
          width: 56,
          height: 56,
          boxShadow:
            "0 0 40px 8px rgba(226,232,240,0.35), inset -10px -8px 0 0 rgba(148,163,184,0.45)",
        }}
      />

      {/* Nuvens drifting lento */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {CLOUDS.map((c, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              top: `${c.top}%`,
              left: `${c.left}%`,
              width: c.w,
              height: c.h,
              background:
                "radial-gradient(ellipse at center, rgba(226,232,240,0.18) 0%, rgba(226,232,240,0.06) 60%, transparent 75%)",
              filter: "blur(6px)",
              animation: `cloud-drift ${c.dur}s linear infinite`,
              animationDelay: `${c.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Montanha com Cristo Redentor (silhueta estática ao fundo) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{ bottom: "26%", width: 520, height: 220, opacity: 0.55 }}
      >
        <svg
          viewBox="0 0 520 220"
          width="520"
          height="220"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0 220 C 80 180, 150 150, 210 120 C 240 105, 270 95, 300 95 C 330 95, 360 105, 390 120 C 430 140, 480 175, 520 220 Z"
            fill="#0a1428"
          />
          <path
            d="M300 220 C 340 190, 380 170, 420 165 C 460 160, 490 185, 520 220 Z"
            fill="#0d1a33"
            opacity="0.7"
          />
          <g fill="#0a1428">
            <rect x="291" y="88" width="18" height="10" rx="1" />
            <rect x="295" y="70" width="10" height="20" rx="1" />
            <circle cx="300" cy="66" r="4" />
            <rect x="272" y="72" width="56" height="4" rx="1" />
            <rect
              x="284"
              y="76"
              width="32"
              height="6"
              fill="#0f1f3d"
              opacity="0.5"
            />
          </g>
        </svg>
      </div>

      {/* Camada de prédios ao fundo (parallax lento) */}
      <div
        className="absolute bottom-[28%] left-0 h-[42%] flex"
        style={{ animation: "city-pan-slow 18s linear infinite" }}
      >
        {[0, 1].map((dup) => (
          <div
            key={dup}
            className="flex items-end shrink-0"
            style={{ width: "max-content" }}
          >
            {BUILDINGS_FAR.map((b, i) => (
              <div
                key={`${dup}-${i}`}
                className="relative shrink-0"
                style={{
                  width: b.w,
                  height: b.h,
                  marginRight: b.gap,
                  background:
                    "linear-gradient(180deg, #1e293b 0%, #0f1f3d 100%)",
                  borderRadius: 4,
                }}
              >
                {b.windows &&
                  Array.from({ length: b.windows }).map((_, w) => (
                    <span
                      key={w}
                      className="absolute rounded-[2px]"
                      style={{
                        left: `${8 + (w % 3) * 28}px`,
                        top: `${10 + Math.floor(w / 3) * 16}px`,
                        width: 8,
                        height: 8,
                        background:
                          (w + i + dup) % 4 === 0
                            ? "rgba(250, 204, 21, 0.85)"
                            : "rgba(96, 165, 250, 0.35)",
                      }}
                    />
                  ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Camada de prédios próxima (parallax rápido) */}
      <div
        className="absolute bottom-[26%] left-0 h-[34%] flex"
        style={{ animation: "city-pan-fast 8s linear infinite" }}
      >
        {[0, 1].map((dup) => (
          <div
            key={dup}
            className="flex items-end shrink-0"
            style={{ width: "max-content" }}
          >
            {BUILDINGS_NEAR.map((b, i) => (
              <div
                key={`${dup}-${i}`}
                className="relative shrink-0"
                style={{
                  width: b.w,
                  height: b.h,
                  marginRight: b.gap,
                  background:
                    "linear-gradient(180deg, #1e3a8a 0%, #0b1a3a 100%)",
                  borderRadius: 6,
                  boxShadow: "0 0 0 1px rgba(30,58,138,0.4) inset",
                }}
              >
                {b.windows &&
                  Array.from({ length: b.windows }).map((_, w) => (
                    <span
                      key={w}
                      className="absolute rounded-[2px]"
                      style={{
                        left: `${10 + (w % 4) * 22}px`,
                        top: `${12 + Math.floor(w / 4) * 18}px`,
                        width: 10,
                        height: 10,
                        background:
                          (w + i + dup) % 3 === 0
                            ? "rgba(250, 204, 21, 0.9)"
                            : "rgba(147, 197, 253, 0.5)",
                      }}
                    />
                  ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Pista / asfalto */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: "26%",
          background: "linear-gradient(180deg, #0b1220 0%, #05080f 100%)",
          borderTop: "2px solid rgba(59,130,246,0.25)",
        }}
      >
        <div
          className="absolute left-0 right-0"
          style={{
            top: "45%",
            height: 4,
            backgroundImage:
              "repeating-linear-gradient(90deg, #f8fafc 0 32px, transparent 32px 64px)",
            animation: "road-dash 0.6s linear infinite",
          }}
        />
      </div>

      {/* Carros na contra-mão (faixa superior da pista, direita → esquerda) */}
      {ONCOMING_CARS.map((car, idx) => (
        <div
          key={idx}
          className="absolute"
          style={{
            bottom: "23%",
            left: 0,
            animation: `car-oncoming ${car.dur}s linear infinite`,
            animationDelay: `${car.delay}s`,
          }}
        >
          <div
            className="relative"
            style={{
              width: 96,
              height: 42,
              transform: `scale(${car.scale})`,
            }}
          >
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-full"
              style={{
                bottom: -6,
                width: 84,
                height: 8,
                background:
                  "radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, transparent 70%)",
              }}
            />
            <svg
              viewBox="0 0 96 42"
              width="96"
              height="42"
              className="absolute inset-0"
              style={{
                filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.4))",
              }}
            >
              <defs>
                <linearGradient
                  id={`caixa-carBody-${idx}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={car.color} />
                  <stop offset="100%" stopColor={car.border} />
                </linearGradient>
              </defs>
              <path
                d={CAR_SILHOUETTES[car.type].body}
                fill={`url(#caixa-carBody-${idx})`}
                stroke={car.border}
                strokeWidth="1.2"
              />
              <path
                d={CAR_SILHOUETTES[car.type].glass}
                fill="#93c5fd"
                opacity="0.75"
              />
              <circle cx="6" cy="28" r="3" fill="#fef08a" opacity="0.9" />
              <circle
                cx="88"
                cy="28"
                r="2.5"
                fill="#ef4444"
                opacity="0.85"
              />
            </svg>
            <div
              className="absolute rounded-full overflow-hidden"
              style={{
                left: 14,
                bottom: -10,
                width: 22,
                height: 22,
                background: "#020617",
                border: "2px solid #334155",
              }}
            >
              <div
                className="absolute inset-0 rounded-full overflow-hidden"
                style={{ animation: "wheel-spin 0.4s linear infinite" }}
              >
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ width: 2, height: 12, background: "#64748b" }}
                />
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ width: 12, height: 2, background: "#64748b" }}
                />
              </div>
            </div>
            <div
              className="absolute rounded-full overflow-hidden"
              style={{
                right: 14,
                bottom: -10,
                width: 22,
                height: 22,
                background: "#020617",
                border: "2px solid #334155",
              }}
            >
              <div
                className="absolute inset-0 rounded-full overflow-hidden"
                style={{ animation: "wheel-spin 0.4s linear infinite" }}
              >
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ width: 2, height: 12, background: "#64748b" }}
                />
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ width: 12, height: 2, background: "#64748b" }}
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Van — corpo principal em azul escuro com logo branca na lateral */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: "20%",
          animation: "van-bob 1.1s ease-in-out infinite",
        }}
      >
        <div className="relative" style={{ width: 220, height: 96 }}>
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-full"
            style={{
              bottom: -10,
              width: 200,
              height: 14,
              background:
                "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, #1e3a8a 0%, #0f1f3d 100%)",
              borderRadius: "18px 26px 10px 10px",
              border: "1.5px solid #2b4cba",
              boxShadow:
                "0 10px 24px rgba(0,0,0,0.45), inset 0 2px 0 rgba(147,197,253,0.25)",
            }}
          />
          <div
            className="absolute"
            style={{
              right: 12,
              top: 12,
              width: 52,
              height: 34,
              background:
                "linear-gradient(180deg, #93c5fd 0%, #3b82f6 100%)",
              borderRadius: "10px 18px 4px 4px",
              opacity: 0.85,
            }}
          />
          <div
            className="absolute"
            style={{
              left: 14,
              right: 80,
              top: 26,
              height: 4,
              background:
                "linear-gradient(90deg, transparent, #60a5fa, transparent)",
              opacity: 0.6,
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              right: 4,
              top: 18,
              width: 8,
              height: 8,
              background: "#fde68a",
              boxShadow: "0 0 12px 4px rgba(253,224,71,0.7)",
            }}
          />
          <div
            className="absolute flex items-center gap-1.5"
            style={{
              left: 22,
              top: 44,
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Geolog"
              style={{ height: 26, width: "auto" }}
            />
            <div className="flex flex-col leading-none">
              <span
                className="text-white font-black tracking-tight"
                style={{ fontSize: 15 }}
              >
                Geolog
              </span>
              <span
                className="text-blue-100/80 font-semibold tracking-wide uppercase"
                style={{
                  fontSize: 7,
                  letterSpacing: "0.08em",
                  marginTop: 3,
                }}
              >
                Transportes Executivo
              </span>
            </div>
          </div>
          <div
            className="absolute rounded-full overflow-hidden"
            style={{
              right: 28,
              bottom: -14,
              width: 34,
              height: 34,
              background: "#020617",
              border: "3px solid #334155",
            }}
          >
            <div
              className="absolute inset-0 rounded-full overflow-hidden"
              style={{ animation: "wheel-spin 0.5s linear infinite" }}
            >
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ width: 2, height: 18, background: "#64748b" }}
              />
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ width: 18, height: 2, background: "#64748b" }}
              />
            </div>
          </div>
          <div
            className="absolute rounded-full overflow-hidden"
            style={{
              left: 28,
              bottom: -14,
              width: 34,
              height: 34,
              background: "#020617",
              border: "3px solid #334155",
            }}
          >
            <div
              className="absolute inset-0 rounded-full overflow-hidden"
              style={{ animation: "wheel-spin 0.5s linear infinite" }}
            >
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ width: 2, height: 18, background: "#64748b" }}
              />
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ width: 18, height: 2, background: "#64748b" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Texto + barra de progresso */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[14%] flex flex-col items-center">
        <p className="text-white text-xl font-black tracking-tight drop-shadow">
          {title}
        </p>
        <p className="text-blue-200/80 text-sm font-medium mt-1.5">
          {subtitle}
        </p>
        <div className="mt-5 w-60 h-1.5 rounded-full bg-slate-700/80 overflow-hidden">
          <div
            className="h-full w-1/3 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, #1e3a8a, #60a5fa, #1e3a8a)",
              animation: "van-progress 1.2s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes city-pan-slow {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes city-pan-fast {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes cloud-drift {
          0% { transform: translateX(0); }
          100% { transform: translateX(120vw); }
        }
        @keyframes car-oncoming {
          0% { transform: translateX(110vw); }
          100% { transform: translateX(-120px); }
        }
        @keyframes road-dash {
          0% { background-position: 0 0; }
          100% { background-position: -64px 0; }
        }
        @keyframes van-bob {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-3px); }
        }
        @keyframes wheel-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes van-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
