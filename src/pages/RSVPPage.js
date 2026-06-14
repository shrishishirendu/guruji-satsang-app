import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import AppShell from '../components/AppShell';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

export default function RSVPPage() {
  const { inviteId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const [invite, setInvite] = useState(null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [requestSeva, setRequestSeva] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'satsangs', inviteId)).then(snap => {
      if (snap.exists()) setInvite({ id: snap.id, ...snap.data() });
    });
  }, [inviteId]);

  async function handleRSVP() {
    setSaving(true);
    try {
      // Check if already RSVPed
      const q = query(
        collection(db, 'rsvps'),
        where('inviteId', '==', inviteId),
        where('uid', '==', currentUser.uid),
      );
      const existing = await getDocs(q);
      if (!existing.empty) {
        toast.error("You've already RSVPed to this satsang.");
        setSaving(false);
        return;
      }

      await addDoc(collection(db, 'rsvps'), {
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
      toast.success('RSVP confirmed! Jai Guruji 🙏');
      navigate(`/invite/${inviteId}/rsvp-list`);
    } catch (err) {
      console.error(err);
      toast.error('Could not save RSVP. Please try again.');
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

      <div className="card flex flex-col gap-5">
        {/* Request Seva */}
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-700 text-sm">Request Seva</span>
          <input
            type="checkbox"
            checked={requestSeva}
            onChange={e => setRequestSeva(e.target.checked)}
            className="w-5 h-5 accent-saffron-400"
          />
        </div>

        {/* No. of RSVP */}
        <div className="flex items-center gap-4">
          <span className="font-semibold text-gray-700 text-sm">No. of RSVP</span>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-saffron-600 text-sm font-semibold">Adults</span>
            <input
              type="number"
              min={1}
              value={adults}
              onChange={e => setAdults(Number(e.target.value))}
              className="input-field text-center"
              style={{width: 60}}
            />
            <span className="text-saffron-600 text-sm font-semibold ml-2">Children</span>
            <input
              type="number"
              min={0}
              value={children}
              onChange={e => setChildren(Number(e.target.value))}
              className="input-field text-center"
              style={{width: 60}}
            />
          </div>
        </div>

        <button className="btn-primary" onClick={handleRSVP} disabled={saving}>
          {saving ? 'Saving…' : 'RSVP'}
        </button>
      </div>
    </AppShell>
  );
}
