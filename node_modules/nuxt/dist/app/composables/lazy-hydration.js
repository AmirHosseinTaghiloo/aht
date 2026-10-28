//#region src/app/composables/lazy-hydration.ts
const neverHydratedSymbol = Symbol.for("nuxt:never-hydrated");
function defineLazyHydrationComponent(_strategy, _source) {}
//#endregion
export { defineLazyHydrationComponent, neverHydratedSymbol };
