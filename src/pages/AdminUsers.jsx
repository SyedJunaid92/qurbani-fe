import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { createAdminUser, fetchAdminUsers } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminUsers() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAdminUsers();
        if (!cancelled) setUsers(data);
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          toast.error(e.message || 'Could not load users');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="card">
        <p className="error">You need administrator access to view this page.</p>
        <Link to="/">Back to bookings</Link>
      </div>
    );
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await createAdminUser({ email, name, password, role });
      toast.success('User created');
      const data = await fetchAdminUsers();
      setUsers(data);
      setEmail('');
      setName('');
      setPassword('');
      setRole('staff');
    } catch (err) {
      const msg = err.message || 'Could not create user';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <h2 className="card-title">Create user</h2>
        <p className="muted">New accounts are only created here (admin only).</p>
        {formError && <p className="error">{formError}</p>}
        <form onSubmit={handleCreate} className="form-grid">
          <div className="form-field">
            <label htmlFor="nu-email">Email</label>
            <input
              id="nu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="nu-name">Name</label>
            <input
              id="nu-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="nu-pass">Password (min 6)</label>
            <input
              id="nu-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="nu-role">Role</label>
            <select id="nu-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-field form-field--full">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="card-title">All users</h2>
        {loading && <p className="muted">Loading…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>{u.isActive ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
