import { parse, format } from 'date-fns';

// RSVP-by is picked with a date input, so new invites store it as 'yyyy-MM-dd'.
// Show it as a friendly "20 February 2026". Invites saved before the date picker
// existed hold free text — return those unchanged so nothing breaks.
export function formatRsvpBy(value) {
  if (!value) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  try {
    return format(parse(value, 'yyyy-MM-dd', new Date()), 'd MMMM yyyy');
  } catch {
    return value;
  }
}
