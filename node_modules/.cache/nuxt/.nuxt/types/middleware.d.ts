declare module '@nuxt/schema' {
  interface RouteRuleConfigExtensions {
    appMiddleware?: string | string[] | Record<string, boolean>
  }
}
declare module 'nuxt/schema' {
  interface RouteRuleConfigExtensions {
    appMiddleware?: string | string[] | Record<string, boolean>
  }
}
export {}