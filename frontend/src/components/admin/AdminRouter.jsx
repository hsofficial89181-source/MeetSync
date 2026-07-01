import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Tabs
import AdminDashboard from './tabs/AdminDashboard';
import UserManagementTab from './tabs/UserManagementTab';
import SubscriptionsTab from './tabs/SubscriptionsTab';
import AnalyticsTab from './tabs/AnalyticsTab';
import SettingsTab from './tabs/SettingsTab';

// Pages
import WorkspaceDetail from './pages/WorkspaceDetail';
import WorkspaceEdit from './pages/WorkspaceEdit';
import SubscriptionDetail from './pages/SubscriptionDetail';

export default function AdminRouter() {
  return (
    <Routes>
      <Route index element={<AdminDashboard />} />
      <Route path="users" element={<UserManagementTab />} />
      <Route path="workspaces/:id" element={<WorkspaceDetail />} />
      <Route path="workspaces/:id/edit" element={<WorkspaceEdit />} />
      <Route path="subscriptions" element={<SubscriptionsTab />} />
      <Route path="subscriptions/:workspaceId" element={<SubscriptionDetail />} />
      <Route path="analytics" element={<AnalyticsTab />} />
      <Route path="settings" element={<SettingsTab />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
