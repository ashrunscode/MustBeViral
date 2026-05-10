import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import type { Route } from "./+types/home";

type CloudflareLoaderContext = {
	cloudflare: {
		env: Cloudflare.Env;
	};
};

type ApiData = Record<string, unknown>;

type SessionState =
	| { status: "loading"; user: null; workspaces: ApiData[] }
	| { status: "guest"; user: null; workspaces: ApiData[] }
	| { status: "ready"; user: ApiData; workspaces: ApiData[] };

type PageState = {
	loading: boolean;
	error: string | null;
	data: ApiData;
};

const mainNav = [
	{ href: "/", label: "Command" },
	{ href: "/workspaces", label: "Workspaces" },
	{ href: "/signup", label: "Signup" },
	{ href: "/login", label: "Login" },
	{ href: "/admin", label: "Admin" },
] as const;

const brandTabs = [
	{ key: "summary", label: "Summary", suffix: "" },
	{ key: "onboarding", label: "Onboarding", suffix: "/onboarding" },
	{ key: "intelligence", label: "Intelligence", suffix: "/intelligence" },
	{ key: "profile", label: "Profile", suffix: "/profile" },
	{ key: "target-market", label: "Target Market", suffix: "/target-market" },
	{ key: "calendar", label: "Calendar", suffix: "/calendar" },
	{ key: "approvals", label: "Approvals", suffix: "/approvals" },
	{ key: "media", label: "Media", suffix: "/media" },
	{ key: "dm-rules", label: "DM Rules", suffix: "/dm-rules" },
	{ key: "reports", label: "Reports", suffix: "/reports" },
	{ key: "growth", label: "Growth", suffix: "/growth" },
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
	};
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const route = useMemo(() => parseRoute(loaderData.path), [loaderData.path]);
	const [session, setSession] = useState<SessionState>({
		status: "loading",
		user: null,
		workspaces: [],
	});
	const [page, setPage] = useState<PageState>({ loading: true, error: null, data: {} });
	const [refreshKey, setRefreshKey] = useState(0);
	const [notice, setNotice] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		async function loadSession() {
			try {
				const data = await readApi("/api/auth/me");
				if (cancelled) {
					return;
				}
				setSession({
					status: "ready",
					user: asRecord(data.user),
					workspaces: asArray(data.workspaces),
				});
			} catch (error) {
				if (cancelled) {
					return;
				}
				if (error instanceof ApiError && error.status === 401) {
					setSession({ status: "guest", user: null, workspaces: [] });
				} else {
					setSession({ status: "guest", user: null, workspaces: [] });
					setNotice(error instanceof Error ? error.message : "Session check failed.");
				}
			}
		}
		void loadSession();
		return () => {
			cancelled = true;
		};
	}, [refreshKey]);

	useEffect(() => {
		let cancelled = false;
		async function loadPage() {
			setPage({ loading: true, error: null, data: {} });
			if (route.page === "signup" || route.page === "login" || route.page === "logout") {
				setPage({ loading: false, error: null, data: {} });
				return;
			}
			if (session.status === "loading") {
				return;
			}
			if (session.status === "guest") {
				setPage({ loading: false, error: null, data: {} });
				return;
			}
			try {
				const data = await loadRouteData(route);
				if (!cancelled) {
					setPage({ loading: false, error: null, data });
				}
			} catch (error) {
				if (!cancelled) {
					setPage({
						loading: false,
						error: error instanceof Error ? error.message : "Page load failed.",
						data: {},
					});
				}
			}
		}
		void loadPage();
		return () => {
			cancelled = true;
		};
	}, [route, session.status, refreshKey]);

	const activeWorkspaceId =
		route.workspaceId ?? text(session.workspaces[0]?.id) ?? text(asRecord(page.data.workspace).id);
	const activeBrandId = route.brandId ?? firstBrandId(page.data) ?? undefined;
	const title = pageTitle(route);

	return (
		<main className="min-h-screen bg-[#f7f7f2] text-[#171717]">
			<div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col lg:flex-row">
				<aside className="border-b border-[#d8d7cf] bg-[#fcfcf8] px-4 py-4 lg:w-64 lg:border-b-0 lg:border-r">
					<a href="/" className="block">
						<div className="text-lg font-semibold">MustBeViral</div>
						<div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#6c6a60]">
							{loaderData.env}
						</div>
					</a>
					<nav className="mt-5 grid grid-cols-2 gap-1 lg:grid-cols-1">
						{mainNav.map((item) => (
							<NavLink key={item.href} href={item.href} active={route.path === item.href}>
								{item.label}
							</NavLink>
						))}
						{activeWorkspaceId ? (
							<NavLink
								href={`/workspaces/${activeWorkspaceId}`}
								active={route.workspaceId === activeWorkspaceId && !route.brandId}
							>
								Workspace
							</NavLink>
						) : null}
						{activeWorkspaceId ? (
							<NavLink
								href={`/workspaces/${activeWorkspaceId}/billing`}
								active={route.page === "billing"}
							>
								Billing
							</NavLink>
						) : null}
						{activeBrandId
							? brandTabs.map((tab) => (
									<NavLink
										key={tab.key}
										href={`/brands/${activeBrandId}${tab.suffix}`}
										active={route.brandId === activeBrandId && route.section === tab.key}
									>
										{tab.label}
									</NavLink>
								))
							: null}
					</nav>
				</aside>

				<section className="min-w-0 flex-1">
					<header className="border-b border-[#d8d7cf] bg-[#fcfcf8] px-5 py-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<h1 className="text-2xl font-semibold">{title}</h1>
								<p className="mt-1 text-sm text-[#5d5a50]">{headerDetail(session, route)}</p>
							</div>
							<HeaderAction session={session} route={route} />
						</div>
						{notice ? <div className="mt-3 rounded-md bg-[#fff4d8] px-3 py-2 text-sm">{notice}</div> : null}
					</header>

					<div className="p-5">
						{renderPage({
							route,
							session,
							page,
							setNotice,
							refresh: () => setRefreshKey((value) => value + 1),
						})}
					</div>
				</section>
			</div>
		</main>
	);
}

