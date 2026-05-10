import js from "@eslint/js";
import tseslint from "typescript-eslint";

const typeScriptFiles = ["**/*.{ts,tsx}"];
const typedRecommended = tseslint.configs.recommendedTypeChecked.map((config) => ({
	...config,
	files: typeScriptFiles,
}));

export default tseslint.config(
	{
		ignores: [
			".react-router/**",
			".wrangler/**",
			"build/**",
			"coverage/**",
			"dist/**",
			"node_modules/**",
			"worker-configuration.d.ts",
		],
	},
	{
		...js.configs.recommended,
		files: ["**/*.{js,mjs,cjs}"],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
		},
	},
	{
		files: ["scripts/**/*.{js,mjs,cjs}"],
		languageOptions: {
			globals: {
				console: "readonly",
				process: "readonly",
				URL: "readonly",
				Buffer: "readonly",
				__dirname: "readonly",
				__filename: "readonly",
			},
		},
	},
	...typedRecommended,
	{
		files: typeScriptFiles,
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			"no-undef": "off",
			"no-unused-vars": "off",
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-floating-promises": "error",
			"@typescript-eslint/no-misused-promises": "error",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" },
			],
		},
	},
	{
		files: ["*.config.{js,ts}", "eslint.config.js", "vite.config.ts"],
		rules: {
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
		},
	},
);
