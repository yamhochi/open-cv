#!/usr/bin/env node
import { t as detectPackageManager } from "../update-moCkSyvg.js";
import path from "node:path";
import * as readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { Command, Option } from "commander";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { cp, lstat, mkdir, readFile, readdir, readlink, rm, symlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as readline$1 from "node:readline";
import { stripVTControlCharacters } from "node:util";
//#region src/cli/preflight.ts
const MIGRATION_URL = "https://open-slide.dev/docs/migrate-to-v2";
const VITE_CONSUMERS = ["@vitejs/plugin-react", "@tailwindcss/vite"];
const DEPENDENCY_FIELDS = [
	"dependencies",
	"devDependencies",
	"optionalDependencies",
	"peerDependencies"
];
const PROJECT_ROOT_MARKERS = [
	"pnpm-workspace.yaml",
	"pnpm-lock.yaml",
	"yarn.lock",
	"bun.lock",
	"bun.lockb",
	"package-lock.json",
	".git"
];
function locatePackage(name, fromDir) {
	let dir = fromDir;
	while (true) {
		const candidate = path.join(dir, "node_modules", name);
		const pkgPath = path.join(candidate, "package.json");
		if (existsSync(pkgPath)) {
			let version = "unknown";
			try {
				version = JSON.parse(readFileSync(pkgPath, "utf8")).version ?? version;
			} catch {}
			return {
				dir: realpathSync(candidate),
				root: dir,
				version
			};
		}
		const parent = path.dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}
function findViteMismatch(coreDir) {
	const coreVite = locatePackage("vite", coreDir);
	if (!coreVite) return null;
	for (const consumer of VITE_CONSUMERS) {
		const consumerPkg = locatePackage(consumer, coreDir);
		if (!consumerPkg) continue;
		const consumerVite = locatePackage("vite", consumerPkg.dir);
		if (!consumerVite || consumerVite.version === coreVite.version) continue;
		return {
			consumer,
			coreVite,
			consumerVite
		};
	}
	return null;
}
function declarationIn(dir) {
	const file = path.join(dir, "package.json");
	if (!existsSync(file)) return null;
	try {
		const pkg = JSON.parse(readFileSync(file, "utf8"));
		for (const field of DEPENDENCY_FIELDS) {
			const deps = pkg[field];
			if (deps && Object.hasOwn(deps, "vite")) return {
				file,
				field
			};
		}
	} catch {}
	return null;
}
function isProjectRoot(dir) {
	return PROJECT_ROOT_MARKERS.some((marker) => existsSync(path.join(dir, marker)));
}
function isAncestorOrSelf(ancestor, dir) {
	const rel = path.relative(ancestor, dir);
	return !rel.startsWith("..") && !path.isAbsolute(rel);
}
function findViteDeclaration(cwd, installRoot) {
	if (installRoot && (isAncestorOrSelf(installRoot, cwd) || isAncestorOrSelf(cwd, installRoot))) {
		const owner = declarationIn(installRoot);
		if (owner) return owner;
	}
	const stopAt = installRoot && isAncestorOrSelf(installRoot, cwd) ? installRoot : null;
	let dir = cwd;
	while (dir !== stopAt) {
		const found = declarationIn(dir);
		if (found) return found;
		const parent = path.dirname(dir);
		if (parent === dir || !stopAt && isProjectRoot(dir)) return null;
		dir = parent;
	}
	return null;
}
function removeCommand(pm) {
	return pm === "npm" ? "npm uninstall vite" : `${pm} remove vite`;
}
function formatViteMismatch(mismatch, { cwd = process.cwd(), packageManager = "npm", declaration = null } = {}) {
	const rel = (p) => path.relative(cwd, p) || p;
	const want = chalk.bold(`vite@${mismatch.coreVite.version}`);
	const got = chalk.bold(`vite@${mismatch.consumerVite.version}`);
	const from = chalk.dim(rel(mismatch.consumerVite.dir));
	const command = (cmd) => [
		"",
		`  ${chalk.dim("$")} ${chalk.cyan(cmd)}`,
		""
	];
	const footer = `${chalk.dim("Migration guide")}  ${chalk.cyan.underline(MIGRATION_URL)}`;
	if (!declaration) return [
		chalk.bold("Conflicting vite versions in node_modules"),
		"",
		`open-slide ships ${want}, but ${mismatch.consumer} is loading ${got}`,
		`from ${from}. Make sure no package.json lists vite, then reinstall:`,
		...command(`${packageManager} install`),
		footer
	].join("\n");
	const dir = path.dirname(declaration.file);
	const cd = path.resolve(dir) === path.resolve(cwd) ? "" : `cd ${rel(dir)} && `;
	return [
		chalk.bold(`Remove ${chalk.yellow("vite")} from your package.json`),
		"",
		`${chalk.bold(declaration.field)} in ${chalk.dim(rel(declaration.file))} still lists vite, a leftover from v1.`,
		`It shadows the ${want} bundled with open-slide: ${mismatch.consumer}`,
		`is loading ${got} from ${from} instead.`,
		...command(cd + removeCommand(packageManager)),
		footer
	].join("\n");
}
async function assertViteResolvesToCore(cwd = process.cwd()) {
	const mismatch = findViteMismatch(realpathSync(path.dirname(fileURLToPath(import.meta.url))));
	if (!mismatch) return;
	const declaration = findViteDeclaration(cwd, mismatch.consumerVite.root);
	const packageManager = await detectPackageManager(declaration ? path.dirname(declaration.file) : cwd);
	throw new Error(formatViteMismatch(mismatch, {
		cwd,
		packageManager,
		declaration
	}));
}
//#endregion
//#region src/cli/sync.ts
async function detectSkillsDrift(skillsDir) {
	if (!existsSync(skillsDir)) return [];
	const cwd = process.cwd();
	const agentsSkillsDir = path.join(cwd, ".agents", "skills");
	const skillNames = (await readdir(skillsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
	const results = [];
	for (const name of skillNames) {
		const src = path.join(skillsDir, name);
		const dst = path.join(agentsSkillsDir, name);
		const srcHash = await hashDir(src);
		const dstHash = existsSync(dst) ? await hashDir(dst) : null;
		let status;
		if (dstHash === null) status = "added";
		else if (dstHash !== srcHash) status = "updated";
		else status = "unchanged";
		results.push({
			name,
			status
		});
	}
	return results;
}
async function syncSkills(skillsDir, opts = {}) {
	const { dryRun = false } = opts;
	if (!existsSync(skillsDir)) throw new Error(`Built-in skills directory missing at ${skillsDir}. The @open-slide/core package may be corrupt — try reinstalling.`);
	const cwd = process.cwd();
	const agentsSkillsDir = path.join(cwd, ".agents", "skills");
	const claudeSkillsDir = path.join(cwd, ".claude", "skills");
	const results = await detectSkillsDrift(skillsDir);
	if (results.length === 0) {
		process.stdout.write(chalk.yellow("No skills found to sync.\n"));
		return;
	}
	for (const { name, status } of results) {
		const src = path.join(skillsDir, name);
		const dst = path.join(agentsSkillsDir, name);
		if (dryRun) continue;
		if (status === "unchanged") {
			await ensureClaudeSymlink(claudeSkillsDir, name);
			continue;
		}
		await mkdir(path.dirname(dst), { recursive: true });
		if (existsSync(dst)) await rm(dst, {
			recursive: true,
			force: true
		});
		await cp(src, dst, { recursive: true });
		await ensureClaudeSymlink(claudeSkillsDir, name);
	}
	printSummary(results, dryRun);
}
async function ensureClaudeSymlink(claudeSkillsDir, name) {
	await mkdir(claudeSkillsDir, { recursive: true });
	const linkPath = path.join(claudeSkillsDir, name);
	const target = path.join("..", "..", ".agents", "skills", name);
	if (existsSync(linkPath)) try {
		if ((await lstat(linkPath)).isSymbolicLink()) {
			if (await readlink(linkPath) === target) return;
		}
		await rm(linkPath, {
			recursive: true,
			force: true
		});
	} catch {
		await rm(linkPath, {
			recursive: true,
			force: true
		});
	}
	try {
		await symlink(target, linkPath, "dir");
	} catch (err) {
		const code = err.code;
		if (code === "EPERM" || code === "EEXIST") {
			const absoluteTarget = path.resolve(claudeSkillsDir, target);
			await cp(absoluteTarget, linkPath, { recursive: true });
		} else throw err;
	}
}
async function hashDir(dir) {
	const hash = createHash("sha256");
	const files = await collectFiles(dir);
	files.sort();
	for (const rel of files) {
		const abs = path.join(dir, rel);
		const data = await readFile(abs);
		hash.update(rel);
		hash.update("\0");
		hash.update(data);
		hash.update("\0");
	}
	return hash.digest("hex");
}
async function collectFiles(dir, prefix = "") {
	const out = [];
	const entries = await readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const rel = prefix ? path.join(prefix, entry.name) : entry.name;
		if (entry.isDirectory()) out.push(...await collectFiles(path.join(dir, entry.name), rel));
		else if (entry.isFile()) out.push(rel);
	}
	return out;
}
function printSummary(results, dryRun) {
	const symbols = {
		added: chalk.green("+"),
		updated: chalk.yellow("~"),
		unchanged: chalk.dim("=")
	};
	const labels = {
		added: chalk.green("added"),
		updated: chalk.yellow("updated"),
		unchanged: chalk.dim("unchanged")
	};
	const header = dryRun ? chalk.bold("Dry run — no files written:") : chalk.bold("Synced built-in skills:");
	process.stdout.write(`${header}\n`);
	for (const { name, status } of results) process.stdout.write(`  ${symbols[status]} ${name} ${chalk.dim(`(${labels[status]})`)}\n`);
	const counts = results.reduce((acc, { status }) => {
		acc[status] += 1;
		return acc;
	}, {
		added: 0,
		updated: 0,
		unchanged: 0
	});
	process.stdout.write(chalk.dim(`\n${counts.added} added, ${counts.updated} updated, ${counts.unchanged} unchanged.\n`));
}
//#endregion
//#region src/cli/ui.ts
const UNICODE = process.platform !== "win32" || Boolean(process.env.WT_SESSION) || process.env.TERM_PROGRAM === "vscode";
const glyph = {
	bar: UNICODE ? "┃" : "|",
	warn: UNICODE ? "▲" : "!",
	cross: UNICODE ? "✖" : "x"
};
function readVersion() {
	let dir = path.dirname(fileURLToPath(import.meta.url));
	while (dir !== path.dirname(dir)) {
		const pkgPath = path.join(dir, "package.json");
		if (existsSync(pkgPath)) {
			const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
			if (pkg.name === "@open-slide/core" && pkg.version) return pkg.version;
		}
		dir = path.dirname(dir);
	}
	return "0.0.0";
}
function brand() {
	return chalk.inverse.bold(" open-slide ");
}
function printHeader(status) {
	const parts = [brand(), chalk.dim(`v${readVersion()}`)];
	if (status) parts.push(chalk.dim(status));
	process.stdout.write(`\n  ${parts.join("  ")}\n\n`);
}
function startupDuration() {
	return `ready in ${Math.round(process.uptime() * 1e3)} ms`;
}
function printUrls(urls, host) {
	if (!urls) return;
	const rows = [];
	for (const url of urls.local) rows.push(urlRow("Local", chalk.cyan(url)));
	urls.network.forEach((url, index) => {
		const iface = urls.networkInterfaceNames?.[index];
		rows.push(urlRow("Network", chalk.cyan(url) + (iface ? `  ${chalk.dim(iface)}` : "")));
	});
	if (urls.network.length === 0 && host === void 0) rows.push(urlRow("Network", chalk.dim("use --host to expose")));
	process.stdout.write(`${rows.join("\n")}\n`);
}
function urlRow(label, value) {
	return `  ${chalk.dim(glyph.bar)}  ${chalk.bold(label.padEnd(8))} ${value}`;
}
function shortcutsEnabled() {
	return Boolean(process.stdin.isTTY) && !process.env.CI;
}
function printShortcutsHint() {
	process.stdout.write(`\n  ${chalk.dim("press")} ${chalk.bold("h + enter")} ${chalk.dim("for shortcuts")}\n`);
}
function formatError(message) {
	const [first, ...rest] = message.split("\n");
	const body = rest.map((line) => line ? `\n    ${line}` : "\n").join("");
	return `\n  ${chalk.red(glyph.cross)} ${first}${body}\n\n`;
}
const DROPPED = [/^vite v\d+\.\d+\.\d+ building /];
const REWRITES = [
	[/hmr update /, "updated "],
	[/hmr invalidate /, "invalidated "],
	[/trigger page reload /, "full reload "],
	[/page reload/, "full reload"],
	[/server restarted\./, "server restarted"],
	[/optimized dependencies changed\. reloading/, "dependencies changed, reloading"],
	[/Re-optimizing dependencies because vite config has changed/, "config changed, re-bundling"],
	[/Re-optimizing dependencies because lockfile has changed/, "lockfile changed, re-bundling"],
	[/Forced re-optimization of dependencies/, "re-bundling dependencies"],
	[/\[plugin builtin:vite-[a-z-]+\] ?\n?/, ""],
	[/\[vite\] ?/g, ""]
];
function rewriteViteMessage(msg) {
	const plain = stripVTControlCharacters(msg);
	if (DROPPED.some((re) => re.test(plain))) return null;
	let out = msg;
	for (const [re, replacement] of REWRITES) out = out.replace(re, replacement);
	return out;
}
function timestamp() {
	return (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hourCycle: "h23" });
}
function formatLine(type, text, opts) {
	if (!opts?.timestamp) return text;
	const mark = type === "warn" ? `${chalk.yellow(glyph.warn)} ` : type === "error" ? `${chalk.red(glyph.cross)} ` : "";
	return `  ${chalk.dim(timestamp())}  ${mark}${text}`;
}
function clearTerminal() {
	if (!process.stdout.isTTY || process.env.CI) return;
	const blank = "\n".repeat(Math.max(process.stdout.rows - 2, 0));
	console.log(blank);
	readline$1.cursorTo(process.stdout, 0, 0);
	readline$1.clearScreenDown(process.stdout);
}
function createCliLogger() {
	const loggedErrors = /* @__PURE__ */ new WeakSet();
	const warnedOnce = /* @__PURE__ */ new Set();
	const write = (type, msg, opts) => {
		const text = rewriteViteMessage(msg);
		if (text === null) return;
		console[type === "info" ? "log" : type](formatLine(type, text, opts));
	};
	const logger = {
		hasWarned: false,
		info(msg, opts) {
			write("info", msg, opts);
		},
		warn(msg, opts) {
			logger.hasWarned = true;
			write("warn", msg, opts);
		},
		warnOnce(msg, opts) {
			if (warnedOnce.has(msg)) return;
			warnedOnce.add(msg);
			logger.warn(msg, opts);
		},
		error(msg, opts) {
			logger.hasWarned = true;
			if (opts?.error) loggedErrors.add(opts.error);
			write("error", msg, opts);
		},
		clearScreen() {
			clearTerminal();
		},
		hasErrorLogged(error) {
			return loggedErrors.has(error);
		}
	};
	return logger;
}
//#endregion
//#region src/cli/run.ts
function parsePort(value) {
	const n = Number(value);
	if (!Number.isInteger(n) || n < 0 || n > 65535) throw new Error(`Invalid port: ${value}`);
	return n;
}
async function runSkillsDriftCheck(skillsDir) {
	if (process.env.OPEN_SLIDE_SKIP_SKILLS_CHECK === "1") return;
	let drift;
	try {
		drift = await detectSkillsDrift(skillsDir);
	} catch {
		return;
	}
	const stale = drift.filter((d) => d.status !== "unchanged");
	if (stale.length === 0) return;
	const names = stale.map((d) => d.name).join(", ");
	const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
	const notice = `${chalk.yellow(glyph.warn)} Built-in skills are out of date: ${chalk.bold(names)}`;
	if (!interactive) {
		process.stderr.write(`\n  ${notice}\n    ${chalk.dim("Run `open-slide sync:skills` to update.")}\n`);
		return;
	}
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
	try {
		const answer = (await rl.question(`\n  ${notice}\n    Sync now? ${chalk.dim("(Y/n)")} `)).trim().toLowerCase();
		if (answer === "" || answer === "y" || answer === "yes") {
			process.stdout.write("\n");
			await syncSkills(skillsDir);
		} else process.stdout.write(chalk.dim("    Skipped. Run `open-slide sync:skills` later to update.\n"));
	} finally {
		rl.close();
	}
}
function resolveBuiltinSkillsDir() {
	const here = path.dirname(fileURLToPath(import.meta.url));
	return path.resolve(here, "..", "..", "skills");
}
async function run(argv) {
	const program = new Command();
	program.name("open-slide").description("Author slides in React — open-slide runs the rest.").version(readVersion(), "-v, --version", "print version").helpOption("-h, --help", "show help").showHelpAfterError(chalk.dim("(run `open-slide --help` for usage)"));
	program.command("dev").description("Start the dev server").addOption(new Option("-p, --port <port>", "port to listen on").argParser(parsePort)).addOption(new Option("--host [host]", "expose on the network (optional host)")).option("--open", "open the browser on start").option("--no-skills-check", "skip the built-in skills drift check").action(async (flags) => {
		if (flags.skillsCheck !== false) await runSkillsDriftCheck(resolveBuiltinSkillsDir());
		await assertViteResolvesToCore();
		const { dev } = await import("../dev-_YkLNJRt.js");
		await dev(flags);
	});
	program.command("build").description("Build a static site").option("--out-dir <dir>", "output directory (defaults to `dist`)").action(async (flags) => {
		await assertViteResolvesToCore();
		const { build } = await import("../build-DOgOEZZA.js");
		await build(flags);
	});
	program.command("preview").description("Preview the production build").addOption(new Option("-p, --port <port>", "port to listen on").argParser(parsePort)).addOption(new Option("--host [host]", "expose on the network (optional host)")).option("--open", "open the browser on start").action(async (flags) => {
		await assertViteResolvesToCore();
		const { preview } = await import("../preview-pABcGTQh.js");
		await preview(flags);
	});
	program.command("sync:skills").description("Sync built-in skills from @open-slide/core into this workspace").option("--dry-run", "show what would change without writing").action(async (flags) => {
		await syncSkills(resolveBuiltinSkillsDir(), flags);
	});
	await program.parseAsync(argv, { from: "user" });
}
//#endregion
//#region src/cli/bin.ts
run(process.argv.slice(2)).catch((err) => {
	const message = err instanceof Error ? err.message : String(err);
	process.stderr.write(formatError(message));
	process.exit(1);
});
//#endregion
export { printUrls as a, printShortcutsHint as i, formatError as n, shortcutsEnabled as o, printHeader as r, startupDuration as s, createCliLogger as t };
