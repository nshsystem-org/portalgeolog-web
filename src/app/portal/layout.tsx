"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import {
  hasPageAccess as checkPageAccess,
  pathnameToPageKey,
  type PageKey,
} from "@/lib/permissions";
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
  DollarSign,
  UserSquare2,
  Handshake,
  Info,
  CheckCircle,
  CircleCheckBig,
  FilePlus,
  AlertTriangle,
  XCircle,
  Archive,
  RotateCcw,
  Eye,
  Send,
  Flag,
  Navigation,
  Wallet,
  ClipboardList,
  Landmark,
  ChevronDown,
  Database,
  Shield,
  User,
  Percent,
  Package,
} from "lucide-react";
import Link from "next/link";
import AnnouncementModal from "@/components/AnnouncementModal";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import PendenciaWarnings from "@/components/PendenciaWarnings";
import PendenciaAlertModal, {
  shouldShowPendenciaAlert,
  type PendenciaAlertData,
} from "@/components/PendenciaAlertModal";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { getThumbnailUrl } from "@/utils/avatar";
import { getOperationalCycleTitle } from "@/lib/os-messages";
import {
  formatShortName,
  extractNotificationProtocolo,
  timeAgo,
} from "@/utils/notifications";
import MotoristaNotifications from "@/components/MotoristaNotifications";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading, logout } = useAuth();
  const [pendenciaAlertData, setPendenciaAlertData] =
    useState<PendenciaAlertData | null>(null);
  const [pendenciaDropdownSignal, setPendenciaDropdownSignal] = useState(0);
  const handlePendenciaAlert = useCallback(
    (counts: {
      semValor: number;
      atrasadas: number;
      docagens: number;
      total: number;
    }) => {
      if (!shouldShowPendenciaAlert(counts)) return;
      setPendenciaAlertData(counts);
    },
    [],
  );
  const {
    unreadCount,
    driverUnreadCount,
    systemNotifications,
    driverNotifications,
    markAsRead,
    markAllAsRead,
    realtimeConnected,
  } = useNotifications({ onPendenciaAlert: handlePendenciaAlert });
  const { displayVersion } = useAppVersion();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<
    "all" | "unread" | "read"
  >("all");
  const [showNotificationSettings, setShowNotificationSettings] =
    useState(false);
  const relativeTimeNow = useRelativeTimeTicker(showNotifications);
  const filteredNotifications = useMemo(() => {
    if (notificationFilter === "unread")
      return systemNotifications.filter((n) => !n.read);
    if (notificationFilter === "read")
      return systemNotifications.filter((n) => n.read);
    return systemNotifications;
  }, [systemNotifications, notificationFilter]);

  const preloadedAvatarsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!showNotifications) return;

    const avatarUrls = filteredNotifications
      .map((n) => n.created_by_avatar_url)
      .filter(
        (url): url is string => !!url && !preloadedAvatarsRef.current.has(url),
      );

    avatarUrls.forEach((url) => {
      const img = document.createElement("img");
      img.src = getThumbnailUrl(url, 100) || url;
      preloadedAvatarsRef.current.add(url);
    });
  }, [showNotifications, filteredNotifications]);

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
  const [openSections, setOpenSections] = useState<
    Record<
      "operacional" | "financeiro" | "cadastros" | "configuracoes",
      boolean
    >
  >({
    operacional: false,
    financeiro: false,
    cadastros: false,
    configuracoes: false,
  });

  // Mapa de rotas por seção para auto-abrir a seção ativa
  const sectionRoutes: Record<
    "operacional" | "financeiro" | "cadastros" | "configuracoes",
    readonly string[]
  > = {
    operacional: ["/portal/os"],
    financeiro: ["/portal/financeiro", "/portal/caixa"],
    cadastros: [
      "/portal/motoristas",
      "/portal/veiculos",
      "/portal/passageiros",
      "/portal/clientes",
      "/portal/parcerias",
      "/portal/fornecedores",
    ],
    configuracoes: [
      "/portal/config",
      "/portal/config/acessos",
      "/portal/config/perfil",
      "/portal/config/financeiro",
      "/portal/config/notificacoes",
    ],
  };

  // Auto-abrir a seção que contém a rota ativa
  useEffect(() => {
    setOpenSections((prev) => {
      const next = { ...prev };
      (Object.keys(sectionRoutes) as (keyof typeof sectionRoutes)[]).forEach(
        (section) => {
          if (sectionRoutes[section].includes(pathname)) {
            next[section] = true;
          }
        },
      );
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Ao colapsar o sidebar, fechar todas as seções exceto a ativa.
  // Ao expandir novamente, só a seção da página atual aparece aberta.
  useEffect(() => {
    if (collapsed) {
      setOpenSections({
        operacional: sectionRoutes.operacional.includes(pathname),
        financeiro: sectionRoutes.financeiro.includes(pathname),
        cadastros: sectionRoutes.cadastros.includes(pathname),
        configuracoes: sectionRoutes.configuracoes.includes(pathname),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  // Seção que contém a rota atual (sempre fica aberta)
  const activeSection = useMemo(() => {
    return (Object.keys(sectionRoutes) as (keyof typeof sectionRoutes)[]).find(
      (section) => sectionRoutes[section].includes(pathname),
    );
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSection = useCallback(
    (
      section: "operacional" | "financeiro" | "cadastros" | "configuracoes",
    ) => {
      // Se o sidebar estiver colapsado, expandir e abrir a seção
      if (collapsed) {
        setCollapsed(false);
        setOpenSections((s) => ({ ...s, [section]: true }));
        return;
      }
      // Ao abrir uma seção, fechar todas as outras (exceto a ativa da página)
      setOpenSections((s) => {
        const willOpen = !s[section];
        if (!willOpen) {
          // Fechando: só se não for a seção ativa
          if (section === activeSection) return s;
          return { ...s, [section]: false };
        }
        // Abrindo: fechar as outras, manter a ativa
        const next = {
          operacional: false,
          financeiro: false,
          cadastros: false,
          configuracoes: false,
        };
        next[section] = true;
        if (activeSection) next[activeSection] = true;
        return next;
      });
    },
    [collapsed, activeSection],
  );

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Função helper para verificar permissões de página (delegada ao módulo central)
  const hasPageAccess = useCallback(
    (page: string): boolean => checkPageAccess(profile, page as PageKey),
    [profile],
  );

  // Verificar se o usuário tem acesso à página atual (guard global)
  useEffect(() => {
    if (!profile || loading) return;

    const pageKey = pathnameToPageKey(pathname);
    if (!pageKey) return; // rota não mapeada, não interferir

    if (!hasPageAccess(pageKey)) {
      toast.warning("Você não tem acesso a esta página. Redirecionando...");
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
  }, [
    showNotifications,
    showNotificationSettings,
    showEmployees,
    announcementStep,
  ]);

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
          <div className="flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Geolog Logo" className="h-10 w-auto" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-none">
              <span className="text-base font-black text-white tracking-wide whitespace-nowrap">
                Portal Geolog
              </span>
              {displayVersion && (
                <span className="mt-1 text-[10px] font-bold text-blue-300/60 tracking-wider whitespace-nowrap">
                  {displayVersion}
                </span>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2 mt-4 overflow-y-auto overflow-x-hidden">
          <NavLink
            href="/portal/dashboard"
            icon={<LayoutDashboard />}
            label="Dashboard"
            active={pathname === "/portal/dashboard"}
            collapsed={collapsed}
          />

          <div
            className={`h-px bg-blue-800/40 ${collapsed ? "mx-1 my-1" : "mx-2 my-2"}`}
          />

          {hasPageAccess("os") && (
            <NavSection
              id="operacional"
              icon={<ClipboardList />}
              label="Operacional"
              collapsed={collapsed}
              isOpen={openSections.operacional}
              onToggle={() => toggleSection("operacional")}
              pathname={pathname}
              accentColor="text-amber-400"
              items={[
                {
                  href: "/portal/os",
                  icon: <FileText />,
                  label: "Ordem de Serviço",
                },
              ]}
            />
          )}

          {(hasPageAccess("motoristas") ||
            hasPageAccess("veiculos") ||
            hasPageAccess("passageiros") ||
            hasPageAccess("clientes") ||
            hasPageAccess("parcerias") ||
            hasPageAccess("fornecedores")) && (
            <NavSection
              id="cadastros"
              icon={<Database />}
              label="Cadastros"
              collapsed={collapsed}
              isOpen={openSections.cadastros}
              onToggle={() => toggleSection("cadastros")}
              pathname={pathname}
              accentColor="text-violet-400"
              items={[
                hasPageAccess("motoristas") && {
                  href: "/portal/motoristas",
                  icon: <Users />,
                  label: "Motoristas",
                },
                hasPageAccess("veiculos") && {
                  href: "/portal/veiculos",
                  icon: <Truck />,
                  label: "Veículos",
                },
                hasPageAccess("passageiros") && {
                  href: "/portal/passageiros",
                  icon: <UserSquare2 />,
                  label: "Passageiros",
                },
                hasPageAccess("clientes") && {
                  href: "/portal/clientes",
                  icon: <Building />,
                  label: "Clientes",
                },
                hasPageAccess("parcerias") && {
                  href: "/portal/parcerias",
                  icon: <Handshake />,
                  label: "Parceiros de Serviço",
                },
                hasPageAccess("fornecedores") && {
                  href: "/portal/fornecedores",
                  icon: <Package />,
                  label: "Fornecedores",
                },
              ].filter(Boolean) as {
                href: string;
                icon: ReactElement;
                label: string;
              }[]}
            />
          )}

          {(hasPageAccess("financeiro") || hasPageAccess("caixa")) && (
            <NavSection
              id="financeiro"
              icon={<Landmark />}
              label="Financeiro"
              collapsed={collapsed}
              isOpen={openSections.financeiro}
              onToggle={() => toggleSection("financeiro")}
              pathname={pathname}
              accentColor="text-emerald-400"
              items={[
                hasPageAccess("financeiro") && {
                  href: "/portal/financeiro",
                  icon: <DollarSign />,
                  label: "Medição Financeira",
                },
                hasPageAccess("caixa") && {
                  href: "/portal/caixa",
                  icon: <Wallet />,
                  label: "Fluxo de Caixa",
                },
              ].filter(Boolean) as {
                href: string;
                icon: ReactElement;
                label: string;
              }[]}
            />
          )}

          {(hasPageAccess("config-acessos") ||
            hasPageAccess("config-perfil") ||
            hasPageAccess("config-financeiro") ||
            hasPageAccess("config-notificacoes")) && (
            <NavSection
              id="configuracoes"
              icon={<Settings />}
              label="Configurações"
              collapsed={collapsed}
              isOpen={openSections.configuracoes}
              onToggle={() => toggleSection("configuracoes")}
              pathname={pathname}
              accentColor="text-sky-400"
              items={[
                hasPageAccess("config-acessos") && {
                  href: "/portal/config/acessos",
                  icon: <Shield />,
                  label: "Gestão de Acessos",
                },
                hasPageAccess("config-perfil") && {
                  href: "/portal/config/perfil",
                  icon: <User />,
                  label: "Meu Perfil",
                },
                hasPageAccess("config-financeiro") && {
                  href: "/portal/config/financeiro",
                  icon: <Percent />,
                  label: "Financeiro",
                },
                hasPageAccess("config-notificacoes") && {
                  href: "/portal/config/notificacoes",
                  icon: <Bell />,
                  label: "Notificações",
                },
              ].filter(Boolean) as {
                href: string;
                icon: ReactElement;
                label: string;
              }[]}
            />
          )}
        </nav>

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
                    : pathname.includes("/caixa")
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
                        : pathname.includes("/caixa")
                          ? "Fluxo de Caixa"
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

            {/* Avisos de Pendências (sem valor + atrasadas + rascunhos) */}
            <PendenciaWarnings externalOpenSignal={pendenciaDropdownSignal} />

            {/* Movimentações de Motoristas (azul) — separado do sino de sistema */}
            <MotoristaNotifications
              notifications={driverNotifications}
              unreadCount={driverUnreadCount}
              markAsRead={markAsRead}
              markAllAsRead={() => markAllAsRead("motorista")}
            />

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
              </button>

              {showEmployees && (
                <div className="absolute right-0 mt-2 w-[380px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-[9999] overflow-hidden">
                  <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-xl text-slate-800">
                        Funcionários
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-sm text-slate-500 font-bold">
                          {onlineCount} online
                        </span>
                        {activeNowCount > 0 && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-sm text-emerald-600 font-black">
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
                        <p className="text-base">Carregando...</p>
                      </div>
                    ) : presenceUsers.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        <Users size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-base">
                          Nenhum funcionário encontrado
                        </p>
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
                                src={getThumbnailUrl(u.avatar_url, 80) || ""}
                                alt={u.nome}
                                width={40}
                                height={40}
                                unoptimized
                                className="w-10 h-10 rounded-full object-cover border border-slate-200"
                              />
                            ) : (
                              <span className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white text-lg font-black flex items-center justify-center border border-slate-200">
                                {u.nome.charAt(0).toUpperCase()}
                              </span>
                            )}
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${u.is_active_now ? "bg-emerald-500" : u.is_online ? "bg-green-400" : "bg-slate-300"}`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-bold text-slate-800 truncate">
                              {u.nome}
                            </p>
                            <p className="text-sm text-slate-500 capitalize">
                              {u.categoria}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {u.is_active_now ? (
                              <span className="text-xs font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                                Ativo agora
                              </span>
                            ) : u.is_online ? (
                              <span className="text-xs leading-none font-black uppercase tracking-wider text-blue-400 bg-blue-50 px-2 py-1 rounded-full">
                                {getPresenceStatusLabel(u)}
                              </span>
                            ) : (
                              <div className="text-right">
                                <span className="text-xs font-bold text-slate-400 block">
                                  {u.last_seen_at
                                    ? getPresenceTimeAgo(u.last_seen_at)
                                    : "Nunca ativo"}
                                </span>
                                {u.last_seen_at && (
                                  <span className="text-xs text-slate-400 block">
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
              </button>

              {showNotifications && (
                <div
                  ref={notificationsDropdownRef}
                  className="absolute right-0 mt-2 w-[400px] bg-white rounded-2xl shadow-2xl z-[9999] overflow-hidden border border-slate-100"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <h3 className="font-black text-xl text-slate-800">
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
                            className={`px-2.5 py-1 rounded-md text-sm font-bold transition-all cursor-pointer ${
                              notificationFilter === f
                                ? "bg-white text-slate-800 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            {f === "all"
                              ? "Todas"
                              : f === "unread"
                                ? "Não lidas"
                                : "Lidas"}
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowNotificationSettings(
                              !showNotificationSettings,
                            );
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Opções"
                        >
                          <Settings size={16} />
                        </button>
                        {showNotificationSettings && (
                          <div
                            ref={notificationSettingsRef}
                            className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-[10000]"
                          >
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                markAllAsRead("sistema");
                                setShowNotificationSettings(false);
                              }}
                              disabled={unreadCount === 0}
                              className="w-full text-left px-3 py-2 text-base font-medium text-slate-700 hover:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
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
                        <p className="text-base">Nenhuma notificação</p>
                      </div>
                    ) : (
                      filteredNotifications.map((notification) => {
                        const { protocolo } = extractNotificationProtocolo(
                          notification.message,
                          notification.metadata,
                        );

                        const chips =
                          notification.metadata?.changed_fields_list;
                        const hasChips =
                          Array.isArray(chips) && chips.length > 0;

                        const isDriverNotify = notification.title.startsWith(
                          "Mensagem enviada ao motorista",
                        );
                        // Extrai o nome do motorista da mensagem (não do título)
                        // Mensagem: "{Operador} enviou uma mensagem de serviço para o motorista {Nome}."
                        const driverNameMatch = notification.message.match(
                          /para o motorista (.+?)\./,
                        );
                        const driverFullName = driverNameMatch
                          ? driverNameMatch[1].trim()
                          : "";
                        const driverNameParts = driverFullName
                          .split(" ")
                          .filter(Boolean);
                        const driverShortName =
                          driverNameParts.length > 1
                            ? `${driverNameParts[0]} ${driverNameParts[driverNameParts.length - 1]}`
                            : driverFullName;

                        const isDriverDelivered =
                          notification.title ===
                          "Mensagem entregue ao motorista";

                        const isDriverViewDetails =
                          notification.title ===
                          "Motorista visualizou os detalhes do atendimento";

                        const isDriverStart =
                          notification.title === "Rota iniciada";
                        const isDriverFinish =
                          notification.title === "Rota finalizada";
                        const isDriverUpdate =
                          notification.title === "Motorista atualizado";

                        const notifCycleKind = notification.metadata
                          ?.cycle_kind as string | undefined;
                        const notifCycleOrdinal = notification.metadata
                          ?.cycle_ordinal as number | undefined;
                        const notifCycleDesc = notifCycleKind
                          ? getOperationalCycleTitle({
                              kind: notifCycleKind as "itinerary" | "return",
                              ordinal: (notifCycleOrdinal ?? 1) as number,
                            }).replace(" - ", " ")
                          : null;
                        const notifCycleIsReturn = notifCycleKind === "return";

                        const actionText =
                          notification.title === "Novo atendimento"
                            ? "cadastrou um novo atendimento"
                            : notification.title === "Atendimento atualizado"
                              ? "atualizou um atendimento"
                              : notification.title === "Atendimento finalizado"
                                ? "finalizou um atendimento"
                                : notification.title === "Atendimento arquivado"
                                  ? "arquivou um atendimento"
                                  : notification.title ===
                                      "Atendimento reaberto"
                                    ? "reabriu um atendimento"
                                    : notification.title ===
                                        "Dia de docagem resetado"
                                      ? `docagem do dia ${notification.metadata?.data ?? ""} foi resetada`
                                      : notification.title ===
                                          "Dia de docagem finalizado"
                                        ? `docagem do dia ${notification.metadata?.data ?? ""} foi finalizada`
                                        : notification.title ===
                                            "Dia de docagem reativado"
                                          ? `docagem do dia ${notification.metadata?.data ?? ""} foi reativada`
                                          : notification.title ===
                                              "Dia de docagem excluído"
                                            ? `docagem do dia ${notification.metadata?.data ?? ""} foi excluída`
                                            : notification.title ===
                                                "Nova docagem"
                                              ? "criou uma docagem"
                                              : notification.title ===
                                                  "Docagem cancelada"
                                                ? "cancelou uma docagem"
                                                : notification.title ===
                                                    "Novo Centro de Custo"
                                                  ? "criou um novo Centro de Custo"
                                                  : isDriverNotify
                                                    ? "enviou uma mensagem de serviço para o motorista"
                                                    : isDriverDelivered
                                                      ? "recebeu a mensagem com sucesso"
                                                      : isDriverViewDetails
                                                        ? notifCycleDesc
                                                          ? "visualizou os detalhes do atendimento"
                                                          : "visualizou os detalhes do atendimento"
                                                        : isDriverStart
                                                          ? notifCycleDesc
                                                            ? "iniciou a rota do"
                                                            : "iniciou a rota"
                                                          : isDriverFinish
                                                            ? notifCycleDesc
                                                              ? "finalizou a rota do"
                                                              : "finalizou a rota"
                                                            : isDriverUpdate
                                                              ? notification.message
                                                              : notification.title.toLowerCase();

                        const renderActionContent = () => {
                          const kmText = (() => {
                            if (
                              isDriverStart &&
                              notification.metadata?.km_initial
                            ) {
                              return ` com KM inicial ${notification.metadata.km_initial}`;
                            }
                            if (
                              isDriverFinish &&
                              notification.metadata?.km_final
                            ) {
                              return ` com KM final ${notification.metadata.km_final}`;
                            }
                            return "";
                          })();

                          if (isDriverViewDetails && notifCycleDesc) {
                            return (
                              <>
                                {actionText}{" "}
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider border ${
                                    notifCycleIsReturn
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}
                                >
                                  {notifCycleDesc}
                                </span>
                              </>
                            );
                          }

                          if (
                            (isDriverStart || isDriverFinish) &&
                            notifCycleDesc
                          ) {
                            return (
                              <>
                                {actionText}{" "}
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider border ${
                                    notifCycleIsReturn
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}
                                >
                                  {notifCycleDesc}
                                </span>
                                {kmText}
                              </>
                            );
                          }

                          const docagemDayTitles = [
                            "Dia de docagem resetado",
                            "Dia de docagem finalizado",
                            "Dia de docagem reativado",
                            "Dia de docagem excluído",
                          ] as const;
                          if (
                            docagemDayTitles.includes(
                              notification.title as (typeof docagemDayTitles)[number],
                            )
                          ) {
                            const rawDate = notification.metadata?.data as
                              | string
                              | undefined;
                            const formattedDate = rawDate
                              ? rawDate.split("-").reverse().join("/")
                              : "";
                            const acao =
                              notification.title === "Dia de docagem resetado"
                                ? "resetada"
                                : notification.title ===
                                    "Dia de docagem finalizado"
                                  ? "finalizada"
                                  : notification.title ===
                                      "Dia de docagem reativado"
                                    ? "reativada"
                                    : "excluída";
                            return (
                              <>
                                docagem do dia{" "}
                                <span
                                  className={`font-bold ${
                                    !notification.read
                                      ? "text-slate-900"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {formattedDate}
                                </span>{" "}
                                foi {acao}
                              </>
                            );
                          }

                          return <>{actionText}</>;
                        };

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
                                  return {
                                    icon: FilePlus,
                                    bg: "bg-green-500",
                                    text: "text-white",
                                  };
                                if (
                                  t === "Atendimento atualizado" ||
                                  t === "Status do atendimento atualizado"
                                )
                                  return {
                                    icon: Info,
                                    bg: "bg-blue-500",
                                    text: "text-white",
                                  };
                                if (t === "Atendimento finalizado")
                                  return {
                                    icon: CircleCheckBig,
                                    bg: "bg-emerald-500",
                                    text: "text-white",
                                  };
                                if (
                                  t === "Atendimento arquivado" ||
                                  t === "OS Arquivada"
                                )
                                  return {
                                    icon: Archive,
                                    bg: "bg-red-500",
                                    text: "text-white",
                                  };
                                if (
                                  t === "Atendimento reaberto" ||
                                  t === "OS Reaberta"
                                )
                                  return {
                                    icon: RotateCcw,
                                    bg: "bg-blue-500",
                                    text: "text-white",
                                  };
                                if (t === "Mensagem entregue ao motorista")
                                  return {
                                    icon: CheckCircle,
                                    bg: "bg-green-500",
                                    text: "text-white",
                                  };
                                if (t === "Motorista atualizado")
                                  return {
                                    icon: UserSquare2,
                                    bg: "bg-blue-500",
                                    text: "text-white",
                                  };
                                if (
                                  t ===
                                  "Motorista visualizou os detalhes do atendimento"
                                )
                                  return {
                                    icon: Eye,
                                    bg: "bg-orange-500",
                                    text: "text-white",
                                  };
                                if (
                                  t.startsWith("Mensagem enviada ao motorista")
                                )
                                  return {
                                    icon: Send,
                                    bg: "bg-sky-400",
                                    text: "text-white",
                                  };
                                if (t === "Rota finalizada")
                                  return {
                                    icon: Flag,
                                    bg: "bg-green-500",
                                    text: "text-white",
                                  };
                                if (t === "Rota iniciada")
                                  return {
                                    icon: Navigation,
                                    bg: "bg-blue-600",
                                    text: "text-white",
                                  };
                                if (t === "Novo Centro de Custo")
                                  return {
                                    icon: Building,
                                    bg: "bg-indigo-500",
                                    text: "text-white",
                                  };
                                switch (notification.type) {
                                  case "success":
                                    return {
                                      icon: CheckCircle,
                                      bg: "bg-green-500",
                                      text: "text-white",
                                    };
                                  case "warning":
                                    return {
                                      icon: AlertTriangle,
                                      bg: "bg-red-500",
                                      text: "text-white",
                                    };
                                  case "error":
                                    return {
                                      icon: XCircle,
                                      bg: "bg-red-500",
                                      text: "text-white",
                                    };
                                  default:
                                    return {
                                      icon: Info,
                                      bg: "bg-blue-500",
                                      text: "text-white",
                                    };
                                }
                              })();
                              const BadgeIcon = badgeConfig.icon;
                              return (
                                <div className="relative flex-shrink-0">
                                  {notification.created_by_avatar_url ? (
                                    <img
                                      src={
                                        getThumbnailUrl(
                                          notification.created_by_avatar_url,
                                          100,
                                        ) || ""
                                      }
                                      alt={formatShortName(
                                        notification.created_by_name,
                                      )}
                                      className="w-14 h-14 rounded-full object-cover border border-slate-200"
                                    />
                                  ) : (
                                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white text-lg font-black flex items-center justify-center">
                                      {formatShortName(
                                        notification.created_by_name,
                                      )
                                        .charAt(0)
                                        .toUpperCase() || "?"}
                                    </div>
                                  )}
                                  <span
                                    className={`absolute -bottom-0.5 -right-0.5 w-6 h-6 ${badgeConfig.bg} ${badgeConfig.text} rounded-full flex items-center justify-center border-2 border-white shadow-sm`}
                                  >
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
                                    className={`text-base font-bold ${
                                      !notification.read
                                        ? "text-slate-900"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {formatShortName(
                                      notification.created_by_name,
                                    )}
                                  </span>
                                )}{" "}
                                <span
                                  className={`text-sm ${!notification.read ? "text-slate-700" : "text-slate-400"}`}
                                >
                                  {renderActionContent()}
                                </span>
                                {isDriverNotify && driverShortName && (
                                  <span className="inline-flex items-center gap-1.5 ml-2">
                                    <Truck
                                      size={12}
                                      className={`${!notification.read ? "text-blue-700" : "text-slate-400"}`}
                                    />
                                    <span
                                      className={`text-sm font-bold ${!notification.read ? "text-blue-800" : "text-slate-400"}`}
                                    >
                                      {driverShortName}
                                    </span>
                                  </span>
                                )}
                              </p>

                              {/* Chips */}
                              {hasChips && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {chips.map((chip) => (
                                    <span
                                      key={String(chip)}
                                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${!notification.read ? "bg-sky-100/70 text-sky-700" : "bg-slate-100/70 text-slate-400"}`}
                                    >
                                      {String(chip)}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Meta */}
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span
                                  className={`text-sm ${!notification.read ? "text-slate-600" : "text-slate-400"}`}
                                >
                                  {timeAgo(
                                    notification.created_at,
                                    relativeTimeNow,
                                  )}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span
                                  className={`text-sm ${!notification.read ? "text-slate-600" : "text-slate-400"} capitalize`}
                                >
                                  {notification.type === "success"
                                    ? "Cadastro"
                                    : notification.type === "info"
                                      ? "Atualização"
                                      : "Alerta"}
                                </span>
                                {protocolo && (
                                  <>
                                    <span className="text-slate-300">•</span>
                                    <span
                                      className={`text-sm ${!notification.read ? "text-slate-600" : "text-slate-400"}`}
                                    >
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
                    src={getThumbnailUrl(profile.avatar_url, 80) || ""}
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

        {/* Modal bloqueante de alerta de pendências (cron 2h) */}
        <PendenciaAlertModal
          data={pendenciaAlertData}
          onClose={() => setPendenciaAlertData(null)}
          onReview={() => setPendenciaDropdownSignal((s) => s + 1)}
          userName={profile?.nome}
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
  variant = "primary",
}: {
  href: string;
  icon: ReactElement;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  variant?: "primary" | "subitem";
}) {
  const isPrimary = variant === "primary";

  // Cores dos 4 itens principais (Dashboard + headers) — mais chamativas
  // Subitens (dentro dos accordions) — mais discretos
  const activeClasses = isPrimary
    ? "bg-sky-400 text-[var(--color-geolog-blue)] shadow-md shadow-sky-500/30"
    : "bg-white/15 text-white";
  const inactiveClasses = isPrimary
    ? "text-blue-100 hover:text-white hover:bg-white/10"
    : "text-blue-300/60 hover:text-blue-100 hover:bg-white/5";
  const iconSize = isPrimary ? 20 : 16;
  const fontWeight = isPrimary ? "font-bold" : "font-medium";
  const padding = isPrimary ? "py-3" : "py-2";
  const labelColor = isPrimary
    ? "text-blue-50 group-hover/link:text-white"
    : "text-blue-200/50 group-hover/link:text-blue-100";

  return (
    <Link
      href={href}
      title={collapsed ? label : ""}
      className={`flex items-center ${collapsed ? "justify-center" : "gap-3 px-4"} ${padding} rounded-xl transition-all ${fontWeight} text-sm relative group/link ${active ? activeClasses : inactiveClasses}`}
    >
      <div
        className={`${active ? "scale-110 text-inherit" : "group-hover/link:translate-x-0.5 group-hover/link:scale-110 text-blue-300 group-hover/link:text-white"} transition-all duration-200`}
      >
        {cloneElement(icon as ReactElement<{ size?: number }>, { size: iconSize })}
      </div>
      {!collapsed && (
        <span
          className={`whitespace-nowrap ${active ? "text-inherit" : labelColor}`}
        >
          {label}
        </span>
      )}
      {active && !collapsed && (
        <div
          className={`absolute right-4 w-2 h-2 rounded-full ${isPrimary ? "bg-[var(--color-geolog-blue)]" : "bg-white"}`}
        />
      )}
    </Link>
  );
}

function NavSection({
  id,
  icon,
  label,
  items,
  collapsed,
  isOpen,
  onToggle,
  pathname,
  accentColor = "text-blue-300",
}: {
  id: string;
  icon: ReactElement;
  label: string;
  items: { href: string; icon: ReactElement; label: string }[];
  collapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  pathname: string;
  accentColor?: string;
}) {
  const hasActive = items.some((item) => pathname === item.href);

  // Estado colapsado (w-20): mostra apenas o ícone da categoria.
  // Clicar expande o sidebar e abre a seção (handled pelo onToggle do parent).
  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        title={label}
        aria-label={label}
        aria-expanded={isOpen}
        className={`flex items-center justify-center w-full py-3 rounded-xl transition-all font-bold text-sm relative group/section ${
          hasActive
            ? "bg-white/15 text-white"
            : "text-blue-100 hover:text-white hover:bg-white/10"
        }`}
      >
        <div
          className={`transition-all duration-200 group-hover/section:scale-110 ${hasActive ? accentColor : accentColor}`}
        >
          {cloneElement(icon as ReactElement<{ size?: number }>, { size: 20 })}
        </div>
        {hasActive && (
          <div className="absolute right-2 w-2 h-2 bg-white rounded-full" />
        )}
      </button>
    );
  }

  // Estado expandido (w-72): accordion com header clicável.
  return (
    <div className="space-y-1" data-section={id}>
      <button
        onClick={onToggle}
        aria-label={label}
        aria-expanded={isOpen}
        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all font-black text-xs uppercase tracking-wider relative group/section ${
          hasActive
            ? "text-white bg-white/10"
            : "text-blue-100 hover:text-white hover:bg-white/10"
        }`}
      >
        <div
          className={`transition-all ${hasActive ? "text-white" : accentColor}`}
        >
          {cloneElement(icon as ReactElement<{ size?: number }>, { size: 18 })}
        </div>
        <span className="whitespace-nowrap group-hover/section:text-white">
          {label}
        </span>
        <ChevronDown
          size={16}
          className={`ml-auto transition-transform duration-200 text-blue-300/70 group-hover/section:text-white ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="space-y-1 ml-4 pl-3 border-l border-blue-800/40">
          {items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={pathname === item.href}
              collapsed={false}
              variant="subitem"
            />
          ))}
        </div>
      )}
    </div>
  );
}
