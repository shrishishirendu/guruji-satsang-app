// Helpers for inviting people from the host's phone directory.
//
// NOTE: This is a web app, so reading the address book is only possible via the
// browser Contact Picker API (navigator.contacts) — available on Chrome / Edge /
// Samsung Internet on Android over HTTPS. Everywhere else (iPhone Safari, desktop,
// Firefox) we fall back to a manual "add name + phone" form. Use
// isContactPickerSupported() to decide which UI to show.

// Default country code used when a guest's number is entered in local format
// (e.g. an Australian "0404…" becomes "61404…"). The app is AU-focused.
const DEFAULT_COUNTRY_CODE = '61';

export function isContactPickerSupported() {
  return (
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    typeof navigator.contacts.select === 'function'
  );
}

// Opens the native contact picker and returns [{ name, phone }, …].
// Returns [] if the user cancels or the API is unavailable.
export async function pickContacts() {
  if (!isContactPickerSupported()) return [];
  try {
    const selected = await navigator.contacts.select(['name', 'tel'], {
      multiple: true,
    });
    return selected
      .map(c => ({
        name: (c.name && c.name[0]) || '',
        phone: (c.tel && c.tel[0]) || '',
      }))
      .filter(c => c.phone); // a contact with no number can't be invited
  } catch (err) {
    // User cancelled or permission denied — treat as "nothing picked".
    console.warn('Contact picker cancelled or unavailable:', err);
    return [];
  }
}

// Normalises a phone number into the digits-only international form wa.me expects,
// assuming an Australian number. Handles all three ways a number gets written:
//  "+61 404 876 234"  -> "61404876234"  (+ international)
//  "0061 404 876 234" -> "61404876234"  (00 international access code)
//  "0404 876 234"     -> "61404876234"  (national: leading 0 -> country code)
//  "61404876234"      -> "61404876234"  (already international, left as-is)
export function normalizePhone(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  const hadPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (hadPlus) return digits;              // "+61…" -> already international
  if (digits.startsWith('00')) {           // "0061…" -> drop the access code
    return digits.slice(2);
  }
  if (digits.startsWith('0')) {            // "04…"  -> national, add country code
    return DEFAULT_COUNTRY_CODE + digits.slice(1);
  }
  return digits;                           // "61…"  -> already international
}

// Example shown in helper text / validation messages so people know the format.
export const AU_MOBILE_HINT = 'e.g. 0404 876 234';

// True only for a valid Australian MOBILE number. The local "04…" form, the
// international "+61 4…" form and the "0061 4…" access-code form all normalise
// to "61" + "4" + eight more digits (11 digits total). Anything shorter, longer,
// or with a non-mobile prefix (e.g. an "02…" landline) is rejected — this is the
// gate that stops half-typed numbers from silently breaking invite matching.
export function isValidAuMobile(raw) {
  return /^614\d{8}$/.test(normalizePhone(raw));
}

// Builds the WhatsApp invite message body for a satsang.
export function buildInviteMessage(invite, rsvpLink, hostName) {
  const lines = ['🙏 *Satsang Seva* invitation', ''];
  if (hostName) lines.push(`${hostName} has invited you to a Satsang.`, '');
  if (invite?.dateStr) lines.push(`📅 ${invite.dateStr}`);
  if (invite?.startTime) {
    lines.push(`🕔 ${invite.startTime}${invite.endTime ? ' – ' + invite.endTime : ''}`);
  }
  if (invite?.address) lines.push(`📍 ${invite.address}`);
  if (invite?.rsvpBy) lines.push(`Please RSVP by ${invite.rsvpBy}`);
  lines.push('', `Tap to Register and RSVP:`, rsvpLink);
  return lines.join('\n');
}

// Builds a "click to chat" WhatsApp link prefilled with the invite message.
export function buildWhatsAppLink(phone, message) {
  const num = normalizePhone(phone);
  const text = encodeURIComponent(message);
  return num
    ? `https://wa.me/${num}?text=${text}`
    : `https://wa.me/?text=${text}`; // no number → let host pick the chat
}

// Opens the device's native share sheet (WhatsApp, SMS, Messages, etc.) with the
// invite. Unlike the Contact Picker, the Web Share API works on iPhone too, so
// this is the most universal "send to anyone" button. Falls back to WhatsApp's
// chat picker on desktops without a share sheet. Returns true if something opened.
export async function shareInvite(invite, rsvpLink, hostName) {
  const message = buildInviteMessage(invite, rsvpLink, hostName);
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      // The rsvpLink is already inside `message`, so we don't also pass `url`
      // (some apps would otherwise show the link twice).
      await navigator.share({ title: 'Satsang Seva invitation', text: message });
      return true;
    } catch (err) {
      if (err && err.name === 'AbortError') return false; // user cancelled
      // otherwise fall through to the WhatsApp fallback below
    }
  }
  window.open(buildWhatsAppLink('', message), '_blank', 'noopener');
  return true;
}
