import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import AppShell from '../components/AppShell';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { shareInvite, normalizePhone } from '../utils/contacts';
import { showError } from '../utils/notify';
import { formatRsvpBy } from '../utils/dates';

export default function ViewInvite() {
  const { inviteId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareName, setShareName] = useState('');
  const [sharePhone, setSharePhone] = useState('');
  const [sharing, setSharing] = useState(false);

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

  function handleShare() {
    const rsvpLink = `${window.location.origin}/invite/${inviteId}/rsvp`;
    shareInvite(
      {
        dateStr,
        startTime: invite.startTime,
        endTime: invite.endTime,
        address: invite.address,
        rsvpBy: formatRsvpBy(invite.rsvpBy),
      },
      rsvpLink,
      invite.hostName,
    );
  }

  // Record who's being invited, THEN open the share sheet. A blind share sheet
  // never tells us the recipient, so we capture their mobile up front and write
  // the same deterministic guest grant the phone flow uses. That both saves them
  // to the invite list and — via the security rules — lets them see this satsang
  // (and get a calendar entry) once they sign in with this number.
  async function recordAndShare() {
    const norm = normalizePhone(sharePhone);
    if (!norm) {
      return showError('Enter a mobile number so the invite is saved and they can see this satsang.');
    }
    setSharing(true);
    try {
      await setDoc(doc(db, 'guests', `${inviteId}_${norm}`), {
        inviteId,
        name: (shareName || '').trim() || sharePhone.trim(),
        phone: norm,
        displayPhone: sharePhone.trim(),
        addedByUid: currentUser.uid,
        source: 'share-invite',
        invitedAt: Timestamp.now(),
      });
      handleShare();                 // open the share sheet to actually send it
      setShareOpen(false);
      setShareName('');
      setSharePhone('');
      toast.success('Invite saved — now pick how to send it.');
    } catch (err) {
      console.error(err);
      showError('Could not save the invite. Please try again.');
    } finally {
      setSharing(false);
    }
  }

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

      {/* Row 2: host shares to a phone contact — records the recipient (see
          recordAndShare) before opening the share sheet. Same outline style as
          the other buttons, no saffron fill. */}
      {isHost && (
        <>
          <button className="btn-secondary mt-3" onClick={() => setShareOpen(o => !o)}>
            Invite Unregistered Sangat
          </button>
          {shareOpen && (
            <div className="card mt-3">
              <p className="text-sm text-gray-600 mb-3">
                Add who you’re inviting so they’re saved to your list and can see
                this {invite.publicInvite ? '' : 'private '}satsang, then choose how to send it.
              </p>
              <input
                className="input-field mb-2"
                placeholder="Name (optional)"
                value={shareName}
                onChange={e => setShareName(e.target.value)}
              />
              <input
                className="input-field mb-3"
                type="tel"
                placeholder="Mobile number"
                value={sharePhone}
                onChange={e => setSharePhone(e.target.value)}
              />
              <div className="flex gap-3">
                <button
                  className="btn-secondary flex-1"
                  onClick={() => setShareOpen(false)}
                  disabled={sharing}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary flex-1"
                  onClick={recordAndShare}
                  disabled={sharing}
                >
                  {sharing ? 'Saving…' : 'Record & Share'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Guests RSVP; the host doesn't RSVP to their own event */}
      {!isHost && (
        <button
          className="btn-secondary mt-3"
          onClick={() => navigate(`/invite/${inviteId}/rsvp`)}
        >
          RSVP
        </button>
      )}

      {/* Row 3: only the host can see who has responded */}
      {isHost && (
        <button
          className="btn-secondary mt-3"
          onClick={() => navigate(`/invite/${inviteId}/rsvp-list`)}
        >
          View Invite list &amp; RSVP
        </button>
      )}
    </AppShell>
  );
}
