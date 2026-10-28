//#region src/boot.d.ts
/**
 * Paint the dev panel and bind its shortcuts, before the command graph loads.
 *
 * The `dev` command joins the same session and the same shortcut context, and
 * gives the terminal back if the resolved arguments refuse the panel.
 */
export declare function bootDevUI(): Promise<void>;
//#endregion