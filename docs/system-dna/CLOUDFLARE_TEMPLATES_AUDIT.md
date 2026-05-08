# CLOUDFLARE_TEMPLATES_AUDIT.md

## Use

### react-router-hono-fullstack-template
Use as base.
Reason: Full-stack Workers template with Hono APIs, React Router, ShadCN UI, Tailwind, and Vite.

### agents-starter
Use as agent reference.
Reason: Includes Agents SDK patterns for AI chat, tools, approvals, scheduling, WebSockets, state, and image input.

## Copy / Adapt

### saas-admin-template
Copy admin layout if current template exists and is compatible.

### text-to-image-template
Copy image generation structure, then adapt to FLUX.2 model routing.

### r2-explorer-template
Copy R2 browsing/upload patterns for Media Library.

### workflows-starter-template
Copy workflow class/config patterns.

### d1-template
Copy D1 migration/setup patterns.

### d1-starter-sessions-api-template
Copy session/auth patterns if compatible.

### durable-chat-template
Copy Durable Object/WebSocket state patterns if useful.

### chanfana-openapi-template
Copy OpenAPI docs patterns if it does not add unnecessary complexity.

### openauth-template
Evaluate for auth. Use only if simpler than custom auth.

## Ignore for MVP

- containers-template
- microfrontend-template
- mysql-hyperdrive-template
- postgres-hyperdrive-template
- nodejs-http-server-template
- workers-for-platforms-template
- worker-publisher-template
- x402-proxy-template
- multiplayer-globe-template
