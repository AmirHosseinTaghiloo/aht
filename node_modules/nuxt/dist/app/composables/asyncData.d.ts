import { NuxtError } from "../error.js";
import "./error.js";
import { MergedAddonsExtensions, MergedAddonsOptions, UseAsyncDataAddon } from "./addons.js";
import { NuxtApp } from "../nuxt.js";
import { MaybeRefOrGetter, MultiWatchSources, Ref } from "vue";
//#region src/app/composables/asyncData.d.ts
export type AsyncDataRequestStatus = 'idle' | 'pending' | 'success' | 'error';
export type _Transform<Input = any, Output = any> = (input: Input) => Output | Promise<Output>;
export interface AsyncDataHandlerContext {
  signal: AbortSignal;
}
export type AsyncDataMiddleware<ResT = unknown> = (next: () => Promise<ResT>, ctx: AsyncDataHandlerContext) => Promise<ResT>;
export type AsyncDataHandler<ResT> = (nuxtApp: NuxtApp, ctx: AsyncDataHandlerContext) => Promise<ResT>;
export type PickFrom<T, K extends Array<string>> = KeysOf<T> extends K ? T : T extends Array<any> ? T : T extends Record<string, any> ? keyof T extends K[number] ? T : K[number] extends never ? T : Pick<T, K[number]> : T;
export type KeysOf<T> = Array<T extends T ? keyof T extends string ? keyof T : never : never>;
export type KeyOfRes<Transform extends _Transform> = KeysOf<ReturnType<Transform>>;
export type NoInfer<T> = [T][T extends any ? 0 : never];
export type AsyncDataRefreshCause = 'initial' | 'refresh:hook' | 'refresh:manual' | 'watch';
interface BaseAsyncDataOptions<ResT, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = undefined> {
  /**
   * Whether to fetch on the server side.
   * @default true
   */
  server?: boolean;
  /**
   * Whether to resolve the async function after loading the route, instead of blocking client-side navigation
   * @default false
   */
  lazy?: boolean;
  /**
   * a factory function to set the default value of the data, before the async function resolves - useful with the `lazy: true` or `immediate: false` options
   */
  default?: () => DefaultT | Ref<DefaultT>;
  /**
   * Only pick specified keys in this array from the handler function result.
   * Do not use it along with the `transform` option.
   */
  pick?: PickKeys;
  /**
   * Watch reactive sources to auto-refresh when changed
   */
  watch?: MultiWatchSources;
  /**
   * When set to false, will prevent the request from firing immediately
   * @default true
   */
  immediate?: boolean;
  /**
   * Return data in a deep ref object (it is false by default). It can be set to false to return data in a shallow ref object, which can improve performance if your data does not need to be deeply reactive.
   */
  deep?: boolean;
  /**
   * Avoid fetching the same key more than once at a time
   * @default 'cancel'
   */
  dedupe?: 'cancel' | 'defer';
  /**
   * A timeout in milliseconds after which the request will be aborted if it has not resolved yet.
   */
  timeout?: number;
  /**
   * Controls whether to run the async function
   * @default true
   */
  enabled?: MaybeRefOrGetter<boolean>;
  /**
   * Whether to store resolved data in the Nuxt payload (and therefore serialize it into `__NUXT_DATA__` when server-rendered).
   * When `false`, data fetched on the server is kept out of the payload entirely and the client will refetch
   * after hydration if a component renders it. Pair with lazy hydration (e.g. `hydrate-never`) to avoid
   * hydration mismatches and unnecessary client fetches.
   * @default true
   */
  serialize?: boolean;
  /**
   * Functions wrapping the handler; the first entry is the outermost. Call `next()` to continue or throw to abort.
   */
  middleware?: AsyncDataMiddleware<NoInfer<ResT>>[];
}
export interface AsyncDataOptions<ResT, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = undefined> extends BaseAsyncDataOptions<ResT, DataT, PickKeys, DefaultT> {
  /**
   * Provide a function which returns cached data.
   * An `undefined` return value will trigger a fetch.
   * Default is `key => nuxt.isHydrating ? nuxt.payload.data[key] : nuxt.static.data[key]` which only caches data when payloadExtraction is enabled.
   */
  getCachedData?: (key: string, nuxtApp: NuxtApp, context: {
    cause: AsyncDataRefreshCause;
  }) => NoInfer<DataT> | undefined;
  /**
   * A function that can be used to alter handler function result after resolving.
   * Do not use it along with the `pick` option.
   */
  transform?: _Transform<ResT, DataT>;
}
export interface AsyncDataOptionsWithTransform<ResT, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = undefined> extends BaseAsyncDataOptions<ResT, DataT, PickKeys, DefaultT> {
  /**
   * Provide a function which returns cached data.
   * An `undefined` return value will trigger a fetch.
   * Default is `key => nuxt.isHydrating ? nuxt.payload.data[key] : nuxt.static.data[key]` which only caches data when payloadExtraction is enabled.
   */
  getCachedData?: (key: string, nuxtApp: NuxtApp, context: {
    cause: AsyncDataRefreshCause;
  }) => NoInfer<DataT | undefined>;
  /**
   * A function that can be used to alter handler function result after resolving.
   * Do not use it along with the `pick` option.
   */
  transform: _Transform<ResT, DataT>;
}
export interface AsyncDataExecuteOptions {
  /**
   * Force a refresh, even if there is already a pending request. Previous requests will
   * not be cancelled, but their result will not affect the data/pending state - and any
   * previously awaited promises will not resolve until this new request resolves.
   */
  dedupe?: 'cancel' | 'defer';
  cause?: AsyncDataRefreshCause;
  /** @internal */
  cachedData?: any;
  signal?: AbortSignal;
  timeout?: number;
}
export interface _AsyncData<DataT, ErrorT> {
  data: Ref<DataT>;
  pending: Ref<boolean>;
  refresh: (opts?: AsyncDataExecuteOptions) => Promise<void>;
  execute: (opts?: AsyncDataExecuteOptions) => Promise<void>;
  clear: () => void;
  error: Ref<ErrorT | undefined>;
  status: Ref<AsyncDataRequestStatus>;
}
export type AsyncData<Data, Error> = _AsyncData<Data, Error> & Promise<_AsyncData<Data, Error>>;
export type AsyncDataWithExtensions<Data, Error, Ext> = _AsyncData<Data, Error> & Ext & Promise<_AsyncData<Data, Error> & Ext>;
export type AugmentedAsyncData<Data, Error, Ext> = [keyof Ext] extends [never] ? AsyncData<Data, Error> : AsyncDataWithExtensions<Data, Error, Ext>;
type NuxtErrorFor<NuxtErrorDataT> = NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>;
type FactoryDataT<FDataT, ResT> = [unknown] extends [FDataT] ? ResT : FDataT;
type FactoryDefaultT<FDefaultT, Fallback> = [undefined] extends [FDefaultT] ? Fallback : FDefaultT;
type FactoryPickKeys<FPickKeys, PickKeys, DataT> = [Array<never>] extends [FPickKeys] ? PickKeys : FPickKeys & KeysOf<DataT>;
export interface UseAsyncData<FResT = unknown, FDataT = unknown, FPickKeys extends KeysOf<FDataT> = never[], FDefaultT = undefined, FAddonOpts = {}, FAddonExt = {}> {
  <ResT = FResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = FactoryDefaultT<FDefaultT, undefined>>(handler: AsyncDataHandler<ResT>, opts: AsyncDataOptionsWithTransform<ResT, DataT, PickKeys, DefaultT> & FAddonOpts): AugmentedAsyncData<PickFrom<DataT, PickKeys> | DefaultT, NuxtErrorFor<NuxtErrorDataT> | undefined, FAddonExt>;
  <ResT = FResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = FactoryDefaultT<FDefaultT, DataT>>(handler: AsyncDataHandler<ResT>, opts: AsyncDataOptionsWithTransform<ResT, DataT, PickKeys, DefaultT> & FAddonOpts): AugmentedAsyncData<PickFrom<DataT, PickKeys> | DefaultT, NuxtErrorFor<NuxtErrorDataT> | undefined, FAddonExt>;
  <ResT = FResT, NuxtErrorDataT = unknown, DataT = FactoryDataT<FDataT, ResT>, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = FactoryDefaultT<FDefaultT, undefined>>(handler: AsyncDataHandler<ResT>, opts?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT> & FAddonOpts): AugmentedAsyncData<PickFrom<DataT, FactoryPickKeys<FPickKeys, PickKeys, DataT>> | DefaultT, NuxtErrorFor<NuxtErrorDataT> | undefined, FAddonExt>;
  <ResT = FResT, NuxtErrorDataT = unknown, DataT = FactoryDataT<FDataT, ResT>, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = FactoryDefaultT<FDefaultT, DataT>>(handler: AsyncDataHandler<ResT>, opts?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT> & FAddonOpts): AugmentedAsyncData<PickFrom<DataT, FactoryPickKeys<FPickKeys, PickKeys, DataT>> | DefaultT, NuxtErrorFor<NuxtErrorDataT> | undefined, FAddonExt>;
  <ResT = FResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = FactoryDefaultT<FDefaultT, undefined>>(key: MaybeRefOrGetter<string>, handler: AsyncDataHandler<ResT>, opts: AsyncDataOptionsWithTransform<ResT, DataT, PickKeys, DefaultT> & FAddonOpts): AugmentedAsyncData<PickFrom<DataT, PickKeys> | DefaultT, NuxtErrorFor<NuxtErrorDataT> | undefined, FAddonExt>;
  <ResT = FResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = FactoryDefaultT<FDefaultT, DataT>>(key: MaybeRefOrGetter<string>, handler: AsyncDataHandler<ResT>, opts: AsyncDataOptionsWithTransform<ResT, DataT, PickKeys, DefaultT> & FAddonOpts): AugmentedAsyncData<PickFrom<DataT, PickKeys> | DefaultT, NuxtErrorFor<NuxtErrorDataT> | undefined, FAddonExt>;
  <ResT = FResT, NuxtErrorDataT = unknown, DataT = FactoryDataT<FDataT, ResT>, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = FactoryDefaultT<FDefaultT, undefined>>(key: MaybeRefOrGetter<string>, handler: AsyncDataHandler<ResT>, opts?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT> & FAddonOpts): AugmentedAsyncData<PickFrom<DataT, FactoryPickKeys<FPickKeys, PickKeys, DataT>> | DefaultT, NuxtErrorFor<NuxtErrorDataT> | undefined, FAddonExt>;
  <ResT = FResT, NuxtErrorDataT = unknown, DataT = FactoryDataT<FDataT, ResT>, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = FactoryDefaultT<FDefaultT, DataT>>(key: MaybeRefOrGetter<string>, handler: AsyncDataHandler<ResT>, opts?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT> & FAddonOpts): AugmentedAsyncData<PickFrom<DataT, FactoryPickKeys<FPickKeys, PickKeys, DataT>> | DefaultT, NuxtErrorFor<NuxtErrorDataT> | undefined, FAddonExt>;
}
export type CreateUseAsyncDataOptions<FResT, FDataT = FResT, FPickKeys extends KeysOf<FDataT> = KeysOf<FDataT>, FDefaultT = undefined, FAddons extends ReadonlyArray<UseAsyncDataAddon<any, any>> = []> = Partial<AsyncDataOptions<FResT, FDataT, FPickKeys, FDefaultT>> & {
  addons?: FAddons;
};
export interface CreateUseAsyncData {
  <FResT, FDataT = FResT, FPickKeys extends KeysOf<FDataT> = KeysOf<FDataT>, FDefaultT = undefined, const FAddons extends ReadonlyArray<UseAsyncDataAddon<any, any>> = []>(options?: CreateUseAsyncDataOptions<FResT, FDataT, FPickKeys, FDefaultT, FAddons> | ((callerOptions: AsyncDataOptions<unknown>) => Partial<AsyncDataOptions<FResT, FDataT, FPickKeys, FDefaultT>>)): UseAsyncData<FResT, FDataT, FPickKeys, FDefaultT, MergedAddonsOptions<FAddons>, MergedAddonsExtensions<FAddons>>;
}
/**
 * A factory function to create a custom `useAsyncData` composable with pre-defined default options.
 * @since 4.4.0
 */
