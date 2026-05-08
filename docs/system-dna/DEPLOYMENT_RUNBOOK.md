# DEPLOYMENT_RUNBOOK.md

## Local Setup

```bash
npm install
cp .env.example .env
npm run db:migrate:local
npm run dev
```

## Cloudflare Resources

Create:
```bash
wrangler d1 create mustbeviral
wrangler r2 bucket create mustbeviral-media
wrangler kv namespace create CACHE
wrangler vectorize create mustbeviral-vectorize --dimensions=1536 --metric=cosine
```

Update placeholders in `wrangler.jsonc`.

## Secrets

```bash
wrangler secret put SESSION_SECRET
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put AI_GATEWAY_TOKEN
wrangler secret put KIMI_API_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put VISTA_SOCIAL_API_KEY
wrangler secret put BUFFER_API_KEY
```

## Migrations

Local:
```bash
wrangler d1 migrations apply mustbeviral --local
```

Remote:
```bash
wrangler d1 migrations apply mustbeviral --remote
```

## Staging Deploy

```bash
npm run typecheck
npm run test
npm run build
wrangler deploy --env staging
```

## Production Deploy

```bash
npm run typecheck
npm run test
npm run build
wrangler deploy --env production
```

## Smoke Test

- login
- create brand
- start onboarding mock
- generate report mock
- schedule manual export
- admin page loads