function renderPage(input: {
	route: ParsedRoute;
	session: SessionState;
	page: PageState;
	setNotice: (notice: string | null) => void;
	refresh: () => void;
}) {
	const { route, session, page, setNotice, refresh } = input;

	if (route.page === "signup") {
		return <AuthPanel mode="signup" setNotice={setNotice} refresh={refresh} />;
	}
	if (route.page === "login") {
		return <AuthPanel mode="login" setNotice={setNotice} refresh={refresh} />;
	}
	if (route.page === "logout") {
		return <LogoutPanel session={session} setNotice={setNotice} refresh={refresh} />;
	}
	if (session.status === "loading") {
		return <StatePanel title="Loading session" detail="Checking the current browser session." />;
	}
	if (session.status === "guest") {
		return <SignedOutPanel />;
	}
	if (page.loading) {
		return <StatePanel title="Loading data" detail="Fetching the latest workspace and brand records." />;
	}
	if (page.error) {
		return <StatePanel title="Could not load this page" detail={page.error} tone="error" />;
	}

	if (route.page === "admin") {
		return <AdminPage data={page.data} />;
	}
	if (route.page === "workspaces") {
		return <WorkspacesPage data={page.data} refresh={refresh} setNotice={setNotice} />;
	}
	if (route.page === "workspace") {
		return <WorkspacePage data={page.data} refresh={refresh} setNotice={setNotice} />;
	}
	if (route.page === "billing") {
		return <BillingPage data={page.data} setNotice={setNotice} refresh={refresh} />;
	}
	if (route.page === "brand") {
		return <BrandPage route={route} data={page.data} refresh={refresh} setNotice={setNotice} />;
	}
	return <CommandCenter session={session} data={page.data} />;
}

function CommandCenter({ session, data }: { session: SessionState; data: ApiData }) {
	const workspaces = session.status === "ready" ? session.workspaces : [];
	const workspace = asRecord(data.workspace);
	const brands = asArray(data.brands);

	return (
		<div className="grid gap-5">
			<Stats
				items={[
					["Workspaces", String(workspaces.length)],
					["Current Brands", String(brands.length)],
					["Session", session.status === "ready" ? "Active" : "Guest"],
					["Publishing", "Approval first"],
				]}
			/>
			<Panel title="Workspace Focus">
				{workspace.id ? (
					<Row
						title={text(workspace.name) ?? "Workspace"}
						detail={`${brands.length} brand${brands.length === 1 ? "" : "s"} loaded`}
						href={`/workspaces/${text(workspace.id)}`}
					/>
				) : (
					<EmptyState title="No workspace selected" actionHref="/workspaces" actionLabel="Open workspaces" />
				)}
			</Panel>
			<Panel title="Brand Queue">
				{brands.length > 0 ? (
					brands.map((brand) => (
						<Row
							key={text(brand.id) ?? text(brand.slug) ?? text(brand.name)}
							title={text(brand.name) ?? "Brand"}
							detail={`${text(brand.status) ?? "active"} / ${text(brand.onboarding_status) ?? "not started"}`}
							href={`/brands/${text(brand.id)}`}
						/>
					))
				) : (
					<EmptyState title="No brands loaded" actionHref="/workspaces" actionLabel="Create a brand" />
				)}
			</Panel>
		</div>
	);
}

function WorkspacesPage({
	data,
	refresh,
	setNotice,
}: {
	data: ApiData;
	refresh: () => void;
	setNotice: (notice: string | null) => void;
}) {
	const workspaces = asArray(data.workspaces);
	return (
		<div className="grid gap-5 xl:grid-cols-[1fr_360px]">
			<Panel title="Workspaces">
				{workspaces.length > 0 ? (
					workspaces.map((workspace) => (
						<Row
							key={text(workspace.id) ?? text(workspace.slug) ?? text(workspace.name)}
							title={text(workspace.name) ?? "Workspace"}
							detail={`${text(workspace.plan) ?? "starter"} / ${text(workspace.role) ?? "member"}`}
							href={`/workspaces/${text(workspace.id)}`}
						/>
					))
				) : (
					<EmptyState title="No workspaces yet" />
				)}
			</Panel>
			<WorkspaceForm refresh={refresh} setNotice={setNotice} />
		</div>
	);
}

