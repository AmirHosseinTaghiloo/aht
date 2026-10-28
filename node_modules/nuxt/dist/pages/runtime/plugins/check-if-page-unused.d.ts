import { ObjectPlugin, Plugin } from "#app/nuxt";
import { RouteLocationNormalizedLoaded, RouteRecordNormalized } from "vue-router";
//#region src/pages/runtime/plugins/check-if-page-unused.d.ts
export declare function findUnrenderedNestedPage(route: RouteLocationNormalizedLoaded): {
  parent: RouteRecordNormalized;
  child: RouteRecordNormalized;
} | undefined;
export declare const NESTED_PAGE_CONFIRMATION_DELAY = 1000;
declare const plugin: Plugin & ObjectPlugin;
//#endregion
export { plugin as default };