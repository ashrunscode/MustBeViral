# Legacy v1 read inventory: exact Cloudflare resource identifiers under the retirement allowlist

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs. Recorded 2026-08-11.

This inventory executes the read-only step of `docs/operations/LEGACY_V1_RETIREMENT.md`: it
converts the name-only allowlist into exact resource identifiers using authenticated Cloudflare
API read access (account-scoped MCP listing calls). It authorizes nothing. Zero mutation was
performed; every call was a list/read operation. Deletion, quarantine, and export remain gated by
the runbook's own sequence and explicit per-resource operator approval.

## 1. Method

Account-wide listings of Workers scripts, D1 databases, KV namespaces, R2 buckets, and Hyperdrive
configurations were taken on 2026-08-11 (UTC) through authenticated Cloudflare API read access.
Results were filtered to the legacy MustBeViral names registered in the retirement runbook.
Resources belonging to the v2 cleanroom generation are listed separately and are excluded from
every retirement action. The machine-readable inventory is the YAML block in section 2.

## 2. Machine-readable inventory

```yaml
schema_version: 1
recorded: 2026-08-11
account_access: cloudflare-api-read (account-scoped listings)
mutation_performed: none
legacy_workers:
  - {
      name: mustbeviral,
      script_tag: 91db99e9153d4b88b3d5e0f3e8a1b198,
      created: 2026-05-10,
      modified: 2026-05-10,
    }
  - {
      name: mustbeviral-staging,
      script_tag: cb75523129f94e74a75e92a1691c8808,
      created: 2026-05-10,
      modified: 2026-05-12,
    }
  - {
      name: mustbeviral-production,
      script_tag: 03eb5e0f586749b18a061a3f58f63ea6,
      created: 2026-05-08,
      modified: 2026-05-13,
    }
  - {
      name: must-be-viral-user-service-prod,
      script_tag: 8a88d5a36dc845bea8d788e13cdbf97d,
      created: 2025-10-05,
      modified: 2025-10-05,
    }
  - {
      name: must-be-viral-health-monitor-prod,
      script_tag: 596569df278748de9bc9ea09730d245c,
      created: 2025-10-05,
      modified: 2025-10-05,
    }
  - {
      name: must-be-viral-content-prod,
      script_tag: 6fb2776530a54fd682b74f6afeda7afb,
      created: 2025-10-04,
      modified: 2025-10-13,
    }
  - {
      name: must-be-viral-auth-prod,
      script_tag: e5fb62c3ef2f4c329c7f84a4c34316a7,
      created: 2025-10-04,
      modified: 2025-10-13,
    }
  - {
      name: must-be-viral-analytics-prod,
      script_tag: 620ae8dcf36b40c4882d6b8ddd118db3,
      created: 2025-10-04,
      modified: 2025-10-13,
    }
  - {
      name: must-be-viral-api-gateway-dev,
      script_tag: 07a293840ef047d5862421fa6f8a7192,
      created: 2025-09-30,
      modified: 2025-09-30,
    }
  - {
      name: must-be-viral-analytics-dev,
      script_tag: cfc9c05fa9eb4d9b89155ffe7465a3cb,
      created: 2025-09-30,
      modified: 2025-09-30,
    }
  - {
      name: must-be-viral-analytics,
      script_tag: 0b5b413cb61440b8933d1234a8b1771b,
      created: 2025-09-30,
      modified: 2025-09-30,
    }
  - {
      name: must-be-viral-websocket-prod-production,
      script_tag: 680a460661e74099968c6d83ac2f5534,
      created: 2025-09-29,
      modified: 2025-09-29,
    }
  - {
      name: must-be-viral-payment-prod-production,
      script_tag: c3c2a503953f4a6090d5dbaf1577f173,
      created: 2025-09-29,
      modified: 2025-09-29,
    }
  - {
      name: must-be-viral-payment-prod,
      script_tag: def9c4ef85044eb095806f28d893984f,
      created: 2025-09-29,
      modified: 2025-09-29,
    }
  - {
      name: must-be-viral-secure,
      script_tag: 7953d5044f9b4bdbaaf890ad22fd7f46,
      created: 2025-09-21,
      modified: 2025-09-21,
    }
legacy_d1_databases:
  - {
      name: mustbeviral-production,
      uuid: b9a428e0-038a-4df7-a59d-3a5ddde54550,
      created: 2026-05-08,
      file_size_bytes: 774144,
    }
  - {
      name: mustbeviral-staging,
      uuid: 04b2303a-d7b1-4773-8fd7-cb44bbff88cb,
      created: 2026-05-10,
      file_size_bytes: 659456,
    }
  - {
      name: must-be-viral-db,
      uuid: 14bdc6aa-5ddb-4340-bfb2-59dc68d2c520,
      created: 2025-09-21,
      file_size_bytes: 270336,
    }
legacy_kv_namespaces:
  - { title: mustbeviral-production-cache, id: ff374abd8ca141e8af086afb593e8a8a }
  - { title: mustbeviral-staging-cache, id: 158d36f839a54e5baac85bdcbcff8555 }
legacy_r2_buckets:
  - { name: mustbeviral-production-media, created: 2026-05-08 }
  - { name: mustbeviral-staging-media, created: 2026-05-10 }
  - { name: mustbeviral-media, created: 2025-08-18 }
  - { name: mustbeviral-assets, created: 2025-08-26 }
  - { name: must-be-viral-assets, created: 2025-09-28 }
  - { name: must-be-viral-media, created: 2025-09-30 }
  - { name: must-be-viral-backups, created: 2025-09-30 }
  - { name: must-be-viral-analytics-exports, created: 2025-09-30 }
legacy_hyperdrive_configs: []
v2_resources_excluded_from_retirement:
  - {
      kind: worker,
      name: mustbeviral-v2-staging-core,
      script_tag: 37720ced02c44041a0fb21dc04405952,
    }
  - { kind: r2_bucket, name: mustbeviral-v2-staging-media, created: 2026-07-20 }
```

## 3. Coverage against the runbook allowlist

Every named allowlist entry for D1, KV, and R2 now has an exact identifier. The Workers listing
additionally surfaced twelve legacy `must-be-viral-*` service Workers from the 2025 generation
that the runbook's table did not name individually; they are recorded above and fall under the
runbook's "old Workers" unverified class, now verified as existing scripts with exact tags.

## 4. What this access still cannot enumerate

- Cloudflare Pages projects (the runbook names project `mustbeviral`): no Pages listing
  capability in the current toolset.
- Worker routes, custom domains, and zone DNS records bound to the legacy scripts.
- Durable Object namespaces, Workflows, queues, and scheduled triggers.
- Per-resource traffic over the trailing 30 days (required by retirement gate 1).
- Webhooks registered with external providers, Stripe objects, and the two legacy Vercel
  projects (`must-be-viral`, `mustbeviral`) — outside Cloudflare read scope.
- Owner and dependency attribution; listings prove existence, not usage.

## 5. Left open

- The enumeration gaps above require either a broader-scoped temporary read token (zone read,
  Pages read, Workers routes read, analytics read) or console screenshots, before retirement
  gate 1 can be called complete.
- No traffic evidence exists yet for any legacy resource; nothing here authorizes deletion.
