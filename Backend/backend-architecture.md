# PGfy Unverified Property Module — Backend Architecture

## 1. Architectural intent

The backend should support a single source of truth for property records, enquiry records, and lifecycle history while keeping tenant-facing listing logic and admin management logic separated. The design must work for:

- manually managed unveriﬁed properties
- tenant discovery flows
- enquiry submission
- alerting to sales via WhatsApp and email
- future verification and conversion into regular verified listings

The system should prioritize data correctness, traceability, and extensibility over premature optimization.

## 2. High-level architecture

```text
┌──────────────────────────────┐
│ Admin Management Portal      │
│ - create/update property      │
│ - manage status and notes    │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Backend API Layer            │
│ - REST / service endpoints   │
│ - validation and access     │
│ - authorization              │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Application Services        │
│ - Property Service           │
│ - Enquiry Service            │
│ - Verification Service       │
│ - Notification Orchestrator  │
│ - Audit / History Service   │
└──────────────┬───────────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌────────────────┐  ┌──────────────────────┐
│ PostgreSQL     │  │ Integration Layer     │
│ Primary store  │  │ - WhatsApp           │
│ - properties   │  │ - Email              │
│ - enquiries    │  │ - Sales workflow     │
│ - audits       │  │ - future services    │
│ - verification │  └──────────────────────┘
│ - statuses     │
└────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ Tenant Listing / Discovery   │
│ - visible filtered results   │
│ - property detail view        │
│ - enquiry submission form    │
└──────────────────────────────┘
```

## 3. Core backend components

### 3.1 API layer
Responsible for:
- validating admin and tenant requests
- enforcing role-based access
- normalizing request payloads
- returning consistent statuses and domain errors

This layer should not own business rules permanently; it should delegate to domain services.

### 3.2 Property service
Responsible for:
- creating unveriﬁed property records
- updating owner and listing information
- applying status transitions
- supporting publication and visibility rules
- handling conversion to verified property

Important design principle:
- The system should store the property as a single canonical record with an explicit lifecycle state rather than creating multiple disconnected copies.

### 3.3 Enquiry service
Responsible for:
- capturing tenant enquiry details
- linking enquiry to property, tenant, and admin context
- recording enquiry status and follow-up state
- triggering notification workflow
- preserving full enquiry history over time

This is the operational heart of the sales funnel.

### 3.4 Verification service
Responsible for:
- validation process for property eligibility
- status changes such as pending verification, under review, approved, rejected, failed
- ownership of the decision trail
- final conversion into a verified property if applicable

This service should maintain a clear record of who changed what and why.

### 3.5 Notification orchestration service
Responsible for:
- consuming enquiry events
- preparing outbound message payloads
- dispatching WhatsApp and email messages
- logging delivery attempts and failures
- retrying failed sends through a queue or scheduled worker

This isolates third-party integrations from the core business flow.

### 3.6 Audit and history service
Responsible for:
- storing create/update/delete state changes
- logging lifecycle transitions and ownership changes
- preserving enough history for dispute resolution, reporting, and compliance review

This is especially important for status changes such as:
- created by admin
- listed
- enquiry received
- sales follow-up started
- verification outcome
- converted to verified

## 4. Main backend domains and data ownership

### A. Property domain
Owns:
- property identity
- category and subcategory
- address and room details
- status and visibility
- source (unverified vs verified)
- relation to a future verified property record

### B. Enquiry domain
Owns:
- enquiry entry
- communication requests
- follow-up workflows
- customer interaction history

### C. Verification domain
Owns:
- verification case and decisions
- reasons for rejection or issue
- evidence or comments tied to review

### D. Notification domain
Owns:
- outbound payloads
- provider integration state
- success or failure result

### E. Audit domain
Owns:
- lifecycle event logs
- who changed status and when
- historical record of business decisions

## 5. Backend data flow

### 5.1 Property creation and listing flow
1. Admin submits property details.
2. API validates mandatory fields and role permissions.
3. Property service creates a property record with status = draft or active_unverified.
4. Listing rules determine which properties are tenant-visible.
5. Tenant discovery service fetches only visible properties marked “PGfy Not Verified”.
6. Property lifecycle history is written automatically.

### 5.2 Enquiry flow
1. Tenant opens a property page.
2. Tenant submits enquiry details.
3. Enquiry service validates input and creates a new enquiry record.
4. Enquiry is linked to the property and tenant profile.
5. Notification orchestrator emits outbound WhatsApp and email tasks.
6. Sales workflow can track the enquiry and update follow-up status.
7. Audit log records all transitions.

### 5.3 Verification flow
1. Property enters a verification case.
2. Verification service marks it as under review.
3. Review outcome is recorded.
4. If approved, the record may be converted into a standard verified property.
5. If rejected or blocked, the property remains unverified with a clear reason and retry path.

### 5.4 Conversion flow
1. A verified property must be created or linked to the existing record.
2. The old unveriﬁed record is marked converted or archived.
3. The tenant-facing listing now reflects verified status.
4. Historical enquiries remain attached to the original property context and can be preserved for sales continuity.

## 6. Key architectural choices

### Separation of transaction and workflow processing
The core database handles transactional integrity, while notifications and follow-up events are processed asynchronously. This prevents user-facing actions from becoming slower when an email or WhatsApp provider is delayed.

### Explicit lifecycle states
Each property and enquiry should have a status field instead of implicit state. This allows clean filtering, debugging, and future reporting.

### Event-driven integration
The enquiry service triggers independent notification and sales tasks rather than embedding provider code directly inside the request path.

### Auditability as a first-class concern
Every important change should be recorded. This is essential because the module has approval, sales, and property verification states.

### Canonical property identity
The property record should stay the source of truth and not be duplicated into separate tenant and verification tables. Related data should be linked via foreign keys and status-specific relationship tables instead of full duplication.

## 7. Suggested backend modules

- Property Management Module
  - property CRUD
  - validation and status transitions
  - listing visibility logic

- Enquiry Management Module
  - tenant enquiry intake
  - sales assignment and follow-up
  - enquiry history

- Verification Workflow Module
  - verification request
  - review decision
  - conversion workflow

- Notification Module
  - WhatsApp dispatch
  - email dispatch
  - retry handling

- Audit Module
  - status history
  - ownership and change logs

- Search and Discovery Module
  - tenant listing query layer
  - filter by category, status, and location

## 8. Scalability considerations

This architecture supports future scale by:

- keeping read-heavy listing queries separate from write-heavy admin workflows
- indexing listing and status columns for tenant search
- isolating integrations behind workers or message queues
- allowing new property categories via a category table instead of schema breakage
- preserving full enquiry history without overwriting earlier records
- supporting more admin states and team workflows as a clear extension point

## 9. Assumptions made

- Tenants are logged in or can submit an enquiry without login, depending on product UX; the backend should support both patterns.
- A property may have one primary category and nested subcategory metadata.
- A sales follow-up record is required for each enquiry; it can be either manual or semi-automated.
- Verification may include multiple review steps or resolutions, but the backend should allow a “pending / rejected / approved / converted” state model.
- WhatsApp and email failures are handled asynchronously with retry and logging.
- Historical property records remain accessible after conversion so the audit trail is preserved.

## 10. Summary

The backend design is centered on a relational model with:
- one canonical property record
- explicit statuses and lifecycle events
- enquiry records tied to property and tenant context
- workflow-driven verification and conversion
- notification orchestration separated from core business logic
- audit history for traceability and future reporting

This keeps the module operationally clear, scalable, and ready for future growth without over-engineering.
