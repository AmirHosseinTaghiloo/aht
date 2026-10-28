import { vaporInteropPlugin } from "vue";
import { defineNuxtPlugin } from "#app/nuxt";
//#region src/app/plugins/vapor-interop.client.ts
var vapor_interop_client_default = defineNuxtPlugin({
	name: "nuxt:vapor-interop",
	enforce: "pre",
	setup(nuxtApp) {
		nuxtApp.vueApp.use(vaporInteropPlugin);
	}
});
//#endregion
export { vapor_interop_client_default as default };
