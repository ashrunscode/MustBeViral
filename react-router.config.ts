import type { Config } from "@react-router/dev/config";

export default {
	ssr: true,
	future: {
		// React Router 7.15 stabilised this flag; the previous name
		// (unstable_viteEnvironmentApi) now throws on startup.
		v8_viteEnvironmentApi: true,
	},
} satisfies Config;