function WorkspacePage({
	data,
	refresh,
	setNotice,
}: {
	data: ApiData;
	refresh: () => void;
	setNotice: (notice: string | null) => void;
}) {
	const workspace = asRecord(data.workspace);
	const brands = asArray(data.brands);
	const workspaceId = text(workspace.id);
	return (
		<div className="grid gap-5 xl:grid-cols-[1fr_380px]">
			<div className="grid gap-5">
				<Stats
					items={[
						["Plan", text(workspace.plan) ?? "starter"],
						["Brands", String(brands.length)],
						["Role", text(workspace.role) ?? "owner"],
						["Billing", workspaceId ? "Available" : "Unavailable"],
					]}
				/>
				<Panel title="Brands">
					{brands.length > 0 ? (
						brands.map((brand) => (
							<Row
								key={text(brand.id) ?? text(brand.name)}
								title={text(brand.name) ?? "Brand"}
								detail={`${text(brand.industry) ?? "No industry"} / ${text(brand.onboarding_status) ?? "not started"}`}
								href={`/brands/${text(brand.id)}`}
							/>
						))
					) : (
						<EmptyState title="No brands in this workspace" />
					)}
				</Panel>
			</div>
			{workspaceId ? (
				<BrandForm workspaceId={workspaceId} refresh={refresh} setNotice={setNotice} />
			) : (
				<StatePanel title="Workspace unavailable" detail="The workspace record was not returned." />
			)}
		</div>
	);
}

function BillingPage({
	data,
	setNotice,
	refresh,
}: {
	data: ApiData;
	setNotice: (notice: string | null) => void;
	refresh: () => void;
}) {
	const workspace = asRecord(data.workspace);
	const billing = asRecord(data.billing);
	const subscription = asRecord(billing.subscription);
	const workspaceId = text(workspace.id);
	const configured = Boolean(billing.stripeConfigured);
	return (
		<div className="grid gap-5 xl:grid-cols-[1fr_360px]">
			<Panel title="Subscription">
				<Row
					title={text(subscription.plan) ?? "starter"}
					detail={`${text(subscription.status) ?? "incomplete"} / Stripe ${configured ? "configured" : "disabled"}`}
				/>
				{!configured ? (
					<StatePanel
						title="Stripe is disabled"
						detail="Checkout and portal actions stay inactive until Stripe configuration exists."
					/>
				) : null}
			</Panel>
			<Panel title="Billing Actions">
				<div className="grid gap-2">
					<ActionButton
						disabled={!workspaceId || !configured}
						onClick={() =>
							workspaceId
								? postAction(`/api/billing/${workspaceId}/checkout`, { plan: "growth" }, setNotice, refresh)
								: undefined
						}
					>
						Start Checkout
					</ActionButton>
					<ActionButton
						disabled={!workspaceId || !configured}
						onClick={() =>
							workspaceId ? postAction(`/api/billing/${workspaceId}/portal`, {}, setNotice, refresh) : undefined
						}
					>
						Open Portal
					</ActionButton>
				</div>
			</Panel>
		</div>
	);
}

function BrandPage({
	route,
	data,
	refresh,
	setNotice,
}: {
	route: ParsedRoute;
	data: ApiData;
	refresh: () => void;
	setNotice: (notice: string | null) => void;
}) {
	const brand = asRecord(data.brand);
	const brandId = route.brandId ?? text(brand.id);
	if (!brandId) {
		return <StatePanel title="Brand not found" detail="The route does not include a brand id." tone="error" />;
	}
	if (route.section === "onboarding") {
		return <OnboardingPage brand={brand} brandId={brandId} refresh={refresh} setNotice={setNotice} />;
	}
	if (route.section === "intelligence") {
		return <IntelligencePage data={data} />;
	}
	if (route.section === "profile") {
		return <ProfilePage data={data} brandId={brandId} />;
	}
	if (route.section === "target-market") {
		return <JsonRecordPage title="Target Market" record={asRecord(data.report)} jsonKey="report_json" />;
	}
	if (route.section === "calendar") {
		return <CalendarPage data={data} brandId={brandId} refresh={refresh} setNotice={setNotice} />;
	}
	if (route.section === "approvals") {
		return <ApprovalsPage data={data} brandId={brandId} refresh={refresh} setNotice={setNotice} />;
	}
	if (route.section === "media") {
		return <MediaPage data={data} brandId={brandId} refresh={refresh} setNotice={setNotice} />;
	}
	if (route.section === "dm-rules") {
		return <DmRulesPage data={data} brandId={brandId} refresh={refresh} setNotice={setNotice} />;
	}
	if (route.section === "reports") {
		return <ReportsPage data={data} brandId={brandId} refresh={refresh} setNotice={setNotice} />;
	}
	if (route.section === "growth") {
		return <GrowthPage data={data} brandId={brandId} refresh={refresh} setNotice={setNotice} />;
	}
	const command = asRecord(data.command);
	const counts = asRecord(command.counts);
	return (
		<div className="grid gap-5">
			<Stats
				items={[
					["Status", text(brand.status) ?? "active"],
					["Onboarding", text(brand.onboarding_status) ?? "not started"],
					["Approvals", String(number(counts.pendingApprovals) ?? 0)],
					["Scheduled", String(number(counts.scheduledPosts) ?? 0)],
				]}
			/>
			<Panel title="Brand">
				<Row
					title={text(brand.name) ?? "Brand"}
					detail={`${text(brand.industry) ?? "No industry"} / ${text(brand.website_url) ?? "No website"}`}
				/>
			</Panel>
			<Panel title="Next Actions">
				<div className="grid gap-2 md:grid-cols-3">
					<a className="btn-primary" href={`/brands/${brandId}/onboarding`}>
						Start Onboarding
					</a>
					<a className="btn-secondary" href={`/brands/${brandId}/approvals`}>
						Review Approvals
					</a>
					<a className="btn-secondary" href={`/brands/${brandId}/calendar`}>
						Open Calendar
					</a>
				</div>
			</Panel>
		</div>
	);
}

