import React from 'react';
import toast from 'react-hot-toast';

// Ids of error toasts currently on screen, so we can clear them on navigation
// without touching success toasts (which are often fired just before a route
// change and are meant to carry over to the next screen).
const activeErrorIds = new Set();

// Error toast with a manual close (the red ✕). Errors stay on screen until the
// user dismisses them or leaves the screen (see dismissErrors), so a message
// can't vanish before it's read while the user is still on the same page.
// Re-firing the same message reuses one toast (via id) instead of stacking
// duplicates.
export function showError(message) {
  activeErrorIds.add(message);
  return toast.error(
    t => (
      <span className="flex items-center gap-3">
        <span className="flex-1">{message}</span>
        <button
          type="button"
          onClick={() => {
            activeErrorIds.delete(message);
            toast.dismiss(t.id);
          }}
          aria-label="Dismiss"
          className="text-red-500 hover:text-red-700 font-bold text-xl leading-none px-1 -my-1 shrink-0"
        >
          ×
        </button>
      </span>
    ),
    { id: message, duration: Infinity }
  );
}

// Clear any lingering error toasts. Called on route changes so a stale error
// (e.g. "Incorrect email or password") doesn't follow the user to a new screen.
export function dismissErrors() {
  activeErrorIds.forEach(id => toast.dismiss(id));
  activeErrorIds.clear();
}
