import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '../components/Nav';
import { api } from '../api/client';
import { v4 as uuidv4 } from 'uuid';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function CreateTicketPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    assigneeId: '',
    tags: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload: any = {
        title: form.title,
        priority: form.priority,
      };
      if (form.description) payload.description = form.description;
      if (form.assigneeId) payload.assigneeId = form.assigneeId;
      if (form.tags) {
        payload.tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
      }

      // Generate idempotency key per submission
      const ikey = uuidv4();
      const res = await api.tickets.create(payload, ikey);
      navigate(`/tickets/${res.data.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Nav />
      <div className="container">
        <h1>Create New Ticket</h1>
        <div className="card">
          <form onSubmit={handleSubmit}>
            {error && <div className="error-msg" style={{ marginBottom: '1rem' }}>{error}</div>}

            <div className="form-group">
              <label htmlFor="title">Title *</label>
              <input
                id="title"
                name="title"
                type="text"
                value={form.title}
                onChange={handleChange}
                placeholder="Brief description of the issue"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Detailed description (optional)"
                rows={4}
              />
            </div>

            <div className="form-group">
              <label htmlFor="priority">Priority *</label>
              <select id="priority" name="priority" value={form.priority} onChange={handleChange}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>


            

            <div className="form-group">
              <label htmlFor="assigneeId">Assignee ID (admin only)</label>
              <input
                id="assigneeId"
                name="assigneeId"
                type="text"
                value={form.assigneeId}
                onChange={handleChange}
                placeholder="user-uuid or username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="tags">Tags (comma-separated)</label>
              <input
                id="tags"
                name="tags"
                type="text"
                value={form.tags}
                onChange={handleChange}
                placeholder="bug, backend, urgent"
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating...' : 'Create Ticket'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/tickets')}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