function OnboardingPage({
	brand,
	brandId,
	refresh,
	setNotice,
}: {
	brand: ApiData;
	brandId: string;
	refresh: () => void;
	setNotice: (notice: string | null) => void;
}) {
	return (
		<div className="grid gap-5 xl:grid-cols-[1fr_360px]">
			<Panel title="Brand Onboarding">
				<Row
					title={text(brand.name) ?? "Brand"}
					detail={`${text(brand.onboarding_status) ?? "not started"} / ${text(brand.website_url) ?? "no website"}`}
				/>
			</Panel>
			<Panel title="Primary Action">
				<ActionButton
					onClick={() => postAction(`/api/brands/${brandId}/onboarding/start`, {}, setNotice, refresh)}
				>
					Start Scan
				</ActionButton>
			</Panel>
		</div>
	);
}

function IntelligencePage({ data }: { data: ApiData }) {
	const score = asRecord(data.score);
	const scans = asArray(data.scans);
	return (
		<div className="grid gap-5">
			<Stats
				items={[
					["Overall", String(number(score.overall_score) ?? 0)],
					["Scans", String(scans.length)],
					["Latest", text(score.created_at)?.slice(0, 10) ?? "None"],
					["Status", scans.length > 0 ? text(scans[0]?.status) ?? "unknown" : "empty"],
				]}
			/>
			<Panel title="Website Scans">
				{scans.length > 0 ? (
					scans.map((scan) => (
						<Row
							key={text(scan.id) ?? text(scan.url)}
							title={text(scan.url) ?? "Scan"}
							detail={`${text(scan.status) ?? "unknown"} / ${text(scan.error_message) ?? "no error"}`}
						/>
					))
				) : (
					<EmptyState title="No scans yet" />
				)}
			</Panel>
		</div>
	);
}

function ProfilePage({
	data,
	brandId,
}: {
	data: ApiData;
	brandId: string;
}) {
	const profile = asRecord(data.profile);
	return (
		<div className="grid gap-5 xl:grid-cols-[1fr_360px]">
			<JsonRecordPage title="Profile" record={profile} jsonKey="profile_json" />
			<Panel title="Profile Action">
				<a className="btn-secondary w-fit" href={`/brands/${brandId}/onboarding`}>
					Refresh Profile Inputs
				</a>
			</Panel>
		</div>
	);
}

function CalendarPage({
	data,
	brandId,
	refresh,
	setNotice,
}: {
	data: ApiData;
	brandId: string;
	refresh: () => void;
	setNotice: (notice: string | null) => void;
}) {
	const calendars = asArray(data.calendars);
	const posts = asArray(data.posts);
	return (
		<div className="grid gap-5">
			<Stats
				items={[
					["Calendars", String(calendars.length)],
					["Posts", String(posts.length)],
					["Pending", String(posts.filter((post) => text(post.status) === "pending_approval").length)],
					["Approved", String(posts.filter((post) => text(post.status) === "approved").length)],
				]}
			/>
			<Panel title="Calendar Action">
				<ActionButton
					onClick={() =>
						postAction(`/api/brands/${brandId}/content-calendar/generate`, {}, setNotice, refresh)
					}
				>
					Generate Calendar
				</ActionButton>
			</Panel>
			<Panel title="Posts">
				{posts.length > 0 ? (
					posts.map((post) => (
						<Row
							key={text(post.id) ?? text(post.caption)}
							title={text(post.platform) ?? "Post"}
							detail={`${text(post.status) ?? "draft"} / ${text(post.caption) ?? ""}`}
						/>
					))
				) : (
					<EmptyState title="No calendar posts" />
				)}
			</Panel>
		</div>
	);
}

function ApprovalsPage({
	data,
	brandId,
	refresh,
	setNotice,
}: {
	data: ApiData;
	brandId: string;
	refresh: () => void;
	setNotice: (notice: string | null) => void;
}) {
	const approvals = asArray(data.approvals);
	return (
		<Panel title="Pending Approvals">
			{approvals.length > 0 ? (
				approvals.map((post) => {
					const postId = text(post.id);
					return (
						<div
							key={postId ?? text(post.caption)}
							className="grid gap-3 border-b border-[#eceae2] px-4 py-4 last:border-b-0 md:grid-cols-[1fr_220px]"
						>
							<div>
								<div className="font-medium">{text(post.platform) ?? "Post"}</div>
								<div className="mt-1 text-sm text-[#5d5a50]">{text(post.caption) ?? ""}</div>
							</div>
							<div className="grid grid-cols-2 gap-2">
								<ActionButton
									disabled={!postId}
									onClick={() =>
										postId
											? postAction(
													`/api/brands/${brandId}/approvals/${postId}`,
													{ action: "approve" },
													setNotice,
													refresh,
												)
											: undefined
									}
								>
									Approve
								</ActionButton>
								<ActionButton
									disabled={!postId}
									variant="secondary"
									onClick={() =>
										postId
											? postAction(
													`/api/brands/${brandId}/approvals/${postId}`,
													{ action: "reject" },
													setNotice,
													refresh,
												)
											: undefined
									}
								>
									Reject
								</ActionButton>
							</div>
						</div>
					);
				})
			) : (
				<EmptyState title="No pending approvals" />
			)}
		</Panel>
	);
}

