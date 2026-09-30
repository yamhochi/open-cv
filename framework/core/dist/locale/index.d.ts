import { n as Plural, t as Locale } from "../types-BcbaKTNY.js";
//#region src/locale/en.d.ts
declare const en: Locale;
//#endregion
//#region src/locale/format.d.ts
declare function format(template: string, vars: Record<string, string | number>): string;
declare function plural(count: number, forms: Plural): string;
//#endregion
//#region src/locale/ja.d.ts
declare const ja: Locale;
//#endregion
//#region src/locale/zh-cn.d.ts
declare const zhCN: Locale;
//#endregion
//#region src/locale/zh-tw.d.ts
declare const zhTW: Locale;
//#endregion
export { type Locale, type Plural, en, format, ja, plural, zhCN, zhTW };