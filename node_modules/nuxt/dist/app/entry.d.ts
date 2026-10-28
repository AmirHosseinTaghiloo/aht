import { NuxtSSRContext } from "./types.js";
import "./nuxt.js";
import { App } from "vue";
import "#build/fetch";
import "#build/global-polyfills.mjs";
import "#build/css";
//#region src/app/entry.d.ts
export type Entry = (ssrContext?: NuxtSSRContext) => Promise<App<Element>>;
declare const _default: Entry;
//#endregion
export { _default as default };