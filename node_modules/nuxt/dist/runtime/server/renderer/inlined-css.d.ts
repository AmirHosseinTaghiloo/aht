//#region src/runtime/server/renderer/inlined-css.d.ts
/**
 * Build a predicate telling whether the contents of an emitted CSS file were
 * inlined as `<style>` tags for this request, meaning its `<link>` can be
 * dropped.
 *
 * The builder can only remove a link at build time when every CSS source in
 * the file is inlined for a module that is always rendered. For the rest it
 * records the modules that inline each source, and the answer depends on what
 * the request actually rendered: a component inside `<ClientOnly>` never
 * reaches `ssrContext.modules`, so its styles are only ever delivered by the
 * link. (#36058)
 */
export declare function createInlinedCSSFilter(modules: Set<string> | undefined): Promise<(file: string) => boolean>;
//#endregion