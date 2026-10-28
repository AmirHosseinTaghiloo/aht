export * from "vue";
//#region src/app/compat/capi.d.ts
export declare const install: () => void;
export declare function set<T>(target: any, key: string | number | symbol, val: T): T;
export declare function del(target: any, key: string | number | symbol): void;
//#endregion