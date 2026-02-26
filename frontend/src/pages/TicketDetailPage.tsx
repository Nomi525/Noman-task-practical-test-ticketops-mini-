import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Nav from '../components/Nav';
import { api, Ticket, TicketEvent } from '../api/client';

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

function fmtDate(d: string) {
  return new Date(d).toLocaleString();
}

function EventItem({ event }: { event: TicketEvent }) {
  return (
    <div className="event-item">
      <span className="event-type">{event.eventType.replace('_', ' ')}</span>
      <div style={{ flex: 1 }}>
        <span className="event-actor">by {event.actor}</span>
        {event.meta && Object.keys(event.meta).length > 0 && (
          <div className="event-meta">
            {event.eventType === 'STATUS_CHANGED'
              ? `${event.meta.from} → ${event.meta.to}`
              : JSON.stringify(event.meta)}
          </div>
        )}
      </div>
      <span className="event-time">{fmtDate(event.createdAt)}</span>
    </div>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<(Ticket & { events: TicketEvent[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [updating, setUpdating] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.tickets.get(id!);
      setTicket(res.data as any);
      setNewStatus(res.data.status);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleUpdateStatus = async () => {
    if (!ticket || newStatus === ticket.status) return;
    setUpdating(true);
    setStatusMsg('');
    try {
      await api.tickets.updateStatus(id!, newStatus);
      setStatusMsg('Status updated!');
      await load();
    } catch (e: any) {
      setStatusMsg(e.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <><Nav /><div className="container spinner">Loading...</div></>;
  if (error) return <><Nav /><div className="container error-msg mt-2">{error}</div></>;
  if (!ticket) return null;

  return (
    <>
      <Nav />
      <div className="container">
        <div style={{ marginBottom: '1rem' }}>
          <Link to="/tickets" className="text-muted" style={{ textDecoration: 'none' }}>
            ← Back to tickets
          </Link>
        </div>

        {/* Main ticket info */}
        <div className="card">
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h1 style={{ fontSize: '1.3rem' }}>{ticket.title}</h1>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span className={`badge badge-status-${ticket.status}`}>
                {ticket.status.replace('_', ' ')}
              </span>
              <span className={`badge badge-priority-${ticket.priority}`}>
                {ticket.priority}
              </span>
            </div>
          </div>

          {ticket.description && (
            <p style={{ color: '#555', marginBottom: '1rem', lineHeight: 1.6 }}>
              {ticket.description}
            </p>
          )}

          <div className="detail-grid">
            <div className="detail-field">
              <label>Assignee</label>
              <div className="value">{ticket.assigneeId || '—'}</div>
            </div>
            <div className="detail-field">
              <label>Created</label>
              <div className="value">{fmtDate(ticket.createdAt)}</div>
            </div>
            <div className="detail-field">
              <label>Updated</label>
              <div className="value">{fmtDate(ticket.updatedAt)}</div>
            </div>
            <div className="detail-field">
              <label>ID</label>
              <div className="value" style={{ fontSize: '0.78rem', color: '#888' }}>{ticket.id}</div>
            </div>
          </div>

          {ticket.tags?.length > 0 && (
            <div className="tags-row">
              {ticket.tags.map((tag) => (
                <span key={tag.id} className="tag-chip">#{tag.name}</span>
              ))}
            </div>
          )}
        </div>

        {/* Status updater */}
        <div className="card">
          <h2>Update Status</h2>
          <div className="status-selector">
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleUpdateStatus}
              disabled={updating || newStatus === ticket.status}
            >
              {updating ? 'Updating...' : 'Update'}
            </button>
          </div>
          {statusMsg && (
            <div
              className={statusMsg === 'Status updated!' ? 'success-msg' : 'error-msg'}
              style={{ marginTop: '0.75rem' }}
            >
              {statusMsg}
            </div>
          )}
        </div>

        {/* Events audit trail */}
        <div className="card">
          <h2>Audit Trail</h2>
          {(ticket.events?.length ?? 0) === 0 ? (
            <div className="text-muted">No events yet.</div>
          ) : (
            ticket.events.map((ev) => <EventItem key={ev.id} event={ev} />)
          )}
        </div>
      </div>
    </>
  );
}
