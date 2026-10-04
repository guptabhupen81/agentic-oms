'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, session, ApiError } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(loginId, password);
      session.setToken(res.accessToken);
      session.setUserId(res.user.id);
      session.setRole(res.user.role);
      session.setProfile(
        res.user.distributorName ? `${res.user.loginId} · ${res.user.distributorName}` : res.user.loginId,
      );
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 360 }}>
        <h1>Agentic OMS</h1>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Login ID</label>
              <input
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Distributor code, or MDM_Admin"
                autoComplete="username"
                required
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Logging in…' : 'Log in'}
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
