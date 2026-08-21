# WYN

WYN is currently in its product, architecture, and engineering-planning phase. The
repository contains the approved V1 product specification, system design,
technology choices, and engineering operating rules that implementation work must
follow.

## Repository guide

- [`docs/product`](docs/product) defines the V1 scope, priorities, exclusions, and
  user flows.
- [`docs/architecture`](docs/architecture) defines system boundaries, data flow,
  security, deployment, and architectural decisions.
- [`docs/tech`](docs/tech) records the approved implementation stack.
- [`docs/engineering`](docs/engineering) defines delivery, security, quality, and
  Git practices.

There is no runnable application in this repository yet. Do not infer production
readiness from the presence of design documents.

## Validation

The documentation validator uses only the Python standard library. It checks all
repository Markdown documents for unreadable files, empty content, trailing
whitespace, and broken relative links.

```bash
python3 scripts/validate_docs.py
python3 -m unittest discover -s tests -v
```

Contributors must also follow [`AGENTS.md`](AGENTS.md) and the engineering workflow
before changing approved scope or architecture.
