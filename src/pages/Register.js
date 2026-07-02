import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { showError } from '../utils/notify';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
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
    setLoading(true);
    try {
      await register(form);
      navigate('/registered');
    } catch (err) {
      showError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <h1 className="page-header mt-4">Satsang Seva</h1>

      {/* Guru Ji thumbnail — file lives in /public/guruji.jpg */}
      <div className="flex justify-center mb-4">
        <img
          src="/guruji.jpg"
          alt="Guru Ji"
          className="w-20 h-20 rounded-full object-cover object-top border-2 border-saffron-200 shadow-sm"
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
        </div>
        <div>
          <input
            className="input-field"
            type="email"
            name="email"
            placeholder="Email ID"
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
          <Link to="/login" className="text-saffron-600 font-medium">Sign in</Link>
        </p>
      </form>
    </AppShell>
  );
}
