import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import AppShell from '../components/AppShell';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { isAdminUid } from '../config/admins';

function fmtDate(ts) {
  try { return ts && ts.toDate ? format(ts.toDate(), 'd MMM yyyy') : '—'; }
  catch { return '—'; }
}
function millis(ts) {
  return ts && ts.toMillis ? ts.toMillis() : 0;
}

// A read-only 360° view for the admin: every satsang across all hosts (public
// and private), who created them, when, and how much response each got. Reads
// the whole of each collection — allowed only because firestore.rules grants
// isAdmin() read access. Non-admins are redirected (and the rules would deny
// the reads anyway).
export default function AdminDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isAdmin = isAdminUid(currentUser && currentUser.uid);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState({ satsangs: [], users: [], rsvps: [], guests: [], invitations: [] });

  // Keep non-admins out with a clean redirect (the rules also block the reads).
  useEffect(() => {
    if (currentUser && !isAdmin) navigate('/satsangs');
  }, [currentUser, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    async function load() {
      try {
        const [s, u, r, g, i] = await Promise.all([
          getDocs(collection(db, 'satsangs')),
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'rsvps')),
          getDocs(collection(db, 'guests')),
          getDocs(collection(db, 'invitations')),
        ]);
        const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setData({ satsangs: rows(s), users: rows(u), rsvps: rows(r), guests: rows(g), invitations: rows(i) });
      } catch (e) {
        console.error('Admin load failed:', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isAdmin]);

  const stats = useMemo(() => {
    const { satsangs, users, rsvps, guests, invitations } = data;
    const isPublic = s => s.publicInvite === true;
    const publicCount = satsangs.filter(isPublic).length;

    // RSVP rollup per satsang.
    const rsvpByInvite = {};
    rsvps.forEach(r => {
      if (!r.inviteId) return;
      const e = rsvpByInvite[r.inviteId] || { responses: 0, attending: 0 };
      e.responses += 1;
      e.attending += (r.adults || 0) + (r.children || 0);
      rsvpByInvite[r.inviteId] = e;
    });
    // "Reach" = how many people were invited/opened (guest + invitation grants).
    const reachByInvite = {};
    [...guests, ...invitations].forEach(x => {
      if (!x.inviteId) return;
      reachByInvite[x.inviteId] = (reachByInvite[x.inviteId] || 0) + 1;
    });

    const rows = satsangs.map(s => {
      const rv = rsvpByInvite[s.id] || { responses: 0, attending: 0 };
      return {
        id: s.id,
        created: s.createdAt,
        date: s.date,
        location: s.suburb || (s.address ? String(s.address).split('\n')[0] : '') || '—',
        host: s.hostName || '—',
        isPublic: isPublic(s),
        reach: reachByInvite[s.id] || 0,
        responses: rv.responses,
        attending: rv.attending,
      };
    });
    rows.sort((a, b) => (millis(b.created) || millis(b.date)) - (millis(a.created) || millis(a.date)));

    // Per-host breakdown (answers "who created private invites").
    const hostMap = {};
    satsangs.forEach(s => {
      const key = s.hostUid || s.hostName || 'unknown';
      const e = hostMap[key] || { name: s.hostName || 'Unknown', total: 0, private: 0, public: 0 };
      e.total += 1;
      if (isPublic(s)) e.public += 1; else e.private += 1;
      hostMap[key] = e;
    });
    const hosts = Object.values(hostMap).sort((a, b) => b.private - a.private || b.total - a.total);

    return {
      totalSatsangs: satsangs.length,
      publicCount,
      privateCount: satsangs.length - publicCount,
      totalUsers: users.length,
      totalResponses: rsvps.length,
      totalAttending: rsvps.reduce((n, r) => n + (r.adults || 0) + (r.children || 0), 0),
      rows,
      hosts,
    };
  }, [data]);

  if (!isAdmin) return <AppShell><p className="text-center text-gray-400 mt-8">Redirecting…</p></AppShell>;
  if (loading) return <AppShell><p className="text-center text-gray-400 mt-8">Loading dashboard…</p></AppShell>;
  if (error) return <AppShell><p className="text-center text-gray-400 mt-8">Could not load admin data.</p></AppShell>;

  const Card = ({ label, value, accent }) => (
    <div className="rounded-xl border-2 border-gray-100 bg-white p-3 text-center">
      <div className={`text-2xl font-bold ${accent || 'text-gray-800'}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{label}</div>
    </div>
  );

  return (
    <AppShell>
      <h1 className="page-header mt-4">Admin Dashboard</h1>
      <p className="text-center text-sm text-gray-500 mb-4">360° view of every satsang &amp; sangat</p>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-2 mb-1">
        <Card label="Satsangs" value={stats.totalSatsangs} />
        <Card label="Private" value={stats.privateCount} accent="text-blue-600" />
        <Card label="Public" value={stats.publicCount} accent="text-green-600" />
        <Card label="Users" value={stats.totalUsers} />
        <Card label="Responses" value={stats.totalResponses} accent="text-saffron-600" />
        <Card label="Attending" value={stats.totalAttending} accent="text-saffron-600" />
      </div>

      {/* Per-host breakdown — who created what */}
      <h2 className="text-saffron-500 font-semibold mt-6 mb-2">By host</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-saffron-400">
              <th className="text-left font-semibold pb-2 pr-3">Host</th>
              <th className="font-semibold pb-2 px-2">Total</th>
              <th className="font-semibold pb-2 px-2">Private</th>
              <th className="font-semibold pb-2 pl-2">Public</th>
            </tr>
          </thead>
          <tbody>
            {stats.hosts.map((h, idx) => (
              <tr key={idx} className="border-t border-gray-100">
                <td className="py-2 pr-3 text-gray-800">{h.name}</td>
                <td className="py-2 px-2 text-center text-gray-700">{h.total}</td>
                <td className="py-2 px-2 text-center text-blue-700 font-semibold">{h.private || ''}</td>
                <td className="py-2 pl-2 text-center text-green-700">{h.public || ''}</td>
              </tr>
            ))}
            {stats.hosts.length === 0 && (
              <tr><td colSpan={4} className="py-4 text-center text-gray-400">No satsangs yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Full list, newest first */}
      <h2 className="text-saffron-500 font-semibold mt-6 mb-2">All satsangs ({stats.rows.length})</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="text-saffron-400">
              <th className="text-left font-semibold pb-2 pr-3">Created</th>
              <th className="text-left font-semibold pb-2 pr-3">Event</th>
              <th className="text-left font-semibold pb-2 pr-3">Location</th>
              <th className="text-left font-semibold pb-2 pr-3">Host</th>
              <th className="font-semibold pb-2 px-2">Type</th>
              <th className="font-semibold pb-2 px-2">Reach</th>
              <th className="font-semibold pb-2 px-2">RSVP</th>
              <th className="font-semibold pb-2 pl-2">Attn</th>
            </tr>
          </thead>
          <tbody>
            {stats.rows.map(r => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="py-2 pr-3 text-gray-500">{fmtDate(r.created)}</td>
                <td className="py-2 pr-3 text-gray-700">{fmtDate(r.date)}</td>
                <td className="py-2 pr-3 text-gray-700 max-w-[8rem] truncate">{r.location}</td>
                <td className="py-2 pr-3 text-gray-700 max-w-[8rem] truncate">{r.host}</td>
                <td className="py-2 px-2 text-center">
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${r.isPublic ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {r.isPublic ? 'Public' : 'Private'}
                  </span>
                </td>
                <td className="py-2 px-2 text-center text-gray-700">{r.reach || ''}</td>
                <td className="py-2 px-2 text-center text-gray-700">{r.responses || ''}</td>
                <td className="py-2 pl-2 text-center text-gray-700">{r.attending || ''}</td>
              </tr>
            ))}
            {stats.rows.length === 0 && (
              <tr><td colSpan={8} className="py-4 text-center text-gray-400">No satsangs yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
