import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { dismissErrors } from './utils/notify';
import PrivateRoute from './components/PrivateRoute';

import Welcome          from './pages/Welcome';
import Register         from './pages/Register';
import Registered       from './pages/Registered';
import Login            from './pages/Login';
import ForgotPassword   from './pages/ForgotPassword';
import SatsangsCalendar from './pages/SatsangsCalendar';
import DayView          from './pages/DayView';
import CreateEditInvite from './pages/CreateEditInvite';
import ViewInvite       from './pages/ViewInvite';
import RSVPPage         from './pages/RSVPPage';
import RSVPList         from './pages/RSVPList';
import InviteSangat     from './pages/InviteSangat';
import InviteSent       from './pages/InviteSent';

// Clears lingering error toasts whenever the route changes, so a stale error
// message doesn't hang around after the user navigates to a different screen.
function ErrorToastCleanup() {
  const location = useLocation();
  useEffect(() => {
    dismissErrors();
  }, [location.pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ErrorToastCleanup />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              borderRadius: '12px',
              background: '#fff',
              color: '#333',
              border: '1px solid #FAC775',
            },
          }}
        />
        <Routes>
          <Route path="/"          element={<Welcome />} />
          <Route path="/register"  element={<Register />} />
          <Route path="/login"     element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/registered" element={<PrivateRoute><Registered /></PrivateRoute>} />
          <Route path="/satsangs"   element={<PrivateRoute><SatsangsCalendar /></PrivateRoute>} />
          <Route path="/satsangs/:dateStr" element={<PrivateRoute><DayView /></PrivateRoute>} />
          <Route path="/create-invite/:dateStr" element={<PrivateRoute><CreateEditInvite /></PrivateRoute>} />
          <Route path="/edit-invite/:inviteId"  element={<PrivateRoute><CreateEditInvite /></PrivateRoute>} />
          <Route path="/invite/:inviteId"             element={<PrivateRoute><ViewInvite /></PrivateRoute>} />
          <Route path="/invite/:inviteId/rsvp"        element={<PrivateRoute><RSVPPage /></PrivateRoute>} />
          <Route path="/invite/:inviteId/rsvp-list"   element={<PrivateRoute><RSVPList /></PrivateRoute>} />
          <Route path="/invite/:inviteId/invite-sangat" element={<PrivateRoute><InviteSangat /></PrivateRoute>} />
          <Route path="/invite/:inviteId/invited"     element={<PrivateRoute><InviteSent /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
