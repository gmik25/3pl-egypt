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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/users/:id" element={<UserFormPage />} />
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/clients/:id" element={<ClientFormPage />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/orders/new" element={<OrderCreatePage />} />
                  <Route path="/orders/import" element={<OrderImportPage />} />
                  <Route path="/orders/:id" element={<OrderDetailPage />} />
                  <Route path="/cod" element={<CodPage />} />
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
