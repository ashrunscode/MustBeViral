# Source Of Truth Decisions

## Inputs Reconciled

- `mustbeviral_system_dna_extracted/mustbeviral_system_dna/*`: original product, architecture, data, agent, workflow, API, UX, security, cost, and deployment DNA.
- `audit/*`: Claude audit proving the repo is greenfield and identifying missing security, database, Cloudflare, agent, billing, and test foundations.
- Actual repo state: spec-only root, no `.git`, no `package.json`, no runnable Worker, no migrations, no tests.

## Final Authority Order

1. Live repository state.
2. Claude audit findings where they match repo state.
3. System DNA product intent.
4. Current Cloudflare/Wrangler/package schemas verified during implementation.

## Superseded Inputs

- `setup.py` is treated as a historical scaffold generator only.
- The extracted `wrangler.jsonc` is a reference, not deployable config.
- `PROMPT_ROADMAP.md` is superseded by the audit roadmap and this final strategy.
