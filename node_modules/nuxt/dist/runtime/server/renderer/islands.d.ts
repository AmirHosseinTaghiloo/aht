import { NuxtIslandResponse, NuxtSSRContext } from "#app/types";
//#region src/runtime/server/renderer/islands.d.ts
/**
 * remove the root node from the html body
 */
export declare function getServerComponentHTML(body: string): string;
export declare function getSlotIslandResponse(ssrContext: NuxtSSRContext): NuxtIslandResponse['slots'];
export declare function getClientIslandResponse(ssrContext: NuxtSSRContext): NuxtIslandResponse['components'];
export declare function getComponentSlotTeleport(clientUid: string, teleports: Record<string, string>): Record<string, string>;
/**
 * Emit each island teleport as an inert `<template>` keyed by its anchor,
 * followed by a relocation script that moves the content into place before
 * hydration. Returns an empty string when there are no island teleports.
 */
export declare function renderStreamedIslandTeleports(ssrContext: NuxtSSRContext, nonceAttr?: string): string;
export declare function replaceIslandTeleports(ssrContext: NuxtSSRContext, html: string): string;
//#endregion