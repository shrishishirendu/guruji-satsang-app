import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
         getDay, addMonths, subMonths } from 'date-fns';
import AppShell from '../components/AppShell';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

export default function SatsangsCalendar() {
  const navigate = useNavigate();
  const { logout, userProfile } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  // Map of 'yyyy-MM-dd' -> { public: count, private: count }
  const [satsangDates, setSatsangDates] = useState(new Map());

  // Load all satsang dates in view month
  useEffect(() => {
    async function fetchDates() {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      const q = query(
        collection(db, 'satsangs'),
        where('date', '>=', Timestamp.fromDate(start)),
        where('date', '<=', Timestamp.fromDate(end)),
      );
      const snap = await getDocs(q);
      const dates = new Map();
      snap.forEach(d => {
        const data = d.data();
        const ts = data.date;
        if (!ts) return;
        const key = format(ts.toDate(), 'yyyy-MM-dd');
        const entry = dates.get(key) || { public: 0, private: 0 };
        // A booking is "private" unless it's explicitly marked as a public invite
        if (data.publicInvite) entry.public += 1;
        else entry.private += 1;
        dates.set(key, entry);
      });
      setSatsangDates(dates);
    }
    fetchDates();
  }, [currentMonth]);

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

      <p className="text-center text-sm text-gray-600 mb-1">
        Please select a date below to create or view a Satsang Invite
      </p>
      <p className="text-center text-sm mb-1">
        <span className="text-green-500 font-semibold">Green</span> dates have public Satsangs,{' '}
        <span className="text-blue-500 font-semibold">blue</span> are private bookings
      </p>
      <p className="text-center text-xs text-gray-400 mb-4">
        A <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 align-middle" /> dot marks dates with multiple private bookings
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
          const entry = satsangDates.get(key);
          // Private (blue) takes priority when a date has both kinds of bookings
          const colorClass = entry?.private
            ? 'text-blue-500 border-blue-200 hover:border-blue-400'
            : entry?.public
              ? 'text-green-500 border-green-200 hover:border-green-400'
              : 'text-gray-700 border-saffron-100 hover:border-saffron-300';
          // Show a blue dot when a date has more than one private booking
          const multiplePrivate = (entry?.private || 0) > 1;
          return (
            <button
              key={key}
              onClick={() => handleDayClick(day)}
              className={`
                relative aspect-square flex items-center justify-center rounded-lg border text-sm font-medium
                transition-all hover:bg-saffron-100
                ${colorClass}
              `}
            >
              {multiplePrivate && (
                <span className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
              )}
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </AppShell>
  );
}
