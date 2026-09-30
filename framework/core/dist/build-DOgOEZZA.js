import { r as printHeader, t as createCliLogger } from "./cli/bin.js";
import { t as createViteConfig } from "./config-hT1o6Jct.js";
import path from "node:path";
import { build as build$1, mergeConfig } from "vite";
//#region src/cli/build.ts
async function build(opts = {}) {
	printHeader("building for production");
	const base = await createViteConfig({
		userCwd: process.cwd(),
		mode: "build"
	});
	const config = mergeConfig(base, {
		customLogger: createCliLogger(),
		build: { ...opts.outDir !== void 0 ? { outDir: path.resolve(process.cwd(), opts.outDir) } : {} }
	});
	await build$1(config);
}
//#endregion
export { build };
