"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import {
  useEffect,
  useState,
  useRef,
  cloneElement,
  ReactElement,
  useCallback,
  useMemo,
} from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { useUserPresence } from "@/hooks/useUserPresence";
import { useAppVersion } from "@/hooks/useAppVersion";
import { useRelativeTimeTicker } from "@/hooks/useRelativeTimeTicker";
import { toast } from "sonner";
import {
  Truck,
  LogOut,
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  Bell,
  Menu,
  Building,
  ShieldCheck,
  DollarSign,
  UserSquare2,
  Handshake,
  RefreshCw,
  Info,
  CheckCircle,
  CircleCheckBig,
  FilePlus,
  AlertTriangle,
  XCircle,
  Archive,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import AnnouncementModal from "@/components/AnnouncementModal";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { ChatWidget } from "@/components/chat/ChatWidget";

function extractNotificationProtocolo(message: string): {
  protocolo: string | null;
  cleanMessage: string;
} {
  let cleanMessage = message.replace(/\[OS_ID:[a-f0-9-]+\]/, "").trim();

  // "OS 2026061284 finalizada com sucesso."
  const osPrefixMatch = cleanMessage.match(/^OS\s+(\d{10})\b/);
  if (osPrefixMatch) {
    cleanMessage = cleanMessage
      .replace(osPrefixMatch[1], "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // "A OS 2026051030 foi atualizada por..."
  const osMatch = cleanMessage.match(/A\s+OS\s+(\d+)/);
  if (osMatch) {
    cleanMessage = cleanMessage.replace(osMatch[0], "").trim();
  }

  // "Protocolo #2026061274 foi gerado."
  const protocoloMatch = cleanMessage.match(/Protocolo\s+#?(\d+)/);
  if (protocoloMatch) {
    cleanMessage = cleanMessage.replace(protocoloMatch[0], "").trim();
  }

  // "2026061117" entre aspas
  const quotesMatch = cleanMessage.match(/"(\d{10})"/);
  if (quotesMatch) {
    cleanMessage = cleanMessage.replace(quotesMatch[0], "").trim();
  }

  // Capitaliza primeira letra se necessario
  if (cleanMessage.length > 0 && cleanMessage[0] === cleanMessage[0].toLowerCase()) {
    cleanMessage = cleanMessage[0].toUpperCase() + cleanMessage.slice(1);
  }

  const protocolo =
    osPrefixMatch?.[1] ??
    osMatch?.[1] ??
    protocoloMatch?.[1] ??
    quotesMatch?.[1] ??
    null;
  return { protocolo, cleanMessage };
}

function timeAgo(date: string, now: number): string {
  const d = date.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(date) ? date : date + "Z";
  const diff = Math.max(now - new Date(d).getTime(), 0);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `${minutes} min`;
  if (hours < 24) return `${hours} h`;
  if (days === 1) return "Ontem";
  return `${days} d`;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading, logout } = useAuth();
  const {
    unreadCount,
    notifications,
    markAsRead,
    markAllAsRead,
    realtimeConnected,
  } = useNotifications();
  const { currentVersion, updateAvailable, updateCountdown } = useAppVersion();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<"all" | "unread" | "read">("all");
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const relativeTimeNow = useRelativeTimeTicker(showNotifications);
  const filteredNotifications = useMemo(() => {
    if (notificationFilter === "unread") return notifications.filter((n) => !n.read);
    if (notificationFilter === "read") return notifications.filter((n) => n.read);
    return notifications;
  }, [notifications, notificationFilter]);
  const [showEmployees, setShowEmployees] = useState(false);
  const [announcementStep, setAnnouncementStep] = useState<
    "intro" | "explanation" | "closed"
  >("closed");
  const notificationsDropdownRef = useRef<HTMLDivElement>(null);
  const notificationSettingsRef = useRef<HTMLDivElement>(null);
  const employeesButtonRef = useRef<HTMLButtonElement>(null);
  const {
    users: presenceUsers,
    onlineCount,
    activeNowCount,
    loading: presenceLoading,
    getTimeAgo: getPresenceTimeAgo,
    getPresenceStatusLabel,
  } = useUserPresence();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Função helper para verificar permissões de página
  const hasPageAccess = useCallback(
    (page: string): boolean => {
      if (!profile) return false;

      // Administradores têm acesso a tudo
      if (profile.categoria === "administrador") return true;

      // Verificar permissões específicas
      const specificPermissions =
        (profile.specific_permissions as Record<string, unknown>) || {};

      switch (page) {
        case "financeiro":
          const financeiroPerms =
            (specificPermissions.financeiro as Record<string, unknown>) || {};
          // Se existir bloco de permissões do financeiro, ele passa a ser a fonte de verdade.
          if (Object.keys(financeiroPerms).length > 0) {
            return financeiroPerms.page_access === true;
          }
          // Sem bloco específico, mantém o acesso baseado na categoria.
          return profile.categoria === "financeiro";
        default:
          return true;
      }
    },
    [profile],
  );

  // Verificar se o usuário tem acesso à página atual
  useEffect(() => {
    if (!profile || loading) return;

    // Se estiver na página financeiro mas não tiver acesso, redirecionar
    if (pathname === "/portal/financeiro" && !hasPageAccess("financeiro")) {
      toast.warning(
        "Você não tem acesso à página financeira. Redirecionando...",
      );
      router.push("/portal/dashboard");
    }
  }, [profile, loading, pathname, router, hasPageAccess]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (announcementStep === "explanation") {
        return; // Bloqueia cliques fora durante explicação
      }
      if (
        showNotifications &&
        notificationsDropdownRef.current &&
        !notificationsDropdownRef.current.contains(e.target as Node)
      ) {
        setShowNotifications(false);
      }
      if (
        showNotificationSettings &&
        notificationSettingsRef.current &&
        !notificationSettingsRef.current.contains(e.target as Node)
      ) {
        setShowNotificationSettings(false);
      }
      if (showEmployees) {
        setShowEmployees(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showNotifications, showNotificationSettings, showEmployees, announcementStep]);

  // Forçar dropdown aberto durante explicação
  useEffect(() => {
    if (announcementStep === "explanation") {
      // Usar setTimeout para evitar setState síncrono no effect
      setTimeout(() => setShowEmployees(true), 0);
    }
  }, [announcementStep]);

  // Escutar evento do toast para abrir dropdown de notificações
  useEffect(() => {
    const handleOpenDropdown = () => {
      setShowNotifications(true);
    };
    window.addEventListener("open-notifications-dropdown", handleOpenDropdown);
    return () =>
      window.removeEventListener(
        "open-notifications-dropdown",
        handleOpenDropdown,
      );
  }, []);

  // Escutar evento do toast para abrir dropdown de funcionarios
  useEffect(() => {
    const handleOpenEmployees = () => {
      setShowEmployees(true);
    };
    window.addEventListener("open-employees-dropdown", handleOpenEmployees);
    return () =>
      window.removeEventListener(
        "open-employees-dropdown",
        handleOpenEmployees,
      );
  }, []);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0A2540]">
        <div className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Portal Geolog"
            className="w-16 h-16 animate-pulse drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
          />
          <p className="text-[#0A2540] dark:text-white font-medium">
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#FDFDFF] flex text-[var(--color-geolog-blue)]">
      {/* Sidebar - Hover to Expand */}
      <aside
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
        className={`${
          collapsed ? "w-20" : "w-72"
        } bg-[var(--color-geolog-blue)] border-r border-blue-900 hidden md:flex flex-col fixed inset-y-0 shadow-[4px_0_24px_rgba(0,0,0,0.1)] z-50 transition-all duration-300 ease-in-out group/sidebar`}
      >
        <div
          className={`p-6 flex items-center ${collapsed ? "justify-center" : "justify-start gap-3"} border-b border-blue-800/50 h-20 overflow-hidden`}
        >
          <div className="p-1.5 bg-white rounded-lg flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Geolog Logo" className="h-6 w-auto" />
          </div>
          {!collapsed && (
            <span className="text-base font-black text-white uppercase tracking-tighter whitespace-nowrap">
              Portal Geolog
            </span>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2 mt-4">
          <NavLink
            href="/portal/dashboard"
            icon={<LayoutDashboard />}
            label="Dashboard"
            active={pathname === "/portal/dashboard"}
            collapsed={collapsed}
          />
          <NavLink
            href="/portal/os"
            icon={<FileText />}
            label="Ordem de Serviço"
            active={pathname === "/portal/os"}
            collapsed={collapsed}
          />
          {hasPageAccess("financeiro") && (
            <NavLink
              href="/portal/financeiro"
              icon={<DollarSign />}
              label="Medição Financeira"
              active={pathname === "/portal/financeiro"}
              collapsed={collapsed}
            />
          )}
          <NavLink
            href="/portal/motoristas"
            icon={<Users />}
            label="Motoristas"
            active={pathname === "/portal/motoristas"}
            collapsed={collapsed}
          />
          <NavLink
            href="/portal/veiculos"
            icon={<Truck />}
            label="Veículos"
            active={pathname === "/portal/veiculos"}
            collapsed={collapsed}
          />
          <NavLink
            href="/portal/passageiros"
            icon={<UserSquare2 />}
            label="Passageiros"
            active={pathname === "/portal/passageiros"}
            collapsed={collapsed}
          />

          <NavLink
            href="/portal/clientes"
            icon={<Building />}
            label="Clientes"
            active={pathname === "/portal/clientes"}
            collapsed={collapsed}
          />
          <NavLink
            href="/portal/parcerias"
            icon={<Handshake />}
            label="Parceiros de Serviço"
            active={pathname === "/portal/parcerias"}
            collapsed={collapsed}
          />
          <NavLink
            href="/portal/config"
            icon={<Settings />}
            label="Configurações"
            active={pathname === "/portal/config"}
            collapsed={collapsed}
          />
          {profile?.categoria === "administrador" && (
            <NavLink
              href="/admin"
              icon={<ShieldCheck />}
              label="Administração"
              active={pathname === "/admin"}
              collapsed={collapsed}
            />
          )}
        </nav>

        {currentVersion && (
          <div className="px-4 pb-3">
            <div className="rounded-2xl border border-blue-700/60 bg-blue-950/30 px-3 py-2 text-center shadow-inner shadow-black/10">
              {collapsed ? (
                <RefreshCw className="w-5 h-5 text-blue-300/80 mx-auto" />
              ) : (
                <>
                  <p className="text-[9px] font-black uppercase tracking-[0.35em] text-blue-300/80">
                    Versão atual
                  </p>
                  <p className="mt-1 text-[11px] font-black text-white leading-tight truncate">
                    v{currentVersion}
                  </p>
                  {updateAvailable && updateCountdown !== null && (
                    <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.25em] text-blue-200/80">
                      Recarregando em {updateCountdown}s
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="p-4 border-t border-blue-800/50">
          <button
            onClick={handleSignOut}
            className={`w-full flex items-center ${collapsed ? "justify-center" : "gap-3 px-5"} py-3 text-blue-300/80 hover:text-white hover:bg-red-500/20 rounded-xl transition-all group font-bold text-sm`}
            title={collapsed ? "Sair" : ""}
          >
            <LogOut
              size={18}
              className={`${!collapsed && "group-hover:-translate-x-1"} transition-transform`}
            />
            {!collapsed && <span>Sair do Portal</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex-1 ${collapsed ? "md:ml-20" : "md:ml-72"} flex flex-col transition-all duration-300 ease-in-out`}
      >
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-slate-500">
              <Menu size={20} />
            </button>
            <div className="flex flex-col">
              <span
                className="text-[10px] font-black text-blue-600 uppercase tracking-[0.25em] leading-none mb-1.5 antialiased"
                style={{
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
                }}
              >
                {pathname === "/portal/dashboard"
                  ? "Portal Geolog"
                  : pathname.includes("/financeiro")
                    ? "Gestão Financeira"
                    : "Gestão Operacional"}
              </span>
              <div className="flex items-baseline gap-4">
                <h1
                  className="text-xl font-black text-slate-800 tracking-[-0.02em] leading-none uppercase antialiased"
                  style={{
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
                  }}
                >
                  {pathname === "/portal/dashboard"
                    ? "Visão Geral"
                    : pathname.includes("/os")
                      ? "Status Operacional"
                      : pathname.includes("/financeiro")
                        ? "Medição de Faturamento"
                        : pathname.split("/").pop()?.replace("-", " ")}
                </h1>
                <span
                  className="hidden xl:block text-slate-400 text-sm font-bold border-l border-slate-200 pl-4 antialiased"
                  style={{
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
                  }}
                >
                  {pathname.includes("/os")
                    ? "Acompanhamento de rotas"
                    : pathname.includes("/financeiro")
                      ? "Fechamento de faturamento"
                      : "Gestão administrativa"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Avisos do Sistema */}
            <AnnouncementBanner />

            {/* Funcionários Online */}
            <div className="relative">
              <button
                ref={employeesButtonRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNotifications(false);
                  setShowEmployees(!showEmployees);
                }}
                className="p-3 text-slate-400 hover:bg-slate-100 hover:text-[var(--color-geolog-blue)] rounded-xl relative transition-all border border-slate-100 cursor-pointer"
                title={`Funcionários online: ${onlineCount} | ativos agora: ${activeNowCount}`}
              >
                <Users size={20} />
                {onlineCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white text-xs font-black rounded-full flex items-center justify-center border-2 border-white">
                    {onlineCount > 9 ? "9+" : onlineCount}
                  </span>
                )}
                <div
                  className={`absolute bottom-1 right-1 w-2 h-2 rounded-full border border-white ${presenceLoading ? "bg-yellow-500 animate-pulse" : "bg-green-500"}`}
                />
              </button>

              {showEmployees && (
                <div className="absolute right-0 mt-2 w-[380px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-[9999] overflow-hidden">
                  <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-slate-800">
                        Funcionários
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-xs text-slate-500 font-bold">
                          {onlineCount} online
                        </span>
                        {activeNowCount > 0 && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs text-emerald-600 font-black">
                              {activeNowCount} ativos agora
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {presenceLoading ? (
                      <div className="p-8 text-center text-slate-400">
                        <Users
                          size={32}
                          className="mx-auto mb-2 opacity-50 animate-pulse"
                        />
                        <p className="text-sm">Carregando...</p>
                      </div>
                    ) : presenceUsers.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        <Users size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhum funcionário encontrado</p>
                      </div>
                    ) : (
                      presenceUsers.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center gap-3 p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                        >
                          <div className="relative flex-shrink-0">
                            {u.avatar_url ? (
                              <Image
                                src={u.avatar_url}
                                alt={u.nome}
                                width={40}
                                height={40}
                                unoptimized
                                className="w-10 h-10 rounded-full object-cover border border-slate-200"
                              />
                            ) : (
                              <span className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white text-xs font-black flex items-center justify-center border border-slate-200">
                                {u.nome.charAt(0).toUpperCase()}
                              </span>
                            )}
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${u.is_active_now ? "bg-emerald-500" : u.is_online ? "bg-green-400" : "bg-slate-300"}`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">
                              {u.nome}
                            </p>
                            <p className="text-xs text-slate-500 capitalize">
                              {u.categoria}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {u.is_active_now ? (
                              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                                Ativo agora
                              </span>
                            ) : u.is_online ? (
                              <span className="text-[9px] leading-none font-black uppercase tracking-wider text-blue-400 bg-blue-50 px-2 py-1 rounded-full">
                                {getPresenceStatusLabel(u)}
                              </span>
                            ) : (
                              <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-400 block">
                                  {u.last_seen_at
                                    ? getPresenceTimeAgo(u.last_seen_at)
                                    : "Nunca ativo"}
                                </span>
                                {u.last_seen_at && (
                                  <span className="text-[11px] text-slate-400 block">
                                    {new Date(u.last_seen_at).toLocaleString(
                                      "pt-BR",
                                      {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
                            <span className="sr-only">
                              {getPresenceStatusLabel(u)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmployees(false);
                  setShowNotifications(!showNotifications);
                }}
                className="p-3 text-slate-400 hover:bg-slate-100 hover:text-[var(--color-geolog-blue)] rounded-xl relative transition-all border border-slate-100 cursor-pointer"
                title={`Notificações ${realtimeConnected ? "✅" : "⏳"}`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-black rounded-full flex items-center justify-center border-2 border-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
                {/* Indicador de status da conexão */}
                <div
                  className={`absolute bottom-1 right-1 w-2 h-2 rounded-full border border-white ${
                    realtimeConnected
                      ? "bg-green-500"
                      : "bg-yellow-500 animate-pulse"
                  }`}
                ></div>
              </button>

              {showNotifications && (
                <div ref={notificationsDropdownRef} className="absolute right-0 mt-2 w-[400px] bg-white rounded-2xl shadow-2xl z-[9999] overflow-hidden border border-slate-100">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <h3 className="font-black text-lg text-slate-800">
                      Notificações
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                        {(["all", "unread", "read"] as const).map((f) => (
                          <button
                            key={f}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setNotificationFilter(f);
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                              notificationFilter === f
                                ? "bg-white text-slate-800 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            {f === "all" ? "Todas" : f === "unread" ? "Não lidas" : "Lidas"}
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowNotificationSettings(!showNotificationSettings);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Opções"
                        >
                          <Settings size={16} />
                        </button>
                        {showNotificationSettings && (
                          <div ref={notificationSettingsRef} className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-[10000]">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                markAllAsRead();
                                setShowNotificationSettings(false);
                              }}
                              disabled={unreadCount === 0}
                              className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
                            >
                              Marcar todos como lidos
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lista */}
                  <div className="max-h-[520px] overflow-y-auto py-2 space-y-1">
                    {filteredNotifications.length === 0 ? (
                      <div className="py-10 text-center text-slate-400">
                        <Bell size={28} className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm">Nenhuma notificação</p>
                      </div>
                    ) : (
                      filteredNotifications.map((notification) => {
                        const { protocolo } = extractNotificationProtocolo(
                          notification.message,
                        );

                        const actionText =
                          notification.title === "Novo atendimento"
                            ? "cadastrou um novo atendimento"
                            : notification.title === "Atendimento atualizado"
                              ? "atualizou um atendimento"
                              : notification.title === "Atendimento finalizado"
                                ? "finalizou um atendimento"
                                : notification.title === "Atendimento arquivado"
                                  ? "arquivou um atendimento"
                                  : notification.title === "Atendimento reaberto"
                                    ? "reabriu um atendimento"
                                    : notification.title.toLowerCase();

                        const chips = notification.metadata?.changed_fields_list;
                        const hasChips =
                          Array.isArray(chips) && chips.length > 0;

                        return (
                          <div
                            key={notification.id}
                            className={`
                              relative flex items-start gap-3 p-3 mx-2 rounded-xl cursor-pointer transition-colors
                              ${notification.read ? "hover:bg-slate-50" : "bg-gradient-to-r from-blue-100/50 to-white/50 hover:from-blue-100/70 hover:to-white/70"}
                            `}
                            onClick={() => {
                              markAsRead(notification.id);

                              // Extrair ID da OS da mensagem se existir
                              const osIdMatch = notification.message.match(
                                /\[OS_ID:([a-f0-9-]+)\]/,
                              );
                              const osProtocoloMatch =
                                notification.message.match(/Protocolo #(\d+)/);
                              const osProtocoloQuotesMatch =
                                notification.message.match(/"(\d{10})"/);

                              if (osIdMatch) {
                                const osId = osIdMatch[1];
                                if (pathname === "/portal/os") {
                                  window.dispatchEvent(
                                    new CustomEvent("open-os-modal", {
                                      bubbles: true,
                                      detail: { osId },
                                    }),
                                  );
                                } else {
                                  router.push(`/portal/os?open_os=${osId}`);
                                }
                              } else if (osProtocoloMatch) {
                                const osProtocolo = osProtocoloMatch[1];
                                if (pathname === "/portal/os") {
                                  window.dispatchEvent(
                                    new CustomEvent("open-os-modal", {
                                      bubbles: true,
                                      detail: { osProtocolo },
                                    }),
                                  );
                                } else {
                                  router.push(
                                    `/portal/os?open_os_protocolo=${osProtocolo}`,
                                  );
                                }
                              } else if (osProtocoloQuotesMatch) {
                                const osProtocolo = osProtocoloQuotesMatch[1];
                                if (pathname === "/portal/os") {
                                  window.dispatchEvent(
                                    new CustomEvent("open-os-modal", {
                                      bubbles: true,
                                      detail: { osProtocolo },
                                    }),
                                  );
                                } else {
                                  router.push(
                                    `/portal/os?open_os_protocolo=${osProtocolo}`,
                                  );
                                }
                              }
                            }}
                          >
                            {/* Avatar com badge de tipo */}
                            {(() => {
                              const badgeConfig = (() => {
                                const t = notification.title;
                                if (t === "Novo atendimento")
                                  return { icon: FilePlus, bg: "bg-green-500", text: "text-white" };
                                if (t === "Atendimento atualizado" || t === "Status do atendimento atualizado")
                                  return { icon: Info, bg: "bg-blue-500", text: "text-white" };
                                if (t === "Atendimento finalizado")
                                  return { icon: CircleCheckBig, bg: "bg-emerald-500", text: "text-white" };
                                if (t === "Atendimento arquivado" || t === "OS Arquivada")
                                  return { icon: Archive, bg: "bg-red-500", text: "text-white" };
                                if (t === "Atendimento reaberto" || t === "OS Reaberta")
                                  return { icon: RotateCcw, bg: "bg-blue-500", text: "text-white" };
                                switch (notification.type) {
                                  case "success":
                                    return { icon: CheckCircle, bg: "bg-green-500", text: "text-white" };
                                  case "warning":
                                    return { icon: AlertTriangle, bg: "bg-red-500", text: "text-white" };
                                  case "error":
                                    return { icon: XCircle, bg: "bg-red-500", text: "text-white" };
                                  default:
                                    return { icon: Info, bg: "bg-blue-500", text: "text-white" };
                                }
                              })();
                              const BadgeIcon = badgeConfig.icon;
                              return (
                                <div className="relative flex-shrink-0">
                                  {notification.created_by_avatar_url ? (
                                    <img
                                      src={notification.created_by_avatar_url}
                                      alt={notification.created_by_name || ""}
                                      className="w-14 h-14 rounded-full object-cover border border-slate-200"
                                    />
                                  ) : (
                                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white text-lg font-black flex items-center justify-center">
                                      {notification.created_by_name?.charAt(0).toUpperCase() || "?"}
                                    </div>
                                  )}
                                  <span className={`absolute -bottom-0.5 -right-0.5 w-6 h-6 ${badgeConfig.bg} ${badgeConfig.text} rounded-full flex items-center justify-center border-2 border-white shadow-sm`}>
                                    <BadgeIcon size={12} strokeWidth={2.5} />
                                  </span>
                                </div>
                              );
                            })()}

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <p className="leading-snug">
                                {notification.created_by_name && (
                                  <span
                                    className={`text-sm font-bold ${
                                      !notification.read
                                        ? "text-slate-900"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {notification.created_by_name}
                                  </span>
                                )}
                                {" "}
                                <span className={`text-xs ${!notification.read ? "text-slate-700" : "text-slate-400"}`}>{actionText}</span>
                              </p>

                              {/* Chips */}
                              {hasChips && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {chips.map((chip) => (
                                    <span
                                      key={String(chip)}
                                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${!notification.read ? "bg-sky-100/70 text-sky-700" : "bg-slate-100/70 text-slate-400"}`}
                                    >
                                      {String(chip)}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Meta */}
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span className={`text-xs ${!notification.read ? "text-slate-600" : "text-slate-400"}`}>
                                  {timeAgo(notification.created_at, relativeTimeNow)}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className={`text-xs ${!notification.read ? "text-slate-600" : "text-slate-400"} capitalize`}>
                                  {notification.type === "success"
                                    ? "Cadastro"
                                    : notification.type === "info"
                                      ? "Atualização"
                                      : "Alerta"}
                                </span>
                                {protocolo && (
                                  <>
                                    <span className="text-slate-300">•</span>
                                    <span className={`text-xs ${!notification.read ? "text-slate-600" : "text-slate-400"}`}>
                                      {protocolo}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Unread dot */}
                            {!notification.read && (
                              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-5 pl-8 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p
                  className="text-base font-black text-[var(--color-geolog-blue)] leading-tight antialiased"
                  style={{
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
                  }}
                >
                  {profile?.nome || user.email?.split("@")[0]}
                </p>
                <p
                  className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 antialiased"
                  style={{
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
                  }}
                >
                  {profile?.categoria || "Administrativo"}
                </p>
              </div>
              <div className="relative h-12 w-12 rounded-full border-2 border-white shadow-md overflow-hidden bg-[var(--color-geolog-blue)] flex items-center justify-center">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={profile.nome || "Avatar"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-black text-sm">
                    {profile?.nome?.[0]?.toUpperCase() ||
                      user.email?.[0]?.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-12 py-10 w-full">{children}</main>

        {/* Announcement Modal */}
        <AnnouncementModal
          onOpenEmployeesDropdown={() => setShowEmployees(true)}
          employeesButtonRef={employeesButtonRef}
          onStepChange={setAnnouncementStep}
        />

        {/* Overlay de bloqueio durante explicação */}
        {announcementStep === "explanation" && (
          <div
            className="fixed inset-0 z-[9995]"
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>

      {/* Chat Widget Flutuante */}
      <ChatWidget />
    </div>
  );
}

function NavLink({
  href,
  icon,
  label,
  active = false,
  collapsed = false,
}: {
  href: string;
  icon: ReactElement;
  label: string;
  active?: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : ""}
      className={`flex items-center ${collapsed ? "justify-center" : "gap-3 px-4"} py-3 rounded-xl transition-all font-bold text-sm relative group/link ${
        active
          ? "bg-white text-[var(--color-geolog-blue)] shadow-md"
          : "text-blue-200/80 hover:text-white hover:bg-white/10"
      }`}
    >
      <div
        className={`${active ? "scale-110" : "group-hover/link:translate-x-0.5 group-hover/link:scale-110"} transition-all duration-200`}
      >
        {cloneElement(icon as ReactElement<{ size?: number }>, { size: 20 })}
      </div>
      {!collapsed && <span className="whitespace-nowrap">{label}</span>}
      {active && !collapsed && (
        <div className="absolute right-4 w-2 h-2 bg-[var(--color-geolog-blue)] rounded-full" />
      )}
    </Link>
  );
}
