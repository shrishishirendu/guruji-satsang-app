import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { showError } from '../utils/notify';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Return the user to wherever they were headed (e.g. an RSVP link) after
  // signing in; otherwise land on the calendar.
  const from = location.state?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) return showError('Please enter your email and password.');
    setLoading(true);
    try {
      await login(email, password);
      navigate(from || '/satsangs');
    } catch (err) {
      showError('Incorrect email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <h1 className="page-header mt-4">Satsang Seva</h1>

      {/* Guru Ji thumbnail — head-focused square crop so the circle doesn't clip
          the forehead (full portrait lives in /public/guruji.jpg). */}
      <div className="flex justify-center mb-4">
        <img
          src="/guruji-face.jpg"
          alt="Guru Ji"
          className="w-20 h-20 rounded-full object-cover object-center border-2 border-saffron-200 shadow-sm"
        />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-6">
        <input
          className="input-field"
          type="email"
          placeholder="Email ID"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          className="input-field"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button className="btn-primary mt-2" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="text-saffron-600 font-medium">
            Forgot password?
          </Link>
        </p>
        <p className="text-center text-sm text-gray-500">
          New here?{' '}
          <Link to="/register" state={{ from }} className="text-saffron-600 font-medium">Register</Link>
        </p>
      </form>
    </AppShell>
  );
}
