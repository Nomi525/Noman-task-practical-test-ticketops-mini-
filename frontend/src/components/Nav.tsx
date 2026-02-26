import { Link } from 'react-router-dom';

export default function Nav() {
  return (
    <nav>
      <Link to="/tickets" className="brand">🎫 TicketOps</Link>
      <Link to="/tickets">All Tickets</Link>
      <Link to="/tickets/new">+ New Ticket</Link>
    </nav>
  );
}
