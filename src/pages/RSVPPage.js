import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc, getDoc, collection, addDoc, updateDoc, query, where, getDocs, Timestamp,
} from 'firebase/firestore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import AppShell from '../components/AppShell';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { showError } from '../utils/notify';

const MAX_PER_KIND = 7;

// A 0–7 stepper ("ticker"). Defaults come from the parent; the buttons clamp so
// the count can never leave the allowed range.
function Counter({ label, value, setValue, disabled }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-saffron-600 text-sm font-semibold">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={disabled || value <= 0}
          onClick={() => setValue(v => Math.max(0, v - 1))}
          className="w-9 h-9 rounded-full border-2 border-saffron-200 text-saffron-600 text-xl font-bold leading-none flex items-center justify-center disabled:opacity-40"
        >
          −
        </button>
        <span className="w-6 text-center font-semibold text-gray-800">{value}</span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={disabled || value >= MAX_PER_KIND}
          onClick={() => setValue(v => Math.min(MAX_PER_KIND, v + 1))}
          className="w-9 h-9 rounded-full border-2 border-saffron-200 text-saffron-600 text-xl font-bold leading-none flex items-center justify-center disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function RSVPPage() {
  const { inviteId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const [invite, setInvite] = useState(null);
  const [adults, setAdults] = useState(0);
  const [children, setChildren] = useState(0);
  const [requestSeva, setRequestSeva] = useState(false);
  const [rsvpDocId, setRsvpDocId] = useState(null);   // set once we find an existing RSVP
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'satsangs', inviteId)).then(snap => {
      if (snap.exists()) setInvite({ id: snap.id, ...snap.data() });
    });
  }, [inviteId]);

  // Load this user's existing RSVP (if any) so re-opening shows their saved
  // numbers and lets them edit rather than being blocked as a duplicate.
  useEffect(() => {
    if (!currentUser) return;
    getDocs(query(collection(db, 'rsvps'), where('uid', '==', currentUser.uid)))
      .then(snap => {
        const mine = snap.docs.find(d => d.data().inviteId === inviteId);
        if (mine) {
          const d = mine.data();
          setRsvpDocId(mine.id);
          setAdults(d.adults || 0);
          setChildren(d.children || 0);
          setRequestSeva(!!d.requestSeva);
        }
      })
      .catch(() => {});
  }, [inviteId, currentUser]);

  // Editing is allowed until the satsang day has passed. Compare by day so an
  // event happening later today is still editable.
  const isPast = (() => {
    if (!invite?.date) return false;
    const eventDay = invite.date.toDate();
    eventDay.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDay < today;
  })();

  async function handleRSVP() {
    if (isPast) {
      return showError('This satsang has already taken place — RSVP can no longer be changed.');
    }
    if (adults + children < 1) {
      return showError('Please add at least one adult or child.');
    }
    setSaving(true);
    try {
      if (rsvpDocId) {
        // Update the existing RSVP in place — editable any time before the event.
        await updateDoc(doc(db, 'rsvps', rsvpDocId), {
          adults,
          children,
          requestSeva,
          updatedAt: Timestamp.now(),
        });
        toast.success('RSVP updated! Jai Guruji 🙏');
      } else {
        const ref = await addDoc(collection(db, 'rsvps'), {
          inviteId,
          uid: currentUser.uid,
          name: userProfile
            ? `${userProfile.firstName} ${userProfile.lastName}`
            : currentUser.email,
          adults,
          children,
          requestSeva,
          createdAt: Timestamp.now(),
        });
        setRsvpDocId(ref.id);
        toast.success('RSVP confirmed! Jai Guruji 🙏');
      }
      // Only the host sees the RSVP list, so send everyone back to the invite.
      navigate(`/invite/${inviteId}`);
    } catch (err) {
      console.error(err);
      showError('Could not save RSVP. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <h1 className="page-header mt-4">Satsang Seva</h1>
      {invite && (
        <div className="card mb-6">
          <p className="text-sm text-gray-500 mb-1">
            {invite.date ? format(invite.date.toDate(), 'd MMMM yyyy') : ''}
          </p>
          <p className="font-semibold text-gray-800">{invite.suburb || invite.address?.split('\n')[0]}</p>
          <p className="text-sm text-gray-500">{invite.startTime} – {invite.endTime}</p>
        </div>
      )}

      {rsvpDocId && !isPast && (
        <p className="text-sm text-gray-500 mb-3 text-center">
          You've already RSVPed — update your numbers below any time before the satsang.
        </p>
      )}
      {isPast && (
        <p className="text-sm text-gray-500 mb-3 text-center">
          This satsang has passed, so your RSVP can no longer be changed.
        </p>
      )}

      <div className="card flex flex-col gap-5">
        {/* Request Seva */}
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-700 text-sm">Request Seva</span>
          <input
            type="checkbox"
            checked={requestSeva}
            disabled={isPast}
            onChange={e => setRequestSeva(e.target.checked)}
            className="w-5 h-5 accent-saffron-400"
          />
        </div>

        {/* No. of RSVP — 0–7 steppers */}
        <div className="flex flex-col gap-3">
          <span className="font-semibold text-gray-700 text-sm">
            No. of RSVP <span className="text-gray-400 font-normal">(up to {MAX_PER_KIND} each)</span>
          </span>
          <Counter label="Adults" value={adults} setValue={setAdults} disabled={isPast} />
          <Counter label="Children" value={children} setValue={setChildren} disabled={isPast} />
        </div>

        <button className="btn-primary" onClick={handleRSVP} disabled={saving || isPast}>
          {saving ? 'Saving…' : rsvpDocId ? 'Update RSVP' : 'RSVP'}
        </button>
      </div>
    </AppShell>
  );
}
