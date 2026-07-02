import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { parse, format, isSameDay, isBefore, startOfDay, addDays, subDays } from 'date-fns';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { loadVisibleSatsangs } from '../utils/satsangs';

export default function DayView() {
  const { dateStr } = useParams(); // yyyy-MM-dd
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [satsangs, setSatsangs] = useState([]);
  const [loading, setLoading] = useState(true);

  const day = parse(dateStr, 'yyyy-MM-dd', new Date());
  // You can't create a satsang in the past — only view what's already there.
  const isPast = isBefore(day, startOfDay(new Date()));

  useEffect(() => {
    async function load() {
      setLoading(true);
      // Only satsangs this user may see; filter to the day client-side.
      const visible = await loadVisibleSatsangs(currentUser);
      setSatsangs(visible.filter(s => s.date?.toDate && isSameDay(s.date.toDate(), day)));
      setLoading(false);
    }
    load();
  // eslint-disable-next-line
  }, [dateStr, currentUser]);

  function prevDay() {
    navigate(`/satsangs/${format(subDays(day, 1), 'yyyy-MM-dd')}`);
  }
  function nextDay() {
    navigate(`/satsangs/${format(addDays(day, 1), 'yyyy-MM-dd')}`);
  }

  return (
    <AppShell>
      <h1 className="page-header mt-4">Satsang Seva</h1>

      {/* Date navigator */}
      <div className="flex items-center justify-center gap-6 mb-6">
        <button onClick={prevDay} className="text-saffron-600 text-xl font-bold px-2 hover:text-saffron-800">‹</button>
        <span className="font-bold text-gray-800">{format(day, 'd MMMM yyyy')}</span>
        <button onClick={nextDay} className="text-saffron-600 text-xl font-bold px-2 hover:text-saffron-800">›</button>
      </div>

      {loading && <p className="text-center text-gray-400">Loading…</p>}

      {!loading && satsangs.length === 0 && (
        <div className="text-center mt-8">
          <p className="text-gray-400 mb-6">No satsangs planned for this date.</p>
          {!isPast && (
            <button
              className="btn-primary max-w-xs"
              onClick={() => navigate(`/create-invite/${dateStr}`)}
            >
              Create Satsang Invite
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {satsangs.map(s => {
          const isPrivate = !s.publicInvite;
          const cardColor = isPrivate
            ? 'border-blue-200 hover:border-blue-400'
            : 'border-green-200 hover:border-green-400';
          const timeBlock = isPrivate
            ? 'bg-blue-50 text-blue-600'
            : 'bg-green-50 text-green-600';
          return (
            <button
              key={s.id}
              onClick={() => navigate(`/invite/${s.id}`)}
              className={`flex items-stretch gap-3 border-2 ${cardColor} rounded-xl overflow-hidden transition-colors text-left`}
            >
              <div className={`${timeBlock} px-3 py-3 flex flex-col items-center justify-center min-w-[64px]`}>
                <span className="text-sm font-bold">{s.startTime || '—'}</span>
              </div>
              <div className="py-3 pr-3">
                <p className="font-semibold text-gray-800">{s.suburb || s.address?.split('\n')[0] || 'Satsang'}</p>
                <p className="text-sm text-gray-500">{s.hostName || ''}</p>
                <span className={`text-xs font-semibold ${isPrivate ? 'text-blue-500' : 'text-green-500'}`}>
                  {isPrivate ? 'Private' : 'Public'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {!loading && satsangs.length > 0 && !isPast && (
        <button
          className="btn-secondary mt-6"
          onClick={() => navigate(`/create-invite/${dateStr}`)}
        >
          + Add another satsang
        </button>
      )}
    </AppShell>
  );
}
