import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import AppShell from '../components/AppShell';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { formatRsvpBy } from '../utils/dates';

export default function ViewInvite() {
  const { inviteId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, 'satsangs', inviteId))
      .then(snap => {
        if (snap.exists()) setInvite({ id: snap.id, ...snap.data() });
        setLoading(false);
      })
      // A private satsang the user isn't invited to is denied by the rules —
      // leave invite null so it shows "not found" rather than crashing.
      .catch(() => setLoading(false));
  }, [inviteId]);

  if (loading) return <AppShell><p className="text-center text-gray-400 mt-8">Loading…</p></AppShell>;
  if (!invite)  return <AppShell><p className="text-center text-gray-400 mt-8">Invite not found.</p></AppShell>;

  const isHost = currentUser?.uid === invite.hostUid;
  // Who may invite others: the host always; for a private satsang only the host,
  // but a public satsang may be forwarded by anyone who can see it. Mirrors
  // canForward() in firestore.rules.
  const canInvite = isHost || invite.publicInvite === true;
  const dateStr = invite.date
    ? format(invite.date.toDate(), 'd MMMM yyyy')
    : '—';

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
        <Row label="RSVP By"      value={formatRsvpBy(invite.rsvpBy)} />
        <Row label="Instructions" value={invite.instructions} multiline />
        {invite.imageUrl && (
          <div className="flex gap-3 py-2">
            <span className="font-semibold text-gray-600 text-sm w-28 shrink-0 pt-0.5">Image</span>
            <img src={invite.imageUrl} alt="Satsang" className="h-28 rounded-xl object-cover" />
          </div>
        )}
        <Row label="Booking Type" value={invite.publicInvite ? 'Public' : 'Private'} />
      </div>

      {/* Row 1: Edit + Invite registered Sangat on one line. .btn-secondary sets
          w-full, so Edit needs an inline width:auto to shrink to its text and
          NOT push the longer button off-screen; the label takes the rest. */}
      {canInvite && (
        <div className="flex gap-3">
          {isHost && (
            <button
              className="btn-secondary flex-none px-5 text-sm"
              style={{ width: 'auto' }}
              onClick={() => navigate(`/edit-invite/${inviteId}`)}
            >
              Edit
            </button>
          )}
          <button
            className="btn-secondary flex-1 px-3 text-sm whitespace-nowrap"
            onClick={() => navigate(`/invite/${inviteId}/invite-sangat`)}
          >
            Invite Registered Sangat
          </button>
        </div>
      )}

      {/* Row 2: invite people who aren't on the app yet — two explicit choices.
          Manually → the capture screen, where each invitee's number is recorded
          so a private-satsang guest gets access once they register. Share via
          WhatsApp → the phone's share sheet with the invite & RSVP link. */}
      {isHost && (
        <>
          <button
            className="btn-secondary text-sm mt-3"
            onClick={() => navigate(`/invite/${inviteId}/invite-unregistered`)}
          >
            Invite Unregistered Sangat Manually
          </button>
          <button
            className="btn-primary text-sm mt-3"
            onClick={() => navigate(`/invite/${inviteId}/invite-unregistered?mode=share`)}
          >
            Share Invite via WhatsApp
          </button>
        </>
      )}

      {/* Guests RSVP; the host doesn't RSVP to their own event */}
      {!isHost && (
        <button
          className="btn-secondary text-sm mt-3"
          onClick={() => navigate(`/invite/${inviteId}/rsvp`)}
        >
          RSVP
        </button>
      )}

      {/* Row 3: only the host can see who has responded */}
      {isHost && (
        <button
          className="btn-secondary text-sm mt-3"
          onClick={() => navigate(`/invite/${inviteId}/rsvp-list`)}
        >
          View Invite list &amp; RSVP
        </button>
      )}
    </AppShell>
  );
}
