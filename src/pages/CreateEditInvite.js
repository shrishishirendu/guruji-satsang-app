import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection, addDoc, doc, getDoc, updateDoc, Timestamp
} from 'firebase/firestore';
import { parse } from 'date-fns';
import toast from 'react-hot-toast';
import AppShell from '../components/AppShell';
import { db } from '../firebase/config';
import { uploadImage } from '../cloudinary/upload';
import { useAuth } from '../context/AuthContext';

export default function CreateEditInvite() {
  const { dateStr, inviteId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const isEdit = Boolean(inviteId);

  const [form, setForm] = useState({
    startHour: '05', startMin: '00', startAmPm: 'AM',
    endHour:   '07', endMin:   '00', endAmPm:   'AM',
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
          startHour: sh, startMin: sm, startAmPm: sa,
          endHour:   eh, endMin:   em, endAmPm:   ea,
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
  }, [isEdit, inviteId]);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.address || !form.rsvpContact) {
      return toast.error('Address and RSVP contact are required.');
    }
    setSaving(true);
    try {
      let imageUrl = existingImageUrl;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const date = dateStr
        ? Timestamp.fromDate(parse(dateStr, 'yyyy-MM-dd', new Date()))
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
      toast.error('Could not save invite. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <h1 className="page-header mt-4">Satsang Seva</h1>
      <form onSubmit={handleSave} className="flex flex-col gap-4">

        {/* Date (display only) */}
        {dateStr && (
          <div className="flex gap-4 items-center">
            <span className="label w-28 shrink-0">Date</span>
            <span className="text-gray-700">{dateStr}</span>
          </div>
        )}

        {/* Suburb */}
        <div>
          <label className="label">Suburb / Location name</label>
          <input className="input-field" value={form.suburb}
            onChange={e => set('suburb', e.target.value)} placeholder="e.g. Castle Hill" />
        </div>

        {/* Start time */}
        <div>
          <label className="label">Start Time</label>
          <div className="flex gap-2">
            <input className="input-field text-center" style={{maxWidth:64}} value={form.startHour}
              onChange={e => set('startHour', e.target.value)} maxLength={2} placeholder="HH" />
            <span className="self-center text-gray-400">-</span>
            <input className="input-field text-center" style={{maxWidth:64}} value={form.startMin}
              onChange={e => set('startMin', e.target.value)} maxLength={2} placeholder="MM" />
            <select className="input-field" style={{maxWidth:80}} value={form.startAmPm}
              onChange={e => set('startAmPm', e.target.value)}>
              <option>AM</option><option>PM</option>
            </select>
          </div>
        </div>

        {/* End time */}
        <div>
          <label className="label">End Time</label>
          <div className="flex gap-2">
            <input className="input-field text-center" style={{maxWidth:64}} value={form.endHour}
              onChange={e => set('endHour', e.target.value)} maxLength={2} placeholder="HH" />
            <span className="self-center text-gray-400">-</span>
            <input className="input-field text-center" style={{maxWidth:64}} value={form.endMin}
              onChange={e => set('endMin', e.target.value)} maxLength={2} placeholder="MM" />
            <select className="input-field" style={{maxWidth:80}} value={form.endAmPm}
              onChange={e => set('endAmPm', e.target.value)}>
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

        {/* RSVP by */}
        <div>
          <label className="label">RSVP By</label>
          <input className="input-field" value={form.rsvpBy}
            onChange={e => set('rsvpBy', e.target.value)} placeholder="e.g. 20 February 2024" />
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

        {/* Public invite toggle */}
        <div className="flex items-center gap-3">
          <label className="label mb-0">Public Invite</label>
          <input
            type="checkbox"
            checked={form.publicInvite}
            onChange={e => set('publicInvite', e.target.checked)}
            className="w-5 h-5 accent-saffron-400"
          />
        </div>

        <button className="btn-primary mt-2" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save Invite'}
        </button>
      </form>
    </AppShell>
  );
}