function MediaPage({
	data,
	brandId,
	refresh,
	setNotice,
}: {
	data: ApiData;
	brandId: string;
	refresh: () => void;
	setNotice: (notice: string | null) => void;
}) {
	const creatives = asArray(data.creatives);
	return (
		<div className="grid gap-5 xl:grid-cols-[1fr_360px]">
			<Panel title="Media">
				{creatives.length > 0 ? (
					creatives.map((creative) => (
						<Row
							key={text(creative.id) ?? text(creative.r2_key)}
							title={text(creative.prompt) ?? text(creative.r2_key) ?? "Creative"}
							detail={`${text(creative.status) ?? "unknown"} / ${text(creative.provider) ?? "provider"}`}
							href={text(creative.id) ? `/api/brands/${brandId}/media/${text(creative.id)}` : undefined}
						/>
					))
				) : (
					<EmptyState title="No media yet" />
				)}
			</Panel>
			<ImageForm brandId={brandId} refresh={refresh} setNotice={setNotice} />
		</div>
	);
}

function DmRulesPage({
	data,
	brandId,
	refresh,
	setNotice,
}: {
	data: ApiData;
	brandId: string;
	refresh: () => void;
	setNotice: (notice: string | null) => void;
}) {
	const rules = asArray(data.rules);
	return (
		<div className="grid gap-5 xl:grid-cols-[1fr_360px]">
			<Panel title="DM Rules">
				{rules.length > 0 ? (
					rules.map((rule) => (
						<Row
							key={text(rule.id) ?? text(rule.trigger_value)}
							title={text(rule.platform) ?? "Rule"}
							detail={`${text(rule.status) ?? "pending"} / ${text(rule.trigger_value) ?? ""}`}
						/>
					))
				) : (
					<EmptyState title="No DM rules" />
				)}
			</Panel>
			<DmRuleForm brandId={brandId} refresh={refresh} setNotice={setNotice} />
		</div>
	);
}

function ReportsPage({
	data,
	brandId,
	refresh,
	setNotice,
}: {
	data: ApiData;
	brandId: string;
	refresh: () => void;
	setNotice: (notice: string | null) => void;
}) {
	const reports = asArray(data.reports);
	return (
		<div className="grid gap-5">
			<Panel title="Report Action">
				<ActionButton
					onClick={() =>
						postAction(`/api/brands/${brandId}/reports/weekly/generate`, {}, setNotice, refresh)
					}
				>
					Generate Report
				</ActionButton>
			</Panel>
			<Panel title="Weekly Reports">
				{reports.length > 0 ? (
					reports.map((report) => (
						<Row
							key={text(report.id) ?? text(report.week_start)}
							title={text(report.week_start) ?? "Report"}
							detail={text(report.week_end) ?? text(report.created_at) ?? ""}
						/>
					))
				) : (
					<EmptyState title="No reports yet" />
				)}
			</Panel>
		</div>
	);
}

function GrowthPage({
	data,
	brandId,
	refresh,
	setNotice,
}: {
	data: ApiData;
	brandId: string;
	refresh: () => void;
	setNotice: (notice: string | null) => void;
}) {
	const opportunities = asArray(data.opportunities);
	return (
		<div className="grid gap-5">
			<Panel title="Growth Action">
				<ActionButton onClick={() => postAction(`/api/brands/${brandId}/growth/generate`, {}, setNotice, refresh)}>
					Find Opportunities
				</ActionButton>
			</Panel>
			<Panel title="Opportunities">
				{opportunities.length > 0 ? (
					opportunities.map((opportunity) => (
						<Row
							key={text(opportunity.id) ?? text(opportunity.title)}
							title={text(opportunity.title) ?? "Opportunity"}
							detail={`${text(opportunity.status) ?? "open"} / impact ${String(number(opportunity.impact_score) ?? 0)}`}
						/>
					))
				) : (
					<EmptyState title="No opportunities yet" />
				)}
			</Panel>
		</div>
	);
}

function AdminPage({ data }: { data: ApiData }) {
	const overview = asRecord(data.overview);
	const counts = asRecord(overview.counts);
	return (
		<div className="grid gap-5">
			<Stats
				items={[
					["Users", String(number(counts.users) ?? 0)],
					["Workspaces", String(number(counts.workspaces) ?? 0)],
					["Brands", String(number(counts.brands) ?? 0)],
					["Failed Workflows", String(number(counts.failedWorkflows) ?? 0)],
				]}
			/>
			<Panel title="Admin Status">
				<Row title="Access" detail="This page only loads for admin sessions." />
			</Panel>
		</div>
	);
}

