import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, addDoc, Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import AppShell from '../components/AppShell';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

export default function InviteSangat() {
  const { inviteId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getDocs(query(collection(db, 'users'), orderBy('firstName'))).then(snap => {
      setUsers(snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.id !== currentUser.uid)
      );
    });
  }, [currentUser.uid]);

  function toggleUser(id) {
    setSelected(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function sendInvites() {
    if (selected.size === 0) return toast.error('Please select at least one person.');
    setSending(true);
    try {
      const batch = [...selected].map(uid =>
        addDoc(collection(db, 'invitations'), {
          inviteId,
          toUid: uid,
          fromUid: currentUser.uid,
          sentAt: Timestamp.now(),
          status: 'sent',
        })
      );
      await Promise.all(batch);
      toast.success(`Invites sent to ${selected.size} sangat!`);
      navigate(`/invite/${inviteId}/invited`);
    } catch (err) {
      console.error(err);
      toast.error('Could not send invites. Please try again.');
    } finally {
      setSending(false);
    }
  }

  const filtered = users.filter(u =>
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    (u.mobile || '').includes(search)
  );

  return (
    <AppShell>
      <h1 className="page-header mt-4">Satsang Seva</h1>

      <input
        className="input-field mb-4"
        placeholder="Search by name or mobile…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <p className="text-sm text-gray-500 mb-3">
        {selected.size} selected · {users.length} registered sangat
      </p>

      <div className="flex flex-col gap-2 max-h-96 overflow-y-auto mb-6">
        {filtered.map(u => (
          <label
            key={u.id}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
              selected.has(u.id)
                ? 'border-saffron-400 bg-saffron-50'
                : 'border-gray-100 bg-white hover:border-saffron-200'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(u.id)}
              onChange={() => toggleUser(u.id)}
              className="accent-saffron-400 w-4 h-4"
            />
            <div>
              <p className="font-semibold text-gray-800 text-sm">
                {u.firstName} {u.lastName}
              </p>
              <p className="text-xs text-gray-400">{u.mobile || u.email}</p>
            </div>
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-6">No sangat found</p>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-4 text-center">
        Sangat not on the app will receive a WhatsApp message to download and view their invite.
      </p>

      <button className="btn-primary" onClick={sendInvites} disabled={sending}>
        {sending ? 'Sending…' : `Send Invites (${selected.size})`}
      </button>
    </AppShell>
  );
}
