import { n as defaultDesign } from "./design-Cpqx7SJs.js";
import { C as reorderDefaultExportPagesInSource, D as updateMetaTitleInSource, E as rmSlideDir, O as validateSlideName, S as removePageFromDefaultExportInSource, T as resolveSlideEntry, _ as SLIDE_ID_RE, a as readBody, b as duplicateSlideDir, c as FOLDER_ID_RE, d as readManifest, f as validateIcon, g as shortId, h as writeManifest, i as makeContext, k as validateMutationRequest, l as foldersManifestPath, m as validateReorder, n as registerUpdateRoutes, o as readSlideSource, p as validateName, r as json, s as resolveSlideEntryPath, u as newFolderId, y as duplicatePageInDefaultExportInSource } from "./update-moCkSyvg.js";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import { parse } from "@babel/parser";
import { randomUUID } from "node:crypto";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import * as t from "@babel/types";
import { isJSXElement, isJSXFragment } from "@babel/types";
import fg from "fast-glob";
import { loadConfigFromFile, normalizePath } from "vite";
//#region src/editing/babel-walk.ts
const SKIP_KEYS = /* @__PURE__ */ new Set([
	"loc",
	"start",
	"end",
	"type",
	"extra",
	"leadingComments",
	"trailingComments",
	"innerComments"
]);
function walk(ast, visit, accept) {
	let stopped = false;
	const recurse = (node) => {
		if (stopped || !node || typeof node !== "object") return;
		if (Array.isArray(node)) {
			for (const c of node) recurse(c);
			return;
		}
		const n = node;
		if (typeof n.type !== "string") return;
		if (accept(n) && visit(n) === "stop") {
			stopped = true;
			return;
		}
		for (const key of Object.keys(n)) {
			if (SKIP_KEYS.has(key)) continue;
			recurse(n[key]);
		}
	};
	recurse(ast);
}
const isJsx = (n) => isJSXElement(n) || isJSXFragment(n);
const acceptAll = () => true;
function walkJsx(ast, visit) {
	walk(ast, visit, isJsx);
}
function walkAll(ast, visit) {
	walk(ast, visit, acceptAll);
}
/** Parse with error recovery; recoverable syntax errors are kept in `errors`. */
function tryParse(source) {
	try {
		return parse(source, {
			sourceType: "module",
			plugins: ["typescript", "jsx"],
			errorRecovery: true
		});
	} catch {
		return null;
	}
}
/** `tryParse`, but a source with any recovered error is rejected outright. */
function parseSource(source) {
	const ast = tryParse(source);
	if (!ast) return null;
	return ast.errors && ast.errors.length > 0 ? null : ast;
}
/** JSX nodes enclosing (line, column), innermost first. */
function findJsxAncestors(ast, line, column) {
	const hits = [];
	walkJsx(ast, (n) => {
		if (!n.loc || !isJSXElement(n) && !isJSXFragment(n)) return;
		const s = n.loc.start;
		const e = n.loc.end;
		const afterStart = line > s.line || line === s.line && column >= s.column;
		const beforeEnd = line < e.line || line === e.line && column < e.column;
		if (afterStart && beforeEnd) hits.push({
			node: n,
			size: (n.end ?? 0) - (n.start ?? 0)
		});
	});
	hits.sort((a, b) => a.size - b.size);
	return hits.map((h) => h.node);
}
//#endregion
//#region src/app/lib/text-diff.ts
function textDiff(prevText, nextText) {
	let start = 0;
	while (start < prevText.length && start < nextText.length && prevText[start] === nextText[start]) start += 1;
	let prevEnd = prevText.length;
	let nextEnd = nextText.length;
	while (prevEnd > start && nextEnd > start && prevText[prevEnd - 1] === nextText[nextEnd - 1]) {
		prevEnd -= 1;
		nextEnd -= 1;
	}
	return {
		start,
		end: prevEnd,
		value: nextText.slice(start, nextEnd)
	};
}
//#endregion
//#region src/editing/edit-ops.ts
function jsString(s) {
	return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n")}'`;
}
function spliceRange(node, text) {
	return {
		from: node.start ?? 0,
		to: node.end ?? 0,
		text
	};
}
function applySplices(source, splices) {
	const ordered = [...splices].sort((a, b) => b.from - a.from);
	let next = source;
	for (const sp of ordered) next = next.slice(0, sp.from) + sp.text + next.slice(sp.to);
	if (!parseSource(next)) return {
		ok: false,
		status: 422,
		error: "edit would produce invalid source"
	};
	return {
		ok: true,
		source: next
	};
}
function formatJsxAttrValue(value) {
	if (/^[^"\\<>&{}\n\r]*$/.test(value)) return `"${value}"`;
	return `{${jsString(value)}}`;
}
function jsxAttrName(attr) {
	return t.isJSXIdentifier(attr.name) ? attr.name.name : null;
}
function findJsxAttr(opening, name) {
	for (const attr of opening.attributes) if (t.isJSXAttribute(attr) && jsxAttrName(attr) === name) return attr;
	return null;
}
function readJsxStringAttr(opening, name) {
	const v = findJsxAttr(opening, name)?.value;
	if (!v) return null;
	if (t.isStringLiteral(v)) return v.value;
	if (t.isJSXExpressionContainer(v) && t.isStringLiteral(v.expression)) return v.expression.value;
	return null;
}
function readJsxNumberAttr(opening, name) {
	const v = findJsxAttr(opening, name)?.value;
	if (!v || !t.isJSXExpressionContainer(v)) return null;
	if (!t.isNumericLiteral(v.expression)) return null;
	const n = v.expression.value;
	return Number.isFinite(n) ? n : null;
}
function findImports$1(ast) {
	const out = [];
	for (const node of ast.program.body) {
		if (!t.isImportDeclaration(node)) continue;
		let def = null;
		for (const spec of node.specifiers) if (t.isImportDefaultSpecifier(spec)) {
			def = spec.local.name;
			break;
		}
		out.push({
			node,
			source: node.source.value,
			defaultIdent: def
		});
	}
	return out;
}
function collectTopLevelIdentifiers(ast) {
	const names = /* @__PURE__ */ new Set();
	for (const imp of findImports$1(ast)) {
		if (imp.defaultIdent) names.add(imp.defaultIdent);
		for (const spec of imp.node.specifiers) if (!t.isImportDefaultSpecifier(spec)) names.add(spec.local.name);
	}
	return names;
}
function safeAssetIdentifier(filename, taken) {
	const stem = filename.replace(/\.[^.]+$/, "");
	let camel = "";
	let upper = false;
	for (const ch of stem) if (/[A-Za-z0-9]/.test(ch)) {
		camel += upper ? ch.toUpperCase() : ch;
		upper = false;
	} else upper = camel.length > 0;
	let base = camel;
	if (!base || !/^[A-Za-z_$]/.test(base)) base = `asset${base.charAt(0).toUpperCase()}${base.slice(1)}` || "asset";
	base = base.charAt(0).toLowerCase() + base.slice(1);
	let candidate = base;
	let i = 2;
	while (taken.has(candidate)) {
		candidate = `${base}${i}`;
		i += 1;
	}
	return candidate;
}
function findJsxByStart(ast, line, column) {
	let hit = null;
	walkJsx(ast, (n) => {
		if (!t.isJSXElement(n) || !n.loc) return;
		const s = n.loc.start;
		if (s.line === line && s.column === column) {
			hit = n;
			return "stop";
		}
	});
	return hit;
}
function findInnermostJsxElement(ast, line, column) {
	const exact = findJsxByStart(ast, line, column);
	if (exact) return exact;
	for (const n of findJsxAncestors(ast, line, column)) if (t.isJSXElement(n)) return n;
	return null;
}
function findUniqueElementByText(ast, prevText) {
	const hits = [];
	walkJsx(ast, (n) => {
		if (!t.isJSXElement(n)) return;
		if (textRangeContent(collectTextRangeParts(n)) !== prevText) return;
		hits.push({
			node: n,
			size: (n.end ?? 0) - (n.start ?? 0)
		});
	});
	if (hits.length === 0) return null;
	hits.sort((a, b) => a.size - b.size);
	const best = hits[0];
	const bestStart = best.node.start ?? 0;
	const bestEnd = best.node.end ?? 0;
	return hits.slice(1).some(({ node }) => (node.start ?? 0) > bestStart || (node.end ?? 0) < bestEnd) ? null : best.node;
}
function fallbackTextForOps(ops) {
	for (const op of ops) if ((op.kind === "set-style" || op.kind === "set-text" || op.kind === "set-text-range-style") && op.prevText !== void 0) return op.prevText;
	return null;
}
function hasOnlyTextOps(ops) {
	return ops.length > 0 && ops.every((op) => op.kind === "set-text");
}
function elementTextMatches(element, prevText) {
	return textRangeContent(collectTextRangeParts(element)) === prevText;
}
function findElementForEdit(ast, line, column, ops) {
	const element = findInnermostJsxElement(ast, line, column);
	const prevText = fallbackTextForOps(ops);
	if (prevText === null) return element;
	if (hasOnlyTextOps(ops) && element && (elementTextMatches(element, prevText) || elementTextCandidateMatches(ast, element, prevText))) return element;
	return findUniqueElementByText(ast, prevText) ?? element;
}
function buildStyleSplice(source, element, ops) {
	const opening = element.openingElement;
	const existing = findJsxAttr(opening, "style");
	const entries = [];
	let hasRawEntry = false;
	if (existing) {
		const value = existing.value;
		if (!value || !t.isJSXExpressionContainer(value)) return { error: "style attribute has unsupported form" };
		const expr = value.expression;
		if (!t.isObjectExpression(expr)) {
			if (typeof expr.start !== "number" || typeof expr.end !== "number") return { error: "style value missing source range" };
			entries.push({
				kind: "raw",
				text: `...(${source.slice(expr.start, expr.end)})`
			});
			hasRawEntry = true;
		} else for (const prop of expr.properties) if (t.isObjectProperty(prop) && !prop.computed) {
			let keyName = null;
			if (t.isIdentifier(prop.key)) keyName = prop.key.name;
			else if (t.isStringLiteral(prop.key)) keyName = prop.key.value;
			if (!keyName) return { error: "style has unsupported key" };
			const v = prop.value;
			if (typeof prop.key.start !== "number" || typeof prop.key.end !== "number" || typeof v.start !== "number" || typeof v.end !== "number") return { error: "style value missing source range" };
			entries.push({
				kind: "prop",
				key: keyName,
				keyText: source.slice(prop.key.start, prop.key.end),
				valueText: source.slice(v.start, v.end)
			});
		} else {
			if (typeof prop.start !== "number" || typeof prop.end !== "number") return { error: "style value missing source range" };
			entries.push({
				kind: "raw",
				text: source.slice(prop.start, prop.end)
			});
			hasRawEntry = true;
		}
	}
	for (const op of ops) {
		const matching = entries.filter((entry) => entry.kind === "prop" && entry.key === op.key);
		if (op.value === null) {
			for (const entry of matching) entries.splice(entries.indexOf(entry), 1);
			if (hasRawEntry) entries.push({
				kind: "prop",
				key: op.key,
				keyText: op.key,
				valueText: "undefined"
			});
		} else if (matching.length > 0) matching[matching.length - 1].valueText = jsString(op.value);
		else entries.push({
			kind: "prop",
			key: op.key,
			keyText: op.key,
			valueText: jsString(op.value)
		});
	}
	if (entries.length === 0) {
		if (!existing) return null;
		let from = existing.start ?? 0;
		if (from > 0 && source[from - 1] === " ") from -= 1;
		return {
			from,
			to: existing.end ?? 0,
			text: ""
		};
	}
	const newAttr = `style={{ ${entries.map((entry) => entry.kind === "prop" ? `${entry.keyText}: ${entry.valueText}` : entry.text).join(", ")} }}`;
	if (existing) {
		const lastAttr = opening.attributes[opening.attributes.length - 1];
		if (lastAttr && lastAttr !== existing && typeof lastAttr.end === "number") {
			const attrsAfterStyle = source.slice(existing.end ?? 0, lastAttr.end).replace(/^[ \t]+/, "");
			return {
				from: existing.start ?? 0,
				to: lastAttr.end,
				text: `${attrsAfterStyle} ${newAttr}`
			};
		}
		return {
			from: existing.start ?? 0,
			to: existing.end ?? 0,
			text: newAttr
		};
	}
	const at = opening.attributes[opening.attributes.length - 1]?.end ?? opening.name.end ?? 0;
	return {
		from: at,
		to: at,
		text: ` ${newAttr}`
	};
}
function formatJsxText(value) {
	if (/[{}<>]/.test(value) || /^\s|\s$/.test(value) || value === "") return `{${jsString(value)}}`;
	return value;
}
function meaningfulChildren(parent) {
	return parent.children.filter((c) => {
		if (t.isJSXText(c)) return c.value.trim() !== "";
		return true;
	});
}
function isOnlyMeaningfulChild(parent, child) {
	const meaningful = meaningfulChildren(parent);
	return meaningful.length === 1 && meaningful[0] === child;
}
function wrapSplice(parent, text) {
	const first = parent.children[0];
	const last = parent.children[parent.children.length - 1];
	return {
		from: first.start ?? 0,
		to: last.end ?? 0,
		text
	};
}
function splitLinesWithOffsets(value) {
	const lines = [];
	let start = 0;
	for (let i = 0; i < value.length; i++) {
		const ch = value[i];
		if (ch !== "\n" && ch !== "\r") continue;
		lines.push({
			text: value.slice(start, i),
			start
		});
		if (ch === "\r" && value[i + 1] === "\n") i += 1;
		start = i + 1;
	}
	lines.push({
		text: value.slice(start),
		start
	});
	return lines;
}
function cleanJsxTextWithOffsets(value) {
	const lines = splitLinesWithOffsets(value);
	let lastNonEmptyLine = 0;
	for (let i = 0; i < lines.length; i++) if (lines[i].text.trim()) lastNonEmptyLine = i;
	let text = "";
	const offsets = [];
	for (let i = 0; i < lines.length; i++) {
		const chars = Array.from(lines[i].text, (ch, j) => ({
			ch: ch === "	" ? " " : ch,
			offset: lines[i].start + j
		}));
		let from = 0;
		let to = chars.length;
		if (i !== 0) while (from < to && chars[from].ch === " ") from += 1;
		if (i !== lines.length - 1) while (to > from && chars[to - 1].ch === " ") to -= 1;
		if (from >= to) continue;
		for (const item of chars.slice(from, to)) {
			text += item.ch;
			offsets.push(item.offset);
		}
		if (i !== lastNonEmptyLine) {
			text += " ";
			offsets.push(null);
		}
	}
	return {
		text,
		offsets
	};
}
function isJsxBrElement(node) {
	if (!t.isJSXElement(node)) return false;
	const name = node.openingElement.name;
	return t.isJSXIdentifier(name) && name.name.toLowerCase() === "br";
}
function collectTextCandidates(element, out) {
	const meaningful = meaningfulChildren(element);
	const isSole = meaningful.length === 1;
	for (const child of meaningful) if (t.isJSXText(child)) {
		const current = child.value.trim();
		if (!current) continue;
		out.push({
			current,
			splice: (v) => isSole ? wrapSplice(element, formatJsxText(v)) : {
				from: child.start ?? 0,
				to: child.end ?? 0,
				text: formatJsxText(v)
			}
		});
	} else if (t.isJSXExpressionContainer(child)) {
		const expr = child.expression;
		if (t.isStringLiteral(expr) || t.isNumericLiteral(expr)) {
			const current = String(expr.value);
			out.push({
				current,
				splice: (v) => isSole ? wrapSplice(element, `{${jsString(v)}}`) : {
					from: child.start ?? 0,
					to: child.end ?? 0,
					text: `{${jsString(v)}}`
				}
			});
		}
	} else if (t.isJSXElement(child) || t.isJSXFragment(child)) collectTextCandidates(child, out);
}
function collectTextRangeParts(element) {
	const parts = [];
	collectTextRangePartsRaw(element, parts);
	return normalizeTextRangeParts(parts);
}
function collectTextRangePartsRaw(element, out) {
	for (const child of element.children) if (t.isJSXText(child)) {
		const { text: current, offsets } = cleanJsxTextWithOffsets(child.value);
		if (current) out.push({
			node: child,
			parent: element,
			current,
			raw: child.value,
			text: formatJsxText,
			offsets
		});
	} else if (t.isJSXExpressionContainer(child)) {
		const expression = child.expression;
		if (t.isStringLiteral(expression) || t.isNumericLiteral(expression)) {
			const raw = String(expression.value);
			const current = raw;
			if (current) out.push({
				node: child,
				parent: element,
				current,
				raw,
				text: (value) => `{${jsString(value)}}`,
				offsets: Array.from({ length: current.length }, (_, i) => i)
			});
		}
	} else if (isJsxBrElement(child)) out.push({
		node: child,
		current: "\n"
	});
	else if (t.isJSXElement(child) || t.isJSXFragment(child)) collectTextRangePartsRaw(child, out);
}
function normalizeTextRangeParts(parts) {
	return parts.flatMap((part, index) => {
		if (!("raw" in part)) return [part];
		let start = 0;
		let end = part.current.length;
		if (parts[index - 1]?.current === "\n") while (start < end && /\s/.test(part.current[start] ?? "")) start++;
		if (parts[index + 1]?.current === "\n") while (end > start && /\s/.test(part.current[end - 1] ?? "")) end--;
		if (start === 0 && end === part.current.length) return [part];
		if (start >= end) return [];
		return [{
			...part,
			current: part.current.slice(start, end),
			offsets: part.offsets.slice(start, end)
		}];
	});
}
function resetValueForRangeStyle(key) {
	if (key === "fontWeight") return "400";
	if (key === "fontStyle") return "normal";
	return null;
}
function styleSpanForText(text, key, value) {
	const styleValue = value ?? resetValueForRangeStyle(key);
	if (styleValue === null) return formatJsxText(text);
	return `<span style={{ ${key}: ${jsString(styleValue)} }}>${formatJsxText(text)}</span>`;
}
function textRangeContent(parts) {
	return parts.map((part) => part.current).join("");
}
function compactText(value) {
	return value.replace(/\s+/g, "");
}
function textMatchesExpected(current, expected) {
	return current === expected || compactText(current) === compactText(expected);
}
function formatRichText(value, formatText = formatJsxText) {
	return value.split("\n").map((part) => formatText(part)).join("<br />");
}
function formatOptionalText(value, formatText) {
	return value ? formatText(value) : "";
}
function textLeafSplice(part, value) {
	const rawRange = textLeafRawRange(part, 0, part.current.length);
	if (!rawRange) return spliceRange(part.node, part.text(value));
	const { rawStart, rawEnd } = rawRange;
	return {
		from: part.node.start ?? 0,
		to: part.node.end ?? 0,
		text: `${part.raw.slice(0, rawStart)}${formatRichText(value, part.text)}${part.raw.slice(rawEnd)}`
	};
}
function textLeafRawRange(part, start, end) {
	if (start >= end) return null;
	let first = null;
	let last = null;
	for (let i = start; i < end; i++) {
		const offset = part.offsets[i];
		if (offset === void 0) return null;
		if (offset === null) continue;
		first ??= offset;
		last = offset;
	}
	if (first === null || last === null) return null;
	return {
		rawStart: first,
		rawEnd: last + 1
	};
}
function buildTextRangeReplaceSplices(parts, start, end, value) {
	const splices = [];
	let offset = 0;
	let inserted = false;
	for (const part of parts) {
		const partStart = offset;
		const partEnd = partStart + part.current.length;
		offset = partEnd;
		const overlaps = start < partEnd && end > partStart;
		const insertsHere = start === end && !inserted && start >= partStart && start <= partEnd;
		if (!overlaps && !insertsHere) continue;
		if ("raw" in part) {
			const localStart = Math.max(start, partStart) - partStart;
			const localEnd = overlaps ? Math.min(end, partEnd) - partStart : localStart;
			const nextText = `${part.current.slice(0, localStart)}${inserted ? "" : value}${part.current.slice(localEnd)}`;
			splices.push(textLeafSplice(part, nextText));
		} else if (overlaps) splices.push(spliceRange(part.node, inserted ? "" : formatRichText(value)));
		else if (insertsHere) {
			const at = start === partStart ? part.node.start ?? 0 : part.node.end ?? 0;
			splices.push({
				from: at,
				to: at,
				text: formatRichText(value)
			});
		}
		inserted = true;
	}
	if (!inserted && start === end && start === offset) {
		const last = parts[parts.length - 1];
		if (!last) return { error: "element has no editable text" };
		if ("raw" in last) splices.push(textLeafSplice(last, `${last.current}${value}`));
		else splices.push({
			from: last.node.end ?? 0,
			to: last.node.end ?? 0,
			text: formatRichText(value)
		});
	}
	return splices;
}
function buildTextContentSplices(element, value, prevText) {
	const parts = collectTextRangeParts(element);
	const current = textRangeContent(parts);
	if (!textMatchesExpected(current, prevText)) return { error: "no text candidate matches the current value" };
	const diff = textDiff(current, value);
	if (diff.start === diff.end && diff.value === "") return [];
	return buildTextRangeReplaceSplices(parts, diff.start, diff.end, diff.value);
}
function buildTextRangeStyleSplices(ast, source, element, start, end, op, prevText) {
	if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start) return { error: "invalid text range" };
	const parts = collectTextRangeParts(element);
	const renderedText = textRangeContent(parts);
	const current = prevText ?? renderedText;
	if (!current) return { error: "element has no editable text" };
	if (end > current.length) return { error: "text range is out of bounds" };
	if (prevText !== void 0 && renderedText !== prevText) {
		if (elementTextCandidateMatches(ast, element, prevText)) {
			const result = buildStyleSplice(source, element, [op]);
			if (result && "error" in result) return result;
			return result ? [result] : [];
		}
		return { error: "no text candidate matches the current value" };
	}
	const splices = [];
	let leafStart = 0;
	for (const leaf of parts) {
		const leafEnd = leafStart + leaf.current.length;
		if (!("raw" in leaf)) {
			leafStart = leafEnd;
			continue;
		}
		const selectedStart = Math.max(start, leafStart);
		const selectedEnd = Math.min(end, leafEnd);
		if (selectedStart >= selectedEnd) {
			leafStart = leafEnd;
			continue;
		}
		if (selectedStart === leafStart && selectedEnd === leafEnd && t.isJSXElement(leaf.parent) && leaf.parent !== element && isOnlyMeaningfulChild(leaf.parent, leaf.node)) {
			const result = buildStyleSplice(source, leaf.parent, [op]);
			if (result && "error" in result) return result;
			if (result) splices.push(result);
			leafStart = leafEnd;
			continue;
		}
		const localStart = selectedStart - leafStart;
		const localEnd = selectedEnd - leafStart;
		const rawRange = textLeafRawRange(leaf, localStart, localEnd);
		if (!rawRange) return { error: "text range source mismatch" };
		const raw = leaf.raw;
		const { rawStart, rawEnd } = rawRange;
		const before = raw.slice(0, rawStart);
		const selected = leaf.current.slice(localStart, localEnd);
		const after = raw.slice(rawEnd);
		const beforeText = t.isJSXText(leaf.node) ? before : formatOptionalText(before, leaf.text);
		const afterText = t.isJSXText(leaf.node) ? after : formatOptionalText(after, leaf.text);
		splices.push(spliceRange(leaf.node, `${beforeText}${styleSpanForText(selected, op.key, op.value)}${afterText}`));
		leafStart = leafEnd;
	}
	return splices.length > 0 ? splices : null;
}
function propPassthroughName(element) {
	const meaningful = meaningfulChildren(element);
	if (meaningful.length !== 1) return null;
	const child = meaningful[0];
	if (!t.isJSXExpressionContainer(child)) return null;
	return t.isIdentifier(child.expression) ? child.expression.name : null;
}
function findEnclosingComponent(ast, target) {
	let best = null;
	let bestSize = Number.POSITIVE_INFINITY;
	const targetStart = target.start ?? 0;
	const targetEnd = target.end ?? 0;
	const consider = (name, fn) => {
		if (!/^[A-Z]/.test(name)) return;
		const fnStart = fn.start ?? 0;
		const fnEnd = fn.end ?? 0;
		if (fnStart > targetStart || fnEnd < targetEnd) return;
		const size = fnEnd - fnStart;
		if (size < bestSize) {
			best = {
				name,
				fn
			};
			bestSize = size;
		}
	};
	const visitDecl = (decl) => {
		if (t.isFunctionDeclaration(decl) && decl.id) consider(decl.id.name, decl);
		else if (t.isVariableDeclaration(decl)) for (const d of decl.declarations) {
			if (!t.isVariableDeclarator(d) || !t.isIdentifier(d.id) || !d.init) continue;
			if (t.isArrowFunctionExpression(d.init) || t.isFunctionExpression(d.init)) consider(d.id.name, d.init);
		}
	};
	for (const decl of ast.program.body) {
		visitDecl(decl);
		if (t.isExportNamedDeclaration(decl) || t.isExportDefaultDeclaration(decl)) {
			const inner = decl.declaration;
			if (inner && (t.isStatement(inner) || t.isFunctionDeclaration(inner))) visitDecl(inner);
		}
	}
	return best;
}
function componentDestructuresProp(fn, propName) {
	if (fn.params.length === 0) return false;
	let first = fn.params[0];
	if (t.isAssignmentPattern(first)) first = first.left;
	if (!t.isObjectPattern(first)) return false;
	for (const prop of first.properties) {
		if (!t.isObjectProperty(prop)) continue;
		if (t.isIdentifier(prop.key) && prop.key.name === propName) return true;
		if (t.isStringLiteral(prop.key) && prop.key.value === propName) return true;
	}
	return false;
}
function collectCallSiteCandidates(ast, componentName) {
	const out = [];
	walkJsx(ast, (n) => {
		if (!t.isJSXElement(n)) return;
		const elName = n.openingElement.name;
		if (t.isJSXIdentifier(elName) && elName.name === componentName) collectTextCandidates(n, out);
	});
	return out;
}
function collectPropCallSiteCandidates(ast, componentName, propName) {
	const out = [];
	walkJsx(ast, (n) => {
		if (!t.isJSXElement(n)) return;
		const elName = n.openingElement.name;
		if (!t.isJSXIdentifier(elName) || elName.name !== componentName) return;
		const attr = findJsxAttr(n.openingElement, propName);
		if (!attr?.value) return;
		const v = attr.value;
		if (t.isStringLiteral(v)) out.push({
			current: v.value,
			splice: (s) => spliceRange(v, formatJsxAttrValue(s))
		});
		else if (t.isJSXExpressionContainer(v)) {
			const expr = v.expression;
			if (t.isStringLiteral(expr) || t.isNumericLiteral(expr)) out.push({
				current: String(expr.value),
				splice: (s) => spliceRange(v, formatJsxAttrValue(s))
			});
		}
	});
	return out;
}
function findEnclosingMapCallback(ast, target) {
	let best = null;
	const targetStart = target.start ?? 0;
	const targetEnd = target.end ?? 0;
	walkAll(ast, (node) => {
		if (!t.isCallExpression(node)) return;
		const callee = node.callee;
		if (!t.isMemberExpression(callee) || callee.computed) return;
		if (!t.isIdentifier(callee.property)) return;
		if (callee.property.name !== "map" && callee.property.name !== "flatMap") return;
		const fn = node.arguments[0];
		if (!fn || !t.isArrowFunctionExpression(fn) && !t.isFunctionExpression(fn)) return;
		const fnStart = fn.start ?? 0;
		const fnEnd = fn.end ?? 0;
		if (fnStart > targetStart || fnEnd < targetEnd) return;
		if (!t.isExpression(callee.object)) return;
		const size = fnEnd - fnStart;
		if (!best || size < best.size) best = {
			fn,
			arrayArg: callee.object,
			size
		};
	});
	if (!best) return null;
	const found = best;
	return {
		fn: found.fn,
		arrayArg: found.arrayArg
	};
}
function resolveArrayLiteralElements(ast, expr) {
	const dropHoles = (arr) => arr.elements.filter((e) => e != null);
	if (t.isArrayExpression(expr)) return dropHoles(expr);
	if (!t.isIdentifier(expr)) return null;
	const name = expr.name;
	const useStart = expr.start ?? 0;
	let init = null;
	walkAll(ast, (node) => {
		if (!t.isVariableDeclarator(node)) return;
		if (!t.isIdentifier(node.id) || node.id.name !== name) return;
		if (!node.init || !t.isArrayExpression(node.init)) return;
		if ((node.init.start ?? 0) > useStart) return;
		init = node.init;
	});
	return init ? dropHoles(init) : null;
}
function findObjectProperty(obj, name) {
	if (!t.isObjectExpression(obj)) return null;
	for (const prop of obj.properties) {
		if (!t.isObjectProperty(prop) || prop.computed) continue;
		if (t.isIdentifier(prop.key) && prop.key.name === name) return prop;
		if (t.isStringLiteral(prop.key) && prop.key.value === name) return prop;
	}
	return null;
}
function decodeMapPassthrough(element, callbackParam) {
	const meaningful = meaningfulChildren(element);
	if (meaningful.length !== 1) return null;
	const child = meaningful[0];
	if (!t.isJSXExpressionContainer(child)) return null;
	const expr = child.expression;
	if (t.isMemberExpression(expr)) {
		if (expr.computed) return null;
		if (!t.isIdentifier(expr.object) || !t.isIdentifier(expr.property)) return null;
		if (!callbackParam || !t.isIdentifier(callbackParam)) return null;
		if (callbackParam.name !== expr.object.name) return null;
		return expr.property.name;
	}
	if (t.isIdentifier(expr)) {
		const fieldName = expr.name;
		if (!callbackParam || !t.isObjectPattern(callbackParam)) return null;
		for (const prop of callbackParam.properties) {
			if (!t.isObjectProperty(prop) || prop.computed) continue;
			if (!t.isIdentifier(prop.key) || prop.key.name !== fieldName) continue;
			return t.isIdentifier(prop.value) && prop.value.name === fieldName ? fieldName : null;
		}
	}
	return null;
}
function collectArrayMapCandidates(ast, element) {
	const ctx = findEnclosingMapCallback(ast, element);
	if (!ctx) return [];
	const fieldName = decodeMapPassthrough(element, ctx.fn.params[0]);
	if (!fieldName) return [];
	const elements = resolveArrayLiteralElements(ast, ctx.arrayArg);
	if (!elements) return [];
	const out = [];
	for (const obj of elements) {
		const prop = findObjectProperty(obj, fieldName);
		if (!prop) continue;
		const v = prop.value;
		if (t.isStringLiteral(v)) out.push({
			current: v.value,
			splice: (s) => spliceRange(v, jsString(s))
		});
		else if (t.isNumericLiteral(v)) out.push({
			current: String(v.value),
			splice: (s) => spliceRange(v, jsString(s))
		});
	}
	return out;
}
function collectElementTextCandidates(ast, element) {
	const candidates = [];
	collectTextCandidates(element, candidates);
	if (candidates.length === 0) {
		const passthrough = propPassthroughName(element);
		const enclosing = passthrough ? findEnclosingComponent(ast, element) : null;
		if (passthrough === "children" && enclosing) candidates.push(...collectCallSiteCandidates(ast, enclosing.name));
		else if (passthrough && enclosing && componentDestructuresProp(enclosing.fn, passthrough)) candidates.push(...collectPropCallSiteCandidates(ast, enclosing.name, passthrough));
	}
	if (candidates.length === 0) candidates.push(...collectArrayMapCandidates(ast, element));
	return candidates;
}
function elementTextCandidateMatches(ast, element, prevText) {
	const norm = prevText.trim();
	return collectElementTextCandidates(ast, element).some((candidate) => candidate.current === norm);
}
function buildTextSplice(ast, element, value, prevText) {
	const candidates = collectElementTextCandidates(ast, element);
	if (candidates.length === 0) return { error: "element has no editable text" };
	if (candidates.length === 1) return candidates[0].splice(value);
	if (prevText === void 0) return { error: "element has multiple text candidates; missing prevText" };
	const norm = prevText.trim();
	const matches = candidates.filter((c) => c.current === norm);
	if (matches.length === 0) return { error: "no text candidate matches the current value" };
	if (matches.length > 1) return { error: "multiple text candidates share the same value; cannot disambiguate" };
	return matches[0].splice(value);
}
function planAssetImport(ast, assetPath) {
	const imports = findImports$1(ast);
	for (const imp of imports) if (imp.source === assetPath && imp.defaultIdent) return {
		identifier: imp.defaultIdent,
		importSplice: null
	};
	const identifier = safeAssetIdentifier(assetPath.slice(assetPath.lastIndexOf("/") + 1), collectTopLevelIdentifiers(ast));
	const importStmt = `import ${identifier} from '${assetPath.replace(/'/g, "\\'")}';\n`;
	const last = imports[imports.length - 1];
	const insertAt = last ? last.node.end ?? 0 : 0;
	return {
		identifier,
		importSplice: {
			from: insertAt,
			to: insertAt,
			text: (last ? "\n" : "") + importStmt
		}
	};
}
function planAssetAttr(ast, element, attr, assetPath) {
	if (!attr || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(attr)) return { error: "invalid attribute name" };
	if (!assetPath.startsWith("./assets/") && !assetPath.startsWith("@assets/")) return { error: "asset path must start with ./assets/ or @assets/" };
	const { identifier, importSplice } = planAssetImport(ast, assetPath);
	const opening = element.openingElement;
	const newAttr = `${attr}={${identifier}}`;
	const existing = findJsxAttr(opening, attr);
	return {
		importSplice,
		attrSplice: existing ? {
			from: existing.start ?? 0,
			to: existing.end ?? 0,
			text: newAttr
		} : {
			from: opening.name.end ?? 0,
			to: opening.name.end ?? 0,
			text: ` ${newAttr}`
		}
	};
}
function planReplacePlaceholder(ast, element, assetPath) {
	const opening = element.openingElement;
	if (!t.isJSXIdentifier(opening.name) || opening.name.name !== "ImagePlaceholder") return { error: "not a placeholder" };
	if (!assetPath.startsWith("./assets/") && !assetPath.startsWith("@assets/")) return { error: "asset path must start with ./assets/ or @assets/" };
	const hint = readJsxStringAttr(opening, "hint") ?? "";
	const width = readJsxNumberAttr(opening, "width");
	const height = readJsxNumberAttr(opening, "height");
	const { identifier, importSplice } = planAssetImport(ast, assetPath);
	const styleParts = [];
	if (width != null) styleParts.push(`width: ${width}`);
	else if (height != null) styleParts.push(`width: '100%'`);
	if (height != null) styleParts.push(`height: ${height}`);
	else if (width != null) styleParts.push(`height: '100%'`);
	styleParts.push(`objectFit: 'cover'`);
	styleParts.push(`objectPosition: '50% 50%'`);
	return {
		importSplice,
		elementSplice: spliceRange(element, `<img src={${identifier}} alt=${jsString(hint)} style={{ ${styleParts.join(", ")} }} />`)
	};
}
function applyEdit(source, line, column, ops) {
	const plan = planEdit(source, line, column, ops);
	if (!plan.ok) return plan;
	return plan.splices.length ? applySplices(source, plan.splices) : {
		ok: true,
		source
	};
}
function planEdit(source, line, column, ops, exactLocation = false) {
	if (ops.length === 0) return {
		ok: true,
		splices: []
	};
	const ast = parseSource(source);
	if (!ast) return {
		ok: false,
		status: 422,
		error: "could not parse source"
	};
	const element = exactLocation ? findJsxByStart(ast, line, column) : findElementForEdit(ast, line, column, ops);
	if (!element) return {
		ok: false,
		status: 422,
		error: "no JSX element at location"
	};
	const splices = [];
	const styleOps = ops.flatMap((op) => op.kind === "set-style" ? [{
		key: op.key,
		value: op.value
	}] : []);
	if (styleOps.length > 0) {
		const result = buildStyleSplice(source, element, styleOps);
		if (result && "error" in result) return {
			ok: false,
			status: 422,
			error: result.error
		};
		if (result) splices.push(result);
	}
	for (const op of ops) {
		if (op.kind !== "set-text-range-style") continue;
		const result = buildTextRangeStyleSplices(ast, source, element, op.start, op.end, {
			key: op.key,
			value: op.value
		}, op.prevText);
		if (result && "error" in result) return {
			ok: false,
			status: 422,
			error: result.error
		};
		if (result) splices.push(...result);
	}
	for (const op of ops) {
		if (op.kind !== "set-text") continue;
		if (op.prevText !== void 0 && (op.value.includes("\n") || op.prevText.includes("\n"))) {
			const richResult = buildTextContentSplices(element, op.value, op.prevText);
			if (!("error" in richResult)) {
				splices.push(...richResult);
				continue;
			}
		}
		const result = buildTextSplice(ast, element, op.value, op.prevText);
		if ("error" in result) {
			if (op.prevText === void 0) return {
				ok: false,
				status: 422,
				error: result.error
			};
			const richResult = buildTextContentSplices(element, op.value, op.prevText);
			if ("error" in richResult) return {
				ok: false,
				status: 422,
				error: result.error
			};
			splices.push(...richResult);
		} else splices.push(result);
	}
	const assetOps = ops.flatMap((op) => op.kind === "set-attr-asset" ? [op] : []);
	const placeholderOps = ops.flatMap((op) => op.kind === "replace-placeholder-with-image" ? [op] : []);
	if (assetOps.length > 0 || placeholderOps.length > 0) {
		const importSplices = [];
		for (const op of assetOps) {
			const plan = planAssetAttr(ast, element, op.attr, op.assetPath);
			if ("error" in plan) return {
				ok: false,
				status: 422,
				error: plan.error
			};
			splices.push(plan.attrSplice);
			if (plan.importSplice) importSplices.push(plan.importSplice);
		}
		for (const op of placeholderOps) {
			const plan = planReplacePlaceholder(ast, element, op.assetPath);
			if ("error" in plan) return {
				ok: false,
				status: 422,
				error: plan.error
			};
			splices.push(plan.elementSplice);
			if (plan.importSplice) importSplices.push(plan.importSplice);
		}
		if (importSplices.length > 0) {
			const from = importSplices[0].from;
			const to = importSplices[0].to;
			const text = importSplices.map((s) => s.text).join("");
			splices.push({
				from,
				to,
				text
			});
		}
	}
	return {
		ok: true,
		splices
	};
}
//#endregion
//#region src/editing/revert-asset.ts
function collectImgSrcUses(ast, identifier) {
	const uses = [];
	walkJsx(ast, (n) => {
		if (!t.isJSXElement(n)) return;
		const opening = n.openingElement;
		if (!t.isJSXIdentifier(opening.name) || opening.name.name !== "img") return;
		const src = findJsxAttr(opening, "src");
		if (!src?.value) return;
		if (!t.isJSXExpressionContainer(src.value)) return;
		const expr = src.value.expression;
		if (!t.isIdentifier(expr) || expr.name !== identifier) return;
		uses.push({
			element: n,
			identNode: expr
		});
	});
	return uses;
}
function readStyleNumericDim(opening, key) {
	const style = findJsxAttr(opening, "style");
	if (!style?.value) return null;
	if (!t.isJSXExpressionContainer(style.value)) return null;
	const obj = style.value.expression;
	if (!t.isObjectExpression(obj)) return null;
	for (const prop of obj.properties) {
		if (!t.isObjectProperty(prop)) continue;
		if (prop.computed) continue;
		const k = prop.key;
		if ((t.isIdentifier(k) ? k.name : t.isStringLiteral(k) ? k.value : null) !== key) continue;
		const v = prop.value;
		if (t.isNumericLiteral(v) && Number.isFinite(v.value)) return v.value;
		return null;
	}
	return null;
}
function buildPlaceholderReplacement(hint, width, height) {
	const parts = [`hint=${formatJsxAttrValue(hint)}`];
	if (width != null) parts.push(`width={${width}}`);
	if (height != null) parts.push(`height={${height}}`);
	return `<ImagePlaceholder ${parts.join(" ")} />`;
}
function planEnsureImagePlaceholderImport(ast) {
	const readKind = (n) => n.importKind === "type";
	const imports = findImports$1(ast);
	let valueImport = null;
	for (const imp of imports) {
		if (imp.source !== "@open-slide/core") continue;
		const declIsTypeOnly = readKind(imp.node);
		for (const spec of imp.node.specifiers) {
			if (!t.isImportSpecifier(spec)) continue;
			const imported = spec.imported;
			if ((t.isIdentifier(imported) ? imported.name : imported.value) !== "ImagePlaceholder") continue;
			if (!(readKind(spec) || declIsTypeOnly)) return null;
		}
		if (!declIsTypeOnly && !valueImport) valueImport = imp;
	}
	if (valueImport) {
		const node = valueImport.node;
		const lastSpec = node.specifiers[node.specifiers.length - 1];
		if (lastSpec && t.isImportSpecifier(lastSpec)) {
			const insertAt = lastSpec.end ?? 0;
			return {
				from: insertAt,
				to: insertAt,
				text: ", ImagePlaceholder"
			};
		}
		if (lastSpec && t.isImportDefaultSpecifier(lastSpec)) {
			const insertAt = lastSpec.end ?? 0;
			return {
				from: insertAt,
				to: insertAt,
				text: ", { ImagePlaceholder }"
			};
		}
		const insertAt = (node.source.start ?? 0) - 5;
		return {
			from: insertAt,
			to: insertAt,
			text: "{ ImagePlaceholder } "
		};
	}
	return {
		from: 0,
		to: 0,
		text: "import { ImagePlaceholder } from '@open-slide/core';\n"
	};
}
function findAssetUsages(source, assetPath) {
	const ast = parseSource(source);
	if (!ast) return 0;
	const target = findImports$1(ast).find((imp) => imp.source === assetPath && imp.defaultIdent);
	if (!target?.defaultIdent) return 0;
	return collectImgSrcUses(ast, target.defaultIdent).length;
}
function findReferencedAssets(source, assetPaths) {
	const referenced = /* @__PURE__ */ new Set();
	if (assetPaths.length === 0) return referenced;
	const ast = parseSource(source);
	if (!ast) return referenced;
	const wanted = new Set(assetPaths);
	const identToPath = /* @__PURE__ */ new Map();
	const importLocals = /* @__PURE__ */ new Set();
	for (const imp of findImports$1(ast)) {
		if (!imp.defaultIdent) continue;
		if (!wanted.has(imp.source)) continue;
		identToPath.set(imp.defaultIdent, imp.source);
		for (const spec of imp.node.specifiers) if (t.isImportDefaultSpecifier(spec) && spec.local.name === imp.defaultIdent) importLocals.add(spec.local);
	}
	if (identToPath.size === 0) return referenced;
	walkAll(ast, (n) => {
		if (!t.isIdentifier(n)) return;
		const p = identToPath.get(n.name);
		if (!p) return;
		if (importLocals.has(n)) return;
		referenced.add(p);
	});
	return referenced;
}
function applyRevertAsset(source, assetPath) {
	const ast = parseSource(source);
	if (!ast) return {
		ok: false,
		status: 422,
		error: "could not parse source"
	};
	const target = findImports$1(ast).find((imp) => imp.source === assetPath && imp.defaultIdent);
	if (!target?.defaultIdent) return {
		ok: true,
		source
	};
	const identifier = target.defaultIdent;
	const importLocal = (() => {
		for (const spec of target.node.specifiers) if (t.isImportDefaultSpecifier(spec) && spec.local.name === identifier) return spec.local;
		return null;
	})();
	const imgUses = collectImgSrcUses(ast, identifier);
	const allowed = new Set(imgUses.map((u) => u.identNode));
	if (importLocal) allowed.add(importLocal);
	let foreign = false;
	walkAll(ast, (n) => {
		if (!t.isIdentifier(n) || n.name !== identifier) return;
		if (!allowed.has(n)) foreign = true;
	});
	if (foreign) return {
		ok: false,
		status: 422,
		error: `cannot revert: '${identifier}' is referenced outside <img src={${identifier}}>`
	};
	const splices = [];
	for (const use of imgUses) {
		const opening = use.element.openingElement;
		const hint = readJsxStringAttr(opening, "alt") ?? "";
		const width = readStyleNumericDim(opening, "width");
		const height = readStyleNumericDim(opening, "height");
		splices.push(spliceRange(use.element, buildPlaceholderReplacement(hint, width, height)));
	}
	const importNode = target.node;
	const importFrom = importNode.start ?? 0;
	let importTo = importNode.end ?? 0;
	if (source[importTo] === "\n") importTo += 1;
	splices.push({
		from: importFrom,
		to: importTo,
		text: ""
	});
	const ensureSplice = planEnsureImagePlaceholderImport(ast);
	if (ensureSplice) splices.push(ensureSplice);
	return applySplices(source, splices);
}
//#endregion
//#region src/files/assets.ts
const GLOBAL_SCOPE = "@global";
const ASSET_FORBIDDEN_RE = /[\x00-\x1F\x7F/\\:*?"<>|]/;
const MIME_BY_EXT = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	svg: "image/svg+xml",
	webp: "image/webp",
	avif: "image/avif",
	ico: "image/x-icon",
	mp4: "video/mp4",
	webm: "video/webm",
	mov: "video/quicktime",
	woff: "font/woff",
	woff2: "font/woff2",
	ttf: "font/ttf",
	otf: "font/otf",
	json: "application/json",
	txt: "text/plain; charset=utf-8",
	md: "text/markdown; charset=utf-8"
};
function mimeForFilename(name) {
	const dot = name.lastIndexOf(".");
	if (dot < 0) return "application/octet-stream";
	const ext = name.slice(dot + 1).toLowerCase();
	return MIME_BY_EXT[ext] ?? "application/octet-stream";
}
function assetCreatedAt(birthtimeMs, mtimeMs) {
	return Number.isFinite(birthtimeMs) && birthtimeMs > 0 ? birthtimeMs : mtimeMs;
}
function validateAssetName(v) {
	if (typeof v !== "string") return null;
	const trimmed = v.trim();
	if (trimmed.length < 1 || trimmed.length > 120) return null;
	if (ASSET_FORBIDDEN_RE.test(trimmed)) return null;
	if (trimmed.startsWith(".") || trimmed.startsWith("~")) return null;
	if (trimmed === ".." || trimmed.split(/[/\\]/).includes("..")) return null;
	const dot = trimmed.lastIndexOf(".");
	if (dot <= 0 || dot === trimmed.length - 1) return null;
	return trimmed;
}
function resolveAssetsDir(slidesRoot, slideId) {
	if (!SLIDE_ID_RE.test(slideId)) return null;
	const slideDir = path.resolve(slidesRoot, slideId);
	if (!slideDir.startsWith(slidesRoot + path.sep)) return null;
	return path.join(slideDir, "assets");
}
function resolveScopedAssetsDir(slidesRoot, globalAssetsRoot, scope) {
	if (scope === "@global") return globalAssetsRoot;
	return resolveAssetsDir(slidesRoot, scope);
}
function resolveScopedAssetFile(slidesRoot, globalAssetsRoot, scope, filename) {
	const assetsDir = resolveScopedAssetsDir(slidesRoot, globalAssetsRoot, scope);
	if (!assetsDir) return null;
	if (!validateAssetName(filename)) return null;
	const file = path.resolve(assetsDir, filename);
	if (!file.startsWith(assetsDir + path.sep)) return null;
	return file;
}
//#endregion
//#region src/vite/routes/assets.ts
function registerAssetRoutes(server, ctx) {
	server.middlewares.use("/__assets", async (req, res, next) => {
		const url = new URL(req.url ?? "/", "http://local");
		const method = req.method ?? "GET";
		try {
			const listMatch = url.pathname.match(/^\/([^/]+)\/?$/);
			const fileMatch = url.pathname.match(/^\/([^/]+)\/([^/]+)$/);
			const usagesMatch = url.pathname.match(/^\/([^/]+)\/([^/]+)\/usages$/);
			if (usagesMatch && method === "GET") {
				const scope = usagesMatch[1];
				const filename = decodeURIComponent(usagesMatch[2]);
				if (!validateAssetName(filename)) return json(res, 400, { error: "invalid path" });
				const isGlobal = scope === GLOBAL_SCOPE;
				const assetPath = isGlobal ? `@assets/${filename}` : `./assets/${filename}`;
				let slideIds;
				if (isGlobal) try {
					slideIds = (await fs.readdir(ctx.slidesRoot, { withFileTypes: true })).filter((e) => e.isDirectory() && SLIDE_ID_RE.test(e.name)).map((e) => e.name);
				} catch {
					slideIds = [];
				}
				else {
					if (!SLIDE_ID_RE.test(scope)) return json(res, 400, { error: "invalid slideId" });
					slideIds = [scope];
				}
				const usages = [];
				let totalCount = 0;
				for (const sid of slideIds) {
					const entry = resolveSlideEntry(ctx.slidesRoot, sid);
					if (!entry) continue;
					let source;
					try {
						source = await fs.readFile(entry, "utf8");
					} catch {
						continue;
					}
					const count = findAssetUsages(source, assetPath);
					if (count > 0) {
						usages.push({
							slideId: sid,
							count
						});
						totalCount += count;
					}
				}
				return json(res, 200, {
					usages,
					totalCount
				});
			}
			if (listMatch && method === "GET") {
				const slideId = listMatch[1];
				const scopedDir = resolveScopedAssetsDir(ctx.slidesRoot, ctx.globalAssetsRoot, slideId);
				if (!scopedDir) return json(res, 400, { error: "invalid slideId" });
				let entries;
				try {
					entries = await fs.readdir(scopedDir);
				} catch (err) {
					if (err.code === "ENOENT") return json(res, 200, { assets: [] });
					throw err;
				}
				const assets = [];
				for (const name of entries) {
					if (!validateAssetName(name)) continue;
					const stat = await fs.stat(path.join(scopedDir, name));
					if (!stat.isFile()) continue;
					assets.push({
						name,
						size: stat.size,
						createdAt: assetCreatedAt(stat.birthtimeMs, stat.mtimeMs),
						mtime: stat.mtimeMs,
						mime: mimeForFilename(name),
						url: `/__assets/${slideId}/${encodeURIComponent(name)}`,
						unused: true
					});
				}
				assets.sort((a, b) => a.name.localeCompare(b.name));
				if (assets.length > 0) {
					const isGlobal = slideId === GLOBAL_SCOPE;
					let scanIds;
					if (isGlobal) try {
						scanIds = (await fs.readdir(ctx.slidesRoot, { withFileTypes: true })).filter((e) => e.isDirectory() && SLIDE_ID_RE.test(e.name)).map((e) => e.name);
					} catch {
						scanIds = [];
					}
					else scanIds = SLIDE_ID_RE.test(slideId) ? [slideId] : [];
					const paths = assets.map((a) => isGlobal ? `@assets/${a.name}` : `./assets/${a.name}`);
					const pathToAsset = new Map(paths.map((p, i) => [p, assets[i]]));
					for (const sid of scanIds) {
						const entry = resolveSlideEntry(ctx.slidesRoot, sid);
						if (!entry) continue;
						let source;
						try {
							source = await fs.readFile(entry, "utf8");
						} catch {
							continue;
						}
						for (const p of findReferencedAssets(source, paths)) {
							const a = pathToAsset.get(p);
							if (a) a.unused = false;
						}
					}
				}
				return json(res, 200, { assets });
			}
			if (fileMatch) {
				const slideId = fileMatch[1];
				const filename = decodeURIComponent(fileMatch[2]);
				const file = resolveScopedAssetFile(ctx.slidesRoot, ctx.globalAssetsRoot, slideId, filename);
				if (!file) return json(res, 400, { error: "invalid path" });
				if (method === "GET") try {
					const buf = await fs.readFile(file);
					res.statusCode = 200;
					res.setHeader("content-type", mimeForFilename(filename));
					res.setHeader("cache-control", "no-store");
					res.end(buf);
					return;
				} catch (err) {
					if (err.code === "ENOENT") return json(res, 404, { error: "asset not found" });
					throw err;
				}
				if (method === "POST") {
					const requestCheck = validateMutationRequest(req);
					if (!requestCheck.ok) return json(res, requestCheck.status, { error: requestCheck.error });
					const overwrite = url.searchParams.get("overwrite") === "1";
					const lenHeader = req.headers["content-length"];
					const len = typeof lenHeader === "string" ? Number(lenHeader) : NaN;
					if (Number.isFinite(len) && len > 26214400) return json(res, 413, { error: "file too large" });
					if (!overwrite) try {
						await fs.access(file);
						return json(res, 409, { error: "asset exists" });
					} catch {}
					const scopedDir = resolveScopedAssetsDir(ctx.slidesRoot, ctx.globalAssetsRoot, slideId);
					if (!scopedDir) return json(res, 400, { error: "invalid slideId" });
					await fs.mkdir(scopedDir, { recursive: true });
					const chunks = [];
					let total = 0;
					let oversized = false;
					await new Promise((resolve, reject) => {
						req.on("data", (c) => {
							total += c.length;
							if (total > 26214400) {
								oversized = true;
								req.destroy();
								return;
							}
							chunks.push(c);
						});
						req.on("end", () => resolve());
						req.on("error", reject);
					});
					if (oversized) return json(res, 413, { error: "file too large" });
					await fs.writeFile(file, Buffer.concat(chunks));
					const stat = await fs.stat(file);
					return json(res, 200, {
						ok: true,
						name: filename,
						size: stat.size,
						createdAt: assetCreatedAt(stat.birthtimeMs, stat.mtimeMs),
						mtime: stat.mtimeMs,
						mime: mimeForFilename(filename),
						url: `/__assets/${slideId}/${encodeURIComponent(filename)}`
					});
				}
				if (method === "PATCH") {
					const requestCheck = validateMutationRequest(req, { requireJsonBody: true });
					if (!requestCheck.ok) return json(res, requestCheck.status, { error: requestCheck.error });
					const target = validateAssetName((await readBody(req)).name);
					if (!target) return json(res, 400, { error: "invalid name" });
					if (target === filename) return json(res, 200, {
						ok: true,
						name: filename
					});
					const dest = resolveScopedAssetFile(ctx.slidesRoot, ctx.globalAssetsRoot, slideId, target);
					if (!dest) return json(res, 400, { error: "invalid name" });
					try {
						await fs.access(dest);
						return json(res, 409, { error: "target exists" });
					} catch {}
					try {
						await fs.rename(file, dest);
					} catch (err) {
						if (err.code === "ENOENT") return json(res, 404, { error: "asset not found" });
						throw err;
					}
					return json(res, 200, {
						ok: true,
						name: target
					});
				}
				if (method === "DELETE") {
					const requestCheck = validateMutationRequest(req);
					if (!requestCheck.ok) return json(res, requestCheck.status, { error: requestCheck.error });
					try {
						await fs.unlink(file);
					} catch (err) {
						if (err.code === "ENOENT") return json(res, 404, { error: "asset not found" });
						throw err;
					}
					return json(res, 200, { ok: true });
				}
			}
			return next();
		} catch (err) {
			json(res, 500, { error: String(err.message ?? err) });
		}
	});
}
//#endregion
//#region src/editing/comments.ts
const MARKER_RE = /\{\/\*\s*@slide-comment\s+id="(c-[a-f0-9]+)"\s+ts="([^"]+)"\s+text="([A-Za-z0-9_-]+={0,2})"\s*\*\/\}/;
function b64urlEncode(s) {
	return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s) {
	const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - s.length % 4);
	return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8");
}
function parseMarkers(source) {
	const comments = [];
	const lines = source.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const m = lines[i].match(MARKER_RE);
		if (!m) continue;
		const [, id, ts, textB64] = m;
		try {
			const payload = JSON.parse(b64urlDecode(textB64));
			comments.push({
				id,
				line: i + 1,
				ts,
				note: payload.note,
				hint: payload.hint
			});
		} catch {}
	}
	return comments;
}
function newCommentId() {
	return shortId("c");
}
function markerDeleteRegex(id) {
	return new RegExp(`\\{\\/\\*\\s*@slide-comment\\s+id="${id}"\\s+ts="[^"]+"\\s+text="[A-Za-z0-9_\\-]+={0,2}"\\s*\\*\\/\\}`);
}
function lineToOffset(source, line) {
	let off = 0;
	for (let l = 1; l < line; l++) {
		const nl = source.indexOf("\n", off);
		if (nl === -1) return source.length;
		off = nl + 1;
	}
	return off;
}
function lineIndent(source, lineNumber) {
	const start = lineToOffset(source, lineNumber);
	return source.slice(start, start + 200).match(/^[ \t]*/)?.[0] ?? "";
}
function planInsertion(source, target) {
	if (t.isJSXElement(target) && target.openingElement.selfClosing) return null;
	return {
		offset: (t.isJSXFragment(target) ? target.openingFragment : target.openingElement).end ?? 0,
		indent: `${lineIndent(source, target.loc?.start.line ?? 1)}  `
	};
}
function findInsertion(source, line, column) {
	const ast = parseSource(source);
	if (!ast) return null;
	const ancestors = findJsxAncestors(ast, line, column ?? 0);
	for (const node of ancestors) {
		const plan = planInsertion(source, node);
		if (plan) return plan;
	}
	return null;
}
function offsetToLine(source, offset) {
	return source.slice(0, offset).split("\n").length;
}
//#endregion
//#region src/vite/routes/comments.ts
function registerCommentRoutes(server, ctx) {
	server.middlewares.use("/__comments", async (req, res, next) => {
		const url = new URL(req.url ?? "/", "http://local");
		const method = req.method ?? "GET";
		try {
			if (method === "GET" && url.pathname === "/") {
				const slideId = url.searchParams.get("slideId") ?? "";
				const file = resolveSlideEntryPath(ctx, slideId);
				if (!file) return json(res, 400, { error: "invalid slideId" });
				const source = await readSlideSource(file);
				if (source === null) return json(res, 404, { error: "slide not found" });
				return json(res, 200, { comments: parseMarkers(source) });
			}
			if (method === "POST" && url.pathname === "/add") {
				const requestCheck = validateMutationRequest(req, { requireJsonBody: true });
				if (!requestCheck.ok) return json(res, requestCheck.status, { error: requestCheck.error });
				const body = await readBody(req);
				const slideId = body.slideId ?? "";
				const file = resolveSlideEntryPath(ctx, slideId);
				if (!file) return json(res, 400, { error: "invalid slideId" });
				if (!body.line || body.line < 1) return json(res, 400, { error: "invalid line" });
				if (!body.text || typeof body.text !== "string") return json(res, 400, { error: "missing text" });
				const source = await readSlideSource(file);
				if (source === null) return json(res, 404, { error: "slide not found" });
				const plan = findInsertion(source, body.line, body.column);
				if (!plan) return json(res, 422, { error: `could not find a JSX container around line ${body.line}. Try clicking a different element.` });
				const id = newCommentId();
				const ts = (/* @__PURE__ */ new Date()).toISOString();
				const payload = b64urlEncode(JSON.stringify({
					note: body.text,
					hint: body.hint
				}));
				const marker = `\n${plan.indent}{/* @slide-comment id="${id}" ts="${ts}" text="${payload}" */}`;
				const next = source.slice(0, plan.offset) + marker + source.slice(plan.offset);
				await fs.writeFile(file, next, "utf8");
				const markerLine = offsetToLine(next, plan.offset + 1);
				return json(res, 200, {
					id,
					line: markerLine
				});
			}
			if (method === "DELETE" && url.pathname.startsWith("/")) {
				const requestCheck = validateMutationRequest(req);
				if (!requestCheck.ok) return json(res, requestCheck.status, { error: requestCheck.error });
				const id = url.pathname.slice(1);
				if (!/^c-[a-f0-9]+$/.test(id)) return json(res, 400, { error: "invalid id" });
				const slideId = url.searchParams.get("slideId") ?? "";
				const file = resolveSlideEntryPath(ctx, slideId);
				if (!file) return json(res, 400, { error: "invalid slideId" });
				const source = await readSlideSource(file);
				if (source === null) return json(res, 404, { error: "slide not found" });
				const lines = source.split("\n");
				const idRe = markerDeleteRegex(id);
				const hit = lines.findIndex((l) => idRe.test(l));
				if (hit === -1) return json(res, 404, { error: "marker not found" });
				lines.splice(hit, 1);
				await fs.writeFile(file, lines.join("\n"), "utf8");
				return json(res, 200, { ok: true });
			}
			next();
		} catch (err) {
			json(res, 500, { error: String(err.message ?? err) });
		}
	});
}
//#endregion
//#region src/editing/batch-edit.ts
function rebaseOffset(offset, splices, target) {
	let shift = 0;
	for (const splice of splices) {
		if (offset < splice.from) break;
		if (offset >= splice.to) shift += splice.text.length - (splice.to - splice.from);
		else if (offset === splice.from && offset === target) return offset + shift;
		else return null;
	}
	return offset + shift;
}
function applyEditBatch(source, edits) {
	const ast = parseSource(source);
	const targets = /* @__PURE__ */ new Map();
	const textTargets = /* @__PURE__ */ new Map();
	const tracked = edits.map((edit, index) => {
		if (!edit || !Number.isInteger(edit.line) || (edit.line ?? 0) < 1 || !Number.isInteger(edit.column ?? 0) || (edit.column ?? 0) < 0 || !Array.isArray(edit.ops) || edit.dependsOn !== void 0 && (!Number.isInteger(edit.dependsOn) || edit.dependsOn < 0 || edit.dependsOn >= index)) return {
			offset: null,
			ops: [],
			error: "invalid edit"
		};
		if (!edit.ops.length) return {
			offset: null,
			ops: [],
			dependsOn: edit.dependsOn
		};
		if (!ast) return {
			offset: null,
			ops: edit.ops,
			error: "could not parse source"
		};
		const location = `${edit.line}:${edit.column ?? 0}:`;
		const textOp = edit.ops.find((op) => "prevText" in op && op.prevText !== void 0);
		const prevText = textOp && "prevText" in textOp ? textOp.prevText : void 0;
		const offset = (edit.dependsOn === void 0 ? void 0 : targets.get(edit.dependsOn)) ?? (prevText === void 0 ? void 0 : textTargets.get(`${location}${prevText}`)) ?? findElementForEdit(ast, edit.line ?? 0, edit.column ?? 0, edit.ops)?.start ?? null;
		if (offset !== null) {
			targets.set(index, offset);
			for (const op of edit.ops) if (op.kind === "set-text") textTargets.set(`${location}${op.value}`, offset);
		}
		return {
			offset,
			ops: edit.ops,
			dependsOn: edit.dependsOn,
			...offset === null ? { error: "no JSX element at location" } : {}
		};
	});
	let next = source;
	const results = [];
	for (const edit of tracked) {
		if (edit.dependsOn !== void 0 && !results[edit.dependsOn]?.ok) {
			results.push({
				ok: false,
				error: "an earlier edit for this text failed"
			});
			continue;
		}
		if (edit.error) {
			results.push({
				ok: false,
				error: edit.error
			});
			continue;
		}
		if (!edit.ops.length) {
			results.push({ ok: true });
			continue;
		}
		if (edit.offset === null) {
			results.push({
				ok: false,
				error: "target was removed by an earlier edit"
			});
			continue;
		}
		const before = next.slice(0, edit.offset);
		const line = before.split("\n").length;
		const column = edit.offset - before.lastIndexOf("\n") - 1;
		const plan = planEdit(next, line, column, edit.ops, true);
		if (!plan.ok) {
			results.push({
				ok: false,
				error: plan.error
			});
			continue;
		}
		const result = plan.splices.length ? applySplices(next, plan.splices) : {
			ok: true,
			source: next
		};
		if (!result.ok) {
			results.push({
				ok: false,
				error: result.error
			});
			continue;
		}
		const target = edit.offset;
		const splices = [...plan.splices].sort((a, b) => a.from - b.from || a.to - b.to);
		for (const pending of tracked) if (pending.offset !== null) pending.offset = rebaseOffset(pending.offset, splices, target);
		next = result.source;
		results.push({ ok: true });
	}
	return {
		source: next,
		results
	};
}
//#endregion
//#region src/vite/routes/edit.ts
function registerEditRoutes(server, ctx) {
	server.middlewares.use("/__edit", async (req, res, next) => {
		const url = new URL(req.url ?? "/", "http://local");
		if ((req.method ?? "GET") !== "POST") return next();
		const requestCheck = validateMutationRequest(req, { requireJsonBody: true });
		if (!requestCheck.ok) return json(res, requestCheck.status, { error: requestCheck.error });
		try {
			if (url.pathname === "/") {
				const body = await readBody(req);
				const slideId = body.slideId ?? "";
				const file = resolveSlideEntryPath(ctx, slideId);
				if (!file) return json(res, 400, { error: "invalid slideId" });
				if (!body.line || body.line < 1) return json(res, 400, { error: "invalid line" });
				if (!Array.isArray(body.ops)) return json(res, 400, { error: "missing ops" });
				const source = await readSlideSource(file);
				if (source === null) return json(res, 404, { error: "slide not found" });
				const result = applyEdit(source, body.line, body.column ?? 0, body.ops);
				if (!result.ok) return json(res, result.status, { error: result.error });
				const changed = result.source !== source;
				if (changed) await fs.writeFile(file, result.source, "utf8");
				return json(res, 200, {
					ok: true,
					changed
				});
			}
			if (url.pathname === "/revert-asset") {
				const body = await readBody(req);
				const slideId = body.slideId ?? "";
				const assetPath = body.assetPath;
				const file = resolveSlideEntryPath(ctx, slideId);
				if (!file) return json(res, 400, { error: "invalid slideId" });
				if (typeof assetPath !== "string" || !assetPath) return json(res, 400, { error: "missing assetPath" });
				if (!assetPath.startsWith("./assets/") && !assetPath.startsWith("@assets/")) return json(res, 400, { error: "asset path must start with ./assets/ or @assets/" });
				const source = await readSlideSource(file);
				if (source === null) return json(res, 404, { error: "slide not found" });
				const result = applyRevertAsset(source, assetPath);
				if (!result.ok) return json(res, result.status, { error: result.error });
				const changed = result.source !== source;
				if (changed) await fs.writeFile(file, result.source, "utf8");
				return json(res, 200, {
					ok: true,
					changed
				});
			}
			if (url.pathname === "/batch") {
				const body = await readBody(req);
				const slideId = body.slideId ?? "";
				const file = resolveSlideEntryPath(ctx, slideId);
				if (!file) return json(res, 400, { error: "invalid slideId" });
				if (!Array.isArray(body.edits)) return json(res, 400, { error: "missing edits" });
				const source = await readSlideSource(file);
				if (source === null) return json(res, 404, { error: "slide not found" });
				const { source: updated, results } = applyEditBatch(source, body.edits);
				const changed = updated !== source;
				if (changed) await fs.writeFile(file, updated, "utf8");
				return json(res, 200, {
					ok: true,
					changed,
					results
				});
			}
			return next();
		} catch (err) {
			json(res, 500, { error: String(err.message ?? err) });
		}
	});
}
//#endregion
//#region src/vite/routes/folders.ts
function registerFolderRoutes(server, ctx) {
	server.middlewares.use("/__folders", async (req, res, next) => {
		const url = new URL(req.url ?? "/", "http://local");
		const method = req.method ?? "GET";
		try {
			if (method === "GET" && url.pathname === "/") {
				const manifest = await readManifest(ctx.manifestPath);
				return json(res, 200, manifest);
			}
			if (method === "POST" && url.pathname === "/") {
				const requestCheck = validateMutationRequest(req, { requireJsonBody: true });
				if (!requestCheck.ok) return json(res, requestCheck.status, { error: requestCheck.error });
				const body = await readBody(req);
				const name = validateName(body.name);
				if (!name) return json(res, 400, { error: "invalid name" });
				const icon = validateIcon(body.icon);
				if (!icon) return json(res, 400, { error: "invalid icon" });
				const manifest = await readManifest(ctx.manifestPath);
				const folder = {
					id: newFolderId(),
					name,
					icon
				};
				manifest.folders.push(folder);
				await writeManifest(ctx.manifestPath, manifest);
				return json(res, 200, folder);
			}
			if (method === "PUT" && url.pathname === "/assign") {
				const requestCheck = validateMutationRequest(req, { requireJsonBody: true });
				if (!requestCheck.ok) return json(res, requestCheck.status, { error: requestCheck.error });
				const body = await readBody(req);
				if (typeof body.slideId !== "string" || !SLIDE_ID_RE.test(body.slideId)) return json(res, 400, { error: "invalid slideId" });
				const slideId = body.slideId;
				let folderId;
				if (body.folderId === null) folderId = null;
				else if (typeof body.folderId === "string" && FOLDER_ID_RE.test(body.folderId)) folderId = body.folderId;
				else return json(res, 400, { error: "invalid folderId" });
				const manifest = await readManifest(ctx.manifestPath);
				if (folderId && !manifest.folders.some((f) => f.id === folderId)) return json(res, 404, { error: "folder not found" });
				if (folderId === null) delete manifest.assignments[slideId];
				else manifest.assignments[slideId] = folderId;
				await writeManifest(ctx.manifestPath, manifest);
				return json(res, 200, { ok: true });
			}
			if (method === "PUT" && url.pathname === "/reorder") {
				const requestCheck = validateMutationRequest(req, { requireJsonBody: true });
				if (!requestCheck.ok) return json(res, requestCheck.status, { error: requestCheck.error });
				const body = await readBody(req);
				const manifest = await readManifest(ctx.manifestPath);
				const ids = validateReorder(body.ids, manifest.folders);
				if (!ids) return json(res, 400, { error: "invalid ids" });
				const byId = new Map(manifest.folders.map((f) => [f.id, f]));
				manifest.folders = ids.map((id) => byId.get(id));
				await writeManifest(ctx.manifestPath, manifest);
				return json(res, 200, { ok: true });
			}
			const idMatch = url.pathname.match(/^\/([^/]+)$/);
			if (idMatch) {
				const id = idMatch[1];
				if (!FOLDER_ID_RE.test(id)) return json(res, 400, { error: "invalid id" });
				if (method === "PATCH") {
					const requestCheck = validateMutationRequest(req, { requireJsonBody: true });
					if (!requestCheck.ok) return json(res, requestCheck.status, { error: requestCheck.error });
					const body = await readBody(req);
					const manifest = await readManifest(ctx.manifestPath);
					const folder = manifest.folders.find((f) => f.id === id);
					if (!folder) return json(res, 404, { error: "folder not found" });
					if (body.name !== void 0) {
						const name = validateName(body.name);
						if (!name) return json(res, 400, { error: "invalid name" });
						folder.name = name;
					}
					if (body.icon !== void 0) {
						const icon = validateIcon(body.icon);
						if (!icon) return json(res, 400, { error: "invalid icon" });
						folder.icon = icon;
					}
					await writeManifest(ctx.manifestPath, manifest);
					return json(res, 200, folder);
				}
				if (method === "DELETE") {
					const requestCheck = validateMutationRequest(req);
					if (!requestCheck.ok) return json(res, requestCheck.status, { error: requestCheck.error });
					const manifest = await readManifest(ctx.manifestPath);
					const before = manifest.folders.length;
					manifest.folders = manifest.folders.filter((f) => f.id !== id);
					if (manifest.folders.length === before) return json(res, 404, { error: "folder not found" });
					for (const [slideId, folderId] of Object.entries(manifest.assignments)) if (folderId === id) delete manifest.assignments[slideId];
					await writeManifest(ctx.manifestPath, manifest);
					return json(res, 200, { ok: true });
				}
			}
			next();
		} catch (err) {
			json(res, 500, { error: String(err.message ?? err) });
		}
	});
}
//#endregion
//#region src/vite/routes/gfonts.ts
const CATALOG_URL = "https://fonts.google.com/metadata/fonts";
const CATALOG_TTL = 36e5;
const LEGACY_UA = "Mozilla/5.0";
const FONT_EXTS = /* @__PURE__ */ new Set([
	"ttf",
	"otf",
	"woff",
	"woff2"
]);
let catalogCache = null;
let catalogInflight = null;
async function loadCatalog() {
	if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL) return catalogCache.entries;
	if (catalogInflight) return catalogInflight;
	catalogInflight = (async () => {
		const res = await fetch(CATALOG_URL);
		if (!res.ok) throw new Error(`metadata ${res.status}`);
		const text = await res.text();
		const start = text.indexOf("{");
		const entries = (JSON.parse(start > 0 ? text.slice(start) : text).familyMetadataList ?? []).map((f) => ({
			family: f.family,
			category: f.category ?? "",
			variants: Object.keys(f.fonts ?? {}),
			popularity: typeof f.popularity === "number" ? f.popularity : Number.MAX_SAFE_INTEGER
		}));
		catalogCache = {
			at: Date.now(),
			entries
		};
		return entries;
	})();
	try {
		return await catalogInflight;
	} finally {
		catalogInflight = null;
	}
}
function cssFamilyParam(family) {
	return encodeURIComponent(family).replace(/%20/g, "+");
}
async function resolveFontFile(family, variant) {
	const italic = /i(talic)?$/.test(variant);
	const weight = variant.replace(/i(talic)?$/, "") || "400";
	const style = italic ? `${weight}italic` : weight;
	const cssUrl = `https://fonts.googleapis.com/css?family=${cssFamilyParam(family)}:${style}`;
	const css = await fetch(cssUrl, { headers: { "user-agent": LEGACY_UA } });
	if (!css.ok) return null;
	const match = (await css.text()).match(/url\((https:\/\/[^)]+)\)/);
	if (!match) return null;
	let parsed;
	try {
		parsed = new URL(match[1]);
	} catch {
		return null;
	}
	if (!parsed.hostname.toLowerCase().endsWith("gstatic.com")) return null;
	const rawExt = parsed.pathname.split(".").pop()?.toLowerCase() ?? "";
	const ext = FONT_EXTS.has(rawExt) ? rawExt : "ttf";
	return {
		url: parsed.toString(),
		ext
	};
}
function registerGfontsRoutes(server) {
	server.middlewares.use("/__gfonts", async (req, res, next) => {
		const reqUrl = new URL(req.url ?? "/", "http://local");
		if ((req.method ?? "GET") !== "GET") return next();
		try {
			if (reqUrl.pathname === "/search") {
				const q = (reqUrl.searchParams.get("q") ?? "").trim().toLowerCase();
				const limit = Number(reqUrl.searchParams.get("limit")) || 30;
				let entries = await loadCatalog();
				if (q) entries = entries.filter((e) => e.family.toLowerCase().includes(q));
				const items = entries.slice().sort((a, b) => a.popularity - b.popularity).slice(0, limit).map((e) => ({
					family: e.family,
					category: e.category,
					variants: e.variants
				}));
				return json(res, 200, items);
			}
			if (reqUrl.pathname === "/download") {
				const family = reqUrl.searchParams.get("family");
				const variant = reqUrl.searchParams.get("variant") || "400";
				if (!family) return json(res, 400, { error: "missing family" });
				const resolved = await resolveFontFile(family, variant);
				if (!resolved) return json(res, 404, { error: "font not found" });
				const upstream = await fetch(resolved.url);
				if (!upstream.ok) return json(res, 502, { error: `gstatic ${upstream.status}` });
				res.statusCode = 200;
				res.setHeader("content-type", upstream.headers.get("content-type") ?? "font/ttf");
				res.setHeader("x-font-ext", resolved.ext);
				res.setHeader("cache-control", "no-store");
				res.end(Buffer.from(await upstream.arrayBuffer()));
				return;
			}
			return next();
		} catch (err) {
			json(res, 502, { error: String(err.message ?? err) });
		}
	});
}
const DEV_SUPERVISED_ENV = "OPEN_SLIDE_DEV_SUPERVISED";
const executionId = randomUUID();
function isSupervised() {
	return process.env[DEV_SUPERVISED_ENV] === "1";
}
function registerRestartRoutes(server) {
	server.middlewares.use("/__server-status", (req, res, next) => {
		if ((req.method ?? "GET") !== "GET") return next();
		res.setHeader("cache-control", "no-store");
		json(res, 200, {
			executionId,
			canRestart: isSupervised()
		});
	});
	server.middlewares.use("/__restart-server", (req, res, next) => {
		if ((req.method ?? "GET") !== "POST") return next();
		const guard = validateMutationRequest(req);
		if (!guard.ok) return json(res, guard.status, { error: guard.error });
		if (!isSupervised()) return json(res, 409, { error: "dev server was not started by the open-slide CLI" });
		res.on("finish", () => process.exit(52));
		json(res, 200, { restarting: true });
	});
}
//#endregion
//#region src/vite/routes/slides.ts
function registerSlideRoutes(server, ctx) {
	server.middlewares.use("/__slides", async (req, res, next) => {
		const url = new URL(req.url ?? "/", "http://local");
		const method = req.method ?? "GET";
		try {
			const reorderMatch = url.pathname.match(/^\/([^/]+)\/reorder$/);
			if (reorderMatch && method === "PUT") {
				const requestCheck = validateMutationRequest(req, { requireJsonBody: true });
				if (!requestCheck.ok) return json(res, requestCheck.status, { error: requestCheck.error });
				const slideId = reorderMatch[1];
				if (!SLIDE_ID_RE.test(slideId)) return json(res, 400, { error: "invalid slideId" });
				const body = await readBody(req);
				if (!Array.isArray(body.order)) return json(res, 400, { error: "invalid order" });
				const order = [];
				for (const v of body.order) {
					if (!Number.isInteger(v)) return json(res, 400, { error: "invalid order" });
					order.push(v);
				}
				const entry = resolveSlideEntry(ctx.slidesRoot, slideId);
				if (!entry) return json(res, 400, { error: "invalid slideId" });
				let source;
				try {
					source = await fs.readFile(entry, "utf8");
				} catch {
					return json(res, 404, { error: "slide not found" });
				}
				const reordered = reorderDefaultExportPagesInSource(source, order);
				if (reordered === null) return json(res, 422, { error: "could not reorder pages — order must be a permutation of the existing array" });
				if (reordered !== source) await fs.writeFile(entry, reordered, "utf8");
				return json(res, 200, {
					ok: true,
					slideId,
					order
				});
			}
			const pageOpMatch = url.pathname.match(/^\/([^/]+)\/pages\/(\d+)(?:\/([a-z]+))?$/);
			if (pageOpMatch) {
				const slideId = pageOpMatch[1];
				const pageIndex = Number.parseInt(pageOpMatch[2], 10);
				const op = pageOpMatch[3];
				if (!SLIDE_ID_RE.test(slideId)) return json(res, 400, { error: "invalid slideId" });
				if (!Number.isInteger(pageIndex) || pageIndex < 0) return json(res, 400, { error: "invalid page index" });
				const isDelete = method === "DELETE" && !op;
				if (!isDelete && !(method === "POST" && op === "duplicate")) return next();
				const requestCheck = validateMutationRequest(req);
				if (!requestCheck.ok) return json(res, requestCheck.status, { error: requestCheck.error });
				const entry = resolveSlideEntry(ctx.slidesRoot, slideId);
				if (!entry) return json(res, 400, { error: "invalid slideId" });
				let source;
				try {
					source = await fs.readFile(entry, "utf8");
				} catch {
					return json(res, 404, { error: "slide not found" });
				}
				const updated = isDelete ? removePageFromDefaultExportInSource(source, pageIndex) : duplicatePageInDefaultExportInSource(source, pageIndex);
				if (updated === null) return json(res, 422, { error: isDelete ? "could not delete page — index out of range or default export is not an array" : "could not duplicate page — index out of range or default export is not an array" });
				if (updated !== source) await fs.writeFile(entry, updated, "utf8");
				return json(res, 200, {
					ok: true,
					slideId,
					index: pageIndex
				});
			}
			const duplicateMatch = url.pathname.match(/^\/([^/]+)\/duplicate$/);
			if (duplicateMatch && method === "POST") {
				const requestCheck = validateMutationRequest(req);
				if (!requestCheck.ok) return json(res, requestCheck.status, { error: requestCheck.error });
				const slideId = duplicateMatch[1];
				if (!SLIDE_ID_RE.test(slideId)) return json(res, 400, { error: "invalid slideId" });
				const body = await readBody(req);
				if (body.newId !== void 0 && typeof body.newId !== "string") return json(res, 400, { error: "invalid newId" });
				const duplicated = await duplicateSlideDir(ctx.slidesRoot, slideId, body.newId);
				if (!duplicated.ok) return json(res, duplicated.status, { error: duplicated.error });
				const manifest = await readManifest(ctx.manifestPath);
				const folderId = manifest.assignments[slideId];
				if (folderId) {
					manifest.assignments[duplicated.slideId] = folderId;
					await writeManifest(ctx.manifestPath, manifest);
				}
				return json(res, 200, {
					ok: true,
					slideId: duplicated.slideId
				});
			}
			const idMatch = url.pathname.match(/^\/([^/]+)$/);
			if (!idMatch) return next();
			const slideId = idMatch[1];
			if (!SLIDE_ID_RE.test(slideId)) return json(res, 400, { error: "invalid slideId" });
			if (method === "PATCH") {
				const requestCheck = validateMutationRequest(req, { requireJsonBody: true });
				if (!requestCheck.ok) return json(res, requestCheck.status, { error: requestCheck.error });
				const body = await readBody(req);
				const name = validateSlideName(body.name);
				if (!name) return json(res, 400, { error: "invalid name" });
				const entry = resolveSlideEntry(ctx.slidesRoot, slideId);
				if (!entry) return json(res, 400, { error: "invalid slideId" });
				let source;
				try {
					source = await fs.readFile(entry, "utf8");
				} catch {
					return json(res, 404, { error: "slide not found" });
				}
				const updated = updateMetaTitleInSource(source, name);
				if (updated === null) return json(res, 422, { error: "could not locate a safe place to write meta.title in index.tsx" });
				if (updated !== source) await fs.writeFile(entry, updated, "utf8");
				server.ws.send({ type: "full-reload" });
				return json(res, 200, {
					ok: true,
					slideId,
					name
				});
			}
			if (method === "DELETE") {
				const requestCheck = validateMutationRequest(req);
				if (!requestCheck.ok) return json(res, requestCheck.status, { error: requestCheck.error });
				if (!await rmSlideDir(ctx.slidesRoot, slideId)) return json(res, 404, { error: "slide not found" });
				const manifest = await readManifest(ctx.manifestPath);
				delete manifest.assignments[slideId];
				await writeManifest(ctx.manifestPath, manifest);
				return json(res, 200, { ok: true });
			}
			return next();
		} catch (err) {
			json(res, 500, { error: String(err.message ?? err) });
		}
	});
}
//#endregion
//#region src/vite/routes/svgl.ts
function registerSvglRoutes(server) {
	server.middlewares.use("/__svgl", async (req, res, next) => {
		const reqUrl = new URL(req.url ?? "/", "http://local");
		if ((req.method ?? "GET") !== "GET") return next();
		try {
			let target = null;
			if (reqUrl.pathname === "/search") {
				const params = new URLSearchParams();
				const q = reqUrl.searchParams.get("q");
				const limit = reqUrl.searchParams.get("limit");
				if (q) params.set("search", q);
				if (limit) params.set("limit", limit);
				const qs = params.toString();
				target = `https://api.svgl.app/${qs ? `?${qs}` : ""}`;
			} else if (reqUrl.pathname === "/svg") {
				const u = reqUrl.searchParams.get("u");
				if (!u) return json(res, 400, { error: "missing u" });
				let parsed;
				try {
					parsed = new URL(u);
				} catch {
					return json(res, 400, { error: "invalid u" });
				}
				if (parsed.protocol !== "https:") return json(res, 400, { error: "https only" });
				const host = parsed.hostname.toLowerCase();
				if (host !== "svgl.app" && !host.endsWith(".svgl.app")) return json(res, 400, { error: "host not allowed" });
				target = parsed.toString();
			} else return next();
			const upstream = await fetch(target);
			const ct = upstream.headers.get("content-type") ?? "application/octet-stream";
			res.statusCode = upstream.status;
			res.setHeader("content-type", ct);
			res.setHeader("cache-control", "no-store");
			const buf = Buffer.from(await upstream.arrayBuffer());
			res.end(buf);
		} catch (err) {
			json(res, 502, { error: String(err.message ?? err) });
		}
	});
}
//#endregion
//#region src/vite/routes/watchers.ts
function registerWatchers(server, ctx) {
	server.watcher.add(ctx.manifestPath);
	server.watcher.on("change", (p) => {
		if (p === ctx.manifestPath) server.ws.send({
			type: "custom",
			event: "open-slide:files-changed"
		});
	});
	server.watcher.add(ctx.globalAssetsRoot);
	const onAssetChange = (p) => {
		if (p.startsWith(ctx.globalAssetsRoot + path.sep) || p === ctx.globalAssetsRoot) {
			server.ws.send({
				type: "custom",
				event: "open-slide:assets-changed",
				data: { slideId: GLOBAL_SCOPE }
			});
			return;
		}
		if (!p.startsWith(ctx.slidesRoot + path.sep)) return;
		const parts = p.slice(ctx.slidesRoot.length + 1).split(path.sep);
		if (parts.length < 3 || parts[1] !== "assets") return;
		const slideId = parts[0];
		if (!SLIDE_ID_RE.test(slideId)) return;
		server.ws.send({
			type: "custom",
			event: "open-slide:assets-changed",
			data: { slideId }
		});
	};
	server.watcher.on("add", onAssetChange);
	server.watcher.on("change", onAssetChange);
	server.watcher.on("unlink", onAssetChange);
}
//#endregion
//#region src/vite/api-plugin.ts
function apiPlugin(opts) {
	return {
		name: "open-slide:api",
		apply: "serve",
		configureServer(server) {
			const ctx = makeContext(opts);
			registerWatchers(server, ctx);
			registerEditRoutes(server, ctx);
			registerCommentRoutes(server, ctx);
			registerSlideRoutes(server, ctx);
			registerAssetRoutes(server, ctx);
			registerSvglRoutes(server);
			registerGfontsRoutes(server);
			registerFolderRoutes(server, ctx);
			registerUpdateRoutes(server, ctx);
			registerRestartRoutes(server);
		}
	};
}
//#endregion
//#region src/vite/current-plugin.ts
const TEXT_SNIPPET_MAX = 120;
function parseSelection(raw) {
	if (raw == null || typeof raw !== "object") return null;
	const sel = raw;
	if (typeof sel.line !== "number" || !Number.isFinite(sel.line)) return null;
	if (typeof sel.column !== "number" || !Number.isFinite(sel.column)) return null;
	const tagName = typeof sel.tagName === "string" ? sel.tagName.toLowerCase().slice(0, 32) : "unknown";
	const text = typeof sel.text === "string" ? sel.text.replace(/\s+/g, " ").trim().slice(0, TEXT_SNIPPET_MAX) : "";
	return {
		line: Math.max(1, Math.floor(sel.line)),
		column: Math.max(0, Math.floor(sel.column)),
		tagName,
		text
	};
}
function currentPlugin(opts) {
	const userCwd = opts.userCwd;
	const slidesDir = opts.slidesDir ?? "slides";
	const outDir = path.join(userCwd, "node_modules", ".open-slide");
	const outFile = path.join(outDir, "current.json");
	const tmpFile = `${outFile}.tmp`;
	let cached = null;
	return {
		name: "open-slide:current",
		apply: "serve",
		configureServer(server) {
			server.ws.on("open-slide:current", async (raw) => {
				const next = cached ? { ...cached } : {
					slideId: "",
					pageIndex: 0,
					pageNumber: 1,
					totalPages: 1,
					slideTitle: "",
					view: "slides",
					pagePath: "",
					selection: null
				};
				if (typeof raw?.slideId === "string") {
					if (!SLIDE_ID_RE.test(raw.slideId)) return;
					const totalPages = typeof raw.totalPages === "number" && Number.isFinite(raw.totalPages) && raw.totalPages > 0 ? Math.floor(raw.totalPages) : 1;
					const rawIndex = typeof raw.pageIndex === "number" && Number.isFinite(raw.pageIndex) ? Math.floor(raw.pageIndex) : 0;
					const pageIndex = Math.max(0, Math.min(totalPages - 1, rawIndex));
					const slideTitle = typeof raw.slideTitle === "string" ? raw.slideTitle : raw.slideId;
					const view = raw.view === "assets" ? "assets" : "slides";
					const pagePath = path.join(slidesDir, raw.slideId, "index.tsx").split(path.sep).join("/");
					if (cached?.slideId !== raw.slideId || cached?.pageIndex !== pageIndex) next.selection = null;
					next.slideId = raw.slideId;
					next.pageIndex = pageIndex;
					next.pageNumber = pageIndex + 1;
					next.totalPages = totalPages;
					next.slideTitle = slideTitle;
					next.view = view;
					next.pagePath = pagePath;
				}
				if ("selection" in raw) next.selection = parseSelection(raw.selection);
				if (!next.slideId) return;
				cached = next;
				const body = {
					...next,
					updatedAt: (/* @__PURE__ */ new Date()).toISOString()
				};
				try {
					await fs.mkdir(outDir, { recursive: true });
					await fs.writeFile(tmpFile, `${JSON.stringify(body, null, 2)}\n`, "utf8");
					await fs.rename(tmpFile, outFile);
				} catch {}
			});
		}
	};
}
//#endregion
//#region src/vite/design-plugin.ts
function parseLoose(source) {
	return tryParse(source);
}
function parseStrict(source) {
	return parseSource(source);
}
function findDesignDecl(ast) {
	const body = ast.program?.body ?? [];
	for (const node of body) {
		let varDecl = null;
		if (node.type === "VariableDeclaration") varDecl = node;
		else if (node.type === "ExportNamedDeclaration") {
			const decl = node.declaration;
			if (decl?.type === "VariableDeclaration") varDecl = decl;
		}
		if (!varDecl) continue;
		const declarations = varDecl.declarations ?? [];
		for (const d of declarations) {
			const id = d.id;
			if (id?.type !== "Identifier" || id.name !== "design") continue;
			const init = d.init;
			if (!init) return null;
			let inner = init;
			if (inner.type === "TSSatisfiesExpression" || inner.type === "TSAsExpression") {
				const expr = inner.expression;
				if (expr) inner = expr;
			}
			if (inner.type !== "ObjectExpression") return null;
			return {
				declStart: node.start,
				declEnd: node.end,
				objectStart: inner.start,
				objectEnd: inner.end
			};
		}
	}
	return null;
}
function literalToValue(node) {
	switch (node.type) {
		case "StringLiteral": return node.value;
		case "NumericLiteral": return node.value;
		case "BooleanLiteral": return node.value;
		case "NullLiteral": return null;
		case "UnaryExpression": {
			const op = node.operator;
			const arg = node.argument;
			const v = literalToValue(arg);
			if (op === "-" && typeof v === "number") return -v;
			if (op === "+" && typeof v === "number") return v;
			throw new Error(`unsupported unary operator ${op}`);
		}
		case "TemplateLiteral": {
			const quasis = node.quasis;
			if (node.expressions.length > 0) throw new Error("template literal has expressions");
			return quasis[0].value.cooked ?? quasis[0].value.raw;
		}
		case "ArrayExpression": return node.elements.map((el) => {
			if (!el) throw new Error("array has hole");
			return literalToValue(el);
		});
		case "ObjectExpression": {
			const properties = node.properties;
			const out = {};
			for (const prop of properties) {
				if (prop.type !== "ObjectProperty") throw new Error("object has spread or method");
				const p = prop;
				if (p.computed) throw new Error("object has computed key");
				let key;
				if (p.key.type === "Identifier" && typeof p.key.name === "string") key = p.key.name;
				else if (p.key.type === "StringLiteral" && typeof p.key.value === "string") key = p.key.value;
				else throw new Error("unsupported object key");
				out[key] = literalToValue(p.value);
			}
			return out;
		}
		default: throw new Error(`unsupported node type ${node.type}`);
	}
}
function isPlainObject(v) {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}
function mergeDesign(base, patch) {
	const out = JSON.parse(JSON.stringify(base));
	const apply = (target, src) => {
		for (const [k, v] of Object.entries(src)) if (isPlainObject(v) && isPlainObject(target[k])) apply(target[k], v);
		else target[k] = v;
	};
	if (isPlainObject(patch)) apply(out, patch);
	return out;
}
function indent(level) {
	return "  ".repeat(level);
}
function isValidIdentifier(name) {
	return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}
