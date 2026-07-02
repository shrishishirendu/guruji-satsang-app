import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection, addDoc, doc, getDoc, updateDoc, Timestamp
} from 'firebase/firestore';
import { parse, format } from 'date-fns';
import toast from 'react-hot-toast';
import AppShell from '../components/AppShell';
import { db } from '../firebase/config';
import { uploadImage } from '../cloudinary/upload';
import { useAuth } from '../context/AuthContext';
import { showError } from '../utils/notify';

// Time-picker options: hours 1–12, minutes in quarter-hour steps.
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = ['00', '15', '30', '45'];

// Coerce stored times (which may be '05' or off-step minutes) onto the picker.
function normHour(h) {
  const n = parseInt(h, 10);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? String(n) : '5';
}
function normMin(m) {
  const n = parseInt(m, 10);
  if (!Number.isFinite(n)) return '00';
  return String(Math.min(45, Math.round(n / 15) * 15)).padStart(2, '0');
}
function normAmPm(a) {
  return a === 'PM' ? 'PM' : 'AM';
}

export default function CreateEditInvite() {
  const { dateStr, inviteId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const isEdit = Boolean(inviteId);

  const [form, setForm] = useState({
    date:      dateStr || format(new Date(), 'yyyy-MM-dd'),
    startHour: '5', startMin: '00', startAmPm: 'AM',
    endHour:   '7', endMin:   '00', endAmPm:   'AM',
    address:   '',
    rsvpContact: '',
    rsvpBy:    '',
    instructions: '',
    suburb:    '',
    publicInvite: false,
  });
  const [imageFile, setImageFile] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) {
      getDoc(doc(db, 'satsangs', inviteId)).then(snap => {
        if (!snap.exists()) return;
        const d = snap.data();
        const [sh, sm, sa] = (d.startTime || '05:00 AM').split(/[: ]/);
        const [eh, em, ea] = (d.endTime   || '07:00 AM').split(/[: ]/);
        setForm({
          date: d.date
            ? format(d.date.toDate(), 'yyyy-MM-dd')
            : (dateStr || format(new Date(), 'yyyy-MM-dd')),
          startHour: normHour(sh), startMin: normMin(sm), startAmPm: normAmPm(sa),
          endHour:   normHour(eh), endMin:   normMin(em), endAmPm:   normAmPm(ea),
          address:   d.address      || '',
          rsvpContact: d.rsvpContact || '',
          rsvpBy:    d.rsvpBy       || '',
          instructions: d.instructions || '',
          suburb:    d.suburb        || '',
          publicInvite: d.publicInvite || false,
        });
        setExistingImageUrl(d.imageUrl || '');
      });
    }
  }, [isEdit, inviteId, dateStr]);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.suburb.trim()) {
      return showError('Suburb / Location name is required.');
    }
    if (!form.startHour) {
      return showError('Start Time is required.');
    }
    if (!form.address.trim() || !form.rsvpContact.trim()) {
      return showError('Address and RSVP contact are required.');
    }
    setSaving(true);
    try {
      let imageUrl = existingImageUrl;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const date = form.date
        ? Timestamp.fromDate(parse(form.date, 'yyyy-MM-dd', new Date()))
        : null;

      const payload = {
        date,
        startTime: `${form.startHour}:${form.startMin} ${form.startAmPm}`,
        endTime:   `${form.endHour}:${form.endMin} ${form.endAmPm}`,
        address:   form.address,
        rsvpContact: form.rsvpContact,
        rsvpBy:    form.rsvpBy,
        instructions: form.instructions,
        suburb:    form.suburb,
        imageUrl,
        publicInvite: form.publicInvite,
        hostUid:   currentUser.uid,
        hostName:  userProfile
          ? `${userProfile.firstName} ${userProfile.lastName}`
          : currentUser.email,
        updatedAt: Timestamp.now(),
      };

      if (isEdit) {
        await updateDoc(doc(db, 'satsangs', inviteId), payload);
        toast.success('Invite updated!');
        navigate(`/invite/${inviteId}`);
      } else {
        payload.createdAt = Timestamp.now();
        const ref2 = await addDoc(collection(db, 'satsangs'), payload);
        toast.success('Invite created!');
        navigate(`/invite/${ref2.id}`);
      }
    } catch (err) {
      console.error(err);
      showError('Could not save invite. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <h1 className="page-header mt-4">Satsang Seva</h1>
      <form onSubmit={handleSave} className="flex flex-col gap-4">

        {/* Date — editable, so you can pick any day without going back to the calendar */}
        <div>
          <label className="label">Satsang Date</label>
          <input
            type="date"
            className="input-field"
            value={form.date}
            onChange={e => set('date', e.target.value)}
          />
          {form.date && (
            <p className="text-xs text-gray-400 mt-1">
              {format(parse(form.date, 'yyyy-MM-dd', new Date()), 'EEEE, d MMMM yyyy')}
            </p>
          )}
        </div>

        {/* Suburb */}
        <div>
          <label className="label">Suburb / Location name*</label>
          <input className="input-field" value={form.suburb}
            onChange={e => set('suburb', e.target.value)} placeholder="e.g. Castle Hill" />
        </div>

        {/* Start time */}
        <div>
          <label className="label">Start Time*</label>
          <div className="flex items-center gap-2">
            <select className="input-field flex-1 min-w-0 px-2 text-center" value={form.startHour}
              onChange={e => set('startHour', e.target.value)} aria-label="Start hour">
              {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <span className="text-gray-400">:</span>
            <select className="input-field flex-1 min-w-0 px-2 text-center" value={form.startMin}
              onChange={e => set('startMin', e.target.value)} aria-label="Start minute">
              {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className="input-field flex-1 min-w-0 px-2 text-center" value={form.startAmPm}
              onChange={e => set('startAmPm', e.target.value)} aria-label="Start AM/PM">
              <option>AM</option><option>PM</option>
            </select>
          </div>
        </div>

        {/* End time */}
        <div>
          <label className="label">End Time</label>
          <div className="flex items-center gap-2">
            <select className="input-field flex-1 min-w-0 px-2 text-center" value={form.endHour}
              onChange={e => set('endHour', e.target.value)} aria-label="End hour">
              {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <span className="text-gray-400">:</span>
            <select className="input-field flex-1 min-w-0 px-2 text-center" value={form.endMin}
              onChange={e => set('endMin', e.target.value)} aria-label="End minute">
              {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className="input-field flex-1 min-w-0 px-2 text-center" value={form.endAmPm}
              onChange={e => set('endAmPm', e.target.value)} aria-label="End AM/PM">
              <option>AM</option><option>PM</option>
            </select>
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="label">Address*</label>
          <textarea className="input-field" rows={3} value={form.address}
            onChange={e => set('address', e.target.value)}
            placeholder="23/13 Woodfoord Ave&#10;Castle Hill&#10;NSW 2153" />
        </div>

        {/* RSVP contact */}
        <div>
          <label className="label">RSVP Contact*</label>
          <textarea className="input-field" rows={2} value={form.rsvpContact}
            onChange={e => set('rsvpContact', e.target.value)}
            placeholder="Deepika Gupta - 04040876234&#10;Rohan Gupta - 0405098432" />
        </div>

        {/* RSVP by — a date picker, same as the Date field above */}
        <div>
          <label className="label">RSVP By</label>
          <input
            type="date"
            className="input-field"
            value={form.rsvpBy}
            onChange={e => set('rsvpBy', e.target.value)}
          />
          {/^\d{4}-\d{2}-\d{2}$/.test(form.rsvpBy) && (
            <p className="text-xs text-gray-400 mt-1">
              {format(parse(form.rsvpBy, 'yyyy-MM-dd', new Date()), 'EEEE, d MMMM yyyy')}
            </p>
          )}
        </div>

        {/* Instructions */}
        <div>
          <label className="label">Instructions</label>
          <textarea className="input-field" rows={2} value={form.instructions}
            onChange={e => set('instructions', e.target.value)}
            placeholder="Please park on the side street, Ada Street or Lincoln Street" />
        </div>

        {/* Image upload */}
        <div>
          <label className="label">Image</label>
          <div className="flex items-center gap-3">
            <input
              id="img-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => setImageFile(e.target.files[0])}
            />
            <input
              className="input-field cursor-pointer"
              readOnly
              value={imageFile ? imageFile.name : ''}
              onClick={() => document.getElementById('img-upload').click()}
              placeholder="No file chosen"
            />
            <label
              htmlFor="img-upload"
              className="text-saffron-600 font-semibold cursor-pointer whitespace-nowrap hover:text-saffron-800"
            >
              Upload
            </label>
          </div>
          {existingImageUrl && !imageFile && (
            <img src={existingImageUrl} alt="Current invite" className="mt-2 h-24 rounded-xl object-cover" />
          )}
        </div>

        {/* Booking type: Public vs Private */}
        <div>
          <label className="label">Booking Type</label>
          <div className="flex gap-6 mt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="bookingType"
                checked={form.publicInvite === true}
                onChange={() => set('publicInvite', true)}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm text-gray-700">
                Public <span className="text-green-500 font-medium">(green)</span>
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="bookingType"
                checked={form.publicInvite === false}
                onChange={() => set('publicInvite', false)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-sm text-gray-700">
                Private <span className="text-blue-500 font-medium">(blue)</span>
              </span>
            </label>
          </div>
        </div>

        <button className="btn-primary mt-2" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save Invite'}
        </button>
      </form>
    </AppShell>
  );
}
