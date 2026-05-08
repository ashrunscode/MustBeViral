import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			exclude: [
				"app/**/*.d.ts",
				"tests/**",
				"worker-configuration.d.ts",
				"*.config.ts",
				"eslint.config.js",
			],
			provider: "v8",
			reporter: ["text", "json", "html"],
		},
		environment: "node",
		globals: true,
		include: ["tests/**/*.test.ts", "app/**/*.test.ts", "workers/**/*.test.ts"],
		setupFiles: ["./tests/setup.ts"],
		testTimeout: 10_000,
	},
});
