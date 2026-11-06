# PGfy Backend

## Local setup

Requirements: Node.js 20+, PostgreSQL, and Redis.

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET`, sales contacts, WhatsApp credentials/template, and SMTP settings. Never commit `.env`.
2. Install dependencies with `npm install`.
3. Generate Prisma Client and apply the checked-in migrations:

   ```powershell
   npm run prisma:generate
   npm run prisma:migrate:deploy
   ```

4. Start the API and notification worker in separate terminals:

   ```powershell
   npm run dev
   npm run dev:worker
   ```

5. Check `GET /health` for liveness and `GET /health/ready` for PostgreSQL and Redis readiness.

## Authentication integration

There is deliberately no password/login endpoint in this backend: the `User` model has no credential fields, and account issuance belongs to the identity provider. Protected API routes accept an HS256 JWT in `Authorization: Bearer <token>`. The trusted issuer must sign with the same `JWT_SECRET` and include the user's UUID as `sub` plus `exp` (Unix seconds). The backend loads the user from PostgreSQL and uses the database role and active status; it does not trust a role claim or caller-supplied identity headers.

Create/administer `User` records through a trusted identity provisioning process before issuing tokens. Do not expose a token-minting endpoint that lets clients select their own role.

## Notification configuration

- Email uses authenticated SMTP. Port 465 uses implicit TLS; other ports require STARTTLS.
- WhatsApp uses the Meta WhatsApp Cloud API and an approved template. Configure the template name, language, and Graph API version. The approved template body must have eight text parameters in this order: property title, category, location, tenant name, tenant phone, move-in date, occupancy preference, enquiry ID.
- The database notification rows are the durable outbox. BullMQ/Redis handles dispatch and retries; a periodic worker sweep re-enqueues rows left queued if Redis was unavailable during request handling.
- Each channel is an independent job, so failure/retry of email does not resend a successfully sent WhatsApp message. Delivery is at-least-once; provider-side idempotency is not available in this implementation.

## Commands

```powershell
npm test
npm run prisma:generate
npm run prisma:migrate:dev
npm run prisma:migrate:deploy
```

`npm test` builds TypeScript and runs focused request-schema tests. End-to-end tests require configured PostgreSQL, Redis, JWT issuance, and notification-provider accounts.
