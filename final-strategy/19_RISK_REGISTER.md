# Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---:|---:|---|
| Template command creates nested structure | Medium | Medium | Scaffold into `app/` if root contains docs; document root decision. |
| FLUX IDs unavailable | Medium | Medium | Configurable model IDs, capability probe, mock provider. |
| Browser Run local support incomplete | Medium | Medium | Fetch fallback and fake browser service. |
| Auth hashing package incompatible with Workers | Medium | High | Start with WebCrypto PBKDF2 and tests. |
| Tenant leak from missed workspace filter | Medium | Critical | RBAC helpers and tenant isolation tests. |
| Stripe webhook body parsing error | Medium | High | Dedicated raw route and fixture tests. |
| Cost runaway during generation | Medium | High | Central model router, usage logs, rate/cost guard. |
| Vista/Buffer APIs differ from assumption | High | Medium | Manual export first, skeleton adapters disabled. |
| DM automation provider unsupported | High | Medium | Draft/approval only; no browser bots. |
| Build scope too broad | High | High | Vertical slice first, mock-first workflows. |
