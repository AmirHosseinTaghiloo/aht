//#region src/vite/client.d.ts
/**
 * Browser-side companion for the Vite plugin. Mounts the overlay HTML pushed
 * over Vite's HMR channel and removes it when the error clears. A client already
 * listening to the channel renders later errors itself, so only the first is
 * mounted from here.
 */
export declare function installMyBadClient(hot?: ImportMetaHot | undefined): void;
type ImportMetaHot = NonNullable<ImportMeta["hot"]>;
//#endregion