function JsonRecordPage({
	title,
	record,
	jsonKey,
}: {
	title: string;
	record: ApiData;
	jsonKey: string;
}) {
	const value = record[jsonKey] ?? record;
	return (
		<Panel title={title}>
			{Object.keys(record).length > 0 ? (
				<pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md bg-[#f6f5ef] p-4 text-xs text-[#36332b]">
					{JSON.stringify(value, null, 2)}
				</pre>
			) : (
				<EmptyState title={`No ${title.toLowerCase()} record`} />
			)}
		</Panel>
	);
}

function AuthPanel({
	mode,
	setNotice,
	refresh,
}: {
	mode: "signup" | "login";
	setNotice: (notice: string | null) => void;
	refresh: () => void;
}) {
	const [busy, setBusy] = useState(false);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setNotice(null);
		const form = new FormData(event.currentTarget);
		const body: Record<string, string> = {
			email: formValue(form, "email"),
			password: formValue(form, "password"),
		};
		if (mode === "signup") {
			body.name = formValue(form, "name");
		}
		try {
			await readApi(`/api/auth/${mode}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			refresh();
			window.location.assign("/workspaces");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Authentication failed.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<Panel title={mode === "signup" ? "Create Account" : "Log In"}>
			<form className="grid max-w-xl gap-3" onSubmit={(event) => void submit(event)}>
				{mode === "signup" ? <Input name="name" label="Name" autoComplete="name" /> : null}
				<Input name="email" label="Email" type="email" autoComplete="email" required />
				<Input
					name="password"
					label="Password"
					type="password"
					autoComplete={mode === "signup" ? "new-password" : "current-password"}
					required
				/>
				<button className="btn-primary" disabled={busy} type="submit">
					{busy ? "Working" : mode === "signup" ? "Sign Up" : "Log In"}
				</button>
			</form>
		</Panel>
	);
}

function LogoutPanel({
	session,
	setNotice,
	refresh,
}: {
	session: SessionState;
	setNotice: (notice: string | null) => void;
	refresh: () => void;
}) {
	return (
		<Panel title="Logout">
			{session.status === "ready" ? (
				<ActionButton
					onClick={() =>
						postAction("/api/auth/logout", {}, setNotice, () => {
							refresh();
							window.location.assign("/login");
						})
					}
				>
					Log Out
				</ActionButton>
			) : (
				<EmptyState title="No active session" actionHref="/login" actionLabel="Log in" />
			)}
		</Panel>
	);
}

function WorkspaceForm({
	refresh,
	setNotice,
}: {
	refresh: () => void;
	setNotice: (notice: string | null) => void;
}) {
	const [busy, setBusy] = useState(false);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (busy) {
			return;
		}
		const formElement = event.currentTarget;
		const form = new FormData(event.currentTarget);
		setBusy(true);
		try {
			const saved = await formAction(
				"/api/workspaces",
				{ name: formValue(form, "name"), slug: formValue(form, "slug") || undefined },
				setNotice,
				refresh,
			);
			if (saved) {
				formElement.reset();
			}
		} finally {
			setBusy(false);
		}
	}
	return (
		<Panel title="Create Workspace">
			<form className="grid gap-3" onSubmit={(event) => void submit(event)}>
				<Input name="name" label="Workspace Name" required />
				<Input name="slug" label="Slug" />
				<button className="btn-primary" disabled={busy} type="submit">
					{busy ? "Working" : "Create Workspace"}
				</button>
			</form>
		</Panel>
	);
}

function BrandForm({
	workspaceId,
	refresh,
	setNotice,
}: {
	workspaceId: string;
	refresh: () => void;
	setNotice: (notice: string | null) => void;
}) {
	const [busy, setBusy] = useState(false);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (busy) {
			return;
		}
		const formElement = event.currentTarget;
		const form = new FormData(event.currentTarget);
		setBusy(true);
		try {
			const saved = await formAction(
				`/api/workspaces/${workspaceId}/brands`,
				{
					name: formValue(form, "name"),
					websiteUrl: formValue(form, "websiteUrl") || undefined,
					industry: formValue(form, "industry") || undefined,
					startOnboarding: true,
				},
				setNotice,
				refresh,
			);
			if (saved) {
				formElement.reset();
			}
		} finally {
			setBusy(false);
		}
	}
	return (
		<Panel title="Create Brand">
			<form className="grid gap-3" onSubmit={(event) => void submit(event)}>
				<Input name="name" label="Brand Name" required />
				<Input name="websiteUrl" label="Website URL" />
				<Input name="industry" label="Industry" />
				<button className="btn-primary" disabled={busy} type="submit">
					{busy ? "Working" : "Create Brand"}
				</button>
			</form>
		</Panel>
	);
}

function ImageForm({
	brandId,
	refresh,
	setNotice,
}: {
	brandId: string;
	refresh: () => void;
	setNotice: (notice: string | null) => void;
}) {
	const [busy, setBusy] = useState(false);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (busy) {
			return;
		}
		const formElement = event.currentTarget;
		const form = new FormData(event.currentTarget);
		setBusy(true);
		try {
			const saved = await formAction(
				`/api/brands/${brandId}/images/generate`,
				{ prompt: formValue(form, "prompt"), category: "image_default" },
				setNotice,
				refresh,
			);
			if (saved) {
				formElement.reset();
			}
		} finally {
			setBusy(false);
		}
	}
	return (
		<Panel title="Generate Image">
			<form className="grid gap-3" onSubmit={(event) => void submit(event)}>
				<TextArea name="prompt" label="Prompt" required />
				<button className="btn-primary" disabled={busy} type="submit">
					{busy ? "Working" : "Generate Image"}
				</button>
			</form>
		</Panel>
	);
}

function DmRuleForm({
	brandId,
	refresh,
	setNotice,
}: {
	brandId: string;
	refresh: () => void;
	setNotice: (notice: string | null) => void;
}) {
	const [busy, setBusy] = useState(false);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (busy) {
			return;
		}
		const formElement = event.currentTarget;
		const form = new FormData(event.currentTarget);
		setBusy(true);
		try {
			const saved = await formAction(
				`/api/brands/${brandId}/dm-rules`,
				{
					platform: formValue(form, "platform"),
					triggerType: "keyword",
					triggerValue: formValue(form, "triggerValue"),
					responseTemplate: formValue(form, "responseTemplate"),
				},
				setNotice,
				refresh,
			);
			if (saved) {
				formElement.reset();
			}
		} finally {
			setBusy(false);
		}
	}
	return (
		<Panel title="Draft DM Rule">
			<form className="grid gap-3" onSubmit={(event) => void submit(event)}>
				<Input name="platform" label="Platform" required />
				<Input name="triggerValue" label="Keyword" required />
				<TextArea name="responseTemplate" label="Response Template" required />
				<button className="btn-primary" disabled={busy} type="submit">
					{busy ? "Working" : "Draft Rule"}
				</button>
			</form>
		</Panel>
	);
}

function SignedOutPanel() {
	return (
		<Panel title="Session Required">
			<EmptyState title="Log in to load workspace data" actionHref="/login" actionLabel="Log in" />
		</Panel>
	);
}

function HeaderAction({ session, route }: { session: SessionState; route: ParsedRoute }) {
	if (session.status === "ready") {
		return (
			<a className="btn-secondary" href="/logout">
				Logout
			</a>
		);
	}
	if (route.page === "login") {
		return (
			<a className="btn-secondary" href="/signup">
				Signup
			</a>
		);
	}
	return (
		<a className="btn-primary" href="/login">
			Login
		</a>
	);
}

function Stats({ items }: { items: Array<[string, string]> }) {
	return (
		<section className="grid gap-4 md:grid-cols-4">
			{items.map(([label, value]) => (
				<div key={label} className="rounded-md border border-[#d8d7cf] bg-white p-4">
					<div className="text-xs uppercase tracking-[0.14em] text-[#6c6a60]">{label}</div>
					<div className="mt-3 break-words text-2xl font-semibold">{value}</div>
				</div>
			))}
		</section>
	);
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="rounded-md border border-[#d8d7cf] bg-white">
			<div className="border-b border-[#e2e0d8] px-4 py-3">
				<h2 className="text-base font-semibold">{title}</h2>
			</div>
			<div>{children}</div>
		</section>
	);
}

function Row({ title, detail, href }: { title: string; detail: string; href?: string | undefined }) {
	const content = (
		<div className="grid gap-1 border-b border-[#eceae2] px-4 py-4 last:border-b-0">
			<div className="break-words font-medium">{title}</div>
			<div className="break-words text-sm text-[#5d5a50]">{detail}</div>
		</div>
	);
	return href ? (
		<a className="block hover:bg-[#faf9f3]" href={href}>
			{content}
		</a>
	) : (
		content
	);
}

function EmptyState({
	title,
	actionHref,
	actionLabel,
}: {
	title: string;
	actionHref?: string;
	actionLabel?: string;
}) {
	return (
		<div className="grid gap-3 px-4 py-6 text-sm text-[#5d5a50]">
			<div>{title}</div>
			{actionHref && actionLabel ? (
				<a className="btn-secondary w-fit" href={actionHref}>
					{actionLabel}
				</a>
			) : null}
		</div>
	);
}

function StatePanel({
	title,
	detail,
	tone = "neutral",
}: {
	title: string;
	detail: string;
	tone?: "neutral" | "error";
}) {
	return (
		<div
			className={`rounded-md border px-4 py-4 ${
				tone === "error" ? "border-[#e6b5ad] bg-[#fff4f1]" : "border-[#d8d7cf] bg-white"
			}`}
		>
			<div className="font-medium">{title}</div>
			<div className="mt-1 text-sm text-[#5d5a50]">{detail}</div>
		</div>
	);
}

function NavLink({
	href,
	active,
	children,
}: {
	href: string;
	active: boolean;
	children: ReactNode;
}) {
	return (
		<a
			href={href}
			className={`rounded-md px-3 py-2 text-sm ${
				active ? "bg-[#1f3a5f] text-white" : "text-[#444139] hover:bg-[#efeee7]"
			}`}
		>
			{children}
		</a>
	);
}

function Input({
	name,
	label,
	type = "text",
	required = false,
	autoComplete,
}: {
	name: string;
	label: string;
	type?: string;
	required?: boolean;
	autoComplete?: string;
}) {
	return (
		<label className="grid gap-1 text-sm">
			<span className="font-medium">{label}</span>
			<input
				autoComplete={autoComplete}
				className="rounded-md border border-[#cfcfc6] bg-white px-3 py-2"
				name={name}
				required={required}
				type={type}
			/>
		</label>
	);
}

function TextArea({ name, label, required = false }: { name: string; label: string; required?: boolean }) {
	return (
		<label className="grid gap-1 text-sm">
			<span className="font-medium">{label}</span>
			<textarea
				className="min-h-28 rounded-md border border-[#cfcfc6] bg-white px-3 py-2"
				name={name}
				required={required}
			/>
		</label>
	);
}

function ActionButton({
	children,
	onClick,
	disabled = false,
	variant = "primary",
}: {
	children: ReactNode;
	onClick: () => void | Promise<unknown>;
	disabled?: boolean;
	variant?: "primary" | "secondary";
}) {
	const [busy, setBusy] = useState(false);
	const isDisabled = disabled || busy;
	return (
		<button
			aria-busy={busy}
			className={variant === "primary" ? "btn-primary" : "btn-secondary"}
			disabled={isDisabled}
			onClick={() => {
				if (isDisabled) {
					return;
				}
				setBusy(true);
				void Promise.resolve(onClick()).finally(() => setBusy(false));
			}}
			type="button"
		>
			{busy ? "Working" : children}
		</button>
	);
}

async function formAction(
	path: string,
	body: Record<string, unknown>,
	setNotice: (notice: string | null) => void,
	refresh: () => void,
): Promise<boolean> {
	return postAction(path, stripUndefined(body), setNotice, refresh);
}

async function postAction(
	path: string,
	body: Record<string, unknown>,
	setNotice: (notice: string | null) => void,
	refresh: () => void,
	method = "POST",
): Promise<boolean> {
	try {
		await readApi(path, {
			method,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		setNotice("Saved.");
		refresh();
		return true;
	} catch (error) {
		setNotice(error instanceof Error ? error.message : "Request failed.");
		return false;
	}
}

async function loadRouteData(route: ParsedRoute): Promise<ApiData> {
	if (route.page === "admin") {
		return { overview: await readApi("/api/admin/overview") };
	}
	if (route.page === "workspaces") {
		return readApi("/api/workspaces");
	}
	if (route.page === "workspace" && route.workspaceId) {
		return readApi(`/api/workspaces/${route.workspaceId}`);
	}
	if (route.page === "billing" && route.workspaceId) {
		const workspace = await readApi(`/api/workspaces/${route.workspaceId}`);
		const billing = await readApi(`/api/billing/${route.workspaceId}`);
		return { ...workspace, billing };
	}
	if (route.page === "brand" && route.brandId) {
		const brandData = await readApi(`/api/brands/${route.brandId}`);
		if (route.section === "summary") {
			const command = await readApi(`/api/brands/${route.brandId}/command-center`);
			return { ...brandData, command };
		}
		const endpoint = brandEndpoint(route.brandId, route.section);
		return endpoint ? { ...brandData, ...(await readApi(endpoint)) } : brandData;
	}
	const workspaces = await readApi("/api/workspaces");
	const first = asArray(workspaces.workspaces)[0];
	const workspaceId = text(first?.id);
	if (!workspaceId) {
		return workspaces;
	}
	const workspace = await readApi(`/api/workspaces/${workspaceId}`);
	return { ...workspace, workspaces: asArray(workspaces.workspaces) };
}

function brandEndpoint(brandId: string, section: string) {
	switch (section) {
		case "intelligence":
			return `/api/brands/${brandId}/intelligence`;
		case "profile":
			return `/api/brands/${brandId}/profile`;
		case "target-market":
			return `/api/brands/${brandId}/target-market`;
		case "calendar":
			return `/api/brands/${brandId}/content-calendar`;
		case "approvals":
			return `/api/brands/${brandId}/approvals`;
		case "media":
			return `/api/brands/${brandId}/media`;
		case "dm-rules":
			return `/api/brands/${brandId}/dm-rules`;
		case "reports":
			return `/api/brands/${brandId}/reports/weekly`;
		case "growth":
			return `/api/brands/${brandId}/growth`;
		default:
			return null;
	}
}

class ApiError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

async function readApi(path: string, init?: RequestInit): Promise<ApiData> {
	const response = await fetch(path, { credentials: "same-origin", ...init });
	const payload = (await response.json().catch(() => ({}))) as ApiData;
	if (!response.ok || payload.success === false) {
		const error = asRecord(payload.error);
		throw new ApiError(response.status, text(error.message) ?? `Request failed with ${response.status}`);
	}
	return asRecord(payload.data);
}

type ParsedRoute = {
	path: string;
	page: "command" | "signup" | "login" | "logout" | "workspaces" | "workspace" | "billing" | "brand" | "admin";
	workspaceId?: string;
	brandId?: string;
	section: string;
};

function parseRoute(path: string): ParsedRoute {
	const parts = path.split("/").filter(Boolean);
	if (parts[0] === "signup") {
		return { path, page: "signup", section: "auth" };
	}
	if (parts[0] === "login") {
		return { path, page: "login", section: "auth" };
	}
	if (parts[0] === "logout") {
		return { path, page: "logout", section: "auth" };
	}
	if (parts[0] === "admin") {
		return { path, page: "admin", section: "admin" };
	}
	if (parts[0] === "workspaces" && parts[1] && parts[2] === "billing") {
		return { path, page: "billing", workspaceId: parts[1], section: "billing" };
	}
	if (parts[0] === "workspaces" && parts[1]) {
		return { path, page: "workspace", workspaceId: parts[1], section: "workspace" };
	}
	if (parts[0] === "workspaces") {
		return { path, page: "workspaces", section: "workspaces" };
	}
	if (parts[0] === "brands" && parts[1]) {
		return { path, page: "brand", brandId: parts[1], section: parts[2] ?? "summary" };
	}
	return { path, page: "command", section: "command" };
}

function pageTitle(route: ParsedRoute) {
	if (route.page === "brand") {
		const tab = brandTabs.find((item) => item.key === route.section);
		return tab?.label ?? "Brand";
	}
	const titles: Record<ParsedRoute["page"], string> = {
		command: "Command Center",
		signup: "Signup",
		login: "Login",
		logout: "Logout",
		workspaces: "Workspaces",
		workspace: "Workspace",
		billing: "Billing",
		brand: "Brand",
		admin: "Admin",
	};
	return titles[route.page];
}

function headerDetail(session: SessionState, route: ParsedRoute) {
	if (session.status === "loading") {
		return "Checking session.";
	}
	if (session.status === "guest") {
		return "No active session.";
	}
	if (route.brandId) {
		return `Brand ${route.brandId}`;
	}
	if (route.workspaceId) {
		return `Workspace ${route.workspaceId}`;
	}
	return text(session.user.email) ?? "Authenticated";
}

function firstBrandId(data: ApiData) {
	const brands = asArray(data.brands);
	return text(brands[0]?.id);
}

function asRecord(value: unknown): ApiData {
	return value && typeof value === "object" && !Array.isArray(value) ? (value as ApiData) : {};
}

function asArray(value: unknown): ApiData[] {
	return Array.isArray(value) ? value.map(asRecord) : [];
}

function text(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function number(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stripUndefined(input: Record<string, unknown>) {
	return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function formValue(form: FormData, name: string) {
	const value = form.get(name);
	return typeof value === "string" ? value : "";
}
