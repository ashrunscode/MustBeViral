import type { Route } from "./+types/home";

type CloudflareLoaderContext = {
	cloudflare: {
		env: Cloudflare.Env;
	};
};

const sections = [
	{ href: "/signup", label: "Signup" },
	{ href: "/workspace", label: "Workspace" },
	{ href: "/brands", label: "Brands" },
	{ href: "/onboarding", label: "Onboarding" },
	{ href: "/intelligence", label: "Intelligence" },
	{ href: "/calendar", label: "Calendar" },
	{ href: "/approvals", label: "Approvals" },
	{ href: "/media", label: "Media" },
	{ href: "/dm-automation", label: "DM Rules" },
	{ href: "/reports", label: "Reports" },
	{ href: "/growth", label: "Growth" },
	{ href: "/billing", label: "Billing" },
	{ href: "/admin", label: "Admin" },
] as const;

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "MustBeViral" },
		{ name: "description", content: "Cloudflare-native AI marketing autopilot." },
	];
}

export function loader({ context, request }: Route.LoaderArgs) {
	const cloudflare = (context as CloudflareLoaderContext).cloudflare;
	const path = new URL(request.url).pathname;

	return {
		path,
		env: cloudflare.env.APP_ENV,
		apiBase: "/api",
	};
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const active = activeSection(loaderData.path);

	return (
		<main className="min-h-screen bg-[#f7f7f2] text-[#171717]">
			<div className="mx-auto flex min-h-screen w-full max-w-7xl">
				<aside className="hidden w-64 shrink-0 border-r border-[#d8d7cf] bg-[#fcfcf8] px-4 py-5 lg:block">
					<a href="/" className="block border-b border-[#d8d7cf] pb-5">
						<div className="text-lg font-semibold">MustBeViral</div>
						<div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#6c6a60]">
							{loaderData.env}
						</div>
					</a>
					<nav className="mt-5 grid gap-1">
						{sections.map((section) => (
							<a
								key={section.href}
								href={section.href}
								className={`rounded-md px-3 py-2 text-sm ${
									active.href === section.href
										? "bg-[#1f3a5f] text-white"
										: "text-[#444139] hover:bg-[#efeee7]"
								}`}
							>
								{section.label}
							</a>
						))}
					</nav>
				</aside>

				<section className="flex min-w-0 flex-1 flex-col">
					<header className="border-b border-[#d8d7cf] bg-[#fcfcf8] px-5 py-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<h1 className="text-2xl font-semibold">{active.title}</h1>
								<p className="mt-1 max-w-3xl text-sm text-[#5d5a50]">{active.subtitle}</p>
							</div>
							<a
								href={active.primaryHref}
								className="rounded-md bg-[#167761] px-4 py-2 text-sm font-medium text-white"
							>
								{active.primaryAction}
							</a>
						</div>
					</header>

					<div className="grid gap-5 p-5">
						<section className="grid gap-4 md:grid-cols-4">
							{active.stats.map((stat) => (
								<div key={stat.label} className="rounded-md border border-[#d8d7cf] bg-white p-4">
									<div className="text-xs uppercase tracking-[0.14em] text-[#6c6a60]">{stat.label}</div>
									<div className="mt-3 text-3xl font-semibold">{stat.value}</div>
									<div className="mt-1 text-sm text-[#5d5a50]">{stat.detail}</div>
								</div>
							))}
						</section>

						<section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
							<div className="rounded-md border border-[#d8d7cf] bg-white">
								<div className="border-b border-[#e2e0d8] px-4 py-3">
									<h2 className="text-base font-semibold">{active.workTitle}</h2>
								</div>
								<div className="divide-y divide-[#eceae2]">
									{active.rows.map((row) => (
										<div key={row.title} className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_140px_120px]">
											<div>
												<div className="font-medium">{row.title}</div>
												<div className="mt-1 text-sm text-[#5d5a50]">{row.evidence}</div>
											</div>
											<div className="text-sm text-[#5d5a50]">{row.owner}</div>
											<div className="text-sm font-medium text-[#1f3a5f]">{row.status}</div>
										</div>
									))}
								</div>
							</div>

							<div className="rounded-md border border-[#d8d7cf] bg-white">
								<div className="border-b border-[#e2e0d8] px-4 py-3">
									<h2 className="text-base font-semibold">Guardrails</h2>
								</div>
								<div className="grid gap-3 p-4">
									{guardrails.map((guardrail) => (
										<div key={guardrail.title} className="rounded-md bg-[#f6f5ef] p-3">
											<div className="text-sm font-medium">{guardrail.title}</div>
											<div className="mt-1 text-sm text-[#5d5a50]">{guardrail.detail}</div>
										</div>
									))}
								</div>
							</div>
						</section>
					</div>
				</section>
			</div>
		</main>
	);
}

function activeSection(path: string) {
	const key = path.split("/").filter(Boolean)[0] ?? "command";
	return pageMap[key] ?? pageMap.command!;
}

