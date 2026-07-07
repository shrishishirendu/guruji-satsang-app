import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AppShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userProfile, logout } = useAuth();
  const onCalendar = location.pathname === '/satsangs';
  const onHome = location.pathname === '/';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Decorative orange orbs — faithful to the original design */}
      <div className="relative overflow-hidden">
        <div className="absolute top-0 left-0 w-36 h-36 bg-saffron-400 rounded-full -translate-x-8 -translate-y-8 opacity-90 pointer-events-none" />
        <div className="absolute top-0 left-0 w-28 h-28 bg-saffron-200 rounded-full translate-x-4 -translate-y-2 opacity-70 pointer-events-none" />
        <div className="relative z-10 pt-10 px-4 pb-8 max-w-md mx-auto">
          {/* Top bar while logged in: one-step Back on the left (inner pages
              only), signed-in user + sign out on the right. */}
          {currentUser && (
            <div className="flex justify-between items-start leading-tight mb-1">
              {/* Go back one page. Falls back to the calendar when there's no
                  in-app history to pop (e.g. opened via a direct link). Router
                  stores its stack index on history.state.idx. */}
              {!onCalendar && !onHome ? (
                <button
                  onClick={() => {
                    const idx = window.history.state?.idx ?? 0;
                    if (idx > 0) navigate(-1);
                    else navigate('/satsangs');
                  }}
                  className="flex items-center gap-1 rounded-full bg-white/90 shadow-sm px-3 py-1 text-sm font-medium text-saffron-600 hover:bg-white"
                  aria-label="Go back"
                >
                  ← Back
                </button>
              ) : (
                <span />
              )}
              <div className="flex flex-col items-end">
                {userProfile && (
                  <span className="text-sm font-medium text-gray-600">
                    {userProfile.firstName} {userProfile.lastName}
                  </span>
                )}
                <button
                  onClick={logout}
                  className="text-xs text-gray-400 hover:text-saffron-600 font-medium"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}

          {children}

          {/* Bottom nav: the calendar links Home; every other logged-in page
              links back to the calendar. Home has its own buttons. */}
          {currentUser && onCalendar && (
            <button
              onClick={() => navigate('/')}
              className="btn-primary mt-6"
            >
              Home
            </button>
          )}
          {currentUser && !onCalendar && !onHome && (
            <button
              onClick={() => navigate('/satsangs')}
              className="mt-6 text-sm text-saffron-600 w-full text-center hover:underline"
            >
              ← Back to Calendar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
