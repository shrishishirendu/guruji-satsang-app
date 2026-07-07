import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import AppShell from '../components/AppShell';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { formatRsvpBy } from '../utils/dates';

// WhatsApp brand glyph (simple-icons path). Rendered in WhatsApp green so the
// share action stands out and is instantly recognisable, while the button
// itself stays .btn-secondary to match the other invite-page buttons.
function WhatsAppIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#25D366" role="img" aria-label="WhatsApp">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.358.101 11.892c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a11.9 11.9 0 005.71 1.447h.006c6.585 0 11.946-5.359 11.949-11.893a11.821 11.821 0 00-3.481-8.413z" />
    </svg>
  );
}

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
            className="btn-secondary text-sm mt-3"
            onClick={() => navigate(`/invite/${inviteId}/invite-unregistered?mode=share`)}
          >
            <span className="inline-flex items-center justify-center gap-2">
              Share Invite via
              <WhatsAppIcon className="h-5 w-5" />
            </span>
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
