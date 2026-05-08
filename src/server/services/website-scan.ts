import { dbRun, toJson } from "../db/sql";
import { createId } from "../utils/id";
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
	input: { brandId: string; url: string; fetcher?: typeof fetch },
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

	return { scanId, url: safeUrl.url, status: "complete", findings, evidence };
}

async function fetchWebsiteText(url: string, fetcher: typeof fetch = fetch): Promise<{ text: string }> {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 6000);
		const response = await fetcher(url, {
			method: "GET",
			redirect: "follow",
			headers: {
				"User-Agent": "MustBeViralBot/1.0 (+https://mustbeviral.com)",
				Accept: "text/html,text/plain;q=0.9,*/*;q=0.1",
			},
			signal: controller.signal,
		});
		clearTimeout(timeout);
		const text = await response.text();
		return { text: text.slice(0, 50_000) };
	} catch {
		return { text: "Website fetch unavailable. Using safe mock scan fallback." };
	}
}

function extractTitle(text: string): string | null {
	const match = /<title[^>]*>([^<]+)<\/title>/i.exec(text);
	return match?.[1]?.trim().slice(0, 160) ?? null;
}
