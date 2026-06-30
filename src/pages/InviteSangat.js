import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection, getDocs, query, where, doc, getDoc, setDoc, Timestamp,
} from 'firebase/firestore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import AppShell from '../components/AppShell';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import {
  isContactPickerSupported, pickContacts, normalizePhone,
  buildInviteMessage, buildWhatsAppLink,
} from '../utils/contacts';

export default function InviteSangat() {
  const { inviteId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  // App users (existing flow)
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');

  // Phone-directory guests (new flow)
  const [invite, setInvite] = useState(null);
  const [guests, setGuests] = useState([]);          // [{ name, phone }]
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  const [sending, setSending] = useState(false);

  const hostName = userProfile
    ? `${userProfile.firstName} ${userProfile.lastName}`
    : '';

  useEffect(() => {
    // Registered sangat, sorted alphabetically (dictionary order) by full name.
    getDocs(collection(db, 'users')).then(snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.id !== currentUser.uid);
      list.sort((a, b) =>
        `${a.firstName} ${a.lastName}`.toLowerCase()
          .localeCompare(`${b.firstName} ${b.lastName}`.toLowerCase())
      );
      setUsers(list);
    });

    getDoc(doc(db, 'satsangs', inviteId)).then(snap => {
      if (snap.exists()) setInvite({ id: snap.id, ...snap.data() });
    });

    // Pre-tick people I've already invited, and re-load guests I've added, so a
    // host managing the event doesn't re-send or lose existing entries (#6).
    getDocs(query(collection(db, 'invitations'), where('fromUid', '==', currentUser.uid)))
      .then(snap => {
        const already = snap.docs
          .map(d => d.data())
          .filter(d => d.inviteId === inviteId)
          .map(d => d.toUid);
        if (already.length) setSelected(new Set(already));
      })
      .catch(() => {});

    getDocs(query(collection(db, 'guests'), where('addedByUid', '==', currentUser.uid)))
      .then(snap => {
        const mine = snap.docs
          .map(d => d.data())
          .filter(d => d.inviteId === inviteId)
          .map(d => ({ name: d.name, phone: d.displayPhone || d.phone }));
        if (mine.length) setGuests(mine);
      })
      .catch(() => {});
  }, [currentUser.uid, inviteId]);

  function toggleUser(id) {
    setSelected(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ---- Phone-directory helpers ---------------------------------------------

  function addGuest(name, phone) {
    const raw = (phone || '').trim();
    if (!raw) return toast.error('A phone number is required.');
    const norm = normalizePhone(raw);
    setGuests(g => {
      // Dedupe by normalized number so "0404…", "+61404…" and "61404…" match.
      if (g.some(x => normalizePhone(x.phone) === norm)) {
        toast('Already added', { icon: 'ℹ️' });
        return g;
      }
      return [...g, { name: (name || '').trim() || raw, phone: raw }];
    });
  }

  function removeGuest(phone) {
    setGuests(g => g.filter(x => x.phone !== phone));
  }

  async function importFromPhone() {
    const picked = await pickContacts();
    if (picked.length === 0) return;
    let added = 0;
    setGuests(g => {
      const existing = new Set(g.map(x => normalizePhone(x.phone)));
      const fresh = [];
      picked.forEach(c => {
        const raw = (c.phone || '').trim();
        const norm = normalizePhone(raw);
        if (raw && norm && !existing.has(norm)) {
          existing.add(norm);
          fresh.push({ name: c.name || raw, phone: raw });
        }
      });
      added = fresh.length;
      return [...g, ...fresh];
    });
    toast.success(`${added} contact${added === 1 ? '' : 's'} added`);
  }

  function handleManualAdd() {
    if (!manualPhone.trim()) return toast.error('Enter a phone number.');
    addGuest(manualName, manualPhone);
    setManualName('');
    setManualPhone('');
  }

  const rsvpLink = `${window.location.origin}/invite/${inviteId}/rsvp`;
  const inviteMeta = invite && {
    dateStr: invite.date ? format(invite.date.toDate(), 'd MMMM yyyy') : '',
    startTime: invite.startTime,
    endTime: invite.endTime,
    address: invite.address,
    rsvpBy: invite.rsvpBy,
  };

  function whatsappLinkFor(guest) {
    const message = buildInviteMessage(inviteMeta, rsvpLink, hostName);
    return buildWhatsAppLink(guest.phone, message);
  }

  // ---- Send ----------------------------------------------------------------

  async function sendInvites() {
    if (selected.size === 0 && guests.length === 0) {
      return toast.error('Select sangat or add a contact to invite.');
    }
    setSending(true);
    try {
      // Deterministic ids ("<inviteId>_<uid>" / "<inviteId>_<phone>") make
      // re-sending idempotent — no duplicate invites (#6) — and act as the
      // access grant the security rules check.
      const appUserWrites = [...selected].map(uid =>
        setDoc(doc(db, 'invitations', `${inviteId}_${uid}`), {
          inviteId,
          toUid: uid,
          fromUid: currentUser.uid,
          sentAt: Timestamp.now(),
          status: 'sent',
        })
      );
      const guestWrites = guests
        .map(g => ({ ...g, norm: normalizePhone(g.phone) }))
        .filter(g => g.norm)
        .map(g =>
          setDoc(doc(db, 'guests', `${inviteId}_${g.norm}`), {
            inviteId,
            name: g.name,
            phone: g.norm,
            displayPhone: g.phone,
            addedByUid: currentUser.uid,
            source: 'phone-directory',
            invitedAt: Timestamp.now(),
          })
        );
      await Promise.all([...appUserWrites, ...guestWrites]);
      const total = selected.size + guestWrites.length;
      toast.success(`${total} invite${total === 1 ? '' : 's'} sent!`);
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

      {/* ---- Registered sangat ---- */}
      <h2 className="text-saffron-500 font-semibold mb-2">Registered Sangat</h2>
      <input
        className="input-field mb-4"
        placeholder="Search by name or mobile…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <p className="text-sm text-gray-500 mb-3">
        {selected.size} selected · {users.length} registered sangat
      </p>

      <div className="flex flex-col gap-2 max-h-72 overflow-y-auto mb-6">
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

      {/* ---- Invite from phone directory ---- */}
      <h2 className="text-saffron-500 font-semibold mb-2">Invite from your phone</h2>

      {isContactPickerSupported() && (
        <button
          type="button"
          className="btn-secondary mb-3"
          onClick={importFromPhone}
        >
          📇 Pick from Phone Contacts
        </button>
      )}

      {/* Manual add */}
      <div className="flex gap-2 mb-3">
        <input
          className="input-field"
          placeholder="Name"
          value={manualName}
          onChange={e => setManualName(e.target.value)}
        />
        <input
          className="input-field"
          placeholder="Phone (e.g. 0404…)"
          value={manualPhone}
          inputMode="tel"
          onChange={e => setManualPhone(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleManualAdd(); } }}
        />
        <button
          type="button"
          className="text-saffron-600 font-semibold whitespace-nowrap hover:text-saffron-800 px-2"
          onClick={handleManualAdd}
        >
          Add
        </button>
      </div>

      {/* Guest list */}
      {guests.length > 0 && (
        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto mb-4">
          {guests.map(g => (
            <div
              key={g.phone}
              className="flex items-center gap-3 p-3 rounded-xl border-2 border-blue-100 bg-blue-50"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm truncate">{g.name}</p>
                <p className="text-xs text-gray-400">{g.phone}</p>
              </div>
              <a
                href={whatsappLinkFor(g)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 font-semibold text-sm whitespace-nowrap hover:text-green-700"
              >
                WhatsApp
              </a>
              <button
                type="button"
                onClick={() => removeGuest(g.phone)}
                className="text-gray-400 hover:text-red-500 text-lg leading-none"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mb-4 text-center">
        Tap <span className="text-green-600 font-medium">WhatsApp</span> to send each guest
        their invite &amp; RSVP link.
      </p>

      <button className="btn-primary" onClick={sendInvites} disabled={sending}>
        {sending ? 'Sending…' : `Send Invites (${selected.size + guests.length})`}
      </button>
    </AppShell>
  );
}
