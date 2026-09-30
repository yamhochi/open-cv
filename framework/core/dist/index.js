import { i as en, n as zhCN, r as ja, t as zhTW } from "./zh-tw-DlZoAc2-.js";
import { n as defaultDesign, r as designToCssVars, t as cssVarsToString } from "./design-Cpqx7SJs.js";
import { Children, cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import "virtual:open-slide/slides";
import config from "virtual:open-slide/config";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/app/lib/assets.ts
async function listAssets(slideId) {
	const res = await fetch(`/__assets/${slideId}`);
	if (!res.ok) throw new Error(`GET /__assets/${slideId} ${res.status}`);
	return (await res.json()).assets ?? [];
}
async function uploadAsset(slideId, file, opts = {}) {
	const qs = opts.overwrite ? "?overwrite=1" : "";
	return fetch(`/__assets/${slideId}/${encodeURIComponent(file.name)}${qs}`, {
		method: "POST",
		headers: {
			"content-type": file.type || "application/octet-stream",
			"content-length": String(file.size)
		},
		body: file
	});
}
async function uploadWithAutoRename(slideId, file) {
	let uploaded = lowercaseExtension(file);
	let res = await uploadAsset(slideId, uploaded);
	if (res.status === 409) {
		const list = await listAssets(slideId);
		const taken = new Set(list.map((a) => a.name));
		uploaded = renamedCopy(uploaded, taken);
		res = await uploadAsset(slideId, uploaded);
	}
	if (!res.ok) return {
		ok: false,
		status: res.status,
		entry: null
	};
	const body = await res.json().catch(() => null);
	const now = Date.now();
	const entry = {
		name: body?.name ?? uploaded.name,
		size: body?.size ?? uploaded.size,
		createdAt: body?.createdAt ?? now,
		mtime: body?.mtime ?? now,
		mime: body?.mime ?? uploaded.type ?? "application/octet-stream",
		url: body?.url ?? `/__assets/${slideId}/${encodeURIComponent(uploaded.name)}`,
		unused: body?.unused ?? false
	};
	return {
		ok: true,
		status: res.status,
		entry
	};
}
function lowercaseExtension(file) {
	const dot = file.name.lastIndexOf(".");
	if (dot <= 0) return file;
	const ext = file.name.slice(dot);
	const lower = ext.toLowerCase();
	if (ext === lower) return file;
	return new File([file], file.name.slice(0, dot) + lower, {
		type: file.type,
		lastModified: file.lastModified
	});
}
function renamedCopy(file, taken) {
	const dot = file.name.lastIndexOf(".");
	const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
	const ext = dot > 0 ? file.name.slice(dot) : "";
	let i = 1;
	let next = `${stem}-${i}${ext}`;
	while (taken.has(next)) {
		i += 1;
		next = `${stem}-${i}${ext}`;
	}
	return new File([file], next, {
		type: file.type,
		lastModified: file.lastModified
	});
}
//#endregion
//#region src/app/lib/locale-store.ts
const LOCALES = {
	en,
	"zh-TW": zhTW,
	"zh-CN": zhCN,
	ja
};
const STORAGE_KEY = "open-slide:locale";
const configLocale = config.locale;
function isLocaleId(value) {
	return value === "en" || value === "zh-TW" || value === "zh-CN" || value === "ja";
}
function readStored() {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (isLocaleId(stored)) return LOCALES[stored];
	} catch {}
	return configLocale ?? en;
}
let current = readStored();
const listeners = /* @__PURE__ */ new Set();
function subscribe(listener) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}
function getSnapshot() {
	return current;
}
function useLocaleValue() {
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
//#endregion
//#region src/app/lib/use-locale.ts
function useLocale() {
	return useLocaleValue();
}
//#endregion
//#region src/app/lib/dom.ts
function dragHasFiles(e) {
	const types = e.dataTransfer?.types;
	if (!types) return false;
	for (let i = 0; i < types.length; i++) if (types[i] === "Files") return true;
	return false;
}
//#endregion
//#region src/app/components/image-placeholder.tsx
function ImagePlaceholder({ hint, width, height, style, className, ...rest }) {
	const dims = width && height ? `${width} × ${height}` : null;
	const [dragActive, setDragActive] = useState(false);
	const [uploading, setUploading] = useState(false);
	const dragDepth = useRef(0);
	const t = useLocale();
	const dndProps = import.meta.env.DEV ? {
		onDragEnter: (e) => {
			if (uploading || !dragHasFiles(e)) return;
			e.preventDefault();
			dragDepth.current += 1;
			setDragActive(true);
		},
		onDragOver: (e) => {
			if (uploading || !dragHasFiles(e)) return;
			e.preventDefault();
			e.dataTransfer.dropEffect = "copy";
		},
		onDragLeave: () => {
			dragDepth.current = Math.max(0, dragDepth.current - 1);
			if (dragDepth.current === 0) setDragActive(false);
		},
		onDrop: (e) => {
			if (uploading || !dragHasFiles(e)) return;
			e.preventDefault();
			dragDepth.current = 0;
			setDragActive(false);
			const file = pickImageFile(e.dataTransfer.files);
			if (!file) return;
			const root = e.currentTarget;
			const slideId = root.closest("[data-slide-id]")?.dataset.slideId;
			const loc = root.dataset.slideLoc;
			if (!slideId || !loc) return;
			const idx = loc.indexOf(":");
			if (idx <= 0) return;
			const line = Number(loc.slice(0, idx));
			const column = Number(loc.slice(idx + 1));
			if (!Number.isFinite(line) || !Number.isFinite(column)) return;
			setUploading(true);
			handleDrop(slideId, file, line, column).catch(() => toast.error(t.imagePlaceholder.uploadFailed)).finally(() => setUploading(false));
		}
	} : null;
	return /* @__PURE__ */ jsxs("div", {
		...rest,
		...dndProps,
		"data-slide-placeholder": hint,
		"data-placeholder-w": width,
		"data-placeholder-h": height,
		role: "img",
		"aria-label": hint,
		style: {
			position: "relative",
			width: width ?? "100%",
			height: height ?? "100%",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			flexDirection: "column",
			gap: 14,
			border: "1px dashed rgba(120, 120, 130, 0.35)",
			borderRadius: 12,
			background: "linear-gradient(135deg, rgba(120,120,130,0.06) 0%, rgba(120,120,130,0.02) 50%, rgba(120,120,130,0.06) 100%)",
			color: "rgba(90, 90, 100, 0.7)",
			fontFamily: "-apple-system, BlinkMacSystemFont, \"Inter\", \"Segoe UI\", system-ui, sans-serif",
			textAlign: "center",
			padding: 24,
			boxSizing: "border-box",
			overflow: "hidden",
			...style
		},
		className,
		children: [
			/* @__PURE__ */ jsx(PlaceholderIcon, {}),
			/* @__PURE__ */ jsxs("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 6,
					maxWidth: "85%"
				},
				children: [
					/* @__PURE__ */ jsx("span", {
						style: {
							fontSize: 11,
							fontWeight: 600,
							letterSpacing: "0.14em",
							textTransform: "uppercase",
							opacity: .55
						},
						children: "Image"
					}),
					/* @__PURE__ */ jsx("span", {
						style: {
							fontSize: 16,
							fontWeight: 500,
							lineHeight: 1.4,
							color: "rgba(60, 60, 70, 0.85)"
						},
						children: hint
					}),
					dims && /* @__PURE__ */ jsx("span", {
						style: {
							fontSize: 11,
							fontVariantNumeric: "tabular-nums",
							fontFamily: "ui-monospace, \"SF Mono\", Menlo, Consolas, monospace",
							opacity: .5,
							marginTop: 2
						},
						children: dims
					})
				]
			}),
			import.meta.env.DEV && (dragActive || uploading) && /* @__PURE__ */ jsx(DropOverlay, { label: uploading ? t.imagePlaceholder.uploading : t.imagePlaceholder.dropOverlay })
		]
	});
}
function DropOverlay({ label }) {
	return /* @__PURE__ */ jsx("div", {
		"aria-hidden": true,
		style: {
			position: "absolute",
			inset: 0,
			pointerEvents: "none",
			borderRadius: 12,
			border: "2px dashed oklch(0.62 0.18 250)",
			background: "oklch(0.62 0.18 250 / 0.08)",
			display: "flex",
			alignItems: "center",
			justifyContent: "center"
		},
		children: /* @__PURE__ */ jsx("span", {
			style: {
				fontSize: 12,
				fontWeight: 600,
				letterSpacing: "0.02em",
				color: "oklch(0.45 0.16 250)",
				background: "rgba(255,255,255,0.92)",
				padding: "6px 10px",
				borderRadius: 6,
				boxShadow: "0 1px 2px rgba(0,0,0,0.08)"
			},
			children: label
		})
	});
}
function pickImageFile(files) {
	for (let i = 0; i < files.length; i++) {
		const f = files[i];
		if (f.type.startsWith("image/")) return f;
	}
	return null;
}
async function handleDrop(slideId, file, line, column) {
	const { ok, entry } = await uploadWithAutoRename(slideId, file);
	if (!ok || !entry) throw new Error("upload failed");
	const res = await fetch("/__edit", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			slideId,
			line,
			column,
			ops: [{
				kind: "replace-placeholder-with-image",
				assetPath: `./assets/${entry.name}`
			}]
		})
	});
	if (!res.ok) throw new Error(`edit failed (${res.status})`);
}
function PlaceholderIcon() {
	return /* @__PURE__ */ jsxs("svg", {
		width: "32",
		height: "32",
		viewBox: "0 0 32 32",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "1.5",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		style: { opacity: .55 },
		role: "img",
		"aria-label": "image placeholder",
		children: [
			/* @__PURE__ */ jsx("title", { children: "image placeholder" }),
			/* @__PURE__ */ jsx("rect", {
				x: "4",
				y: "6",
				width: "24",
				height: "20",
				rx: "2.5"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "11",
				cy: "13",
				r: "2"
			}),
			/* @__PURE__ */ jsx("path", { d: "M4 22l7-7 6 6 4-4 7 7" })
		]
	});
}
//#endregion
//#region src/app/components/morph-element.tsx
function MorphElement({ id, children, className, style }) {
	const child = Children.toArray(children)[0] ?? null;
	if (Children.count(children) === 1 && isValidElement(child) && typeof child.type === "string") return cloneElement(child, {
		"data-osd-morph": id,
		className: [child.props.className, className].filter(Boolean).join(" ") || void 0,
		style: style ? {
			...child.props.style,
			...style
		} : child.props.style
	});
	return /* @__PURE__ */ jsx("div", {
		className,
		style,
		"data-osd-morph": id,
		children
	});
}
//#endregion
//#region src/app/lib/page-context.tsx
const GLOBAL_KEY$1 = "__open_slide_page_context__";
const g$1 = globalThis;
if (!g$1[GLOBAL_KEY$1]) g$1[GLOBAL_KEY$1] = createContext(null);
const SlidePageContext = g$1[GLOBAL_KEY$1];
function useSlidePageNumber() {
	const ctx = useContext(SlidePageContext);
	if (!ctx) throw new Error("useSlidePageNumber must be called from a slide page rendered by @open-slide/core");
	return {
		current: ctx.index + 1,
		total: ctx.total
	};
}
//#endregion
//#region src/app/lib/sdk.ts
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
//#endregion
//#region src/app/lib/use-media-query.ts
function matchesMediaQuery(query) {
	if (typeof window === "undefined") return false;
	return window.matchMedia(query).matches;
}
function useMediaQuery(query) {
	const [matches, setMatches] = useState(() => matchesMediaQuery(query));
	useEffect(() => {
		const mql = window.matchMedia(query);
		setMatches(mql.matches);
		const onChange = (e) => setMatches(e.matches);
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, [query]);
	return matches;
}
//#endregion
//#region src/app/lib/use-prefers-reduced-motion.ts
const QUERY = "(prefers-reduced-motion: reduce)";
function usePrefersReducedMotion() {
	return useMediaQuery(QUERY);
}
//#endregion
//#region src/app/lib/step-context.tsx
const GLOBAL_KEY = "__open_slide_step_host_context__";
const g = globalThis;
if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = createContext(null);
const StepHostContext = g[GLOBAL_KEY];
function useIsActivePage() {
	return useContext(StepHostContext)?.isActivePage ?? false;
}
function Steps({ children }) {
	const host = useContext(StepHostContext);
	const flat = Children.toArray(children);
	const stepCount = flat.filter((c) => isValidElement(c) && c.type === Step).length;
	const initial = host?.controlled ? 0 : host?.entryDirection === "forward" ? 0 : stepCount;
	const revealedRef = useRef(initial);
	const [revealed, setRevealed] = useState(initial);
	const idRef = useRef({});
	const applyRevealed = useCallback((n) => {
		revealedRef.current = n;
		setRevealed(n);
	}, []);
	useLayoutEffect(() => {
		if (!host) return;
		const id = idRef.current;
		return host.register({
			id,
			stepCount,
			initialRevealed: revealedRef.current,
			controller: {
				advance: () => {
					if (revealedRef.current >= stepCount) return false;
					applyRevealed(revealedRef.current + 1);
					host.reportRevealed(id, revealedRef.current);
					return true;
				},
				retreat: () => {
					if (revealedRef.current <= 0) return false;
					applyRevealed(revealedRef.current - 1);
					host.reportRevealed(id, revealedRef.current);
					return true;
				}
			},
			setRevealed: applyRevealed
		});
	}, [
		host,
		stepCount,
		applyRevealed
	]);
	const effectiveRevealed = host ? revealed : stepCount;
	let stepIdx = 0;
	return /* @__PURE__ */ jsx(Fragment, { children: flat.map((child, key) => {
		if (isValidElement(child) && child.type === Step) {
			const idx = stepIdx++;
			return cloneElement(child, {
				key: child.key ?? key,
				_revealed: idx < effectiveRevealed
			});
		}
		return child;
	}) });
}
function Step({ children, duration = 180, _revealed }) {
	const reduceMotion = usePrefersReducedMotion();
	const revealed = _revealed ?? true;
	return /* @__PURE__ */ jsx("div", {
		"data-osd-step": revealed ? "revealed" : "pending",
		style: {
			opacity: revealed ? 1 : 0,
			visibility: revealed ? "visible" : "hidden",
			transition: `opacity ${reduceMotion ? 0 : duration}ms cubic-bezier(0, 0, 0.2, 1)`
		},
		children
	});
}
//#endregion
export { CANVAS_HEIGHT, CANVAS_WIDTH, ImagePlaceholder, MorphElement, Step, Steps, cssVarsToString, defaultDesign, designToCssVars, useIsActivePage, useSlidePageNumber };
