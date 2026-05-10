import { dbRun, toJson } from "../db/sql";
import { createId } from "../utils/id";
import { writeAuditLog } from "./audit";
import { sanitizeUntrustedText } from "./security/prompt-injection";
import { normalizeScanUrl } from "./security/ssrf";

export interface WebsiteScanResult {
	scanId: string;
	url: string;
	status: "complete" | "failed";
	findings: Record<string, unknown>;
	evidence: Array<Record<string, unknown>>;
	errorMessage?: string;
}

export async function createWebsiteScan(
	db: D1Database,
	input: {
		brandId: string;
		url: string;
		workspaceId?: string | undefined;
		userId?: string | null | undefined;
		fetcher?: typeof fetch;
	},
): Promise<WebsiteScanResult> {
	const safeUrl = normalizeScanUrl(input.url);
	const scanId = createId("scan");

	if (!safeUrl.ok) {
		await dbRun(
			db,
			`INSERT INTO website_scans (id, brand_id, url, status, findings_json, evidence_json, error_message)
			VALUES (?, ?, ?, 'failed', ?, ?, ?)`,
			[
				scanId,
				input.brandId,
				input.url,
				toJson({ blocked: true, reason: safeUrl.code }),
				toJson([]),
				safeUrl.message,
			],
		);
		await writeAuditLog(db, {
			workspaceId: input.workspaceId ?? null,
			brandId: input.brandId,
			userId: input.userId ?? null,
			action: "website_scan.blocked",
			entityType: "website_scan",
			entityId: scanId,
			after: { reason: safeUrl.code, url: input.url },
		});
		return {
			scanId,
			url: input.url,
			status: "failed",
			findings: { blocked: true, reason: safeUrl.code },
			evidence: [],
			errorMessage: safeUrl.message,
		};
	}

	const fetched = await fetchWebsiteText(safeUrl.url, input.fetcher);
	const injection = sanitizeUntrustedText(fetched.text);
	const findings = {
		title: extractTitle(fetched.text),
		wordCount: fetched.text.split(/\s+/).filter(Boolean).length,
		promptInjectionRisk: injection.risk,
		promptInjectionFlags: injection.flags,
		trust: "untrusted_scan_content",
	};
	const evidence = [
		{
			type: "website_scan",
			source: safeUrl.url,
			claim: "Website content was scanned and treated as untrusted evidence.",
			promptInjectionRisk: injection.risk,
		},
	];

	await dbRun(
		db,
		`INSERT INTO website_scans (id, brand_id, url, status, findings_json, evidence_json)
		VALUES (?, ?, ?, 'complete', ?, ?)`,
		[scanId, input.brandId, safeUrl.url, toJson(findings), toJson(evidence)],
	);
	await writeAuditLog(db, {
		workspaceId: input.workspaceId ?? null,
		brandId: input.brandId,
		userId: input.userId ?? null,
		action: "website_scan.created",
		entityType: "website_scan",
		entityId: scanId,
		after: { url: safeUrl.url, promptInjectionRisk: injection.risk },
	});

	return { scanId, url: safeUrl.url, status: "complete", findings, evidence };
}

async function fetchWebsiteText(
	url: string,
	fetcher: typeof fetch = fetch,
): Promise<{ text: string }> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 6000);
	try {
		// Follow redirects manually so the SSRF guard can re-validate every hop.
		// Default redirect: "follow" would let a 3xx → 127.0.0.1 attack slip through.
		const headers = {
			"User-Agent": "MustBeViralBot/1.0 (+https://mustbeviral.com)",
			Accept: "text/html,text/plain;q=0.9,*/*;q=0.1",
		};

		let currentUrl = url;
		let response: Response | null = null;
		for (let hop = 0; hop < 4; hop += 1) {
			response = await fetcher(currentUrl, {
				method: "GET",
				redirect: "manual",
				headers,
				signal: controller.signal,
			});
			if (response.status >= 300 && response.status < 400) {
				const location = response.headers.get("Location");
				if (!location) {
					break;
				}
				const nextSafe = normalizeScanUrl(new URL(location, currentUrl).toString());
				if (!nextSafe.ok) {
					return { text: `Website fetch unavailable. Redirect rejected: ${nextSafe.code}.` };
				}
				currentUrl = nextSafe.url;
				continue;
			}
			break;
		}
		clearTimeout(timeout);
		if (!response) {
			return { text: "Website fetch unavailable. Using safe mock scan fallback." };
		}
		const text = await response.text();
		return { text: text.slice(0, 50_000) };
	} catch {
		clearTimeout(timeout);
		return { text: "Website fetch unavailable. Using safe mock scan fallback." };
	}
}

function extractTitle(text: string): string | null {
	const match = /<title[^>]*>([^<]+)<\/title>/i.exec(text);
	return match?.[1]?.trim().slice(0, 160) ?? null;
}
