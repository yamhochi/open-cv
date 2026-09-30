import { i as en, n as zhCN, r as ja, t as zhTW } from "../zh-tw-DlZoAc2-.js";
//#region src/locale/format.ts
function format(template, vars) {
	return template.replace(/\{(\w+)\}/g, (m, key) => {
		const v = vars[key];
		return v === void 0 ? m : String(v);
	});
}
function plural(count, forms) {
	return count === 1 ? forms.one : forms.other;
}
//#endregion
export { en, format, ja, plural, zhCN, zhTW };
