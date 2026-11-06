# AI Usage Log

## Entry 1
- Running number: 1
- Date & time: 05/11/2026 20:25 IST
- Tool: Copilot
- Section: Assignment interpretation and backend architecture outline
- Why you asked: I needed to understand the assignment requirements from the PDF and translate them into a backend architecture and supporting documentation without writing implementation code.
- Time spent before asking: 10 minutes
- Prompt(s):
  1. `read the pdf`
  2. `create backend architecture and AI usage log. Dont write code.`
- What AI gave: A summary of the assignment, extracted key requirements, and a structured architecture outline for the unverified property module.
- What you used: Adapted
- What you learned: The module is centered on admin-managed property records, tenant-facing listing visibility, enquiry capture, notification triggers, and verification-to-conversion workflows; the backend should separate transactional data, lifecycle status tracking, and outbound integration processing.
- End note: This is the only AI-assisted interaction used for this task.

## Entry 2
- Running number: 2
- Date & time: 05/11/2026 23:26 IST
- Tool: Copilot
- Section: Prisma schema debugging for User model and related relations
- Why you asked: I was creating the Prisma `User` model and got a validation error. I needed help identifying which field/relationship definitions were invalid and what configuration was missing before finishing the schema.
- Time spent before asking: 15 minutes
- Prompt(s):
  1. `Help me throw this User model i created. There is something i missing ? like there is en error showing up.`
  2. `update the AI_Log also when i asked for help`
- What AI gave: A diagnosis of the Prisma schema issue, pointing out that the relation fields referenced models that were not yet defined and listing the naming/typo problems in the `User` model.
- What you used: Adapted
- What you learned: Prisma relation fields must point to actual models, and model names, relation names, and field names must be consistent. The `User` model needs valid related models or those relation fields must be removed until the schema is completed.
- End note: This issue was fixed by identifying the schema mismatch rather than by writing the full implementation.

## Entry 3
- Running number: 3
- Date & time: 06/11/2026 01:14 IST
- Tool: Copilot
- Section: Assignment brief verification and PDF requirement review
- Why you asked: I wanted to confirm whether the PDF instructions were correct for this task and whether the design expectation matched the practical scope of the assignment.
- Time spent before asking: 5 minutes
- Prompt(s):
  1. `Check the pdf, its correct?`
  2. `update AI_LOG`
- What AI gave: Confirmation that the PDF is the correct design assignment for PGfy, that it intentionally requires architectural reasoning rather than code implementation, and that the deliverables include schema, ER diagram, lifecycle flow, architecture, assumptions, and AI usage log.
- What you used: Adapted
- What you learned: The PDF is consistent with the assignment brief: no implementation code is required; the work is architectural and database design oriented. The key objective is to explain reasoning, assumptions, and trade-offs clearly.
- End note: This review confirmed the assignment direction and the need to keep the AI log updated throughout the process.

## Entry 4
- Running number: 4
- Date & time: 06/11/2026 01:16 IST
- Tool: Copilot
- Section: Prisma schema error fix for model relations and validation
- Why you asked: I was receiving Prisma validation errors on the schema and wanted a corrected structure that matched relation names and required model definitions.
- Time spent before asking: 20 minutes
- Prompt(s):
  1. `Can you fix this schema erros?`
- What AI gave: A corrected Prisma schema layout with consistent relation names, a valid `PropertyVerification` model, and aligned reverse fields across `User`, `Property`, `Enquiry`, and follow-up models.
- What you used: Adapted
- What you learned: Prisma errors were caused by mismatched relation names and the absence of a valid ID-bearing `PropertyVerification` model, not by TypeScript compilation issues. Once the relation names were aligned and the model was properly defined, validation passed.
- End note: The schema was fixed and revalidated successfully after setting a temporary `DATABASE_URL` environment variable.

## Entry 5
- Running number: 5
- Date & time: 06/11/2026 01:35 IST
- Tool: Copilot
- Section: PostgreSQL connection configuration, Prisma client setup, and role middleware
- Why you asked: I needed help configuring the backend to connect to PostgreSQL using Prisma and the `DATABASE_URL` environment variable.
- Time spent before asking: Not recorded
- Prompt(s):
  1. `yes help on this situation`
  2. `ok`
- What AI gave: Guidance on configuring the connection and initializing a shared Prisma client. The setup added a `.env.example`, runtime dotenv loading, a reusable Prisma client module, and a role guard aligned with the Prisma roles.
- What you used: Adapted
- What you learned: Prisma reads the connection string from `DATABASE_URL`; runtime apps need to load environment variables, and role middleware should rely on authenticated request context rather than trusting client-supplied headers.
- End note: Prisma schema validation, client generation, and TypeScript build passed. A live database connection was not tested because valid PostgreSQL credentials were not configured in `.env`.

## Entry 6
- Running number: 6
- Date & time: 06/11/2026 01:43 IST
- Tool: Copilot
- Section: Backend API routes and route/server integration
- Why you asked: The route code did not match the current Prisma schema and had imports pointing to missing modules, so the backend build failed. You asked to fix all route code.
- Time spent before asking: Not recorded
- Prompt(s):
  1. `Fix the all routes codes`
- What AI gave: Updated admin property, public property, enquiry, sales follow-up, and verification routes; added Zod request schemas; added JWT authentication middleware; and wired the routers into an Express app and server entry point.
- What you used: Adapted
- What you learned: Route inputs should be validated before database operations, Prisma relation/model field names must match the generated client, and protected routes need verified authentication context rather than caller-provided identity headers.
- End note: Prisma validation and TypeScript build passed. A live PostgreSQL connection, valid JWT issuer, and notification delivery worker/provider still need local configuration or implementation.

