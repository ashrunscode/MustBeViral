# MustBeViral Studio

MustBeViral Studio is the visual operating system for DTC creative production. ViralGraph turns a structured campaign brief into a transparent, versioned graph that humans and compatible agents can plan, quote, execute, inspect, refine, and export.

The cleanroom rebuild is governed from the repository. Start with:

```powershell
corepack pnpm install --frozen-lockfile
pnpm agent:preflight
```

- Human documentation map: `docs/INDEX.md`
- Current machine state: `PROJECT_STATE.yaml`
- Agent contract: `AGENTS.md`
- Active implementation slice: `docs/delivery/ACTIVE_WORK_PACKET.yaml`

Do not infer product or architecture behavior from this README; the accepted documents registered in `docs/MANIFEST.yaml` are authoritative.
