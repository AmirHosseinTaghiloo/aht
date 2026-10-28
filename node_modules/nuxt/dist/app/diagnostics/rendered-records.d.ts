import { RouteRecordNormalized } from "vue-router";
//#region src/app/diagnostics/rendered-records.d.ts
export declare function trackRenderedRecord(record: RouteRecordNormalized): () => void;
export declare function isRecordRendered(record: RouteRecordNormalized): boolean;
//#endregion