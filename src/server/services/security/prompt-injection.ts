export interface PromptInjectionScan {
	risk: "low" | "medium" | "high";
	flags: string[];
	sanitizedText: string;
}

const patterns: Array<{ label: string; pattern: RegExp; risk: "medium" | "high" }> = [
	{ label: "ignore-instructions", pattern: /ignore (all )?(previous|prior|above) instructions/i, risk: "high" },
	{ label: "system-prompt-request", pattern: /(show|reveal|print).{0,24}(system|developer) prompt/i, risk: "high" },
	{ label: "role-claim", pattern: /you are now (system|developer|admin|root)/i, risk: "high" },
	{ label: "tool-exfiltration", pattern: /(send|exfiltrate|forward).{0,32}(secret|token|api key|cookie)/i, risk: "high" },
	{ label: "instruction-smuggling", pattern: /BEGIN (SYSTEM|DEVELOPER|INSTRUCTIONS)|<\/?(system|developer)>/i, risk: "medium" },
];

export function sanitizeUntrustedText(input: string): PromptInjectionScan {
	const flags: string[] = [];
	let risk: PromptInjectionScan["risk"] = "low";

	for (const item of patterns) {
		if (item.pattern.test(input)) {
			flags.push(item.label);
			risk = item.risk === "high" ? "high" : risk === "low" ? "medium" : risk;
		}
	}

	const sanitizedText = input
		.replaceAll(/\b(system|developer|tool)\s*:/gi, "untrusted-label:")
		.replaceAll(/ignore (all )?(previous|prior|above) instructions/gi, "[removed unsafe instruction]")
		.slice(0, 20_000);

	return { risk, flags, sanitizedText };
}
