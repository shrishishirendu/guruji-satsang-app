import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';

export default function Welcome() {
  const navigate = useNavigate();
  return (
    <AppShell>
      <h1 className="page-header mt-4">Satsang Seva</h1>
      <div className="flex flex-col items-center text-center mt-8 gap-6">
        {/* Guruji image — file lives in /public/guruji.jpg */}
        <img
          src="/guruji.jpg"
          alt="Guruji"
          className="w-48 h-56 rounded-2xl object-cover object-top border-2 border-saffron-200 shadow-md"
        />
        <p className="text-gray-500 text-sm leading-relaxed px-2">
          Aum Namah Shivay Shivji Sada Sahay<br />
          Aum Namah Shivay Guru ji Sada Sahay
        </p>
        <p className="text-gray-600 leading-relaxed">
          With Guru Ji's kripa you can use this platform to send Satsang Invites (public or private), RSVP to Satsangs, share Seva and lots more.
        </p>
        <button className="btn-primary mt-2" onClick={() => navigate('/register')}>
          Get Started
        </button>
        <button className="btn-secondary" onClick={() => navigate('/login')}>
          Sign In
        </button>
      </div>
    </AppShell>
  );
}
