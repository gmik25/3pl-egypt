import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Gauge, ShoppingCart, Coins, Tags, Warehouse, Boxes, Inbox, ClipboardCheck,
  Truck, Bike, RotateCcw, Ship, Hash, ArrowLeftRight, Wallet, Banknote, ReceiptText, Calculator,
  Network, Store, BarChart3, Bell, Building2, Users, History, Home, ShieldCheck, LogOut, Menu, X,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@3pl/shared';
import { useAuthStore } from '../stores/auth.store';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  permission?: string;
  roles?: UserRole[];
}
interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    labelKey: 'nav.groups.overview',
    items: [
      { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
      { to: '/ops', labelKey: 'nav.ops', icon: Gauge, permission: 'reports.read' },
    ],
  },
  {
    labelKey: 'nav.groups.orders',
    items: [
      { to: '/orders', labelKey: 'nav.orders', icon: ShoppingCart, permission: 'orders.read' },
      { to: '/cod', labelKey: 'nav.cod', icon: Coins, permission: 'orders.read' },
    ],
  },
  {
    labelKey: 'nav.groups.warehouse',
    items: [
      { to: '/catalog', labelKey: 'nav.catalog', icon: Tags, permission: 'catalog.read' },
      { to: '/warehouses', labelKey: 'nav.warehouses', icon: Warehouse, permission: 'warehouse.read' },
      { to: '/inventory', labelKey: 'nav.inventory', icon: Boxes, permission: 'inventory.read' },
      { to: '/receiving', labelKey: 'nav.receiving', icon: Inbox, permission: 'inventory.read' },
      { to: '/cycle-counts', labelKey: 'nav.cycleCounts', icon: ClipboardCheck, permission: 'inventory.read' },
    ],
  },
  {
    labelKey: 'nav.groups.delivery',
    items: [
      { to: '/shipments', labelKey: 'nav.shipments', icon: Truck, permission: 'fleet.read' },
      { to: '/drivers', labelKey: 'nav.drivers', icon: Bike, permission: 'fleet.read' },
    ],
  },
  {
    labelKey: 'nav.groups.reverseCustoms',
    items: [
      { to: '/returns', labelKey: 'nav.returns', icon: RotateCcw, permission: 'returns.read' },
      { to: '/imports', labelKey: 'nav.imports', icon: Ship, permission: 'customs.read' },
      { to: '/hs-codes', labelKey: 'nav.hsCodes', icon: Hash, permission: 'customs.read' },
    ],
  },
  {
    labelKey: 'nav.groups.finance',
    items: [
      { to: '/remittances', labelKey: 'nav.remittances', icon: ArrowLeftRight, roles: ['DRIVER', 'FINANCE', 'SUPER_ADMIN'] },
      { to: '/wallets', labelKey: 'nav.wallets', icon: Wallet, permission: 'finance.read' },
      { to: '/payouts', labelKey: 'nav.payouts', icon: Banknote, permission: 'finance.read' },
      { to: '/invoices', labelKey: 'nav.invoices', icon: ReceiptText, permission: 'finance.read' },
      { to: '/storage-billing', labelKey: 'nav.storageBilling', icon: Calculator, permission: 'finance.read' },
    ],
  },
  {
    labelKey: 'nav.groups.integrations',
    items: [
      { to: '/integrations/couriers', labelKey: 'nav.couriers', icon: Network, permission: 'integrations.read' },
      { to: '/integrations/stores', labelKey: 'nav.stores', icon: Store, permission: 'integrations.read' },
    ],
  },
  {
    labelKey: 'nav.groups.insights',
    items: [
      { to: '/reports', labelKey: 'nav.reports', icon: BarChart3, permission: 'reports.read' },
      { to: '/notifications', labelKey: 'nav.notifications', icon: Bell, permission: 'notifications.read' },
    ],
  },
  {
    labelKey: 'nav.groups.admin',
    items: [
      { to: '/clients', labelKey: 'nav.clients', icon: Building2, permission: 'clients.read' },
      { to: '/users', labelKey: 'nav.users', icon: Users, permission: 'users.read' },
      { to: '/audit', labelKey: 'nav.audit', icon: History, permission: 'audit.read' },
    ],
  },
  {
    labelKey: 'nav.groups.myAccount',
    items: [
      { to: '/portal', labelKey: 'nav.portal', icon: Home, roles: ['CLIENT'] },
      { to: '/portal/stores', labelKey: 'nav.myStores', icon: Store, roles: ['CLIENT'] },
      { to: '/portal/storage', labelKey: 'nav.myStorage', icon: Boxes, roles: ['CLIENT'] },
    ],
  },
  {
    labelKey: 'nav.groups.account',
    items: [{ to: '/mfa', labelKey: 'nav.mfa', icon: ShieldCheck }],
  },
];

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasRole = useAuthStore((s) => s.hasRole);
  const logout = useAuthStore((s) => s.logout);
  const [mobileOpen, setMobileOpen] = useState(false);

  const visible = (n: NavItem) =>
    (!n.permission || hasPermission(n.permission)) && (!n.roles || hasRole(...n.roles));
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter(visible) })).filter((g) => g.items.length > 0);

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const initials = (user?.fullName || user?.email || '?').trim().slice(0, 2).toUpperCase();

  const sidebar = (
    <>
      <div className="px-5 h-14 flex items-center gap-2 border-b border-line">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white text-sm font-bold">3</span>
        <h1 className="text-base font-bold text-ink">{t('app.shortTitle')}</h1>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {groups.map((g) => (
          <div key={g.labelKey}>
            <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">{t(g.labelKey)}</p>
            <div className="space-y-0.5">
              {g.items.map((n) => {
                const Icon = n.icon;
                return (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.to === '/'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                        isActive
                          ? 'bg-accent/10 text-accent font-semibold'
                          : 'text-muted hover:text-ink hover:bg-surface-muted'
                      }`
                    }
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="truncate">{t(n.labelKey)}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-line">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent text-xs font-bold" dir="ltr">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink truncate">{user?.fullName ?? '—'}</p>
            <p className="text-xs text-faint truncate" dir="ltr">{user?.email}</p>
          </div>
          <button
            onClick={onLogout}
            aria-label={t('auth.logout')}
            title={t('auth.logout')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-red-600 hover:bg-surface-muted transition"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-canvas text-body font-sans flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-surface border-e border-line flex-col fixed inset-y-0 start-0 z-30">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-64 bg-surface border-e border-line flex flex-col animate-fade-in">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:ms-64">
        <header className="sticky top-0 z-20 h-14 bg-surface/80 backdrop-blur border-b border-line flex items-center justify-between px-4 sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label={t('nav.menu')}
            className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-surface-muted transition"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>

      {/* Close button when drawer open (mobile) */}
      {mobileOpen && (
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed top-3 end-3 z-50 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface border border-line text-muted"
          aria-label={t('common.close')}
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