const baseStats = [
	{ label: "Brands", value: "Multi", detail: "one agent per brand" },
	{ label: "Publishing", value: "0", detail: "without approval" },
	{ label: "Scheduler", value: "Manual", detail: "Phase 1 default" },
	{ label: "AI Mode", value: "Mock", detail: "provider-gated" },
];

const guardrails = [
	{ title: "Approval first", detail: "Content, images, schedules, and DM rules require review." },
	{ title: "Untrusted scans", detail: "Website and social content cannot instruct the agent." },
	{ title: "No DM bots", detail: "Only safe rule drafting and provider-ready handoff are enabled." },
	{ title: "Manual export", detail: "Direct social publishing is not a launch dependency." },
];

const pageMap: Record<
	string,
	{
		href: string;
		title: string;
		subtitle: string;
		primaryAction: string;
		primaryHref: string;
		stats: typeof baseStats;
		workTitle: string;
		rows: Array<{ title: string; evidence: string; owner: string; status: string }>;
	}
> = {
	command: {
		href: "/",
		title: "Command Center",
		subtitle: "Operate every brand from one approval-driven marketing cockpit.",
		primaryAction: "Create Brand",
		primaryHref: "/brands",
		stats: baseStats,
		workTitle: "Today",
		rows: [
			{ title: "Brand onboarding", evidence: "Website scan, scores, profile, target market", owner: "Agent", status: "Ready" },
			{ title: "Approval queue", evidence: "Pending posts block scheduling until approved", owner: "Owner", status: "Open" },
			{ title: "Growth loop", evidence: "Weekly report feeds next opportunities", owner: "Agent", status: "Queued" },
		],
	},
	signup: {
		href: "/signup",
		title: "Signup And Login",
		subtitle: "D1-backed sessions secure the workspace and brand surfaces.",
		primaryAction: "Open API",
		primaryHref: "/api/health",
		stats: baseStats,
		workTitle: "Auth Surface",
		rows: [
			{ title: "POST /api/auth/signup", evidence: "PBKDF2 password hashing and secure cookie session", owner: "API", status: "Implemented" },
			{ title: "POST /api/auth/login", evidence: "Lockout after repeated invalid attempts", owner: "API", status: "Implemented" },
			{ title: "GET /api/auth/me", evidence: "Session, user, and workspace list", owner: "API", status: "Implemented" },
		],
	},
	workspace: {
		href: "/workspace",
		title: "Workspace Setup",
		subtitle: "Multi-tenant workspaces with owner membership and starter subscription records.",
		primaryAction: "Brands",
		primaryHref: "/brands",
		stats: baseStats,
		workTitle: "Workspace Flow",
		rows: [
			{ title: "Create workspace", evidence: "Owner membership and audit log", owner: "User", status: "Implemented" },
			{ title: "List brands", evidence: "Workspace-scoped RBAC", owner: "API", status: "Implemented" },
		],
	},
	brands: {
		href: "/brands",
		title: "Brands",
		subtitle: "Each brand receives independent state, profile memory, scans, and workflow runs.",
		primaryAction: "Start Onboarding",
		primaryHref: "/onboarding",
		stats: baseStats,
		workTitle: "Brand Flow",
		rows: [
			{ title: "Create brand", evidence: "Website URL SSRF guard before insert", owner: "User", status: "Implemented" },
			{ title: "MarketingAgent", evidence: "Durable Object per brand", owner: "Cloudflare", status: "Implemented" },
			{ title: "Social links", evidence: "Stored as unconnected profiles for provider handoff", owner: "API", status: "Implemented" },
		],
	},
	onboarding: page("Onboarding", "Mock-first website scan, score, profile, target market, and workflow run."),
	intelligence: page("Brand Intelligence", "Evidence-backed scores and scan findings."),
	calendar: page("Content Calendar", "Thirty-day mock calendar with platform variants and approval states."),
	approvals: page("Approvals", "Approve, reject, edit, or regenerate before scheduling."),
	media: page("Media Library", "R2 metadata plus mock image generation through ModelRouter."),
	"dm-automation": page("DM Automation", "Safe keyword rules and human-handoff templates, approval required."),
	reports: page("Weekly Reports", "Mock analytics summary and next-action loop."),
	growth: page("Growth Opportunities", "Evidence-backed campaign opportunities ready for conversion."),
	billing: page("Billing", "Stripe Checkout and portal skeletons stay disabled until keys and prices exist."),
	admin: page("Admin", "Protected overview for users, workspaces, brands, failures, usage, and costs."),
};

function page(title: string, subtitle: string) {
	return {
		href: `/${title.toLowerCase().replaceAll(" ", "-")}`,
		title,
		subtitle,
		primaryAction: "Command Center",
		primaryHref: "/",
		stats: baseStats,
		workTitle: "Operational Surface",
		rows: [
			{ title: "API route", evidence: "Standard envelope, auth, RBAC, and audit logging where scoped", owner: "API", status: "Implemented" },
			{ title: "Workflow record", evidence: "Durable workflow run state in D1", owner: "Agent", status: "Mock-safe" },
			{ title: "Guardrail", evidence: "No direct publishing or unsafe DM automation", owner: "Security", status: "Enforced" },
		],
	};
}
