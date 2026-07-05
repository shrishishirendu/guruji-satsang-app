import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection, getDocs, query, where, doc, getDoc, setDoc, Timestamp,
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import AppShell from '../components/AppShell';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { normalizePhone } from '../utils/contacts';
import { showError } from '../utils/notify';

export default function InviteSangat() {
  const { inviteId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Registered app users to invite.
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');

  const [invite, setInvite] = useState(null);
  const [sending, setSending] = useState(false);

  // Baseline of who was ALREADY invited when this page opened, so re-opening to
  // add people only sends grants to the newly-added ones (accurate count, no
  // re-stamping) and we can badge existing invitees as "Invited".
  const [invitedUids, setInvitedUids] = useState(new Set());
  const [invitedPhones, setInvitedPhones] = useState(new Set());

  useEffect(() => {
    // Registered sangat, sorted alphabetically (dictionary order) by full name.
    getDocs(collection(db, 'users')).then(snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.id !== currentUser.uid);
      // Dedupe by normalized phone so someone who registered more than once (or
      // shares a number) shows up only once in the sangat list. Users with no
      // number are all kept — there's no phone to collide on.
      const seenPhones = new Set();
      const deduped = list.filter(u => {
        const key = normalizePhone(u.mobile || '');
        if (!key) return true;
        if (seenPhones.has(key)) return false;
        seenPhones.add(key);
        return true;
      });
      deduped.sort((a, b) =>
        `${a.firstName} ${a.lastName}`.toLowerCase()
          .localeCompare(`${b.firstName} ${b.lastName}`.toLowerCase())
      );
      setUsers(deduped);
    });

    getDoc(doc(db, 'satsangs', inviteId)).then(snap => {
      if (snap.exists()) setInvite({ id: snap.id, ...snap.data() });
    });

    // Pre-tick registered people I've already invited, so a host managing the
    // event doesn't re-send existing invites (#6).
    getDocs(query(collection(db, 'invitations'), where('fromUid', '==', currentUser.uid)))
      .then(snap => {
        const already = snap.docs
          .map(d => d.data())
          .filter(d => d.inviteId === inviteId)
          .map(d => d.toUid);
        if (already.length) {
          setSelected(new Set(already));
          setInvitedUids(new Set(already));
        }
      })
      .catch(() => {});

    // Phone/WhatsApp guests this host previously invited. Kept only to badge
    // "Invited" on anyone who has since registered and now appears in the
    // Registered Sangat list above (matched by number). Unregistered invites
    // themselves are sent from the "Invite Unregistered Sangat" flow.
    getDocs(query(collection(db, 'guests'), where('addedByUid', '==', currentUser.uid)))
      .then(snap => {
        const phones = snap.docs
          .map(d => d.data())
          .filter(d => d.inviteId === inviteId)
          .map(d => normalizePhone(d.displayPhone || d.phone))
          .filter(Boolean);
        if (phones.length) setInvitedPhones(new Set(phones));
      })
      .catch(() => {});
  }, [currentUser.uid, inviteId]);

  // Guard: for a private satsang only the host may invite others (mirrors
  // canForward() in firestore.rules). Blocks a non-host who reaches this page
  // via a direct URL, so they get a clear message instead of a failed send.
  useEffect(() => {
    if (invite && !(currentUser.uid === invite.hostUid || invite.publicInvite === true)) {
      showError('Only the host can invite others to a private satsang.');
      navigate(`/invite/${inviteId}`);
    }
  }, [invite, currentUser.uid, inviteId, navigate]);

  function toggleUser(id) {
    setSelected(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ---- Send ----------------------------------------------------------------

  async function sendInvites() {
    if (selected.size === 0) {
      return showError('Select sangat to invite.');
    }
    // Only send to people who weren't already invited when the page opened, so
    // re-opening to add more people sends just the new ones (accurate count) and
    // updates the existing invite rather than re-stamping everyone.
    const newUids = [...selected].filter(uid => !invitedUids.has(uid));

    if (newUids.length === 0) {
      return toast('Everyone selected is already invited — pick someone new to update the invite.', { icon: 'ℹ️' });
    }

    setSending(true);
    try {
      // Deterministic ids ("<inviteId>_<uid>") make re-sending idempotent — no
      // duplicate invites (#6) — and act as the access grant the security rules
      // check.
      const appUserWrites = newUids.map(uid =>
        setDoc(doc(db, 'invitations', `${inviteId}_${uid}`), {
          inviteId,
          toUid: uid,
          fromUid: currentUser.uid,
          sentAt: Timestamp.now(),
          status: 'sent',
        })
      );
      await Promise.all(appUserWrites);
      toast.success(`${newUids.length} invite${newUids.length === 1 ? '' : 's'} sent!`);
      navigate(`/invite/${inviteId}/invited`);
    } catch (err) {
      console.error(err);
      showError('Could not send invites. Please try again.');
    } finally {
      setSending(false);
    }
  }

  const filtered = users.filter(u =>
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    (u.mobile || '').includes(search)
  );

  // Badge "Invited" on a registered user who was already invited — either
  // directly (uid) or earlier by phone before they registered (matched by
  // number, via the "Invite Unregistered Sangat" flow).
  const phoneOf = u => u.mobileNormalized || normalizePhone(u.mobile || '');
  const isUserInvited = u => invitedUids.has(u.id) || invitedPhones.has(phoneOf(u));

  // How many selected people are newly added vs. already invited — drives the
  // Send count so the host sees exactly how many new invites will go out.
  const newCount = [...selected].filter(uid => !invitedUids.has(uid)).length;
  const hasExisting = invitedUids.size > 0 || invitedPhones.size > 0;

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

      <p className="text-sm text-gray-500 mb-1">
        {selected.size} selected · {users.length} registered sangat
      </p>
      {hasExisting && (
        <p className="text-xs text-gray-400 mb-3">
          People already invited are marked{' '}
          <span className="text-green-700 font-medium">Invited</span>. Select anyone
          new, then Send — only the new people are notified.
        </p>
      )}

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
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-800 truncate">
                <span className="font-semibold">{u.firstName} {u.lastName}</span>
                {(u.mobile || u.email) && (
                  <span className="text-gray-400 font-normal"> ({u.mobile || u.email})</span>
                )}
              </p>
            </div>
            {isUserInvited(u) && (
              <span className="ml-auto text-[11px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full shrink-0">
                Invited
              </span>
            )}
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-6">No sangat found</p>
        )}
      </div>

      <button className="btn-primary" onClick={sendInvites} disabled={sending || newCount === 0}>
        {sending
          ? 'Sending…'
          : hasExisting
            ? `Send ${newCount} New Invite${newCount === 1 ? '' : 's'}`
            : `Send Invites (${newCount})`}
      </button>
    </AppShell>
  );
}
