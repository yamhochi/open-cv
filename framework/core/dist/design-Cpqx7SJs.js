//#region src/app/lib/design.ts
function designToCssVars(d) {
	return {
		"--osd-bg": d.palette.bg,
		"--osd-text": d.palette.text,
		"--osd-accent": d.palette.accent,
		"--osd-font-display": d.fonts.display,
		"--osd-font-body": d.fonts.body,
		"--osd-size-hero": `${d.typeScale.hero}px`,
		"--osd-size-body": `${d.typeScale.body}px`,
		"--osd-radius": `${d.radius}px`
	};
}
function cssVarsToString(vars) {
	return Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join("\n");
}
const defaultDesign = {
	palette: {
		bg: "#f7f5f0",
		text: "#1a1814",
		accent: "#6d4cff"
	},
	fonts: {
		display: "Georgia, \"Times New Roman\", serif",
		body: "-apple-system, BlinkMacSystemFont, \"Inter\", system-ui, sans-serif"
	},
	typeScale: {
		hero: 168,
		body: 36
	},
	radius: 12
};
//#endregion
export { defaultDesign as n, designToCssVars as r, cssVarsToString as t };
