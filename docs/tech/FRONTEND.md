# Frontend Stack

**Status:** PROPOSED

## Consumer

Use **Next.js + React + strict TypeScript**. Server rendering/static generation provide public profile/Drop discovery and Thai SEO; client islands support an app-like feed, optimistic interactions and chat. Route-level rendering policy must distinguish public, personalized and private content. Next image optimization may be used for public processed variants, while private media uses short-lived authorized URLs and must not enter a shared cache.

PWA support uses a small reviewed service worker rather than a broad plugin: app shell/static assets may be cached, authenticated API responses may not. Queue only explicitly idempotent offline actions. Measure LCP/INP/CLS, paginate with cursors, virtualize only after profiling, reserve image dimensions and default to WebP with AVIF where its CPU/size trade-off wins.

Compared with a React SPA, Next improves SSR/SEO and routing conventions. Remix is credible but gives less organizational leverage for the preferred ecosystem. A native app duplicates V1 delivery and is out of scope. Deployment must use standard Node output/OCI where possible, not provider-only APIs.

## Admin

Use a **separate Next.js application**, origin, artifact, deployment, environment and session realm. It can share `ui`, safe `types`, `validation`, and `config`, but never Consumer cookies or auth callbacks. Admin pages default to dynamic/no-store, are absent from public indexing, and still rely on API authorization—not hidden controls.

## UI and localization

Use Tailwind CSS for constrained utilities and an internal WYN design system for tokens and product components. Adopt Radix primitives selectively for difficult accessible interactions; do not wholesale import a generic dashboard kit. The visual target is 80–90% white with 10–20% rainbow accent. Semantic HTML, keyboard/focus behavior, contrast, reduced motion, scalable type, touch targets and loading/empty/error/offline states are acceptance criteria. Externalize Thai-primary strings from the beginning and test English expansion.
