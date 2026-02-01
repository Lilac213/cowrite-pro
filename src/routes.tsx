import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppLayout } from './components/layouts/AppLayout';
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

interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: 'Login',
    path: '/login',
    element: <LoginPage />,
  },
  {
    name: 'App',
    path: '/',
    element: <AppLayout />,
    visible: false,
  },
  {
    name: 'Projects',
    path: '/',
    element: <ProjectListPage />,
  },
  {
    name: 'Project Workflow',
    path: '/project/:projectId',
    element: <ProjectWorkflowPage />,
  },
  {
    name: 'AI Reducer',
    path: '/ai-reducer',
    element: <AIReducerPage />,
  },
  {
    name: 'Materials',
    path: '/materials',
    element: <MaterialsPage />,
  },
  {
    name: 'References',
    path: '/references',
    element: <ReferencesPage />,
  },
  {
    name: 'Templates',
    path: '/templates',
    element: <TemplatesPage />,
  },
  {
    name: 'Settings',
    path: '/settings',
    element: <SettingsPage />,
  },
  {
    name: 'Admin',
    path: '/admin',
    element: <AdminPage />,
  },
  {
    name: 'Not Found',
    path: '/404',
    element: <NotFound />,
  },
  {
    name: 'Catch All',
    path: '*',
    element: <Navigate to="/404" replace />,
  },
];

export default routes;
