import type { ReactNode } from 'react';
import { BrowserRouter, Navigate,Route, Routes } from 'react-router-dom';

import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { AuthProvider, QUALITY_ROLES, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { LanguageProvider } from './context/LanguageContext';
import AdminPage from './pages/AdminPage';
import AnalysisPage from './pages/AnalysisPage';
import AuditPage from './pages/AuditPage';
import CaseDetailPage from './pages/CaseDetailPage';
import CohortBuilderPage from './pages/CohortBuilderPage';
import DocQualityPage from './pages/DocQualityPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import QualityPage from './pages/QualityPage';
import SettingsPage from './pages/SettingsPage';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function QualityRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!QUALITY_ROLES.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <DataProvider>
              <Layout />
            </DataProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<LandingPage />} />
        <Route path="/cohort" element={<CohortBuilderPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/case/:caseId" element={<CaseDetailPage />} />
        <Route path="/quality" element={<QualityPage />} />
        <Route path="/doc-quality" element={<QualityRoute><DocQualityPage /></QualityRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        <Route path="/audit" element={<AdminRoute><AuditPage /></AdminRoute>} />
        <Route path="/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </LanguageProvider>
  );
}
