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
  const [satsangDates, setSatsangDates] = useState(new Set());

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
      const dates = new Set();
      snap.forEach(d => {
        const ts = d.data().date;
        if (ts) dates.add(format(ts.toDate(), 'yyyy-MM-dd'));
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
      <div className="flex items-center justify-between mb-1">
        <h1 className="page-header mb-0">Satsang Seva</h1>
        <button
          onClick={logout}
          className="text-xs text-gray-400 hover:text-saffron-600 font-medium"
        >
          Sign out
        </button>
      </div>
      {userProfile && (
        <p className="text-center text-sm text-gray-400 mb-4">
          Jai Guruji, {userProfile.firstName} {userProfile.lastName}
        </p>
      )}

      <p className="text-center text-sm text-gray-600 mb-1">
        Please select a date below to create or view a Satsang Invite
      </p>
      <p className="text-center text-sm mb-4">
        Dates marked in <span className="text-green-500 font-semibold">green</span> have Satsangs planned
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
          const hasSatsang = satsangDates.has(key);
          return (
            <button
              key={key}
              onClick={() => handleDayClick(day)}
              className={`
                aspect-square flex items-center justify-center rounded-lg border text-sm font-medium
                transition-all hover:bg-saffron-100
                ${hasSatsang
                  ? 'text-green-500 border-green-200 hover:border-green-400'
                  : 'text-gray-700 border-saffron-100 hover:border-saffron-300'}
              `}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </AppShell>
  );
}
