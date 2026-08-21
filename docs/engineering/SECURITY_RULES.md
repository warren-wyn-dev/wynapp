# Mandatory Security Baseline

Security is a release requirement and privacy is designed in from the start. These rules apply to design, implementation, testing, and operations.

## Identity and Access

- Deny by default. Authenticate every protected operation and authorize the requested action against the specific resource server-side.
- Never rely on hidden UI, client claims, route guards, or object identifiers as authorization.
- Apply least privilege to people, services, jobs, databases, infrastructure, and tokens. Separate privileged administrative paths.
- Protect sessions and credentials using approved platform mechanisms; define expiration, revocation, recovery, and audit behavior.
- Authentication architecture and security-policy changes require Founder approval.

## Data and Privacy

- Inventory sensitive and private data, its purpose, owner, access, retention, deletion, and exposure paths.
- Minimize collection and retention; prevent cross-user leakage in queries, caches, logs, analytics, exports, and errors.
- Encrypt sensitive data in transit and at rest using approved mechanisms where applicable.
- Do not use production personal data in development or tests without explicit authorization and effective protection.
- Treat block, privacy, and visibility settings as server-enforced access rules.

## Input, Output, APIs, and Files

- Treat all input as untrusted. Validate type, size, range, format, encoding, ownership, and business invariants at trusted boundaries.
- Use parameterized data access and context-appropriate output encoding. Protect against injection, request forgery, unsafe redirects, and server-side request abuse.
- Apply rate limits and abuse controls based on risk; do not assume one limit fits every operation.
- For uploads, verify allowed type and actual content, size, ownership, storage isolation, retrieval authorization, and malware risk. Never execute user uploads.
- Return minimal errors externally while retaining privacy-safe diagnostic context internally.

## Secrets and Supply Chain

- Never place secrets in source control, client code, images, logs, command history, test fixtures, documentation, or build artifacts.
- Use approved secret storage, tightly scoped access, rotation, expiration, and audit. Treat any committed or logged secret as compromised and rotate it.
- Evaluate dependencies and build inputs for necessity, provenance, maintenance, known vulnerabilities, license, and update strategy.
- Do not disable security checks merely to pass a build.

## Required Adversarial Tests

QA & Security must test applicable cases, including:

- User A reads, edits, or deletes User B's content.
- Unauthenticated or unauthorized users access private resources.
- A user bypasses frontend restrictions through direct API requests or parameter manipulation.
- A user manipulates engagement, rate limits, workflow state, or identifiers.
- Malicious, mislabeled, oversized, or executable files are uploaded or retrieved.
- A user escalates permissions or abuses administrative functions.
- A blocked user or privacy-restricted user bypasses relationship or visibility rules.
- Sessions are replayed, expired, revoked, fixed, or used across privilege changes.

## Findings and Release Response

- **CRITICAL:** Practical severe compromise such as broad unauthorized access, remote execution, exposed production secrets, destructive control, or systemic authentication bypass. Blocks release; immediately escalate to CTO and Founder.
- **HIGH:** Serious confidentiality, integrity, availability, or privilege impact requiring prompt remediation. Ordinarily blocks affected release unless the Founder explicitly accepts a documented risk after security review.
- **MEDIUM:** Meaningful weakness with constrained impact or exploitability; assign an owner and remediation date.
- **LOW:** Limited-impact hardening or defense-in-depth issue; track to resolution.

Every finding records affected scope, prerequisites, reproduction, evidence, impact, severity rationale, recommended remediation, owner, and retest result. CRITICAL issues cannot be waived for release.

## Operations and Incidents

- Log security-relevant events without sensitive payloads; protect logs from unauthorized access and tampering.
- Maintain monitoring, alerting, backups, tested restoration, and rollback appropriate to system risk.
- Define incident ownership, containment, evidence preservation, communication, recovery, and post-incident review.
- Never perform destructive production action without Founder approval, and never expose secrets while troubleshooting.

## Step 8 media boundary

Uploaded images remain private quarantine data until strict decode, bounded dimensions/pixels, metadata stripping and deterministic re-encoding complete. Storage keys and signed requests are server-generated; provider credentials never enter browser code. Media reads, completion, deletion and attachment are owner-authorized and no global media enumeration endpoint is permitted. See `docs/features/media/SECURITY.md`.

## Step 9 Drop boundary

Drop author IDs are session-derived. Drafts and revisions are never public; published reads recheck blocks, follows, account privacy, state, and soft deletion. Attachments are transactionally restricted to nine READY, author-owned DROP_IMAGE assets. External links permit only HTTP(S), and user text is plain text rather than HTML.

## Step 10 engagement

Engagement commands re-authorize Drop visibility, bidirectional block, follow/private state, account state and deletion on every direct mutation and saved/comment read. Client-supplied actor IDs and counts are ignored; Save membership is never public, and ReDrop/Quote rendering must not cache or leak an inaccessible original.
