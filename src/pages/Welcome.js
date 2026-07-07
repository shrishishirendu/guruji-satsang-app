import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/AuthContext';

export default function Welcome() {
  const navigate = useNavigate();
  const location = useLocation();
  // Where the visitor was originally headed (e.g. an RSVP link), set by
  // PrivateRoute. Carried through Register/Sign In so we can return them there.
  const from = location.state?.from;
  const { currentUser } = useAuth();
  return (
    <AppShell>
      <h1 className="page-header mt-4">Satsang Seva</h1>
      <div className="flex flex-col items-center text-center mt-6 gap-4">
        {/* Guruji image — file lives in /public/guruji.jpg */}
        <img
          src="/guruji.jpg"
          alt="Guruji"
          className="w-48 h-56 rounded-2xl object-cover object-top border-2 border-saffron-200 shadow-md"
        />
        <p className="text-saffron-400 font-bold text-sm leading-relaxed px-2">
          Aum Namah Shivay Shivji Sada Sahay<br />
          Aum Namah Shivay Guru ji Sada Sahay
        </p>
        <div className="text-gray-600 text-sm leading-relaxed space-y-2">
          <p>
            With Guru Ji's blessings you can now use Guruji's platform to View Satsangs
            on a calendar, send Satsang Invites (Public or Private), RSVP to Satsangs,
            Request Seva, View your RSVP list and lots more features like My Groups, My
            Saved Satsangs coming soon.
          </p>
          <p>
            Importantly, your Private satsangs will only be visible to the sangat you
            invite. The Public ones are visible to all. You can change from Public to
            Private at any time.
          </p>
        </div>
        {currentUser ? (
          <button className="btn-primary mt-2" onClick={() => navigate('/satsangs')}>
            Go to Calendar
          </button>
        ) : (
          <div className="flex gap-3 w-full mt-2">
            <button
              className="btn-primary flex-1 text-sm px-3 py-2.5"
              onClick={() => navigate('/register', { state: { from } })}
            >
              Get Started
            </button>
            <button
              className="btn-secondary flex-1 text-sm px-3 py-2.5"
              onClick={() => navigate('/login', { state: { from } })}
            >
              Sign In
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
