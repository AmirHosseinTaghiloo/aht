import { Component, ComponentOptions, DefineSetupFnComponent, InjectionKey, SlotsType, VNode } from "vue";
//#region src/app/components/client-only.d.ts
export declare const clientOnlySymbol: InjectionKey<boolean>;
interface ClientOnlyProps {
  fallback?: string;
  placeholder?: string;
  placeholderTag?: string;
  fallbackTag?: string;
}
type ClientOnlySlots = SlotsType<{
  default?: () => VNode[];
  /**
   * Specify a content to be rendered on the server and displayed until `<ClientOnly>` is mounted in the browser.
   */
  fallback?: () => VNode[];
  placeholder?: () => VNode[];
}>;
declare const ClientOnly: DefineSetupFnComponent<ClientOnlyProps, {}, ClientOnlySlots>;
export declare function createClientOnly<T extends ComponentOptions>(component: T): Component;
//#endregion
export { ClientOnly as default };