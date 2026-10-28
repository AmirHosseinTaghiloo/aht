//#region src/runtime/server/renderer/error-template.d.ts
export type DefaultMessages = Record<"appName" | "status" | "statusText" | "description" | "refresh", string | boolean | number>;
export declare const template: (messages: Partial<DefaultMessages>) => string;
//#endregion