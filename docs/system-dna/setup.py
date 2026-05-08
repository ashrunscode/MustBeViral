#!/usr/bin/env python3
"""
setup.py
Creates MustBeViral Cloudflare-native project skeleton.

Run:
python setup.py
"""

from pathlib import Path
import textwrap

ROOT = Path("mustbeviral")

DIRS = [
    "src/client/components/ui",
    "src/client/components/layout",
    "src/client/components/navigation",
    "src/client/components/command",
    "src/client/components/brand",
    "src/client/components/onboarding",
    "src/client/components/dashboard",
    "src/client/components/calendar",
    "src/client/components/approvals",
    "src/client/components/media",
    "src/client/components/creative",
    "src/client/components/dm",
    "src/client/components/analytics",
    "src/client/components/reports",
    "src/client/components/growth",
    "src/client/components/admin",
    "src/client/hooks",
    "src/client/lib",
    "src/client/stores",
    "src/client/types",
    "src/server/routes",
    "src/server/agents",
    "src/server/workflows",
    "src/server/services/scheduler",
    "src/server/mcp",
    "src/server/middleware",
    "src/server/db/migrations",
    "src/server/shared",
    "scripts",
    "tests/unit",
    "tests/integration",
    "tests/e2e",
    "docs/product",
    "docs/architecture",
    "docs/prompts",
    "docs/runbooks",
]

