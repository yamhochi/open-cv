import path from "node:path";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { parse } from "@babel/parser";
import { randomUUID } from "node:crypto";
//#region src/http/request-guard.ts
function headerValue(req, name) {
	const raw = req.headers[name.toLowerCase()];
	return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? null;
}
function firstCommaToken(value) {
	if (!value) return null;
	const [first] = value.split(",", 1);
	return first?.trim() || null;
}
function requestProto(req) {
	const forwarded = firstCommaToken(headerValue(req, "x-forwarded-proto"))?.toLowerCase();
	if (forwarded === "http" || forwarded === "https") return forwarded;
	return "encrypted" in req.socket && req.socket.encrypted ? "https" : "http";
}
function normalizedOrigin(origin) {
	try {
		const url = new URL(origin);
		return `${url.protocol}//${url.host}`.toLowerCase();
	} catch {
		return null;
	}
}
function validateMutationRequest(req, opts = {}) {
	if (opts.requireJsonBody) {
		if (!(headerValue(req, "content-type")?.toLowerCase())?.startsWith("application/json")) return {
			ok: false,
			status: 415,
			error: "content-type must be application/json"
		};
	}
	if (firstCommaToken(headerValue(req, "sec-fetch-site"))?.toLowerCase() === "cross-site") return {
		ok: false,
		status: 403,
		error: "cross-site request blocked"
	};
	const originRaw = headerValue(req, "origin");
	if (!originRaw) return { ok: true };
	if (originRaw.toLowerCase() === "null") return {
		ok: false,
		status: 403,
		error: "opaque origin is not allowed"
	};
	const actualOrigin = normalizedOrigin(originRaw);
	if (!actualOrigin) return {
		ok: false,
		status: 403,
		error: "invalid origin header"
	};
	const host = firstCommaToken(headerValue(req, "x-forwarded-host")) ?? headerValue(req, "host");
	if (!host) return {
		ok: false,
		status: 400,
		error: "missing host header"
	};
	if (actualOrigin !== `${requestProto(req)}://${host}`.toLowerCase()) return {
		ok: false,
		status: 403,
		error: "origin mismatch"
	};
	return { ok: true };
}
//#endregion
//#region src/editing/slide-ops.ts
const SLIDE_ID_RE = /^[a-z0-9_-]+$/i;
function validateSlideName(v) {
	if (typeof v !== "string") return null;
	const trimmed = v.trim();
	if (trimmed.length < 1 || trimmed.length > 80) return null;
	return trimmed;
}
function unwrapExpression(node) {
	let current = node;
	while (current && (current.type === "TSAsExpression" || current.type === "TSSatisfiesExpression")) current = current.expression;
	return current;
}
function readMetaTitleInSource(source) {
	let ast;
	try {
		ast = parse(source, {
			sourceType: "module",
			plugins: ["typescript", "jsx"],
			errorRecovery: true
		});
	} catch {
		return { kind: "unsupported" };
	}
	const body = ast.program?.body ?? [];
	for (const stmt of body) {
		if (stmt.type !== "ExportNamedDeclaration") continue;
		const decl = stmt.declaration;
		if (decl?.type !== "VariableDeclaration") continue;
		const declarations = decl.declarations ?? [];
		for (const d of declarations) {
			const id = d.id;
			if (id?.type !== "Identifier" || id.name !== "meta") continue;
			const init = unwrapExpression(d.init);
			if (init?.type !== "ObjectExpression") return { kind: "unsupported" };
			const properties = init.properties ?? [];
			for (const property of properties) {
				if (property.type !== "ObjectProperty" || property.computed) continue;
				const key = property.key;
				if ((key?.type === "Identifier" ? key.name : key?.type === "StringLiteral" ? key.value : void 0) !== "title") continue;
				const value = property.value;
				if (value?.type === "StringLiteral" && typeof value.value === "string") return {
					kind: "found",
					title: value.value
				};
				if (value?.type === "TemplateLiteral") {
					const expressions = value.expressions ?? [];
					const firstValue = (value.quasis ?? [])[0]?.value;
					const cooked = firstValue?.cooked;
					const raw = firstValue?.raw;
					if (expressions.length === 0 && typeof (cooked ?? raw) === "string") return {
						kind: "found",
						title: cooked ?? raw
					};
				}
				return { kind: "unsupported" };
			}
			return { kind: "missing" };
		}
	}
	return { kind: "missing" };
}
async function rmSlideDir(slidesRoot, slideId) {
	if (!SLIDE_ID_RE.test(slideId)) return false;
	const dir = path.resolve(slidesRoot, slideId);
	if (!dir.startsWith(slidesRoot + path.sep)) return false;
	try {
		await fs.rm(dir, {
			recursive: true,
			force: true
		});
		return true;
	} catch {
		return false;
	}
}
async function duplicateSlideDir(slidesRoot, slideId, desiredId) {
	if (!SLIDE_ID_RE.test(slideId)) return {
		ok: false,
		status: 400,
		error: "invalid slideId"
	};
	const root = path.resolve(slidesRoot);
	const srcDir = path.resolve(root, slideId);
	if (!srcDir.startsWith(root + path.sep)) return {
		ok: false,
		status: 400,
		error: "invalid slideId"
	};
	try {
		await fs.access(path.join(srcDir, "index.tsx"));
	} catch {
		return {
			ok: false,
			status: 404,
			error: "slide not found"
		};
	}
	let newId;
	if (desiredId !== void 0) {
		if (!SLIDE_ID_RE.test(desiredId)) return {
			ok: false,
			status: 400,
			error: "invalid newId"
		};
		newId = desiredId;
		const dstDir = path.resolve(root, newId);
		if (!dstDir.startsWith(root + path.sep)) return {
			ok: false,
			status: 400,
			error: "invalid newId"
		};
		try {
			await fs.access(dstDir);
			return {
				ok: false,
				status: 409,
				error: "slide already exists"
			};
		} catch {}
	} else {
		let suffix = 1;
		while (true) {
			newId = suffix === 1 ? `${slideId}-copy` : `${slideId}-copy-${suffix}`;
			try {
				await fs.access(path.resolve(root, newId));
				suffix++;
			} catch {
				break;
			}
		}
	}
	const dstDir = path.resolve(root, newId);
	if (!dstDir.startsWith(root + path.sep)) return {
		ok: false,
		status: 400,
		error: "invalid newId"
	};
	const srcEntry = path.join(srcDir, "index.tsx");
	let copiedEntrySource;
	try {
		const source = await fs.readFile(srcEntry, "utf8");
		const metaTitle = readMetaTitleInSource(source);
		if (metaTitle.kind === "unsupported") return {
			ok: false,
			status: 422,
			error: "could not update copied slide title"
		};
		const updated = updateMetaTitleInSource(source, `${metaTitle.kind === "found" ? metaTitle.title : slideId} (copy)`);
		if (updated === null) return {
			ok: false,
			status: 422,
			error: "could not update copied slide title"
		};
		copiedEntrySource = updated;
	} catch {
		return {
			ok: false,
			status: 404,
			error: "slide not found"
		};
	}
	try {
		await fs.cp(srcDir, dstDir, {
			recursive: true,
			errorOnExist: true,
			force: false
		});
		await fs.writeFile(path.join(dstDir, "index.tsx"), copiedEntrySource, "utf8");
		return {
			ok: true,
			slideId: newId
		};
	} catch (err) {
		if (err.code === "EEXIST") return {
			ok: false,
			status: 409,
			error: "slide already exists"
		};
		return {
			ok: false,
			status: 500,
			error: String(err.message ?? err)
		};
	}
}
function resolveSlideEntry(slidesRoot, slideId) {
	if (!SLIDE_ID_RE.test(slideId)) return null;
	const dir = path.resolve(slidesRoot, slideId);
	if (!dir.startsWith(slidesRoot + path.sep)) return null;
	return path.join(dir, "index.tsx");
}
function escapeSingleQuoted(s) {
	return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
/**
* Rewrite (or insert) the `title` field in the slide module's `export const meta`.
*
* Strategy:
*   1. Find `export const meta` and brace-match its object literal.
*   2. If the object already has a `title: '...'` entry, replace the literal.
*   3. If the object exists but has no title, inject a new `title: '...'` line
*      as the first property (preserving the author's surrounding indentation).
*   4. If there is no `meta` export at all, insert a fresh one right before
*      `export default`.
*
* Returns the rewritten source, or `null` if the file shape was too surprising
* to touch safely (e.g. `export default` missing when we'd need to inject meta).
*/
function updateMetaTitleInSource(source, title) {
	const newLiteral = `'${escapeSingleQuoted(title)}'`;
	const metaStart = source.search(/export\s+const\s+meta\b/);
	if (metaStart !== -1) {
		const eqIdx = source.indexOf("=", metaStart);
		if (eqIdx === -1) return null;
		const openBrace = source.indexOf("{", eqIdx);
		if (openBrace === -1) return null;
		let depth = 0;
		let closeBrace = -1;
		for (let i = openBrace; i < source.length; i++) {
			const ch = source[i];
			if (ch === "{") depth++;
			else if (ch === "}") {
				depth--;
				if (depth === 0) {
					closeBrace = i;
					break;
				}
			}
		}
		if (closeBrace === -1) return null;
		const body = source.slice(openBrace + 1, closeBrace);
		const titleRe = /(^|[\s,{])(title\s*:\s*)(['"`])((?:\\.|(?!\3).)*)\3/;
		const match = body.match(titleRe);
		if (match) {
			const newBody = body.replace(titleRe, `${match[1]}${match[2]}${newLiteral}`);
			return source.slice(0, openBrace + 1) + newBody + source.slice(closeBrace);
		}
		const firstIndentMatch = body.match(/\n([ \t]+)\S/);
		const insertion = `\n${firstIndentMatch ? firstIndentMatch[1] : "  "}title: ${newLiteral}${body.replace(/^\s*\n?/, "").trim().length > 0 ? "," : ""}`;
		return source.slice(0, openBrace + 1) + insertion + body + source.slice(closeBrace);
	}
	const exportDefaultIdx = source.search(/export\s+default\b/);
	if (exportDefaultIdx === -1) return null;
	const insertion = `export const meta: SlideMeta = { title: ${newLiteral} };\n\n`;
	return source.slice(0, exportDefaultIdx) + insertion + source.slice(exportDefaultIdx);
}
function findDefaultExportArray(source) {
	let ast;
	try {
		ast = parse(source, {
			sourceType: "module",
			plugins: ["typescript", "jsx"],
			errorRecovery: true
		});
	} catch {
		return null;
	}
	const body = ast.program?.body ?? [];
	for (const node of body) {
		if (node.type !== "ExportDefaultDeclaration") continue;
		let inner = node.declaration;
		while (inner && (inner.type === "TSAsExpression" || inner.type === "TSSatisfiesExpression")) inner = inner.expression;
		if (inner?.type !== "ArrayExpression") return null;
		const arrayStart = inner.start;
		const arrayEnd = inner.end;
		const rawElements = inner.elements ?? [];
		const elements = [];
		for (const el of rawElements) {
			if (!el || typeof el.start !== "number" || typeof el.end !== "number") return null;
			elements.push({
				start: el.start,
				end: el.end
			});
		}
		return {
			elements,
			arrayStart,
			arrayEnd
		};
	}
	return null;
}
/**
* Rewrite `export default [...]` so its elements appear in the requested order.
*
* `order[i]` is the original index that should land at new position `i`. The
* function preserves each element's exact source slice (including any inline
* comments that hug an identifier) and keeps the inter-element separator slots
* in their original positions, so a 3-page array `[A, B, C]` reordered to
* `[2, 0, 1]` becomes `[C, A, B]` with the same indentation and trailing
* commas the author wrote.
*
* Returns `null` when the file's default export isn't an array literal, or the
* order is not a valid permutation of `[0, n-1]`.
*/
function reorderDefaultExportPagesInSource(source, order) {
	const found = findDefaultExportArray(source);
	if (!found) return null;
	const { elements, arrayStart, arrayEnd } = found;
	const n = elements.length;
	if (order.length !== n) return null;
	const seen = /* @__PURE__ */ new Set();
	for (const idx of order) {
		if (!Number.isInteger(idx) || idx < 0 || idx >= n) return null;
		if (seen.has(idx)) return null;
		seen.add(idx);
	}
	if (n === 0) return source;
	let identity = true;
	for (let i = 0; i < n; i++) if (order[i] !== i) {
		identity = false;
		break;
	}
	if (identity) return source;
	const prefix = source.slice(arrayStart, elements[0].start);
	const suffix = source.slice(elements[n - 1].end, arrayEnd);
	const separators = [];
	for (let i = 0; i < n - 1; i++) separators.push(source.slice(elements[i].end, elements[i + 1].start));
	const elementText = elements.map((el) => source.slice(el.start, el.end));
	let rebuilt = prefix + elementText[order[0]];
	for (let i = 1; i < n; i++) rebuilt += separators[i - 1] + elementText[order[i]];
	rebuilt += suffix;
	return source.slice(0, arrayStart) + rebuilt + source.slice(arrayEnd);
}
function findNotesArray(source) {
	let ast;
	try {
		ast = parse(source, {
			sourceType: "module",
			plugins: ["typescript", "jsx"],
			errorRecovery: true
		});
	} catch {
		return "invalid";
	}
	const body = ast.program?.body ?? [];
	for (const stmt of body) {
		if (stmt.type !== "ExportNamedDeclaration") continue;
		const decl = stmt.declaration;
		if (decl?.type !== "VariableDeclaration") continue;
		const declarations = decl.declarations ?? [];
		for (const d of declarations) {
			const id = d.id;
			if (id?.type !== "Identifier" || id.name !== "notes") continue;
			const init = d.init;
			if (init?.type !== "ArrayExpression") return "invalid";
			const arrayStart = init.start;
			const arrayEnd = init.end;
			if (typeof arrayStart !== "number" || typeof arrayEnd !== "number") return "invalid";
			const rawElements = init.elements ?? [];
			const elementTexts = [];
			for (const el of rawElements) {
				if (el === null) {
					elementTexts.push("undefined");
					continue;
				}
				if (el.type === "SpreadElement") return "invalid";
				const start = el.start;
				const end = el.end;
				if (typeof start !== "number" || typeof end !== "number") return "invalid";
				elementTexts.push(source.slice(start, end));
			}
			return {
				arrayStart,
				arrayEnd,
				elementTexts
			};
		}
	}
	return null;
}
/**
* Reorder `export const notes = [...]` to follow the page-array reorder.
*
* `order[i]` is the original page index that should land at new position `i`.
* The notes array is index-aligned with the pages array but may be shorter
* (trailing `undefined` slots are routinely trimmed). Missing elements are
* treated as `undefined`, and trailing `undefined` is trimmed again after
* reordering to keep the file tidy.
*
* Returns the rewritten source, the original source if no `notes` export
* exists or the reorder is a no-op, or `null` if the `notes` export's shape
* is too surprising to touch safely.
*/
function reorderNotesArrayInSource(source, order) {
	for (const idx of order) if (!Number.isInteger(idx) || idx < 0) return null;
	const found = findNotesArray(source);
	if (found === "invalid") return null;
	if (found === null) return source;
	const { arrayStart, arrayEnd, elementTexts } = found;
	const pick = (i) => i >= 0 && i < elementTexts.length ? elementTexts[i] : "undefined";
	return rebuildNotesArray(source, arrayStart, arrayEnd, order.map(pick));
}
/**
* Remove the note aligned with the page at `index` so the `notes` export stays
* index-aligned with `export default [...]` after a page deletion. Mirrors
* {@link removePageFromDefaultExportInSource}.
*
* Returns the rewritten source, the original source if no `notes` export exists
* or the index falls past the recorded notes, or `null` if the `notes` export's
* shape is too surprising to touch safely.
*/
function removeNotesElementInSource(source, index) {
	if (!Number.isInteger(index) || index < 0) return null;
	const found = findNotesArray(source);
	if (found === "invalid") return null;
	if (found === null) return source;
	const { arrayStart, arrayEnd, elementTexts } = found;
	if (index >= elementTexts.length) return source;
	const next = elementTexts.slice();
	next.splice(index, 1);
	return rebuildNotesArray(source, arrayStart, arrayEnd, next);
}
/**
* Duplicate the note aligned with the page at `index`, inserting the copy right
* after it so the `notes` export stays index-aligned with `export default [...]`
* after a page duplication. Mirrors {@link duplicatePageInDefaultExportInSource}.
*
* Returns the rewritten source, the original source if no `notes` export exists
* or the index falls past the recorded notes (the new slot and everything after
* it are absent, so nothing shifts), or `null` if the shape is too surprising.
*/
function duplicateNotesElementInSource(source, index) {
	if (!Number.isInteger(index) || index < 0) return null;
	const found = findNotesArray(source);
	if (found === "invalid") return null;
	if (found === null) return source;
	const { arrayStart, arrayEnd, elementTexts } = found;
	if (index >= elementTexts.length) return source;
	const next = elementTexts.slice();
	next.splice(index + 1, 0, next[index]);
	return rebuildNotesArray(source, arrayStart, arrayEnd, next);
}
function rebuildNotesArray(source, arrayStart, arrayEnd, elements) {
	const trimmed = elements.slice();
	while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "undefined") trimmed.pop();
	const replacement = trimmed.length === 0 ? "[]" : `[\n${trimmed.map((s) => `  ${s},`).join("\n")}\n]`;
	if (replacement === source.slice(arrayStart, arrayEnd)) return source;
	return source.slice(0, arrayStart) + replacement + source.slice(arrayEnd);
}
/**
* Remove the element at `index` from `export default [...]`.
*
* Preserves the source slice of every other element, dropping the separator
* immediately following the removed element (or the preceding one when the
* removed element is the last). Returns `null` when the default export isn't
* an array literal or `index` is out of range.
*/
function removePageFromDefaultExportInSource(source, index) {
	const found = findDefaultExportArray(source);
	if (!found) return null;
	const { elements, arrayStart, arrayEnd } = found;
	const n = elements.length;
	if (!Number.isInteger(index) || index < 0 || index >= n) return null;
	if (n === 1) return `${source.slice(0, arrayStart)}[]${source.slice(arrayEnd)}`;
	const prefix = source.slice(arrayStart, elements[0].start);
	const suffix = source.slice(elements[n - 1].end, arrayEnd);
	const separators = [];
	for (let i = 0; i < n - 1; i++) separators.push(source.slice(elements[i].end, elements[i + 1].start));
	const elementText = elements.map((el) => source.slice(el.start, el.end));
	const keptElements = [];
	const keptSeparators = [];
	for (let i = 0; i < n; i++) {
		if (i === index) continue;
		keptElements.push(elementText[i]);
	}
	for (let i = 0; i < n - 1; i++) {
		if (index === n - 1 ? i === n - 2 : i === index) continue;
		keptSeparators.push(separators[i]);
	}
	let rebuilt = prefix + keptElements[0];
	for (let i = 1; i < keptElements.length; i++) rebuilt += keptSeparators[i - 1] + keptElements[i];
	rebuilt += suffix;
	return source.slice(0, arrayStart) + rebuilt + source.slice(arrayEnd);
}
function chooseInsertSeparator(prefix, existingSeparators) {
	const sample = existingSeparators.find((s) => s.includes(","));
	if (sample) return sample;
	if (prefix.includes("\n")) {
		const m = prefix.match(/\n([ \t]*)$/);
		return `,\n${m ? m[1] : "  "}`;
	}
	return ", ";
}
/**
* Duplicate the element at `index` in `export default [...]`, inserting the
* copy immediately after the original. Reuses an existing inter-element
* separator when one is available so the cloned entry matches the surrounding
* indentation. Returns `null` when the default export isn't an array literal
* or `index` is out of range.
*/
function duplicatePageInDefaultExportInSource(source, index) {
	const found = findDefaultExportArray(source);
	if (!found) return null;
	const { elements, arrayStart, arrayEnd } = found;
	const n = elements.length;
	if (!Number.isInteger(index) || index < 0 || index >= n) return null;
	const prefix = source.slice(arrayStart, elements[0].start);
	const suffix = source.slice(elements[n - 1].end, arrayEnd);
	const separators = [];
	for (let i = 0; i < n - 1; i++) separators.push(source.slice(elements[i].end, elements[i + 1].start));
	const elementText = elements.map((el) => source.slice(el.start, el.end));
	const insertSep = chooseInsertSeparator(prefix, separators);
	const newElements = [];
	const newSeparators = [];
	for (let i = 0; i < n; i++) {
		newElements.push(elementText[i]);
		if (i === index) {
			newElements.push(elementText[i]);
			newSeparators.push(insertSep);
		}
		if (i < n - 1) newSeparators.push(separators[i]);
	}
	let rebuilt = prefix + newElements[0];
	for (let i = 1; i < newElements.length; i++) rebuilt += newSeparators[i - 1] + newElements[i];
	rebuilt += suffix;
	return source.slice(0, arrayStart) + rebuilt + source.slice(arrayEnd);
}
//#endregion
//#region src/files/short-id.ts
function shortId(prefix) {
	return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}
//#endregion
//#region src/files/folders.ts
const FOLDER_ID_RE = /^f-[a-f0-9]{8}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
function foldersManifestPath(slidesRoot) {
	return path.join(slidesRoot, ".folders.json");
}
function emptyManifest() {
	return {
		folders: [],
		assignments: {}
	};
}
async function readManifest(file) {
	try {
		const raw = await fs.readFile(file, "utf8");
		const parsed = JSON.parse(raw);
		return {
			folders: Array.isArray(parsed.folders) ? parsed.folders : [],
			assignments: parsed.assignments && typeof parsed.assignments === "object" ? parsed.assignments : {}
		};
	} catch (err) {
		if (err.code === "ENOENT") return emptyManifest();
		throw err;
	}
}
async function writeManifest(file, manifest) {
	await fs.mkdir(path.dirname(file), { recursive: true });
	await fs.writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
function newFolderId() {
	return shortId("f");
}
function validateName(v) {
	if (typeof v !== "string") return null;
	const trimmed = v.trim();
	if (trimmed.length < 1 || trimmed.length > 40) return null;
	return trimmed;
}
function validateReorder(v, current) {
	if (!Array.isArray(v) || v.length !== current.length) return null;
	const known = new Set(current.map((f) => f.id));
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const id of v) {
		if (typeof id !== "string" || !FOLDER_ID_RE.test(id)) return null;
		if (!known.has(id) || seen.has(id)) return null;
		seen.add(id);
		out.push(id);
	}
	return out;
}
function validateIcon(v) {
	if (!v || typeof v !== "object") return null;
	const icon = v;
	if (icon.type === "emoji") {
		if (typeof icon.value !== "string") return null;
		if (icon.value.length < 1 || icon.value.length > 8) return null;
		return {
			type: "emoji",
			value: icon.value
		};
	}
	if (icon.type === "color") {
		if (typeof icon.value !== "string" || !COLOR_RE.test(icon.value)) return null;
		return {
			type: "color",
			value: icon.value
		};
	}
	return null;
}
//#endregion
//#region src/vite/routes/context.ts
function makeContext(opts) {
	const userCwd = opts.userCwd;
	const slidesDir = opts.slidesDir ?? "slides";
	const assetsDir = opts.assetsDir ?? "assets";
	const slidesRoot = path.resolve(userCwd, slidesDir);
	return {
		userCwd,
		slidesDir,
		slidesRoot,
		globalAssetsRoot: path.resolve(userCwd, assetsDir),
		manifestPath: foldersManifestPath(slidesRoot),
		coreVersion: opts.coreVersion
	};
}
async function readBody(req) {
	return await new Promise((resolve, reject) => {
		const chunks = [];
		req.on("data", (c) => chunks.push(c));
		req.on("end", () => {
			const raw = Buffer.concat(chunks).toString("utf8");
			if (!raw) return resolve({});
			try {
				resolve(JSON.parse(raw));
			} catch (e) {
				reject(e);
			}
		});
		req.on("error", reject);
	});
}
function json(res, status, body) {
	res.statusCode = status;
	res.setHeader("content-type", "application/json");
	res.end(JSON.stringify(body));
}
function resolveSlideEntryPath(ctx, slideId) {
	return resolveSlideEntry(ctx.slidesRoot, slideId);
}
async function readSlideSource(file) {
	try {
		return await fs.readFile(file, "utf8");
	} catch (err) {
		if (err.code === "ENOENT") return null;
		throw err;
	}
}
//#endregion
//#region src/vite/routes/update.ts
const PKG = "@open-slide/core";
const CACHE_TTL_MS = 6e5;
const COMMAND_TIMEOUT_MS = 3e5;
let cache = null;
let updateInFlight = null;
function parseSemver(v) {
	const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
	if (!m) return null;
	return [
		Number(m[1]),
		Number(m[2]),
		Number(m[3])
	];
}
function isOutdated(current, latest) {
	const a = parseSemver(current);
	const b = parseSemver(latest);
	if (!a || !b) return false;
	for (let i = 0; i < 3; i++) {
		if (b[i] > a[i]) return true;
		if (b[i] < a[i]) return false;
	}
	return false;
}
async function fetchLatest(now) {
	if (cache && now - cache.at < CACHE_TTL_MS) return cache.latest;
	try {
		const res = await fetch(`https://registry.npmjs.org/${PKG}/latest`, {
			signal: AbortSignal.timeout(3e3),
			headers: { accept: "application/json" }
		});
		if (!res.ok) throw new Error(`registry ${res.status}`);
		const body = await res.json();
		const latest = typeof body.version === "string" ? body.version : null;
		cache = {
			at: now,
			latest
		};
		return latest;
	} catch {
		return cache?.latest ?? null;
	}
}
async function fileExists(file) {
	try {
		await fs.access(file);
		return true;
	} catch {
		return false;
	}
}
const LOCKFILES = [
	["pnpm-lock.yaml", "pnpm"],
	["yarn.lock", "yarn"],
	["bun.lockb", "bun"],
	["bun.lock", "bun"],
	["package-lock.json", "npm"]
];
async function detectPackageManager(cwd) {
	const ua = process.env.npm_config_user_agent ?? "";
	if (ua.startsWith("pnpm")) return "pnpm";
	if (ua.startsWith("yarn")) return "yarn";
	if (ua.startsWith("bun")) return "bun";
	if (ua.startsWith("npm")) return "npm";
	let dir = cwd;
	while (true) {
		for (const [lockfile, pm] of LOCKFILES) if (await fileExists(path.join(dir, lockfile))) return pm;
		const parent = path.dirname(dir);
		if (parent === dir) return "npm";
		dir = parent;
	}
}
function updateCommandFor(packageManager) {
	switch (packageManager) {
		case "pnpm": return {
			cmd: "pnpm",
			args: ["add", `${PKG}@latest`]
		};
		case "yarn": return {
			cmd: "yarn",
			args: ["add", `${PKG}@latest`]
		};
		case "bun": return {
			cmd: "bun",
			args: ["add", `${PKG}@latest`]
		};
		case "npm": return {
			cmd: "npm",
			args: ["install", `${PKG}@latest`]
		};
	}
}
function localOpenSlideCommand(cwd) {
	const bin = process.platform === "win32" ? "open-slide.cmd" : "open-slide";
	return {
		cmd: path.join(cwd, "node_modules", ".bin", bin),
		args: ["sync:skills"]
	};
}
function formatCommand(spec) {
	return [spec.cmd, ...spec.args].join(" ");
}
async function runCommand(spec, cwd) {
	await new Promise((resolve, reject) => {
		const child = spawn(spec.cmd, spec.args, {
			cwd,
			env: process.env,
			shell: process.platform === "win32",
			stdio: [
				"ignore",
				"ignore",
				"pipe"
			]
		});
		let stderr = "";
		const timer = setTimeout(() => {
			child.kill();
			reject(/* @__PURE__ */ new Error(`${formatCommand(spec)} timed out`));
		}, COMMAND_TIMEOUT_MS);
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString("utf8");
			if (stderr.length > 2e3) stderr = stderr.slice(-2e3);
		});
		child.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			if (code === 0) {
				resolve();
				return;
			}
			const detail = stderr.trim();
			reject(new Error(detail || `${formatCommand(spec)} exited with code ${code ?? "unknown"}`));
		});
	});
}
async function updatePackage(ctx) {
	const packageManager = await detectPackageManager(ctx.userCwd);
	const updateCommand = updateCommandFor(packageManager);
	const syncCommand = localOpenSlideCommand(ctx.userCwd);
	await runCommand(updateCommand, ctx.userCwd);
	await runCommand(syncCommand, ctx.userCwd);
	cache = null;
	const latest = await fetchLatest(Date.now());
	return {
		packageManager,
		command: `${formatCommand(updateCommand)} && open-slide sync:skills`,
		latest,
		message: "Updated @open-slide/core and synced skills."
	};
}
function registerUpdateRoutes(server, ctx) {
	server.middlewares.use("/__update-check", async (req, res, next) => {
		if ((req.method ?? "GET") !== "GET") return next();
		const latest = await fetchLatest(Date.now());
		const result = {
			current: ctx.coreVersion,
			latest,
			outdated: latest ? isOutdated(ctx.coreVersion, latest) : false
		};
		res.setHeader("cache-control", "no-store");
		json(res, 200, result);
	});
	server.middlewares.use("/__update-package", async (req, res, next) => {
		if ((req.method ?? "GET") !== "POST") return next();
		const guard = validateMutationRequest(req);
		if (!guard.ok) return json(res, guard.status, { error: guard.error });
		try {
			updateInFlight ??= updatePackage(ctx).finally(() => {
				updateInFlight = null;
			});
			json(res, 200, await updateInFlight);
		} catch (err) {
			json(res, 500, { error: err instanceof Error ? err.message : "update failed" });
		}
	});
}
//#endregion
export { reorderDefaultExportPagesInSource as C, updateMetaTitleInSource as D, rmSlideDir as E, validateSlideName as O, removePageFromDefaultExportInSource as S, resolveSlideEntry as T, SLIDE_ID_RE as _, readBody as a, duplicateSlideDir as b, FOLDER_ID_RE as c, readManifest as d, validateIcon as f, shortId as g, writeManifest as h, makeContext as i, validateMutationRequest as k, foldersManifestPath as l, validateReorder as m, registerUpdateRoutes as n, readSlideSource as o, validateName as p, json as r, resolveSlideEntryPath as s, detectPackageManager as t, newFolderId as u, duplicateNotesElementInSource as v, reorderNotesArrayInSource as w, removeNotesElementInSource as x, duplicatePageInDefaultExportInSource as y };
