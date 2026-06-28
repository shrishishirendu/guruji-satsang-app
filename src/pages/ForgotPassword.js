import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/AuthContext';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return toast.error('Please enter your email.');
    setLoading(true);
    try {
      await resetPassword(trimmed);
      setSent(true);
    } catch (err) {
      if (err.code === 'auth/invalid-email') {
        toast.error('That email address looks invalid.');
      } else if (err.code === 'auth/user-not-found') {
        // Don't reveal whether an account exists — show the same confirmation.
        setSent(true);
      } else {
        console.error(err);
        toast.error('Could not send the reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <h1 className="page-header mt-4">Satsang Seva</h1>

      {sent ? (
        <div className="flex flex-col items-center text-center mt-8 gap-4 px-2">
          <div className="text-5xl">📧</div>
          <p className="text-gray-600 leading-relaxed">
            If an account exists for{' '}
            <span className="font-semibold text-gray-800">{email.trim()}</span>, a
            password reset link is on its way.
          </p>
          <p className="text-sm text-gray-500">
            Please check your inbox (and your spam folder). Tap the link in the email to
            set a new password, then come back and sign in.
          </p>
          <button className="btn-primary mt-4" onClick={() => navigate('/login')}>
            Back to Sign In
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-6">
          <p className="text-sm text-gray-500 text-center">
            Enter your registered email and we’ll send you a link to reset your password.
          </p>
          <input
            className="input-field"
            type="email"
            placeholder="Email ID"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <button className="btn-primary mt-2" type="submit" disabled={loading}>
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
          <p className="text-center text-sm text-gray-500">
            Remembered your password?{' '}
            <Link to="/login" className="text-saffron-600 font-medium">Sign in</Link>
          </p>
        </form>
      )}
    </AppShell>
  );
}