function serializeValue(value, level) {
	if (value === null) return "null";
	if (typeof value === "string") return jsString(value);
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new Error("non-finite number");
		return String(value);
	}
	if (typeof value === "boolean") return value ? "true" : "false";
	if (Array.isArray(value)) {
		if (value.length === 0) return "[]";
		return `[${value.map((el) => serializeValue(el, level + 1)).join(", ")}]`;
	}
	if (isPlainObject(value)) {
		const entries = Object.entries(value);
		if (entries.length === 0) return "{}";
		const childIndent = indent(level + 1);
		return `{\n${entries.map(([k, v]) => {
			const key = isValidIdentifier(k) ? k : jsString(k);
			return `${childIndent}${key}: ${serializeValue(v, level + 1)},`;
		}).join("\n")}\n${indent(level)}}`;
	}
	throw new Error(`unsupported value type ${typeof value}`);
}
function serializeDesign(design) {
	return serializeValue(design, 0);
}
function parseSlideDesign(source) {
	const ast = parseLoose(source);
	if (!ast) return {
		ok: false,
		exists: true,
		error: "could not parse slide source"
	};
	const loc = findDesignDecl(ast);
	if (!loc) return {
		ok: false,
		exists: false
	};
	const objectNode = findDesignObjectNode(ast);
	if (!objectNode) return {
		ok: false,
		exists: true,
		error: "design has unsupported initializer"
	};
	let value;
	try {
		value = literalToValue(objectNode);
	} catch (err) {
		return {
			ok: false,
			exists: true,
			error: err.message
		};
	}
	return {
		ok: true,
		design: mergeDesign(defaultDesign, value),
		loc
	};
}
function findDesignObjectNode(ast) {
	const body = ast.program?.body ?? [];
	for (const node of body) {
		let varDecl = null;
		if (node.type === "VariableDeclaration") varDecl = node;
		else if (node.type === "ExportNamedDeclaration") {
			const decl = node.declaration;
			if (decl?.type === "VariableDeclaration") varDecl = decl;
		}
		if (!varDecl) continue;
		const declarations = varDecl.declarations ?? [];
		for (const d of declarations) {
			const id = d.id;
			if (id?.type !== "Identifier" || id.name !== "design") continue;
			const init = d.init;
			if (!init) return null;
			let inner = init;
			if (inner.type === "TSSatisfiesExpression" || inner.type === "TSAsExpression") {
				const expr = inner.expression;
				if (expr) inner = expr;
			}
			if (inner.type !== "ObjectExpression") return null;
			return inner;
		}
	}
	return null;
}
function findImports(ast) {
	const body = ast.program?.body ?? [];
	const out = [];
	for (const node of body) {
		if (node.type !== "ImportDeclaration") continue;
		const src = node.source?.value;
		if (typeof src !== "string") continue;
		const specs = node.specifiers ?? [];
		out.push({
			node,
			source: src,
			specifiers: specs
		});
	}
	return out;
}
function addDesignSystemImport(source, imports) {
	const stmt = `import type { DesignSystem } from '@open-slide/core';\n`;
	if (imports.length > 0) {
		const insertAt = imports[imports.length - 1].node.end;
		const trail = source[insertAt] === "\n" ? "" : "\n";
		return {
			source: `${source.slice(0, insertAt)}\n${stmt.slice(0, -1)}${trail}${source.slice(insertAt)}`,
			offsetShift: 1 + stmt.length - (trail ? 0 : 1)
		};
	}
	return {
		source: `${stmt}\n${source}`,
		offsetShift: stmt.length + 1
	};
}
function ensureDesignSystemImport(source, ast) {
	const imports = findImports(ast);
	const coreImport = imports.find((imp) => imp.source === "@open-slide/core");
	if (!coreImport) return addDesignSystemImport(source, imports);
	if (coreImport.specifiers.some((spec) => {
		if (spec.type !== "ImportSpecifier") return false;
		return spec.imported?.name === "DesignSystem";
	})) return {
		source,
		offsetShift: 0
	};
	const node = coreImport.node;
	const specifier = node.importKind === "type" ? "DesignSystem" : "type DesignSystem";
	const named = coreImport.specifiers.filter((spec) => spec.type === "ImportSpecifier");
	const lastNamed = named[named.length - 1];
	if (lastNamed) {
		const insertText = `, ${specifier}`;
		return {
			source: `${source.slice(0, lastNamed.end)}${insertText}${source.slice(lastNamed.end)}`,
			offsetShift: insertText.length
		};
	}
	const braceClose = source.slice(node.start, node.end).lastIndexOf("}");
	if (braceClose === -1) return addDesignSystemImport(source, imports);
	const absoluteBrace = node.start + braceClose;
	return {
		source: `${source.slice(0, absoluteBrace)}${specifier}${source.slice(absoluteBrace)}`,
		offsetShift: specifier.length
	};
}
function findInsertionPoint(source, ast) {
	const imports = findImports(ast);
	if (imports.length === 0) return 0;
	let off = imports[imports.length - 1].node.end;
	while (off < source.length && source[off] !== "\n") off++;
	if (off < source.length) off++;
	return off;
}
function applyDesignWrite(source, next) {
	let body;
	try {
		body = serializeDesign(next);
	} catch (err) {
		return {
			ok: false,
			status: 422,
			error: `serialize failed: ${err.message}`
		};
	}
	const ast = parseStrict(source);
	if (!ast) return {
		ok: false,
		status: 422,
		error: "could not parse slide source"
	};
	const loc = findDesignDecl(ast);
	if (loc) return {
		ok: true,
		source: source.slice(0, loc.objectStart) + body + source.slice(loc.objectEnd),
		created: false
	};
	const withImport = ensureDesignSystemImport(source, ast);
	const ast2 = parseStrict(withImport.source);
	if (!ast2) return {
		ok: false,
		status: 422,
		error: "failed to re-parse after adding import"
	};
	const insertAt = findInsertionPoint(withImport.source, ast2);
	const block = `\nconst design: DesignSystem = ${body};\n`;
	return {
		ok: true,
		source: withImport.source.slice(0, insertAt) + block + withImport.source.slice(insertAt),
		created: true
	};
}
function designPlugin(opts) {
	const slidesRoot = path.resolve(opts.userCwd, opts.slidesDir ?? "slides");
	return {
		name: "open-slide:design",
		apply: "serve",
		configureServer(server) {
			server.middlewares.use("/__design", async (req, res, next) => {
				const url = new URL(req.url ?? "/", "http://local");
				const method = req.method ?? "GET";
				const slideId = url.searchParams.get("slideId") ?? "";
				const file = resolveSlideEntry(slidesRoot, slideId);
				if (!file) return json(res, 400, { error: "invalid slideId" });
				try {
					if (method === "GET" && url.pathname === "/") {
						let source;
						try {
							source = await fs.readFile(file, "utf8");
						} catch {
							return json(res, 404, { error: "slide not found" });
						}
						const parsed = parseSlideDesign(source);
						if (parsed.ok) return json(res, 200, {
							design: parsed.design,
							exists: true,
							warning: null
						});
						if (parsed.exists === false) return json(res, 200, {
							design: defaultDesign,
							exists: false,
							warning: null
						});
						return json(res, 200, {
							design: defaultDesign,
							exists: true,
							warning: parsed.error
						});
					}
					if (method === "PUT" && url.pathname === "/") {
						const requestCheck = validateMutationRequest(req, { requireJsonBody: true });
						if (!requestCheck.ok) return json(res, requestCheck.status, { error: requestCheck.error });
						const patch = (await readBody(req)).patch;
						if (!patch || typeof patch !== "object") return json(res, 400, { error: "missing patch object" });
						let source;
						try {
							source = await fs.readFile(file, "utf8");
						} catch {
							return json(res, 404, { error: "slide not found" });
						}
						const parsed = parseSlideDesign(source);
						const baseDesign = parsed.ok ? parsed.design : defaultDesign;
						if (!parsed.ok && parsed.exists) return json(res, 422, { error: parsed.error });
						const merged = mergeDesign(baseDesign, patch);
						const written = applyDesignWrite(source, merged);
						if (!written.ok) return json(res, written.status, { error: written.error });
						if (written.source !== source) await fs.writeFile(file, written.source, "utf8");
						return json(res, 200, {
							ok: true,
							design: merged,
							created: written.created
						});
					}
					if (method === "POST" && url.pathname === "/reset") {
						const requestCheck = validateMutationRequest(req);
						if (!requestCheck.ok) return json(res, requestCheck.status, { error: requestCheck.error });
						let source;
						try {
							source = await fs.readFile(file, "utf8");
						} catch {
							return json(res, 404, { error: "slide not found" });
						}
						const written = applyDesignWrite(source, defaultDesign);
						if (!written.ok) return json(res, written.status, { error: written.error });
						if (written.source !== source) await fs.writeFile(file, written.source, "utf8");
						return json(res, 200, {
							ok: true,
							design: defaultDesign,
							created: written.created
						});
					}
					return next();
				} catch (err) {
					json(res, 500, { error: String(err.message ?? err) });
				}
			});
		}
	};
}
//#endregion
//#region src/vite/loc-tags-plugin.ts
const FORWARDING_COMPONENTS = /* @__PURE__ */ new Set(["ImagePlaceholder"]);
function isTaggableJsxName(name) {
	if (!t.isJSXIdentifier(name)) return false;
	return /^[a-z]/.test(name.name) || FORWARDING_COMPONENTS.has(name.name);
}
function alreadyTagged(opening) {
	return opening.attributes.some((attr) => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === "data-slide-loc");
}
function injectLocTags(code) {
	const ast = tryParse(code);
	if (!ast) return null;
	const insertions = [];
	walkJsx(ast, (node) => {
		if (!t.isJSXElement(node) || !node.loc) return;
		const opening = node.openingElement;
		const name = opening.name;
		if (!isTaggableJsxName(name) || alreadyTagged(opening)) return;
		insertions.push({
			offset: name.end ?? 0,
			text: ` data-slide-loc="${node.loc.start.line}:${node.loc.start.column}"`
		});
	});
	if (insertions.length === 0) return null;
	insertions.sort((a, b) => b.offset - a.offset);
	let next = code;
	for (const ins of insertions) next = next.slice(0, ins.offset) + ins.text + next.slice(ins.offset);
	return next;
}
function isSlideSourceFile(id, slidesRootPosix) {
	const filePath = id.split(/[?#]/)[0].replace(/\\/g, "/");
	if (!filePath.startsWith(`${slidesRootPosix}/`)) return false;
	if (!filePath.endsWith(".tsx")) return false;
	if (filePath.endsWith(".d.ts") || filePath.endsWith(".test.tsx")) return false;
	return filePath.slice(slidesRootPosix.length + 1).includes("/");
}
function locTagsPlugin(opts) {
	const slidesRoot = path.resolve(opts.userCwd, opts.slidesDir ?? "slides").replace(/\\/g, "/");
	return {
		name: "open-slide:loc-tags",
		apply: "serve",
		enforce: "pre",
		transform(code, id) {
			if (!isSlideSourceFile(id, slidesRoot)) return null;
			const next = injectLocTags(code);
			if (next === null) return null;
			return {
				code: next,
				map: null
			};
		}
	};
}
//#endregion
//#region src/vite/recent-writes.ts
const recentWrites = /* @__PURE__ */ new Map();
/** Record that `file` was just written by us. */
function recordWrite(file, now = Date.now()) {
	recentWrites.set(file, now);
}
/**
* True if `file` was recorded within the recent-write window. Expired entries
* are pruned so a stale path can no longer suppress a later genuine edit.
*/
function hasRecentWrite(file, now = Date.now()) {
	const ts = recentWrites.get(file);
	if (ts == null) return false;
	if (now - ts < 1500) return true;
	recentWrites.delete(file);
	return false;
}
//#endregion
//#region src/vite/open-slide-plugin.ts
const CONFIG_FILE = "open-slide.config.ts";
const SLIDES_VMOD = "virtual:open-slide/slides";
const CONFIG_VMOD = "virtual:open-slide/config";
const FOLDERS_VMOD = "virtual:open-slide/folders";
function resolved$1(id) {
	return `\0${id}`;
}
async function findSlides(userCwd, slidesDir) {
	const abs = path.resolve(userCwd, slidesDir);
	if (!existsSync(abs)) return [];
	return (await fg("*/index.{tsx,jsx,ts,js}", {
		cwd: abs,
		absolute: true,
		onlyFiles: true
	})).sort();
}
function toId(absFile, slidesRoot) {
	return path.relative(slidesRoot, absFile).split(path.sep)[0];
}
const META_THEME_RE = /(?:^|[\s,{])theme\s*:\s*['"]([^'"]+)['"]/;
const META_CREATED_AT_RE = /(?:^|[\s,{])createdAt\s*:\s*['"]([^'"]+)['"]/;
function extractMeta(src) {
	const empty = {
		theme: null,
		createdAt: null
	};
	const metaStart = src.search(/export\s+const\s+meta\b/);
	if (metaStart === -1) return empty;
	const eqIdx = src.indexOf("=", metaStart);
	if (eqIdx === -1) return empty;
	const openBrace = src.indexOf("{", eqIdx);
	if (openBrace === -1) return empty;
	let depth = 0;
	let closeBrace = -1;
	for (let i = openBrace; i < src.length; i++) {
		const ch = src[i];
		if (ch === "{") depth++;
		else if (ch === "}") {
			depth--;
			if (depth === 0) {
				closeBrace = i;
				break;
			}
		}
	}
	if (closeBrace === -1) return empty;
	const body = src.slice(openBrace + 1, closeBrace);
	const themeMatch = body.match(META_THEME_RE);
	const createdAtMatch = body.match(META_CREATED_AT_RE);
	return {
		theme: themeMatch ? themeMatch[1] : null,
		createdAt: createdAtMatch ? createdAtMatch[1] : null
	};
}
async function readSlideMeta(abs) {
	try {
		return extractMeta(await fs.readFile(abs, "utf8"));
	} catch {
		return {
			theme: null,
			createdAt: null
		};
	}
}
function parseCreatedAtMs(iso) {
	if (!iso) return null;
	const ms = Date.parse(iso);
	return Number.isFinite(ms) ? ms : null;
}
const warnedInvalidSlideIds = /* @__PURE__ */ new Set();
async function generateSlidesModule(files, slidesRoot, isDev) {
	const scanned = await Promise.all(files.map(async (abs) => {
		const id = toId(abs, slidesRoot);
		const importPath = isDev ? `@fs/${normalizePath(abs).replace(/^\/+/, "")}` : abs;
		const meta = await readSlideMeta(abs);
		return {
			id,
			importPath,
			theme: meta.theme,
			createdAt: parseCreatedAtMs(meta.createdAt)
		};
	}));
	const entries = scanned.filter((e) => SLIDE_ID_RE.test(e.id));
	const ignored = scanned.filter((e) => !SLIDE_ID_RE.test(e.id)).map((e) => e.id);
	const ids = JSON.stringify(entries.map((e) => e.id).sort());
	const themesMap = {};
	const createdAtMap = {};
	for (const e of entries) {
		if (e.theme) themesMap[e.id] = e.theme;
		if (e.createdAt !== null) createdAtMap[e.id] = e.createdAt;
	}
	const themesJson = JSON.stringify(themesMap);
	const createdAtJson = JSON.stringify(createdAtMap);
	const importTokens = JSON.stringify(Object.fromEntries(entries.map((e) => [e.id, 0])));
	return {
		code: `// virtual:open-slide/slides — generated
export const slideIds = ${ids};
export const slideThemes = ${themesJson};
export const slideCreatedAt = ${createdAtJson};
${isDev ? `
const slideImportTokens = ${importTokens};
if (import.meta.hot) {
  import.meta.hot.on('open-slide:slide-changed', (data) => {
    const ids = Array.isArray(data?.slideIds) ? data.slideIds : [];
    const token = Date.now();
    for (const id of ids) {
      if (Object.prototype.hasOwnProperty.call(slideImportTokens, id)) slideImportTokens[id] = token;
    }
  });
}
` : ""}

export async function loadSlide(id) {
  switch (id) {
${entries.map((e) => {
			const importExpr = isDev ? `import(/* @vite-ignore */ import.meta.env.BASE_URL + ${JSON.stringify(`${e.importPath}?t=`)} + slideImportTokens[${JSON.stringify(e.id)}])` : `import(${JSON.stringify(e.importPath)})`;
			return `    case ${JSON.stringify(e.id)}: return ${importExpr};`;
		}).join("\n")}
    default: throw new Error('Slide not found: ' + id);
  }
}
`,
		ignored
	};
}
function openSlidePlugin(opts) {
	const { userCwd, config, coreVersion } = opts;
	const slidesDir = config.slidesDir ?? "slides";
	const slidesRoot = path.resolve(userCwd, slidesDir);
	const manifestPath = foldersManifestPath(slidesRoot);
	let isDev = false;
	const slideIdForEntry = (p) => {
		const rel = path.relative(slidesRoot, p);
		if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
		const parts = rel.split(path.sep);
		if (parts.length !== 2) return null;
		if (!/^index\.(tsx|jsx|ts|js)$/.test(parts[1])) return null;
		return parts[0];
	};
	let slideChangeTimer = null;
	const pendingSlideChanges = /* @__PURE__ */ new Set();
	const queueSlideChanged = (server, id) => {
		pendingSlideChanges.add(id);
		if (slideChangeTimer) clearTimeout(slideChangeTimer);
		slideChangeTimer = setTimeout(() => {
			slideChangeTimer = null;
			const mod = server.moduleGraph.getModuleById(resolved$1(SLIDES_VMOD));
			if (mod) server.moduleGraph.invalidateModule(mod);
			const slideIds = Array.from(pendingSlideChanges);
			pendingSlideChanges.clear();
			server.ws.send({
				type: "custom",
				event: "open-slide:slide-changed",
				data: { slideIds }
			});
		}, 100);
	};
	return {
		name: "open-slide",
		config(_c, env) {
			isDev = env.command === "serve";
		},
		resolveId(id) {
			if (id === SLIDES_VMOD) return resolved$1(SLIDES_VMOD);
			if (id === CONFIG_VMOD) return resolved$1(CONFIG_VMOD);
			if (id === FOLDERS_VMOD) return resolved$1(FOLDERS_VMOD);
			return null;
		},
		async load(id) {
			if (id === resolved$1(SLIDES_VMOD)) {
				const { code, ignored } = await generateSlidesModule(await findSlides(userCwd, slidesDir), slidesRoot, isDev);
				for (const slideId of ignored) {
					if (warnedInvalidSlideIds.has(slideId)) continue;
					warnedInvalidSlideIds.add(slideId);
					this.warn(`Ignoring slide folder "${slideId}": slide ids must match ${SLIDE_ID_RE} (lowercase/uppercase letters, digits, "-", "_"). Rename the folder under "${slidesDir}/" to a kebab-case id so it appears in the browser and can be moved into folders.`);
				}
				return code;
			}
			if (id === resolved$1(CONFIG_VMOD)) {
				const userBuild = config.build ?? {};
				const buildResolved = isDev ? {
					showSlideBrowser: true,
					showSlideUi: true,
					allowHtmlDownload: true
				} : {
					showSlideBrowser: userBuild.showSlideBrowser ?? true,
					showSlideUi: userBuild.showSlideUi ?? true,
					allowHtmlDownload: userBuild.allowHtmlDownload ?? true
				};
				const resolvedConfig = {
					...config,
					build: buildResolved,
					version: coreVersion
				};
				return `export default ${JSON.stringify(resolvedConfig)};\n`;
			}
			if (id === resolved$1(FOLDERS_VMOD)) {
				const manifest = await readManifest(manifestPath);
				return `export default ${JSON.stringify(manifest)};\n`;
			}
			return null;
		},
		handleHotUpdate(ctx) {
			const slideId = slideIdForEntry(ctx.file);
			if (!slideId) return;
			if (hasRecentWrite(ctx.file)) return [];
			queueSlideChanged(ctx.server, slideId);
			return [];
		},
		configureServer(server) {
			const isSlideEntry = (p) => slideIdForEntry(p) !== null;
			let reloadTimer = null;
			const reload = () => {
				if (reloadTimer) clearTimeout(reloadTimer);
				reloadTimer = setTimeout(() => {
					reloadTimer = null;
					const mod = server.moduleGraph.getModuleById(resolved$1(SLIDES_VMOD));
					if (mod) server.moduleGraph.invalidateModule(mod);
					server.ws.send({ type: "full-reload" });
				}, 150);
			};
			if (existsSync(slidesRoot)) server.watcher.add(slidesRoot);
			server.watcher.on("add", (p) => {
				if (isSlideEntry(p)) reload();
			});
			server.watcher.on("unlink", (p) => {
				if (isSlideEntry(p)) reload();
			});
			let foldersTimer = null;
			const invalidateFolders = () => {
				if (foldersTimer) clearTimeout(foldersTimer);
				foldersTimer = setTimeout(() => {
					foldersTimer = null;
					const mod = server.moduleGraph.getModuleById(resolved$1(FOLDERS_VMOD));
					if (mod) server.moduleGraph.invalidateModule(mod);
				}, 100);
			};
			server.watcher.add(manifestPath);
			server.watcher.on("change", (p) => {
				if (p === manifestPath) invalidateFolders();
			});
			server.watcher.on("add", (p) => {
				if (p === manifestPath) invalidateFolders();
			});
			server.watcher.on("unlink", (p) => {
				if (p === manifestPath) invalidateFolders();
			});
		}
	};
}
async function loadUserConfig(userCwd) {
	const file = path.join(userCwd, CONFIG_FILE);
	if (!existsSync(file)) return {};
	return (await loadConfigFromFile({
		command: "serve",
		mode: "development"
	}, file, userCwd, "silent"))?.config ?? {};
}
//#endregion
//#region src/vite/themes-plugin.ts
const THEMES_VMOD = "virtual:open-slide/themes";
function resolved(id) {
	return `\0${id}`;
}
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
function parseFrontmatter(raw, themeId) {
	const match = raw.match(FM_RE);
	const fmText = match ? match[1] : "";
	const body = match ? match[2] : raw;
	const data = {};
	for (const line of fmText.split(/\r?\n/)) {
		const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
		if (!m) continue;
		let value = m[2].trim();
		if (value.startsWith("\"") && value.endsWith("\"") || value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
		data[m[1]] = value;
	}
	return {
		fm: {
			name: data.name || themeId,
			description: data.description || ""
		},
		body: body.trim()
	};
}
async function findThemes(userCwd, themesDir) {
	const abs = path.resolve(userCwd, themesDir);
	if (!existsSync(abs)) return [];
	return (await fg("*.md", {
		cwd: abs,
		absolute: true,
		onlyFiles: true
	})).sort();
}
async function readTheme(mdAbs, themesRoot) {
	const id = path.basename(mdAbs, ".md");
	const { fm, body } = parseFrontmatter(await fs.readFile(mdAbs, "utf8"), id);
	const demoCandidates = [
		`${id}.demo.tsx`,
		`${id}.demo.jsx`,
		`${id}.demo.ts`,
		`${id}.demo.js`
	];
	let demoAbs = null;
	for (const cand of demoCandidates) {
		const p = path.join(themesRoot, cand);
		if (existsSync(p)) {
			demoAbs = p;
			break;
		}
	}
	return {
		id,
		frontmatter: fm,
		body,
		demoAbs
	};
}
function generateThemesModule(themes, isDev) {
	const meta = themes.map((t) => ({
		id: t.id,
		name: t.frontmatter.name,
		description: t.frontmatter.description,
		body: t.body,
		hasDemo: t.demoAbs !== null
	}));
	const cases = themes.flatMap((t) => {
		const abs = t.demoAbs;
		if (!abs) return [];
		const importPath = isDev ? `@fs/${normalizePath(abs).replace(/^\/+/, "")}` : abs;
		const importExpr = isDev ? `import(/* @vite-ignore */ import.meta.env.BASE_URL + ${JSON.stringify(importPath)})` : `import(${JSON.stringify(importPath)})`;
		return [`    case ${JSON.stringify(t.id)}: return ${importExpr};`];
	}).join("\n");
	return `// virtual:open-slide/themes — generated
export const themes = ${JSON.stringify(meta)};

export async function loadThemeDemo(id) {
  switch (id) {
${cases}
    default: throw new Error('Theme demo not found: ' + id);
  }
}
`;
}
function themesPlugin(opts) {
	const { userCwd, config } = opts;
	const themesDir = config.themesDir ?? "themes";
	const themesRoot = path.resolve(userCwd, themesDir);
	let isDev = false;
	return {
		name: "open-slide:themes",
		config(_c, env) {
			isDev = env.command === "serve";
		},
		resolveId(id) {
			if (id === THEMES_VMOD) return resolved(THEMES_VMOD);
			return null;
		},
		async load(id) {
			if (id !== resolved(THEMES_VMOD)) return null;
			const files = await findThemes(userCwd, themesDir);
			return generateThemesModule(await Promise.all(files.map((f) => readTheme(f, themesRoot))), isDev);
		},
		configureServer(server) {
			const isThemeFile = (p) => {
				const rel = path.relative(themesRoot, p);
				if (rel.startsWith("..") || path.isAbsolute(rel)) return false;
				if (rel.includes(path.sep)) return false;
				return /\.(md|demo\.(tsx|jsx|ts|js))$/.test(rel);
			};
			let reloadTimer = null;
			const reload = () => {
				if (reloadTimer) clearTimeout(reloadTimer);
				reloadTimer = setTimeout(() => {
					reloadTimer = null;
					const mod = server.moduleGraph.getModuleById(resolved(THEMES_VMOD));
					if (mod) server.moduleGraph.invalidateModule(mod);
					server.ws.send({ type: "full-reload" });
				}, 150);
			};
			if (existsSync(themesRoot)) server.watcher.add(themesRoot);
			server.watcher.on("add", (p) => {
				if (isThemeFile(p)) reload();
			});
			server.watcher.on("unlink", (p) => {
				if (isThemeFile(p)) reload();
			});
			server.watcher.on("change", (p) => {
				if (isThemeFile(p)) reload();
			});
		}
	};
}
//#endregion
//#region src/vite/config.ts
function findPackageRoot(fromFile) {
	let dir = path.dirname(fromFile);
	while (dir !== path.dirname(dir)) {
		if (existsSync(path.join(dir, "package.json"))) return dir;
		dir = path.dirname(dir);
	}
	throw new Error(`Could not find package.json walking up from ${fromFile}`);
}
const PKG_ROOT = findPackageRoot(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(PKG_ROOT, "src", "app");
function readCoreVersion() {
	try {
		const raw = readFileSync(path.join(PKG_ROOT, "package.json"), "utf8");
		return JSON.parse(raw).version ?? "0.0.0";
	} catch {
		return "0.0.0";
	}
}
const CORE_VERSION = readCoreVersion();
const RUNTIME_ASSET_ROOTS = resolveRuntimeAssetRoots();
function resolveRuntimeAssetRoots() {
	const require = createRequire(import.meta.url);
	const roots = [];
	for (const pkg of ["@fontsource-variable/geist"]) try {
		roots.push(path.dirname(require.resolve(`${pkg}/package.json`)));
	} catch {}
	return roots;
}
async function createViteConfig(opts) {
	const userCwd = path.resolve(opts.userCwd);
	const config = opts.config ?? await loadUserConfig(userCwd);
	const slidesDir = config.slidesDir ?? "slides";
	const themesDir = config.themesDir ?? "themes";
	const assetsDir = config.assetsDir ?? "assets";
	const slidesAbs = path.resolve(userCwd, slidesDir);
	const themesAbs = path.resolve(userCwd, themesDir);
	const assetsAbs = path.resolve(userCwd, assetsDir);
	return {
		base: config.base ?? "/",
		root: APP_ROOT,
		configFile: false,
		envDir: userCwd,
		plugins: [
			locTagsPlugin({
				userCwd,
				slidesDir
			}),
			react(),
			tailwindcss(),
			openSlidePlugin({
				userCwd,
				config,
				coreVersion: CORE_VERSION
			}),
			themesPlugin({
				userCwd,
				config
			}),
			designPlugin({ userCwd }),
			apiPlugin({
				userCwd,
				slidesDir,
				assetsDir,
				coreVersion: CORE_VERSION
			}),
			currentPlugin({
				userCwd,
				slidesDir
			})
		],
		resolve: {
			alias: {
				"@": APP_ROOT,
				"@assets": assetsAbs
			},
			dedupe: ["react", "react-dom"]
		},
		optimizeDeps: {
			entries: [path.join(APP_ROOT, "main.tsx")],
			include: [
				"react",
				"react-dom",
				"react-dom/client",
				"next-themes",
				"react-router-dom",
				"@base-ui/react",
				"use-sync-external-store/shim",
				"use-sync-external-store/shim/with-selector",
				"lucide-react",
				"clsx",
				"tailwind-merge",
				"class-variance-authority",
				"emoji-picker-react"
			],
			rolldownOptions: { plugins: [{
				name: "open-slide:virtual-externals",
				resolveId(id) {
					return id.startsWith("virtual:open-slide/") ? {
						id,
						external: true
					} : null;
				}
			}] }
		},
		server: {
			port: config.port ?? 5173,
			...config.allowedHosts !== void 0 ? { allowedHosts: config.allowedHosts } : {},
			fs: { allow: [
				APP_ROOT,
				...RUNTIME_ASSET_ROOTS,
				userCwd,
				slidesAbs,
				themesAbs,
				assetsAbs
			] }
		},
		build: {
			outDir: path.resolve(userCwd, "dist"),
			emptyOutDir: true
		}
	};
}
//#endregion
export { DEV_SUPERVISED_ENV as n, createViteConfig as t };
