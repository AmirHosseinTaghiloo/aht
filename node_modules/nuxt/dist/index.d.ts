import { LoadNuxtOptions } from "@nuxt/kit";
import { Nuxt, NuxtOptions } from "nuxt/schema";
//#region src/core/nuxt.d.ts
export declare function createNuxt(options: NuxtOptions): Nuxt;
export declare function loadNuxt(opts: LoadNuxtOptions): Promise<Nuxt>;
//#endregion
//#region src/core/builder.d.ts
export declare function build(nuxt: Nuxt): Promise<void>;
//#endregion