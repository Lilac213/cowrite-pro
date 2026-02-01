import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import { AuthProvider } from '@/contexts/AuthContext';
import { RouteGuard } from '@/components/common/RouteGuard';
import { Toaster } from '@/components/ui/toaster';
import { AppLayout } from '@/components/layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import ProjectListPage from './pages/ProjectListPage';
import ProjectWorkflowPage from './pages/ProjectWorkflowPage';
import AIReducerPage from './pages/AIReducerPage';
import MaterialsPage from './pages/MaterialsPage';
import ReferencesPage from './pages/ReferencesPage';
import TemplatesPage from './pages/TemplatesPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import NotFound from './pages/NotFound';

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <RouteGuard>
          <IntersectObserver />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/404" element={<NotFound />} />
            <Route path="/" element={<AppLayout />}>
              <Route index element={<ProjectListPage />} />
              <Route path="project/:projectId" element={<ProjectWorkflowPage />} />
              <Route path="ai-reducer" element={<AIReducerPage />} />
              <Route path="materials" element={<MaterialsPage />} />
              <Route path="references" element={<ReferencesPage />} />
              <Route path="templates" element={<TemplatesPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="admin" element={<AdminPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
          <Toaster />
        </RouteGuard>
      </AuthProvider>
    </Router>
  );
};

export default App;
