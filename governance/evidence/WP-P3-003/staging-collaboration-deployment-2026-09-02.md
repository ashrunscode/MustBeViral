# Staging collaboration deployment — WP-P3-003

Recorded: 2026-09-02  
Cloudflare account: `d2897bdebfa128919bd89b265e6a712e`

## Deployment

- Worker: `mustbeviral-v2-staging-collaboration`
- Version: `92255439-310e-4803-a2ac-864008053882`
- Deployment allocation: 100% to the version above
- Endpoint: `https://mustbeviral-v2-staging-collaboration.ernijs-ansons.workers.dev`
- Binding: `CANVAS_COORDINATION` → `CanvasCoordination`
- Custom routes: none in configuration

The deployment created only the named staging Worker and its Durable Object
class migration. It did not attach Core, web, a custom domain, production
clients, or legacy V1.

## Bounded smoke

| Request                                  | Result | Proof                                                                                             |
| ---------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| `GET /health`                            | 200    | service `mustbeviral-collaboration`, generation `viralgraph-cleanroom-v2`, authority `draft-only` |
| `GET /canvases/wp-p3-003-smoke/snapshot` | 200    | isolated empty snapshot for the named smoke canvas                                                |
| `GET /v1/revisions`                      | 404    | collaboration Worker refuses revision/billing authority                                           |
| `GET /`                                  | 404    | unknown routes fail closed                                                                        |

`wrangler deployments status --env production` returned Cloudflare API code
10007: `mustbeviral-v2-production-collaboration` does not exist. Production and
legacy V1 remain untouched.

## Rollback posture

This is the first staging version, so there is no earlier good version to roll
back to. The Worker is unrouted from the product. If a defect is found, deploy
a corrected version to the same staging name; do not delete the Worker or
Durable Object namespace.
