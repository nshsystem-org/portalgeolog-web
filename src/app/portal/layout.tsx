"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useRef, cloneElement, ReactElement } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { useUserPresence } from "@/hooks/useUserPresence";
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
  CheckCircle,
  Info,
  AlertTriangle,
  XCircle,
  Briefcase,
  User,
  Handshake,
} from "lucide-react";
import Link from "next/link";
import AnnouncementModal from "@/components/AnnouncementModal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading, logout } = useAuth();
  const { unreadCount, notifications, dismiss, dismissAll, realtimeConnected } =
    useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showEmployees, setShowEmployees] = useState(false);
  const [announcementStep, setAnnouncementStep] = useState<"intro" | "explanation" | "closed">("closed");
  const employeesButtonRef = useRef<HTMLButtonElement>(null);
  const { users: presenceUsers, onlineCount, loading: presenceLoading, getTimeAgo: getPresenceTimeAgo } = useUserPresence();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (announcementStep === "explanation") {
        return; // Bloqueia cliques fora durante explicação
      }
      if (showNotifications) {
        setShowNotifications(false);
      }
      if (showEmployees) {
        setShowEmployees(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showNotifications, showEmployees, announcementStep]);

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
          <NavLink
            href="/portal/financeiro"
            icon={<DollarSign />}
            label="Medição Financeira"
            active={pathname === "/portal/financeiro"}
            collapsed={collapsed}
          />
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
            {/* Funcionários Online */}
            <div className="relative">
              <button
                ref={employeesButtonRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmployees(!showEmployees);
                }}
                className="p-3 text-slate-400 hover:bg-slate-100 hover:text-[var(--color-geolog-blue)] rounded-xl relative transition-all border border-slate-100 cursor-pointer"
                title={`Funcionários online: ${onlineCount}`}
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
                      </div>
                    </div>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {presenceLoading ? (
                      <div className="p-8 text-center text-slate-400">
                        <Users size={32} className="mx-auto mb-2 opacity-50 animate-pulse" />
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
                              <img
                                src={u.avatar_url}
                                alt={u.nome}
                                className="w-10 h-10 rounded-full object-cover border border-slate-200"
                              />
                            ) : (
                              <span className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white text-xs font-black flex items-center justify-center border border-slate-200">
                                {u.nome.charAt(0).toUpperCase()}
                              </span>
                            )}
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${u.is_online ? "bg-green-500" : "bg-slate-300"}`}
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
                            {u.is_online ? (
                              <span className="text-[10px] font-black uppercase tracking-wider text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                Online
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
                                    {new Date(u.last_seen_at).toLocaleString("pt-BR", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                )}
                              </div>
                            )}
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
                onClick={() => setShowNotifications(!showNotifications)}
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
                <div className="absolute right-0 mt-2 w-[480px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-[9999] overflow-hidden">
                  <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-slate-800">
                          Notificações
                        </h3>
                        <div
                          className={`w-2 h-2 rounded-full ${
                            realtimeConnected
                              ? "bg-green-500"
                              : "bg-yellow-500 animate-pulse"
                          }`}
                        ></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">
                          {realtimeConnected ? "Tempo real" : "Conectando..."}
                        </span>
                        {unreadCount > 0 && (
                          <button
                            onClick={dismissAll}
                            className="text-xs text-blue-600 hover:text-blue-700 font-black"
                          >
                            Limpar todas
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="max-h-[520px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        <Bell size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhuma notificação</p>
                      </div>
                    ) : (
                      notifications.map((notification) => {
                        const iconConfig = {
                          success: {
                            icon: CheckCircle,
                            color: "text-green-500",
                            bg: "bg-green-50",
                          },
                          info: {
                            icon: Info,
                            color: "text-blue-500",
                            bg: "bg-blue-50",
                          },
                          warning: {
                            icon: AlertTriangle,
                            color: "text-amber-500",
                            bg: "bg-amber-50",
                          },
                          error: {
                            icon: XCircle,
                            color: "text-red-500",
                            bg: "bg-red-50",
                          },
                        };
                        const config =
                          iconConfig[notification.type] || iconConfig.info;
                        const IconComponent = config.icon;

                        // Detectar tipo de entidade pelo conteúdo
                        const content = (
                          notification.title +
                          " " +
                          notification.message
                        ).toLowerCase();
                        let EntityIcon = Info;
                        let entityColor = "text-slate-400";

                        if (
                          content.includes("os") ||
                          content.includes("ordem de serviço") ||
                          content.includes("serviço")
                        ) {
                          EntityIcon = FileText;
                          entityColor = "text-blue-400";
                        } else if (content.includes("cliente")) {
                          EntityIcon = Building;
                          entityColor = "text-indigo-400";
                        } else if (content.includes("parceiro")) {
                          EntityIcon = ShieldCheck;
                          entityColor = "text-purple-400";
                        } else if (content.includes("motorista")) {
                          EntityIcon = Truck;
                          entityColor = "text-orange-400";
                        } else if (content.includes("passageiro")) {
                          EntityIcon = User;
                          entityColor = "text-teal-400";
                        } else if (
                          content.includes("veículo") ||
                          content.includes("veiculo") ||
                          content.includes("frota")
                        ) {
                          EntityIcon = Truck;
                          entityColor = "text-cyan-400";
                        } else if (
                          content.includes("financeiro") ||
                          content.includes("fatura") ||
                          content.includes("pagamento")
                        ) {
                          EntityIcon = DollarSign;
                          entityColor = "text-emerald-400";
                        } else if (
                          content.includes("serviço") ||
                          content.includes("servico")
                        ) {
                          EntityIcon = Briefcase;
                          entityColor = "text-pink-400";
                        }

                        return (
                          <div
                            key={notification.id}
                            className="p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                            onClick={() => dismiss(notification.id)}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`p-2 rounded-xl ${config.bg} flex-shrink-0`}
                              >
                                <IconComponent
                                  size={20}
                                  className={config.color}
                                />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <EntityIcon
                                    size={14}
                                    className={`${entityColor} flex-shrink-0`}
                                  />
                                  <p className="font-black text-sm text-slate-800">
                                    {notification.title}
                                  </p>
                                </div>
                                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                                  {notification.message}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <p className="text-xs text-slate-400">
                                    {new Date(
                                      notification.created_at,
                                    ).toLocaleString("pt-BR")}
                                  </p>
                                  {notification.created_by_name && (
                                    <>
                                      <span className="text-xs text-slate-300">
                                        •
                                      </span>
                                      {notification.created_by_avatar_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={notification.created_by_avatar_url}
                                          alt={notification.created_by_name}
                                          className="w-6 h-6 rounded-full object-cover border border-slate-200"
                                        />
                                      ) : (
                                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center">
                                          {notification.created_by_name.charAt(0).toUpperCase()}
                                        </span>
                                      )}
                                      <p className="text-xs text-slate-500 font-medium">
                                        {notification.created_by_name}
                                      </p>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
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
          <div className="fixed inset-0 z-[9995]" onClick={(e) => e.stopPropagation()} />
        )}
      </div>
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
