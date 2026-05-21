import { type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { UserRole } from '@3pl/shared';
import { useAuthStore } from '../stores/auth.store';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Button } from './ui';

interface NavItem {
  to: string;
  labelKey: string;
  permission?: string;
  /** Show only if the user holds one of these roles. */
  roles?: UserRole[];
}

const NAV: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard' },
  { to: '/orders', labelKey: 'nav.orders', permission: 'orders.read' },
  { to: '/cod', labelKey: 'nav.cod', permission: 'orders.read' },
  { to: '/catalog', labelKey: 'nav.catalog', permission: 'catalog.read' },
  { to: '/warehouses', labelKey: 'nav.warehouses', permission: 'warehouse.read' },
  { to: '/inventory', labelKey: 'nav.inventory', permission: 'inventory.read' },
  { to: '/receiving', labelKey: 'nav.receiving', permission: 'inventory.read' },
  { to: '/cycle-counts', labelKey: 'nav.cycleCounts', permission: 'inventory.read' },
  { to: '/remittances', labelKey: 'nav.remittances', roles: ['DRIVER', 'FINANCE', 'SUPER_ADMIN'] },
  { to: '/wallets', labelKey: 'nav.wallets', permission: 'finance.read' },
  { to: '/payouts', labelKey: 'nav.payouts', permission: 'finance.read' },
  { to: '/invoices', labelKey: 'nav.invoices', permission: 'finance.read' },
  { to: '/clients', labelKey: 'nav.clients', permission: 'clients.read' },
  { to: '/users', labelKey: 'nav.users', permission: 'users.read' },
  { to: '/audit', labelKey: 'nav.audit', permission: 'audit.read' },
  { to: '/portal', labelKey: 'nav.portal', roles: ['CLIENT'] },
  { to: '/mfa', labelKey: 'nav.mfa' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasRole = useAuthStore((s) => s.hasRole);
  const logout = useAuthStore((s) => s.logout);

  const visible = (n: NavItem) =>
    (!n.permission || hasPermission(n.permission)) && (!n.roles || hasRole(...n.roles));

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex">
      <aside className="w-60 bg-white border-e border-slate-200 flex flex-col">
        <div className="px-4 py-5 border-b border-slate-200">
          <h1 className="text-lg font-bold text-brand-700">{t('app.shortTitle')}</h1>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.filter(visible).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm transition ${
                  isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              {t(n.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <p className="text-xs text-slate-500 mb-2 truncate">{user?.email}</p>
          <Button variant="secondary" className="w-full" onClick={onLogout}>
            {t('auth.logout')}
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-end px-6 gap-3">
          <LanguageSwitcher />
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
