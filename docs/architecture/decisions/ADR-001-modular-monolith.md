# ADR-001: Modular Monolith

## Status

**PROPOSED** — requires Founder approval.

## Context

WYN V1 spans social, club, chat, moderation and ranking domains, but begins near 1,000 DAU with a small operational footprint. It needs clear boundaries and asynchronous work without speculative distributed-system cost.

## Decision

Use one modular API codebase and logical PostgreSQL database with enforced domain ownership, plus separately running workers built from the same domain modules. Consumer App, Admin App, API and Worker remain deployable boundaries. Scale stateless processes and database/read paths before extracting services.

## Alternatives

- Microservices per domain: stronger deployment isolation but excessive network, data-consistency and operations burden for V1.
- Unstructured monolith: initially fast but invites cross-table mutation and circular dependencies.
- Serverless functions per endpoint: fragmented transactions, cold-start/observability complexity and provider coupling.

## Consequences

V1 has simpler transactions, deployment and debugging. Module interfaces and table ownership require review discipline. A noisy domain shares process/database capacity until isolated. Extraction remains possible through event/interface seams when measured scaling, security isolation or team autonomy justifies it.
