# 🎫 TicketOps Mini
Task: Noman Mansuri

This is A mini ticket management system built with NestJS, PostgreSQL, BullMQ, and React.

## Stack


| Backend    |- NestJS (TypeScript)               
| Database     - PostgreSQL + TypeORM              
| Queue      - BullMQ + Redis                    
| Frontend   - React (Vite) + React Router       
| Tests     - Jest                              

---

## Quick Start (Docker — Recommended)

```bash
# 1. Clone / unzip the project
cd ticketops

# 2. Start all services (DB, Redis, Backend, Frontend)
docker compose up --build

# 3. Open browser
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
```

---

## Manual Setup

### Prerequisites

- Node.js 
- PostgreSQ - pass admin 
- Redis pass i set admin in this pc 
 - Docker also

### Backend

```bash
cd backend
cp .env.example .env

npm install
npm run start:dev
```

Backend runs at **http://localhost:3001**

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:3000** (proxies `/api` → `localhost:3001`)

---

## Environment Variables

### `backend/.env.example`

```env
DB_HOST=localhost
DB_PORT=5433  (your system port)
DB_USER=postgres
DB_PASS=admin  (your system pass)
DB_NAME=ticketops

REDIS_HOST=admin
REDIS_PORT=6379

PORT=3001
NODE_ENV=development
```

---

## Database Migrations / Schema

right now i set app as TypeORM DB with `synchronize: true` in non-production mode.  
so basically On first the start, all tables are auto-created:

- `tickets`
- `tags`
- `ticket_tags` (join table)    
- `ticket_events`
- `idempotency_keys`

For production, disable `synchronize` and use:

```bash
cd backend
npm run migration:run
```

---

## Running Tests

```bash
cd backend
npm test

# With coverage
npm run test:cov
```

Tests cover:
1. **Create ticket success** — writes audit event + tags
2. **List tickets pagination** — nextCursor present when more results exist
3. **Status change** — creates `STATUS_CHANGED` event with `{from, to}` meta
4. **Idempotency** — duplicate key returns same ticket, no duplicate notification enqueue



---

## API Reference

All requests to write endpoints require the `X-Actor` header.

### Headers

| Header           | Required | Description                                 |
| `X-Actor`        | ✅ writes | Actor name (e.g. `alice`)                   |
| `X-Role`         | Optional | `admin` or `user` (default: `user`)         |
| `Idempotency-Key`| Optional | UUID string for POST /tickets idempotency   |

### Response format

**Success:**
```json
{ "success": true, "data": { }, "meta": { } }
```

**Error:**
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

---

### Sample curl commands

#### Create a ticket
```bash
curl -X POST http://localhost:3001/tickets \
  -H "Content-Type: application/json" \
  -H "X-Actor: alice" \
  -H "X-Role: admin" \
  -H "Idempotency-Key: my-unique-key-001" \
  -d '{
    "title": "Login button broken on mobile",
    "description": "The login button does not respond on iOS Safari",
    "priority": "HIGH",
    "assigneeId": "bob",
    "tags": ["bug", "mobile", "auth"]
  }'
```

#### List tickets
```bash
# All tickets
curl http://localhost:3001/tickets

# Filter by status
curl "http://localhost:3001/tickets?status=OPEN"

# Search by title
curl "http://localhost:3001/tickets?q=login"

# Filter by tag
curl "http://localhost:3001/tickets?tag=bug"

# Date range
curl "http://localhost:3001/tickets?from=2024-01-01&to=2024-12-31"

# With cursor pagination
curl "http://localhost:3001/tickets?limit=5"
# Then use nextCursor from response:
curl "http://localhost:3001/tickets?limit=5&cursor=<nextCursor>"
```

#### Get ticket detail
```bash
curl http://localhost:3001/tickets/<ticket-id>
```

