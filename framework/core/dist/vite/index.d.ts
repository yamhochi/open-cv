import { t as OpenSlideConfig } from "../config-GMR1QUlM.js";
import { InlineConfig } from "vite";
//#region src/vite/config.d.ts
type CreateViteConfigOptions = {
  userCwd: string;
  config?: OpenSlideConfig;
  mode?: 'serve' | 'build';
};
declare function createViteConfig(opts: CreateViteConfigOptions): Promise<InlineConfig>;
//#endregion
export { createViteConfig };