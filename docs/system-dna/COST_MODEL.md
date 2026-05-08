# COST_MODEL.md

## Cost Buckets

Per brand:
- text generation
- image generation
- Browser Run scans
- Workflows
- D1 reads/writes
- R2 storage
- Cloudflare Images delivery/transforms
- AI Gateway
- scheduler backend
- email/report export
- Stripe fees

## Expected MVP Cost Controls

- Kimi/cheap text model default.
- Premium model only for final reviews/reports.
- FLUX 4B for drafts.
- FLUX 9B for default production.
- FLUX dev only for premium/important campaigns.
- Max images per plan.
- Max posts per plan.
- Weekly report generation once/week.
- Cache stable brand profile outputs.
- Do not regenerate full calendar unnecessarily.

## Plan Margin Assumptions

Starter $49/mo:
- target infra/model cost: <$8
- gross margin target: 80%+

Growth $149/mo:
- target infra/model cost: <$25
- gross margin target: 80%+

Agency $399/mo:
- target infra/model cost: <$75
- gross margin target: 80%+

Managed $500-$1,500/mo:
- software cost is minor
- margin depends on human labor

## Usage Guardrails

- Stop generation when plan usage exceeded.
- Allow paid top-up.
- Warn admin when brand cost exceeds threshold.
- Track cost by workspace, brand, provider, model, task.