#### Update ticket status
```bash
curl -X PATCH http://localhost:3001/tickets/<ticket-id>/status \
  -H "Content-Type: application/json" \
  -H "X-Actor: bob" \
  -d '{"status": "IN_PROGRESS"}'
```

---

## Idempotency Demo

Idempotency prevents duplicate ticket creation and duplicate notification jobs when
the same request is retried (e.g. due to network failures).

**Steps to demonstrate:**

```bash
# Request 1 — creates a new ticket
curl -X POST http://localhost:3001/tickets \
  -H "Content-Type: application/json" \
  -H "X-Actor: alice" \
  -H "Idempotency-Key: demo-idem-key-xyz" \
  -d '{"title": "Idempotency Test", "priority": "LOW"}'
# → Returns new ticket, meta.idempotent: false

# Request 2 — same key, same payload (retry)
curl -X POST http://localhost:3001/tickets \
  -H "Content-Type: application/json" \
  -H "X-Actor: alice" \
  -H "Idempotency-Key: demo-idem-key-xyz" \
  -d '{"title": "Idempotency Test", "priority": "LOW"}'
# → Returns SAME ticket, meta.idempotent: true
# → NO duplicate notification job enqueued
```



**How it works:**

1. Incoming key + SHA-256 hash of payload stored in `idempotency_keys` table
2. On duplicate: hash compared → same payload → return existing ticket
3. Notification job has deterministic `jobId = ticket_created:<idempotency-key>`
   → BullMQ deduplicates by job ID automatically
4. Records expire after 10 minutes (window-based)

---

## Database Index Explanation

### `idx_tickets_status_assignee_created`
```sql
CREATE INDEX ON tickets (status, assignee_id, created_at DESC, id DESC);
```
**Why:** The most common list queries filter by `status` and/or `assignee_id`.
Column order matters — PostgreSQL can use leading columns for equality filters
and trailing columns for range + ordering. This covers:
- `WHERE status = 'OPEN'`
- `WHERE status = 'OPEN' AND assignee_id = 'bob'`
- Ordered `created_at DESC, id DESC` (stable cursor sort)

### `idx_tickets_created_id`
```sql
CREATE INDEX ON tickets (created_at DESC, id DESC);
```
**Why:** Used for cursor pagination on unfiltered list queries. The composite
`(created_at, id)` ensures a stable total ordering — two tickets with the same
timestamp are disambiguated by `id DESC`. This also serves as the ordering index
for all list queries.

### `idx_tags_name` (unique)
```sql
CREATE UNIQUE INDEX ON tags (name);
```
**Why:** Tag upsert logic looks up tags by name. A unique index enforces
uniqueness and makes the lookup O(log n) instead of a sequential scan.

### `idx_ticket_events_ticket_id`
```sql
CREATE INDEX ON ticket_events (ticket_id);
```
**Why:** The detail endpoint fetches the 20 latest events for a specific ticket.
Without this index, PostgreSQL would full-scan the events table for every detail load.

### `ticket_tags` composite unique
```sql
UNIQUE (ticket_id, tag_id)
```
**Why:** Prevents duplicate tag associations and the leading `ticket_id` column
serves as an implicit index for queries joining from tickets → tags.

---

## Architecture Notes

### Queue Reliability
- BullMQ jobs have `attempts: 3` with exponential backoff
- Deterministic `jobId` prevents duplicate enqueue on retries
- Jobs persist in Redis until processed

### Cursor Pagination
- Cursor encodes `{ createdAt, id }` as base64 JSON
- Tie-breaker on `id DESC` ensures stable ordering for tickets with same timestamp
- Fetches `limit + 1` to detect if next page exists

### RBAC 
- `X-Role: admin` required to set `assigneeId` on ticket creation
- Non-admin attempts to assign → 403 Forbidden

### Audit Trail
- Every create → `CREATED` event
- Every status change → `STATUS_CHANGED` event with `meta: { from, to }`
- Events stored in `ticket_events` table, never mutated
