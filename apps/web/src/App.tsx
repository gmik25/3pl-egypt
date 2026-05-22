import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MfaPage from './pages/MfaPage';
import UsersPage from './pages/UsersPage';
import UserFormPage from './pages/UserFormPage';
import AuditPage from './pages/AuditPage';
import ClientsPage from './pages/ClientsPage';
import ClientFormPage from './pages/ClientFormPage';
import ClientPortalPage from './pages/ClientPortalPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import OrderCreatePage from './pages/OrderCreatePage';
import OrderImportPage from './pages/OrderImportPage';
import CodPage from './pages/CodPage';
import SkuCatalogPage from './pages/wms/SkuCatalogPage';
import WarehousesPage from './pages/wms/WarehousesPage';
import InventoryPage from './pages/wms/InventoryPage';
import ReceivingPage from './pages/wms/ReceivingPage';
import CycleCountPage from './pages/wms/CycleCountPage';
import RemittancePage from './pages/finance/RemittancePage';
import WalletsPage from './pages/finance/WalletsPage';
import PayoutsPage from './pages/finance/PayoutsPage';
import InvoicesPage from './pages/finance/InvoicesPage';
import ShipmentsPage from './pages/fleet/ShipmentsPage';
import ShipmentDetailPage from './pages/fleet/ShipmentDetailPage';
import DriversPage from './pages/fleet/DriversPage';
import ReturnsPage from './pages/returns/ReturnsPage';
import ReturnPortalPage from './pages/ReturnPortalPage';
import HsCodesPage from './pages/customs/HsCodesPage';
import ImportsPage from './pages/customs/ImportsPage';
import ReportsPage from './pages/ReportsPage';
import NotificationsPage from './pages/NotificationsPage';
import OpsDashboardPage from './pages/OpsDashboardPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/return-portal" element={<ReturnPortalPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/ops" element={<OpsDashboardPage />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/users/:id" element={<UserFormPage />} />
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/clients/:id" element={<ClientFormPage />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/orders/new" element={<OrderCreatePage />} />
                  <Route path="/orders/import" element={<OrderImportPage />} />
                  <Route path="/orders/:id" element={<OrderDetailPage />} />
                  <Route path="/cod" element={<CodPage />} />
                  <Route path="/catalog" element={<SkuCatalogPage />} />
                  <Route path="/warehouses" element={<WarehousesPage />} />
                  <Route path="/inventory" element={<InventoryPage />} />
                  <Route path="/receiving" element={<ReceivingPage />} />
                  <Route path="/cycle-counts" element={<CycleCountPage />} />
                  <Route path="/remittances" element={<RemittancePage />} />
                  <Route path="/wallets" element={<WalletsPage />} />
                  <Route path="/payouts" element={<PayoutsPage />} />
                  <Route path="/invoices" element={<InvoicesPage />} />
                  <Route path="/shipments" element={<ShipmentsPage />} />
                  <Route path="/shipments/:id" element={<ShipmentDetailPage />} />
                  <Route path="/drivers" element={<DriversPage />} />
                  <Route path="/returns" element={<ReturnsPage />} />
                  <Route path="/hs-codes" element={<HsCodesPage />} />
                  <Route path="/imports" element={<ImportsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/portal" element={<ClientPortalPage />} />
                  <Route path="/mfa" element={<MfaPage />} />
                  <Route path="/audit" element={<AuditPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
