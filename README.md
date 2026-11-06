# PGfy Unverified Property Management

This repository contains work for PGfy's technical assignment. The assignment focuses on designing a PostgreSQL-backed module for manually managed, unverified property listings, tenant enquiries, sales follow-up, and property verification.

## Repository contents

```text
.
├── Backend/                       # Node.js, TypeScript, Express, Prisma API
│   ├── prisma/                    # Prisma schema and database migrations
│   ├── src/
│   │   ├── auth/                  # Bearer-token authentication
│   │   ├── infrastructure/        # Redis connection
│   │   ├── middleware/            # Authorization middleware
│   │   ├── queues/                # BullMQ queue definitions
│   │   ├── routes/                # Property, enquiry, sales, verification APIs
│   │   ├── schemas/               # Zod request validation
│   │   ├── services/              # Notification provider adapters
│   │   ├── utils/                 # Shared Prisma client
│   │   └── workers/               # Asynchronous notification worker
│   ├── test/                      # Focused schema validation tests
│   └── README.md                  # Backend setup and integration details
├── Frontend/                      # Frontend project area
├── AI_LOG.md                      # Required record of AI assistance
└── PGfy_Technical_Assignment.pdf  # Assignment brief
```

## Backend overview

The backend uses Express and Prisma with PostgreSQL. It includes:

- Admin endpoints to create, update, publish, and archive property listings.
- Public property discovery endpoints with filters and pagination.
- Tenant enquiry submission and sales follow-up tracking.
- Admin verification workflow with status history.
- Redis/BullMQ-based asynchronous notification processing for WhatsApp and email.
- Zod request validation and bearer-token authentication.

The notification worker uses Meta WhatsApp Cloud API and SMTP adapters. Provider credentials and approved WhatsApp template configuration are required before notifications can be sent.

## Run the backend

Requirements: Node.js 20 or newer, PostgreSQL, and Redis.

1. Copy `Backend/.env.example` to `Backend/.env`.
2. Set the PostgreSQL `DATABASE_URL`, a strong `JWT_SECRET`, Redis URL, sales contact, WhatsApp template settings, and SMTP settings in `Backend/.env`. Keep this file private and do not commit it.
3. From the `Backend` directory, install dependencies and prepare the database:

   ```powershell
   npm install
   npm run prisma:generate
   npm run prisma:migrate:deploy
   ```

4. Run the API and notification worker in separate terminals, both from `Backend`:

   ```powershell
   npm run dev
   ```

   ```powershell
   npm run dev:worker
   ```

5. Check `http://localhost:3000/health` for liveness and `/health/ready` for PostgreSQL and Redis readiness.

The existing identity provider must issue HS256 JWTs signed with the configured secret. The token subject (`sub`) must be the user's UUID; the backend loads the user's role and active status from PostgreSQL. This project does not currently implement login or issue tokens.

For detailed environment variables, WhatsApp template parameter order, notification retries, and backend commands, see [`Backend/README.md`](Backend/README.md).

## Verify changes

From `Backend`:

```powershell
npm test
npx prisma validate --schema prisma/schema.prisma
```

The tests cover request-schema validation and the build. They do not replace end-to-end testing against configured PostgreSQL, Redis, authentication, and notification-provider accounts.

## Assignment deliverables

The backend implementation is supporting work; it does not by itself complete the design assignment submission. Prepare the required ER diagram, property lifecycle diagram, and high-level architecture diagram, plus the written explanations, assumptions, integrity/performance considerations, and trade-offs described in the PDF. Review and author the final design in your own words, and keep `AI_LOG.md` accurate.