export declare const createUseAsyncData: CreateUseAsyncData;
/** @internal */
export declare function _createUseAsyncData<FResT, FDataT = FResT, FPickKeys extends KeysOf<FDataT> = KeysOf<FDataT>, FDefaultT = undefined>(options?: Partial<AsyncDataOptions<FResT, FDataT, FPickKeys, FDefaultT>> | ((callerOptions: AsyncDataOptions<unknown>) => Partial<AsyncDataOptions<FResT, FDataT, FPickKeys, FDefaultT>>)): UseAsyncData<FResT, FDataT, FPickKeys, FDefaultT>;
export declare const useAsyncData: UseAsyncData;
export declare const useLazyAsyncData: UseAsyncData;
/** @internal */
export declare function _isAutoKeyNeeded(keyOrFetcher: string | MaybeRefOrGetter<string> | (() => any), fetcher: () => any): boolean;
/** @since 3.1.0 */
export declare function useNuxtData<DataT = any>(key: string): {
  data: Ref<DataT | undefined>;
};
/** @since 3.0.0 */
export declare function refreshNuxtData(keys?: string | string[]): Promise<void>;
/** @since 3.0.0 */
export declare function clearNuxtData(keys?: string | string[] | ((key: string) => boolean)): void;
export type CreatedAsyncData<ResT, NuxtErrorDataT = unknown, DataT = ResT, DefaultT = undefined> = Omit<_AsyncData<DataT | DefaultT, (NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>)>, 'clear' | 'refresh'> & {
  _off: () => void;
  _hash?: Record<string, string | undefined>;
  _default: () => unknown;
  _init: boolean;
  _deps: number;
  _execute: (opts?: AsyncDataExecuteOptions) => Promise<void>;
  _abortController?: AbortController;
};
//#endregion
export type { MultiWatchSources };