## Entry 7
- Running number: 7
- Date & time: 06/11/2026 01:48 IST
- Tool: Copilot
- Section: Backend readiness assessment
- Why you asked: I wanted to know whether the backend was ready after the route fixes and what remained before it could be run or relied on.
- Time spent before asking: Not recorded
- Prompt(s):
  1. `now our backend is ready?`
- What AI gave: A status assessment distinguishing a successful schema validation and TypeScript build from an end-to-end working backend. Remaining items include database configuration and connection testing, an authentication/token issuer, notification delivery processing, and broader endpoint/test coverage.
- What you used: Adapted
- What you learned: A passing build verifies types and compilation, not live service readiness; database, authentication, and integration paths need runtime verification.
- End note: No code changes were made for this assessment.

## Entry 8
- Running number: 8
- Date & time: 06/11/2026 01:54 IST
- Tool: Copilot
- Section: Enquiry notification queue and infrastructure integration
- Why you asked: You clarified that notification worker and infrastructure code had been added based on Google assistance; this needed to be checked against the enquiry route and the backend build.
- Time spent before asking: Not recorded
- Prompt(s):
  1. `I take help of google for enquiryNotification, so this is code and also added infrastructure`
- What AI gave: A review found the worker was importing a missing queue module, the enquiry route was not adding jobs to the queue, and the worker's placeholder provider functions returned fake success IDs. Added the BullMQ queue, connected enquiry submission to queue dispatch, and made unconfigured providers fail explicitly rather than report false delivery.
- What you used: Adapted
- What you learned: Creating notification log rows is not the same as enqueueing delivery work; a queue producer, worker, and real provider implementation all need to be connected. Placeholder integrations must not mark messages as sent.
- End note: TypeScript build and Prisma schema validation passed. The notification provider functions remain intentionally unconfigured. You reported using Google for the original code; add the original Google/Gemini tool name, exact prompt/search, time spent, and result to this log because those details were not provided here.

## Entry 9
- Running number: 9
- Date & time: 06/11/2026 02:00 IST
- Tool: Copilot
- Section: Completing backend business logic, persistence, and provider integration
- Why you asked: You had completed the notification and infrastructure parts using Google assistance, but recognized that important backend logic was still missing. You asked for help completing the remaining backend work.
- Time spent before asking: Not recorded
- Prompt(s):
  1. `Ok then complete all the remaining we are missing our backend. On my side i done this part, but there major logic i was missing. So help it.`
- What AI gave: Connected queue jobs per notification channel, added a recoverable database outbox sweep, configured WhatsApp Cloud API and SMTP delivery adapters, added property update/archive and sales enquiry list/claim flows, tightened authentication to load active users and roles from PostgreSQL, added health checks, generated an initial database migration, and added focused input-schema tests plus setup documentation.
- What you used: Adapted
- What you learned: Reliable asynchronous notification delivery needs independent per-channel jobs, retry state in durable storage, and a recovery path if Redis is unavailable; real provider credentials and an identity issuer remain deployment-specific.
- End note: TypeScript build, five focused tests, Prisma validation, and schema diff checks passed. The original Google interaction details are still not available in this chat; record the exact Google/Gemini search prompts and time from your own history to complete that entry honestly.

## Entry 10
- Running number: 10
- Date & time: 06/11/2026 08:48 IST
- Tool: Copilot
- Section: Backend code folder structure clarification
- Why you asked: My previous reply interpreted “backend architecture” as the written `backend-architecture.md` design document. You clarified that you meant the code folder layout, such as routes, services, queues, and infrastructure.
- Time spent before asking: Not recorded
- Prompt(s):
  1. `I was saying that folder architecture for backend like routes services queues. I am saying folder, not architecture.md .`
- What AI gave: Clarified that the project’s backend folder layout is present in `Backend/src`, with separate routes, schemas, services, queues, infrastructure, middleware, auth, workers, and utilities folders.
- What you used: Not used
- What you learned: “Backend architecture” can refer either to the codebase folder organization or to a high-level system design document; here the request was about the code folders.
- End note: No code changes were made for this clarification.

## Entry 11
- Running number: 11
- Date & time: 06/11/2026 09:09 IST
- Tool: Copilot
- Section: Repository-level README
- Why you asked: I needed a proper project README at the repository root, outside the Backend folder, to explain the repository structure, backend setup, and assignment status.
- Time spent before asking: Not recorded
- Prompt(s):
  1. `create proper readme file outside of the backend folder.`
- What AI gave: Created a root README describing the project, folder layout, backend setup and verification commands, required external services, and remaining assignment deliverables.
- What you used: Adapted
- What you learned: A repository-level README should orient readers at the project root and point to component-specific setup documentation without claiming that configuration-dependent integrations are already operational.
- End note: Documentation only; no code or runtime behavior changed.

Total entries: 11

AI reliance summary: AI was used to interpret the assignment, debug and validate Prisma schema relations, confirm assignment scope, configure PostgreSQL/Prisma, repair API routes and server wiring, assess readiness, complete the enquiry outbox/worker/provider integration, clarify the code folder structure, and prepare repository documentation. The notification worker code was reported as Google-assisted; its exact tool/search history must be added from the user's records. Changes were adapted and validated with a TypeScript build, focused tests, and Prisma validation. Live database connectivity, trusted JWT issuance, Redis availability, and provider account credentials still require setup before end-to-end operation.
