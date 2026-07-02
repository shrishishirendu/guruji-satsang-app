import React from 'react';
import toast from 'react-hot-toast';

// Error toast with a manual close (the red ✕). Errors stay on screen until the
// user dismisses them, so a message can't vanish before it's read and the user
// is always in control of clearing it. Re-firing the same message reuses one
// toast (via id) instead of stacking duplicates.
export function showError(message) {
  return toast.error(
    t => (
      <span className="flex items-center gap-3">
        <span className="flex-1">{message}</span>
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
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
