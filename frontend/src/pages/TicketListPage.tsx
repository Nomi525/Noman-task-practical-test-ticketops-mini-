import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Nav from '../components/Nav';
import { api, Ticket } from '../api/client';

const STATUSES = ['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export default function TicketListPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadTickets = useCallback(
    async (cursorVal: string | null = null, append = false) => {
      setLoading(true);
      setError('');
      try {
        const params: Record<string, string> = {};
        if (status) params.status = status;
        if (q) params.q = q;
        if (cursorVal) params.cursor = cursorVal;

        const res = await api.tickets.list(params);

        setTickets((prev) => (append ? [...prev, ...res.data] : res.data));
        setNextCursor(res.meta.nextCursor);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [status, q],
  );

  useEffect(() => {
    setCursor(null);
    setTickets([]);
    loadTickets(null, false);
  }, [status, q]);

  const handleLoadMore = () => {
    loadTickets(nextCursor, true);
  };

  return (
    <>
      <Nav />
      <div className="container">
        <div className="flex-between">
          <h1>Tickets</h1>
          <Link to="/tickets/new" className="btn btn-primary">+ New Ticket</Link>
        </div>

        <div className="filters-bar">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search title..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {error && <div className="error-msg">{error}</div>}

        {loading && tickets.length === 0 && (
          <div className="spinner">Loading...</div>
        )}

        {!loading && tickets.length === 0 && (
          <div className="card text-muted">No tickets found.</div>
        )}

        {tickets.map((ticket) => (
          <Link key={ticket.id} to={`/tickets/${ticket.id}`} className="ticket-row">
            <div className="left">
              <div className="title">{ticket.title}</div>
              <div className="meta-row">
                <span className={`badge badge-status-${ticket.status}`}>
                  {ticket.status.replace('_', ' ')}
                </span>
                <span className={`badge badge-priority-${ticket.priority}`}>
                  {ticket.priority}
                </span>
                {ticket.tags?.map((tag) => (
                  <span key={tag.id} className="tag-chip">#{tag.name}</span>
                ))}
              </div>
            </div>
            <div className="right">
              {ticket.assigneeId && (
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                  👤 {ticket.assigneeId}
                </span>
              )}
              <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                {new Date(ticket.createdAt).toLocaleDateString()}
              </span>
            </div>
          </Link>
        ))}

        {nextCursor && (
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button
              className="btn btn-secondary"
              onClick={handleLoadMore}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
