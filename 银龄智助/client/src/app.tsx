import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';

import { AccessibilityProvider } from './contexts/AccessibilityContext';
import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';

import ElderHomePage from './pages/elder-home/ElderHomePage';
import VoiceRegisterPage from './pages/voice-register/VoiceRegisterPage';
import RecordsPage from './pages/records/RecordsPage';
import PatientsPage from './pages/patients/PatientsPage';
import HelpPage from './pages/help/HelpPage';

import FamilyHomePage from './pages/family-home/FamilyHomePage';
import FamilyBindPage from './pages/family-bind/FamilyBindPage';
import FamilyNotificationsPage from './pages/family-notifications/FamilyNotificationsPage';
import FamilyAssistPage from './pages/family-assist/FamilyAssistPage';

import DashboardPage from './pages/dashboard/DashboardPage';

const RoutesComponent = () => {
  return (
    <AccessibilityProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/elder" replace />} />

          {/* 老年端 */}
          <Route path="elder" element={<ElderHomePage />} />
          <Route path="elder/register" element={<VoiceRegisterPage />} />
          <Route path="elder/records" element={<RecordsPage />} />
          <Route path="elder/patients" element={<PatientsPage />} />
          <Route path="elder/help" element={<HelpPage />} />

          {/* 子女端 */}
          <Route path="family" element={<FamilyHomePage />} />
          <Route path="family/bind" element={<FamilyBindPage />} />
          <Route path="family/notifications" element={<FamilyNotificationsPage />} />
          <Route path="family/assist" element={<FamilyAssistPage />} />

          {/* 数据看板 */}
          <Route path="dashboard" element={<DashboardPage />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AccessibilityProvider>
  );
};

export default RoutesComponent;
