import React from 'react';

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Decorative orange orbs — faithful to the original design */}
      <div className="relative overflow-hidden">
        <div className="absolute top-0 left-0 w-36 h-36 bg-saffron-400 rounded-full -translate-x-8 -translate-y-8 opacity-90 pointer-events-none" />
        <div className="absolute top-0 left-0 w-28 h-28 bg-saffron-200 rounded-full translate-x-4 -translate-y-2 opacity-70 pointer-events-none" />
        <div className="relative z-10 pt-10 px-4 pb-8 max-w-md mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
