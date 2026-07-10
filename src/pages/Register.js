import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { showError } from '../utils/notify';
import { isValidAuMobile, AU_MOBILE_HINT } from '../utils/contacts';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // If they came from a protected link (e.g. an RSVP invite), go straight there
  // after registering instead of the generic confirmation screen.
  const from = location.state?.from;
  const [form, setForm] = useState({
    firstName: '', lastName: '', mobile: '', email: '', password: '',
  });
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.mobile || !form.email || !form.password) {
      return showError('Please fill in all required fields.');
    }
    if (!isValidAuMobile(form.mobile)) {
      return showError(`Please enter a valid Australian mobile number (${AU_MOBILE_HINT}).`);
    }
    setLoading(true);
    try {
      await register(form);
      navigate(from || '/registered');
    } catch (err) {
      showError(err.message || 'Registration failed. Please try again.');
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
        <div>
          <input
            className="input-field"
            type="text"
            name="firstName"
            placeholder="First Name*"
            value={form.firstName}
            onChange={handleChange}
          />
        </div>
        <div>
          <input
            className="input-field"
            type="text"
            name="lastName"
            placeholder="Last Name*"
            value={form.lastName}
            onChange={handleChange}
          />
        </div>
        <div>
          <input
            className="input-field"
            type="tel"
            name="mobile"
            placeholder="Mobile Number*"
            value={form.mobile}
            onChange={handleChange}
          />
          <p className="text-xs text-gray-400 mt-1">Australian mobile · {AU_MOBILE_HINT}</p>
        </div>
        <div>
          <input
            className="input-field"
            type="email"
            name="email"
            placeholder="Email ID*"
            value={form.email}
            onChange={handleChange}
          />
        </div>
        <div>
          <input
            className="input-field"
            type="password"
            name="password"
            placeholder="Password*"
            value={form.password}
            onChange={handleChange}
          />
        </div>
        <button className="btn-primary mt-2" type="submit" disabled={loading}>
          {loading ? 'Registering…' : 'Register'}
        </button>
        <p className="text-center text-sm text-gray-500">
          Already registered?{' '}
          <Link to="/login" state={{ from }} className="text-saffron-600 font-medium">Sign in</Link>
        </p>
      </form>
    </AppShell>
  );
}
