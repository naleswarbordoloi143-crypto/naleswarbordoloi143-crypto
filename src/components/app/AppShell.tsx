import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getNavGroups } from '@/components/app/nav-config';
import { Menu, X, LogOut, Sprout, Bell, Globe, ChevronRight, ChevronDown, Sprout as FarmerIcon, Shield, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Language, UserRole } from '@/lib/types';
import { useNotificationCount } from '@/lib/hooks';

interface AppShellProps {
  activeKey: string;
  onNavigate: (key: string) => void;
  children: React.ReactNode;
}

export function AppShell({ activeKey, onNavigate, children }: AppShellProps) {
  const { profile, t, signOut, language, setLanguage, switchRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const unreadCount = useNotificationCount();

  const activeRole = profile?.active_role || profile?.role || 'farmer';

  const roleIcons: Record<string, React.ReactNode> = {
    farmer: <FarmerIcon size={16} />,
    champion: <Shield size={16} />,
    buyer: <ShoppingBag size={16} />,
    admin: <Shield size={16} />,
  };

  const navGroups = getNavGroups(t).map((group) => ({
    ...group,
    items: group.items.filter((item) => profile ? item.roles.includes(activeRole) : false),
  })).filter((group) => group.items.length > 0);

  const allItems = navGroups.flatMap((g) => g.items);
  const activeItem = allItems.find((n) => n.key === activeKey);
  const pageTitle = activeItem ? t(activeItem.key) : t('dashboard');

  useEffect(() => {
    setSidebarOpen(false);
  }, [activeKey]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setRoleMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Sidebar - desktop */}
      <aside className={cn(
        'fixed lg:sticky top-0 left-0 z-40 h-screen w-72 bg-white border-r border-stone-200/60 flex flex-col transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="px-5 py-5 border-b border-stone-100 flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl text-white shadow-soft shadow-primary-600/20">
            <Sprout size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-stone-800 truncate">{t('appName')}</h1>
              <span className="badge-beta">Beta</span>
            </div>
            <p className="text-xs text-stone-400 truncate">{t('tagline')}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
            <X size={20} className="text-stone-500" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="section-label mb-1.5">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeKey === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => onNavigate(item.key)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative',
                        isActive
                          ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-soft shadow-primary-600/20'
                          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-800'
                      )}
                    >
                      <span className={cn(
                        'transition-transform duration-200 group-hover:scale-110',
                        isActive ? 'text-white' : 'text-stone-400'
                      )}>
                        {item.icon}
                      </span>
                      {t(item.key)}
                      {item.key === 'notifications' && unreadCount > 0 && (
                        <span className={cn(
                          'ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center transition-colors',
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-accent-500 text-white'
                        )}>
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                      {isActive && item.key !== 'notifications' && (
                        <ChevronRight size={14} className="ml-auto opacity-50" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-stone-100">
          <button
            onClick={() => onNavigate('profile')}
            className="w-full flex items-center gap-3 px-3 py-2.5 mb-2 rounded-xl hover:bg-stone-50 transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center font-semibold text-sm shadow-soft">
              {profile?.full_name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-semibold text-stone-700 truncate">{profile?.full_name}</p>
              <p className="text-xs text-stone-400 capitalize">{profile ? t(activeRole) : ''}</p>
            </div>
          </button>
          <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-stone-500 hover:bg-error-50 hover:text-error-600 transition-colors">
            <LogOut size={18} />
            {t('logout')}
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-stone-900/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-stone-200/60 px-4 lg:px-8 py-3.5 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-stone-100 transition-colors">
            <Menu size={22} className="text-stone-600" />
          </button>
          <div className="flex-1 flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-800">{pageTitle}</h2>
            <span className="badge-beta hidden sm:inline-flex">Beta</span>
          </div>
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer">
            <Globe size={18} />
            <span className="sr-only">{t('language')}</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="bg-transparent border-0 outline-none cursor-pointer text-sm font-medium text-stone-600">
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="bn">বাংলা</option>
              <option value="mr">मराठी</option>
              <option value="ta">தமிழ்</option>
            </select>
          </label>

          {/* Role switcher */}
          {profile && (profile.roles?.length ?? 0) > 1 && (
            <div ref={roleMenuRef} className="relative">
              <button
                onClick={() => setRoleMenuOpen((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors"
              >
                <span className="text-primary-600">{roleIcons[activeRole]}</span>
                <span className="hidden sm:inline capitalize">{t(activeRole)}</span>
                <ChevronDown size={14} className={cn('transition-transform', roleMenuOpen && 'rotate-180')} />
              </button>
              {roleMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-stone-200/60 py-1.5 animate-slide-down z-50">
                  <p className="px-3 py-1.5 text-xs font-semibold text-stone-400 uppercase tracking-wide">{t('switchRole')}</p>
                  {profile.roles.map((r: UserRole) => (
                    <button
                      key={r}
                      onClick={() => { switchRole(r); setRoleMenuOpen(false); onNavigate('dashboard'); }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors text-left',
                        activeRole === r ? 'text-primary-600 bg-primary-50' : 'text-stone-600 hover:bg-stone-50'
                      )}
                    >
                      <span className={activeRole === r ? 'text-primary-600' : 'text-stone-400'}>{roleIcons[r]}</span>
                      <span className="capitalize">{t(r)}</span>
                      {activeRole === r && <ChevronRight size={14} className="ml-auto" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={() => onNavigate('notifications')} className="relative p-2 rounded-lg hover:bg-stone-100 transition-colors">
            <Bell size={22} className="text-stone-600" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-accent-500 rounded-full ring-2 ring-white animate-pulse-soft" />
            )}
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
