import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import AppShell from '../components/AppShell';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
// Share Invite temporarily disabled (per request) — re-enable this import with the button below.
// import { shareInvite } from '../utils/contacts';

export default function ViewInvite() {
  const { inviteId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, 'satsangs', inviteId)).then(snap => {
      if (snap.exists()) setInvite({ id: snap.id, ...snap.data() });
      setLoading(false);
    });
  }, [inviteId]);

  if (loading) return <AppShell><p className="text-center text-gray-400 mt-8">Loading…</p></AppShell>;
  if (!invite)  return <AppShell><p className="text-center text-gray-400 mt-8">Invite not found.</p></AppShell>;

  const isHost = currentUser?.uid === invite.hostUid;
  const dateStr = invite.date
    ? format(invite.date.toDate(), 'd MMMM yyyy')
    : '—';

  // Share Invite temporarily disabled (per request) — re-enable with the import & button.
  // function handleShare() {
  //   const rsvpLink = `${window.location.origin}/invite/${inviteId}/rsvp`;
  //   shareInvite(
  //     {
  //       dateStr,
  //       startTime: invite.startTime,
  //       endTime: invite.endTime,
  //       address: invite.address,
  //       rsvpBy: invite.rsvpBy,
  //     },
  //     rsvpLink,
  //     invite.hostName,
  //   );
  // }

  function Row({ label, value, multiline }) {
    if (!value) return null;
    return (
      <div className="flex gap-3 py-2 border-b border-gray-100 last:border-0">
        <span className="font-semibold text-gray-600 text-sm w-28 shrink-0 pt-0.5">{label}</span>
        <span className={`text-gray-800 text-sm ${multiline ? 'whitespace-pre-line' : ''}`}>{value}</span>
      </div>
    );
  }

  return (
    <AppShell>
      <h1 className="page-header mt-4">Satsang Seva</h1>
      <div className="card mb-6">
        <Row label="Date"         value={dateStr} />
        <Row label="Start Time"   value={invite.startTime} />
        <Row label="End Time"     value={invite.endTime} />
        <Row label="Address"      value={invite.address} multiline />
        <Row label="RSVP"         value={invite.rsvpContact} multiline />
        <Row label="RSVP By"      value={invite.rsvpBy} />
        <Row label="Instructions" value={invite.instructions} multiline />
        {invite.imageUrl && (
          <div className="flex gap-3 py-2">
            <span className="font-semibold text-gray-600 text-sm w-28 shrink-0 pt-0.5">Image</span>
            <img src={invite.imageUrl} alt="Satsang" className="h-28 rounded-xl object-cover" />
          </div>
        )}
        <Row label="Booking Type" value={invite.publicInvite ? 'Public' : 'Private'} />
      </div>

      {/* Share Invite temporarily disabled (per request) — re-enable when ready:
      <button className="btn-primary" onClick={handleShare}>
        📲 Share Invite
      </button>
      */}

      <div className="flex gap-3 mt-3">
        {isHost && (
          <button
            className="btn-secondary flex-1"
            onClick={() => navigate(`/edit-invite/${inviteId}`)}
          >
            Edit
          </button>
        )}
        <button
          className="btn-secondary flex-1"
          onClick={() => navigate(`/invite/${inviteId}/invite-sangat`)}
        >
          Invite Sangat
        </button>
      </div>

      {/* RSVP button visible to all */}
      <button
        className="btn-secondary mt-3"
        onClick={() => navigate(`/invite/${inviteId}/rsvp`)}
      >
        RSVP
      </button>

      <button
        className="mt-4 text-sm text-saffron-600 w-full text-center hover:underline"
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>
    </AppShell>
  );
}
