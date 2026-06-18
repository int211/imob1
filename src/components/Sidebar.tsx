import { Home, Building2, SearchCode, Compass, Heart, ShieldAlert, User, CheckCircle, Clock, LogOut, Globe, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Corretor } from "../types";

type ActiveTab = "inicio" | "imoveis" | "procuras" | "matches" | "favoritos" | "perfil" | "admin" | "globocatalogo";

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  broker: Corretor | null;
  unreadNotificationsCount: number;
  matchesCount: number;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
  globalCatalogEnabled?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, broker, unreadNotificationsCount, matchesCount, onLogout, isOpen, onClose, globalCatalogEnabled, collapsed, onToggleCollapse }: SidebarProps) {
  const menuItems = [
    { id: "inicio", label: "Início", icon: Home },
    { id: "imoveis", label: "Meus Imóveis", icon: Building2 },
    { id: "procuras", label: "Procuras (Demandas)", icon: SearchCode },
    { id: "matches", label: "Matches de Parceria", icon: Compass, badge: matchesCount },
    { id: "favoritos", label: "Favoritos", icon: Heart },
    { id: "perfil", label: "Meu Perfil & CRECI", icon: User },
  ];

  if (globalCatalogEnabled) {
    menuItems.push({ id: "globocatalogo", label: "Catálogo Global", icon: Globe });
  }

  const sidebarWidth = collapsed ? 'w-16' : 'w-64';

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 dark:bg-black/70 md:hidden" onClick={onClose} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-30 flex ${sidebarWidth} flex-col border-r border-[#e8e8ed] dark:border-dark-border bg-[#f5f5f7] dark:bg-dark-bg text-[#1d1d1f] dark:text-dark-text font-sans antialiased transition-all duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-2.5 border-b border-[#e8e8ed] dark:border-dark-border px-4 bg-[#f5f5f7] dark:bg-dark-bg">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1d1d1f] font-extrabold text-[13px] text-white tracking-widest">
          CC
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-[#1d1d1f] leading-none">ConectaCorretor</h1>
            <span className="text-[9px] font-bold text-[#86868b] uppercase tracking-wider leading-none block mt-1">Marketplace B2B</span>
          </div>
        )}
      </div>

      {/* User Information Display */}
      {!collapsed && broker ? (
        <div className="p-4 mx-3 my-4 rounded-xl bg-white dark:bg-dark-card border border-[#e8e8ed] dark:border-dark-border">
          <div className="flex items-center gap-3">
            {broker.photoUrl ? (
              <img
                src={broker.photoUrl}
                alt={broker.name}
                referrerPolicy="no-referrer"
                className="h-9 w-9 rounded-full object-cover border border-[#e8e8ed]"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1d1d1f] text-xs font-bold text-white">
                {broker.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-extrabold text-[#1d1d1f] leading-tight">{broker.name}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[10px] font-medium text-[#86868b] truncate">{broker.creci}</span>
                {broker.status === "Aprovado" ? (
                  <CheckCircle className="h-3 w-3 text-[#0071e3] shrink-0" />
                ) : broker.status === "Pendente" ? (
                  <Clock className="h-3 w-3 text-[#ff9500] shrink-0" />
                ) : null}
              </div>
            </div>
          </div>

                {broker.status !== "Aprovado" && (
            <div className="mt-3.5 rounded-lg bg-[#fff9f2] dark:bg-amber-900/20 p-2 text-center border border-[#ffe0b2] dark:border-amber-700/50">
              <p className="text-[10px] text-[#ff9500] font-bold leading-normal">
                Aguardando verificação do CRECI
              </p>
            </div>
          )}
        </div>
      ) : collapsed && broker ? (
        <div className="flex justify-center my-4">
          {broker.photoUrl ? (
            <img src={broker.photoUrl} alt={broker.name} referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover border border-[#e8e8ed]" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1d1d1f] text-xs font-bold text-white">
              {broker.name.charAt(0)}
            </div>
          )}
        </div>
      ) : !collapsed ? (
        <div className="p-4 mx-3 my-4 rounded-xl bg-[#e8e8ed] animate-pulse h-16" />
      ) : null}

      {/* Menu Options */}
      <nav className="flex-1 space-y-1 px-2 py-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id as ActiveTab); onClose(); }}
              title={collapsed ? item.label : undefined}
              className={`flex w-full items-center ${collapsed ? 'justify-center' : 'justify-between'} rounded-lg ${collapsed ? 'px-0 py-2.5' : 'px-3.5 py-2.5'} text-xs font-semibold transition-all duration-150 cursor-pointer ${
                isActive
                  ? "bg-[#1d1d1f] dark:bg-dark-card text-white shadow-none"
                  : "text-[#515154] dark:text-dark-muted hover:bg-[#e8e8ed] dark:hover:bg-gray-800 hover:text-[#1d1d1f] dark:hover:text-dark-text"
              }`}
            >
              {collapsed ? (
                <div className="relative">
                  <Icon className={`h-5 w-5 ${isActive ? "text-white" : "text-[#86868b] dark:text-dark-muted"}`} />
                  {item.badge && item.badge > 0 ? (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[8px] font-bold bg-[#0071e3] text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4.5 w-4.5 ${isActive ? "text-white" : "text-[#86868b] dark:text-dark-muted"}`} />
                    <span className="tracking-tight">{item.label}</span>
                  </div>
                  {item.badge && item.badge > 0 ? (
                    <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 text-[9px] font-bold ${
                      isActive ? "bg-white text-[#1d1d1f]" : "bg-[#0071e3] text-white"
                    }`}>
                      {item.badge}
                    </span>
                  ) : null}
                </>
              )}
            </button>
          );
        })}

        {/* Administrator Access */}
        {broker?.isAdmin && (
          <div className={`pt-4 border-t border-[#e8e8ed] mt-4 ${collapsed ? '' : ''}`}>
            {!collapsed && <span className="px-4 text-[9px] font-bold text-[#86868b] dark:text-dark-muted uppercase tracking-widest block mb-2">Administração</span>}
            <button
              onClick={() => { setActiveTab("admin"); onClose(); }}
              title={collapsed ? "Painel de Verificações" : undefined}
              className={`flex w-full items-center ${collapsed ? 'justify-center' : 'gap-3'} rounded-lg ${collapsed ? 'px-0 py-2.5' : 'px-3.5 py-2.5'} text-xs font-semibold transition-all duration-150 cursor-pointer ${
                activeTab === "admin"
                  ? "bg-[#0071e3] text-white shadow-none"
                  : "text-[#515154] dark:text-dark-muted hover:bg-[#e8e8ed] dark:hover:bg-gray-800 hover:text-[#1d1d1f] dark:hover:text-dark-text"
              }`}
            >
              <ShieldAlert className={`${collapsed ? 'h-5 w-5' : 'h-4.5 w-4.5'} shrink-0`} />
              {!collapsed && <span>Painel de Verificações</span>}
            </button>
          </div>
        )}
      </nav>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden md:flex border-t border-[#e8e8ed] dark:border-dark-border">
        <button
          onClick={onToggleCollapse}
          className="flex w-full items-center justify-center gap-2 py-3 text-[11px] font-semibold text-[#86868b] dark:text-dark-muted hover:text-[#1d1d1f] dark:hover:text-dark-text hover:bg-[#e8e8ed] dark:hover:bg-gray-800 transition cursor-pointer"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>

      {/* Lower Footer branding */}
      <div className="border-t border-[#e8e8ed] dark:border-dark-border p-3 text-center space-y-2">
        <button
          onClick={onLogout}
          title={collapsed ? "Sair da conta" : undefined}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold text-red-500 hover:bg-red-50 transition cursor-pointer`}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && "Sair da conta"}
        </button>
        {!collapsed && (
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-[#86868b]">
            <span>ConectaCorretor &copy; {new Date().getFullYear()}</span>
          </div>
        )}
      </div>
      </aside>
    </>
  );
}
