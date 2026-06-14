import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/AuthContext';

export default function InviteSent() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const name = userProfile
    ? `${userProfile.firstName} ${userProfile.lastName}`
    : 'Sangat Ji';

  return (
    <AppShell>
      <h1 className="page-header mt-4">Satsang Seva</h1>
      <div className="flex flex-col items-center text-center mt-16 gap-4 px-4">
        <p className="text-gray-500 text-lg leading-relaxed">
          Thank you<br />
          <span className="font-bold text-gray-800">{name}</span><br />
          for inviting sangat using{' '}
          <span className="font-bold text-saffron-400">Satsang Seva</span>
        </p>
        <p className="text-gray-500 text-sm leading-relaxed mt-2">
          Those Sangat who are not registered on the App will receive a WhatsApp message to download the app to view your invite.
        </p>
        <button className="btn-primary mt-8 max-w-xs" onClick={() => navigate('/satsangs')}>
          Home
        </button>
      </div>
    </AppShell>
  );
}
