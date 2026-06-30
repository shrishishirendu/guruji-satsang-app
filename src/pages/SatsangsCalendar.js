import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
         getDay, addMonths, subMonths, isSameMonth } from 'date-fns';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { loadVisibleSatsangs } from '../utils/satsangs';

export default function SatsangsCalendar() {
  const navigate = useNavigate();
  const { logout, userProfile, currentUser } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  // Every satsang this user is allowed to see (public + hosted + invited).
  const [satsangs, setSatsangs] = useState([]);

  useEffect(() => {
    loadVisibleSatsangs(currentUser).then(setSatsangs).catch(() => setSatsangs([]));
  }, [currentUser]);

  // Map of 'yyyy-MM-dd' -> { public: count, private: count } for the open month.
  const monthDates = useMemo(() => {
    const dates = new Map();
    satsangs.forEach(s => {
      const ts = s.date;
      if (!ts?.toDate) return;
      const d = ts.toDate();
      if (!isSameMonth(d, currentMonth)) return;
      const key = format(d, 'yyyy-MM-dd');
      const entry = dates.get(key) || { public: 0, private: 0 };
      if (s.publicInvite) entry.public += 1;
      else entry.private += 1;
      dates.set(key, entry);
    });
    return dates;
  }, [satsangs, currentMonth]);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  // Monday-first offset (0=Mon … 6=Sun)
  const offset = (getDay(startOfMonth(currentMonth)) + 6) % 7;

  function handleDayClick(day) {
    const key = format(day, 'yyyy-MM-dd');
    navigate(`/satsangs/${key}`);
  }

  return (
    <AppShell>
      <div className="flex items-start justify-between mb-1">
        <h1 className="page-header mb-0">Satsang Seva</h1>
        <div className="flex flex-col items-end leading-tight">
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

      {/* Guru Ji sticker — file lives in /public/guruji.jpg */}
      <div className="flex justify-center mb-2 mt-2">
        <img
          src="/guruji.jpg"
          alt="Guru Ji"
          className="w-20 h-20 rounded-full object-cover object-top border-2 border-saffron-200 shadow-sm"
        />
      </div>

      {/* Guru Ji mantra */}
      <p className="text-center text-sm text-saffron-600 font-medium leading-relaxed mb-4">
        Aum Namah Shivay Shivji Sada Sahay<br />
        Aum Namah Shivay Guru ji Sada Sahay
      </p>

      {/* Primary action — create a new Satsang in one tap (date is editable next) */}
      <button
        className="btn-primary mb-4"
        onClick={() => navigate(`/create-invite/${format(new Date(), 'yyyy-MM-dd')}`)}
      >
        ➕ Create a Satsang Invite
      </button>

      <p className="text-center text-sm text-gray-600 mb-2">
        …or tap a date below to view or add a Satsang
      </p>
      <p className="text-center text-xs text-gray-500 mb-4 flex items-center justify-center gap-4">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> Private
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" /> Public
        </span>
      </p>

      {/* Month navigator */}
      <div className="flex items-center justify-center gap-6 mb-4">
        <button
          onClick={() => setCurrentMonth(m => subMonths(m, 1))}
          className="text-saffron-600 text-xl font-bold px-2 hover:text-saffron-800"
        >‹</button>
        <span className="font-bold text-gray-800 text-base">
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setCurrentMonth(m => addMonths(m, 1))}
          className="text-saffron-600 text-xl font-bold px-2 hover:text-saffron-800"
        >›</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['M','T','W','Th','F','Sa','Su'].map(d => (
          <div key={d} className="text-center text-saffron-400 font-semibold text-sm py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array(offset).fill(null).map((_, i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const entry = monthDates.get(key);
          const hasEvent = entry && (entry.public > 0 || entry.private > 0);
          return (
            <button
              key={key}
              onClick={() => handleDayClick(day)}
              className={`
                relative aspect-square flex items-center justify-center rounded-lg border text-sm font-medium
                transition-all
                ${hasEvent
                  ? 'bg-orange-50 border-orange-200 text-gray-800 hover:border-saffron-400'
                  : 'bg-white border-saffron-100 text-gray-700 hover:bg-saffron-100 hover:border-saffron-300'}
              `}
            >
              {format(day, 'd')}
              {hasEvent && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {entry.private > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                  {entry.public > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </AppShell>
  );
}
