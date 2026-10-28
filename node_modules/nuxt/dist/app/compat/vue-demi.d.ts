import { del, install, set } from "./capi.js";
export * from "vue";
//#region src/app/compat/vue-demi.d.ts
export declare const Vue2: undefined;
export declare const isVue2 = false;
export declare const isVue3 = true;
//#endregion
export { del, install, set };