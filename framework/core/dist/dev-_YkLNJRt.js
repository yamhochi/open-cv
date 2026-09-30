import { a as printUrls, i as printShortcutsHint, n as formatError, o as shortcutsEnabled, r as printHeader, s as startupDuration, t as createCliLogger } from "./cli/bin.js";
import { n as DEV_SUPERVISED_ENV, t as createViteConfig } from "./config-hT1o6Jct.js";
import path from "node:path";
import { existsSync } from "node:fs";
import { fork } from "node:child_process";
import { createServer, mergeConfig } from "vite";
//#region src/cli/dev.ts
async function dev(opts = {}) {
	if (process.env["OPEN_SLIDE_DEV_SUPERVISED"] === "1") {
		await startServer(opts);
		return;
	}
	supervise(opts);
}
async function startServer(opts) {
	const base = await createViteConfig({ userCwd: process.cwd() });
	const config = mergeConfig(base, {
		customLogger: createCliLogger(),
		server: {
			...opts.port !== void 0 ? { port: opts.port } : {},
			...opts.host !== void 0 ? { host: opts.host } : {},
			...opts.open !== void 0 ? { open: opts.open } : {}
		}
	});
	const server = await createServer(config);
	await server.listen();
	printHeader(startupDuration());
	printUrls(server.resolvedUrls, opts.host);
	if (shortcutsEnabled()) {
		printShortcutsHint();
		server.bindCLIShortcuts({ customShortcuts: devShortcuts(opts) });
	}
	const address = server.httpServer?.address();
	if (process.send && address && typeof address === "object") process.send({
		type: "open-slide:listening",
		port: address.port
	});
}
function devShortcuts(opts) {
	const showUrls = (server) => {
		console.log("");
		printUrls(server.resolvedUrls, opts.host);
	};
	return [{
		key: "r",
		description: "restart the server",
		async action(server) {
			const before = JSON.stringify(server.resolvedUrls);
			await server.restart();
			if (JSON.stringify(server.resolvedUrls) !== before) showUrls(server);
		}
	}, {
		key: "u",
		description: "show server url",
		action: showUrls
	}];
}
function supervise(opts) {
	const userCwd = process.cwd();
	let port = opts.port;
	let openBrowser = opts.open;
	let child;
	let shuttingDown = false;
	const spawnChild = () => {
		child = fork(resolveDevEntry(userCwd), devArgs({
			...opts,
			port,
			open: openBrowser
		}), {
			cwd: userCwd,
			stdio: "inherit",
			env: {
				...process.env,
				[DEV_SUPERVISED_ENV]: "1"
			}
		});
		child.on("error", (err) => {
			process.stderr.write(formatError(err.message));
			process.exit(1);
		});
		child.on("message", (message) => {
			if (typeof message !== "object" || message === null) return;
			const { type, port: reportedPort } = message;
			if (type === "open-slide:listening" && typeof reportedPort === "number") port = reportedPort;
		});
		child.on("exit", (code, signal) => {
			if (shuttingDown) process.exit(0);
			if (code === 52) {
				openBrowser = false;
				spawnChild();
				return;
			}
			if (signal) process.exit(1);
			process.exit(code ?? 0);
		});
	};
	for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
		shuttingDown = true;
		child?.kill(signal);
	});
	spawnChild();
}
function devArgs(opts) {
	const args = ["dev", "--no-skills-check"];
	if (opts.port !== void 0) args.push("--port", String(opts.port));
	if (opts.host === true) args.push("--host");
	else if (typeof opts.host === "string") args.push("--host", opts.host);
	if (opts.open) args.push("--open");
	return args;
}
function resolveDevEntry(userCwd) {
	const installed = path.join(userCwd, "node_modules", "@open-slide", "core", "bin.js");
	if (existsSync(installed)) return installed;
	return process.argv[1];
}
//#endregion
export { dev };