FILES = {
    "package.json": """{
  "name": "mustbeviral",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "deploy": "wrangler deploy",
    "deploy:staging": "wrangler deploy --env staging",
    "deploy:production": "wrangler deploy --env production",
    "db:migrate:local": "wrangler d1 migrations apply mustbeviral --local",
    "db:migrate:remote": "wrangler d1 migrations apply mustbeviral --remote"
  },
  "dependencies": {
    "@cloudflare/workers-types": "latest",
    "@hono/zod-validator": "latest",
    "@modelcontextprotocol/sdk": "latest",
    "@tanstack/react-query": "latest",
    "agents": "latest",
    "hono": "latest",
    "lucide-react": "latest",
    "react": "latest",
    "react-dom": "latest",
    "react-hook-form": "latest",
    "react-router": "latest",
    "stripe": "latest",
    "tailwind-merge": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest",
    "wrangler": "latest",
    "tailwindcss": "latest",
    "postcss": "latest",
    "autoprefixer": "latest",
    "@playwright/test": "latest"
  }
}
""",
    "src/server/index.ts": """import { Hono } from "hono";
import { cors } from "hono/cors";

export type Env = {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  AI: Ai;
  MARKETING_AGENT: DurableObjectNamespace;
  MUSTBEVIRAL_MCP: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

app.get("/api/health", (c) => c.json({ success: true, data: { ok: true } }));

app.get("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export { MarketingAgent } from "./agents/MarketingAgent";
export { MustBeViralMCP } from "./mcp/MustBeViralMCP";
export { BrandOnboardingWorkflow } from "./workflows/BrandOnboardingWorkflow";
export { ContentCalendarWorkflow } from "./workflows/ContentCalendarWorkflow";
export { ImageGenerationWorkflow } from "./workflows/ImageGenerationWorkflow";
export { ApprovalSchedulingWorkflow } from "./workflows/ApprovalSchedulingWorkflow";
export { WeeklyReportWorkflow } from "./workflows/WeeklyReportWorkflow";
export { GrowthOpportunityWorkflow } from "./workflows/GrowthOpportunityWorkflow";
export { DMAutomationSetupWorkflow } from "./workflows/DMAutomationSetupWorkflow";

export default app;
""",
    "src/server/agents/MarketingAgent.ts": """import { Agent, callable } from "agents";

export type MarketingAgentState = {
  brandId?: string;
  status: "idle" | "onboarding" | "generating" | "waiting_approval" | "scheduling" | "reporting" | "paused" | "error";
  pendingApprovalsCount: number;
  scheduledThisWeekCount: number;
  errors: Array<{ at: string; message: string; severity: string }>;
};

export class MarketingAgent extends Agent<Env, MarketingAgentState> {
  initialState: MarketingAgentState = {
    status: "idle",
    pendingApprovalsCount: 0,
    scheduledThisWeekCount: 0,
    errors: []
  };

  @callable()
  async getCommandCenter() {
    return this.state;
  }

  @callable()
  async pauseAgent() {
    this.setState({ ...this.state, status: "paused" });
    return this.state;
  }

  @callable()
  async resumeAgent() {
    this.setState({ ...this.state, status: "idle" });
    return this.state;
  }

  async onWorkflowProgress(workflowName: string, instanceId: string, progress: unknown) {
    this.broadcast(JSON.stringify({ type: "workflow-progress", workflowName, instanceId, progress }));
  }

  async onWorkflowComplete(workflowName: string, instanceId: string, result?: unknown) {
    this.broadcast(JSON.stringify({ type: "workflow-complete", workflowName, instanceId, result }));
  }

  async onWorkflowError(workflowName: string, instanceId: string, error: string) {
    this.setState({
      ...this.state,
      status: "error",
      errors: [...this.state.errors, { at: new Date().toISOString(), message: error, severity: "error" }]
    });
  }
}
""",
    "src/server/mcp/MustBeViralMCP.ts": """import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export class MustBeViralMCP extends McpAgent {
  server = new McpServer({ name: "mustbeviral-mcp", version: "0.1.0" });

  async init() {
    this.server.tool("list_tables", {}, async () => ({
      content: [{ type: "text", text: "Implement read-only D1 table listing." }]
    }));

    this.server.tool("get_brand_profile", { brandId: z.string() }, async ({ brandId }) => ({
      content: [{ type: "text", text: `Implement read-only brand profile lookup for ${brandId}.` }]
    }));
  }
}
""",
    "src/server/workflows/BrandOnboardingWorkflow.ts": """import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";

export class BrandOnboardingWorkflow extends WorkflowEntrypoint<Env> {
  async run(event: WorkflowEvent<{ brandId: string }>, step: WorkflowStep) {
    const params = event.payload;

    await step.do("validate-inputs", async () => {
      if (!params.brandId) throw new Error("brandId required");
      return true;
    });

    await step.do("create-intelligence-placeholder", async () => {
      return { brandId: params.brandId, status: "placeholder" };
    });

    return { success: true, brandId: params.brandId };
  }
}
""",
    "src/server/workflows/ContentCalendarWorkflow.ts": """import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
export class ContentCalendarWorkflow extends WorkflowEntrypoint<Env> {
  async run(event: WorkflowEvent<{ brandId: string }>, step: WorkflowStep) {
    return step.do("generate-calendar-placeholder", async () => ({ brandId: event.payload.brandId }));
  }
}
""",
    "src/server/workflows/ImageGenerationWorkflow.ts": """import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
export class ImageGenerationWorkflow extends WorkflowEntrypoint<Env> {
  async run(event: WorkflowEvent<{ brandId: string }>, step: WorkflowStep) {
    return step.do("generate-image-placeholder", async () => ({ brandId: event.payload.brandId }));
  }
}
""",
    "src/server/workflows/ApprovalSchedulingWorkflow.ts": """import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
export class ApprovalSchedulingWorkflow extends WorkflowEntrypoint<Env> {
  async run(event: WorkflowEvent<{ brandId: string }>, step: WorkflowStep) {
    return step.do("schedule-placeholder", async () => ({ brandId: event.payload.brandId }));
  }
}
""",
    "src/server/workflows/WeeklyReportWorkflow.ts": """import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
export class WeeklyReportWorkflow extends WorkflowEntrypoint<Env> {
  async run(event: WorkflowEvent<{ brandId: string }>, step: WorkflowStep) {
    return step.do("weekly-report-placeholder", async () => ({ brandId: event.payload.brandId }));
  }
}
""",
    "src/server/workflows/GrowthOpportunityWorkflow.ts": """import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
export class GrowthOpportunityWorkflow extends WorkflowEntrypoint<Env> {
  async run(event: WorkflowEvent<{ brandId: string }>, step: WorkflowStep) {
    return step.do("growth-opportunity-placeholder", async () => ({ brandId: event.payload.brandId }));
  }
}
""",
    "src/server/workflows/DMAutomationSetupWorkflow.ts": """import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
export class DMAutomationSetupWorkflow extends WorkflowEntrypoint<Env> {
  async run(event: WorkflowEvent<{ brandId: string }>, step: WorkflowStep) {
    return step.do("dm-automation-placeholder", async () => ({ brandId: event.payload.brandId }));
  }
}
""",
    "src/client/main.tsx": """import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return <div>MustBeViral command center scaffold</div>;
}

createRoot(document.getElementById("root")!).render(<App />);
""",
    "src/client/styles.css": """@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}
""",
    "src/server/db/migrations/0001_initial.sql": "-- Replace with DATABASE_SCHEMA.sql content from System DNA package.\n"
}

def write(path: str, content: str):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(textwrap.dedent(content).strip() + "\n", encoding="utf-8")

def main():
    for d in DIRS:
        (ROOT / d).mkdir(parents=True, exist_ok=True)

    for path, content in FILES.items():
        write(path, content)

    print(f"Created skeleton at {ROOT.resolve()}")

if __name__ == "__main__":
    main()
