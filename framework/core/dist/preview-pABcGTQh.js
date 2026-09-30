import { a as printUrls, i as printShortcutsHint, o as shortcutsEnabled, r as printHeader, s as startupDuration, t as createCliLogger } from "./cli/bin.js";
import { t as createViteConfig } from "./config-hT1o6Jct.js";
import { mergeConfig, preview as preview$1 } from "vite";
//#region src/cli/preview.ts
async function preview(opts = {}) {
	const base = await createViteConfig({ userCwd: process.cwd() });
	const config = mergeConfig(base, {
		customLogger: createCliLogger(),
		preview: {
			...opts.port !== void 0 ? { port: opts.port } : {},
			...opts.host !== void 0 ? { host: opts.host } : {},
			...opts.open !== void 0 ? { open: opts.open } : {}
		}
	});
	const server = await preview$1(config);
	printHeader(`preview · ${startupDuration()}`);
	printUrls(server.resolvedUrls, opts.host);
	if (shortcutsEnabled()) {
		printShortcutsHint();
		server.bindCLIShortcuts();
	}
}
//#endregion
export { preview };
