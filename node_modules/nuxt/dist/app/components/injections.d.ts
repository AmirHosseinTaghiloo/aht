import { ComputedRef, InjectionKey } from "vue";
import { RouteLocationNormalizedLoaded } from "vue-router";
//#region src/app/components/injections.d.ts
export interface LayoutMeta {
  isCurrent: (route: RouteLocationNormalizedLoaded) => boolean;
}
export declare const LayoutMetaSymbol: InjectionKey<LayoutMeta>;
export declare const LayoutSymbol: InjectionKey<Readonly<ComputedRef<string | false>>>;
export declare const PageRouteSymbol: InjectionKey<RouteLocationNormalizedLoaded>;
//#endregion