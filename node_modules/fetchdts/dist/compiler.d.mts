import { c as HTTPMethod, r as EndpointMetadata, s as WildcardParam, t as DynamicParam } from "./tree-DXKy8PY7.mjs";
//#region src/compiler.d.ts
/**
 * A single segment of a route.
 *
 * Static segments may be written with or without a leading slash (`'/users'`, `'users'`), or as an
 * origin (`'https://api.example.com'`). Parameters are either the exported symbols or the plain
 * object form, which survives serialisation across a tool boundary.
 *
 * A static segment spanning several path segments is split into one key per segment; an origin is
 * kept whole.
 */
type RouteSegment = string | typeof DynamicParam | typeof WildcardParam | {
  type: "static";
  value: string;
} | {
  type: "dynamic";
} | {
  type: "wildcard";
};
interface Route {
  /**
   * The route, already split into segments. `fetchdts` does not parse route patterns; convert them
   * with whichever tool owns them.
   */
  segments: RouteSegment[];
  /**
   * Types for the endpoint, per method, as source. `ALL` describes a handler registered for every
   * method; a specific method takes precedence over it.
   */
  metadata?: { [key in HTTPMethod | "ALL"]?: Partial<Record<`${keyof EndpointMetadata}Type`, string>>; };
}
/** A set of routes sharing an origin. Several sets compile into one module, as several roots. */
interface RouteSet {
  routes: Route[];
  /** An origin the set is served from, for a schema describing an API on another host. */
  origin?: string;
}
/**
 * How the compiler resolved a path in the emitted module.
 *
 * - `table`: an exact-match table for static paths, and the tree for the rest. No path union, so an
 *   editor offers no completions; chosen where a union would cost more than it is worth.
 * - `table+union`: as `table`, and the union of every path, emitted as source.
 * - `tree`, `tree+union`: no table, for a route set with too few static paths to be worth one.
 */
type CompileStrategy = "table" | "table+union" | "tree" | "tree+union";
interface CompileStats {
  routes: number;
  static: number;
  dynamic: number;
  wildcard: number;
}
interface CompileOptions {
  /** The name of the emitted route tree interface. Defaults to `'Routes'`. */
  name?: string;
  /**
   * The interface the emitted accessors resolve a path against. Defaults to `name`.
   *
   * A consumer whose route map can be extended by hand declares an interface extending the emitted
   * one and points the accessors at it, so a route added by augmentation is still found. The name
   * must be in scope in the emitted module; pass it through `imports`.
   */
  resolveAgainst?: string;
  /**
   * Import statements to emit after the compiler's own, for a consumer whose metadata references
   * types it has to bring into scope. Emitting them here keeps the banner at the head of the file.
   */
  imports?: string[];
  /**
   * Where the emitted imports resolve to. Defaults to `'fetchdts'`.
   *
   * Pass the specifier the types are re-exported from where the consuming project does not depend on
   * `fetchdts` directly.
   */
  moduleSpecifier?: string;
  /**
   * The number of paths reached through a parameter above which the path union is not emitted.
   * Defaults to 200.
   *
   * A parameter contributes a template literal member, which is related against every call site
   * where a literal member is found through a map, so the union's cost tracks this count.
   */
  unionLimit?: number;
  /** Force a strategy, where the chosen one is wrong for a project. */
  strategy?: CompileStrategy;
}
interface CompiledRoutes {
  /** The emitted module. */
  code: string;
  strategy: CompileStrategy;
  stats: CompileStats;
  /**
   * The names the emitted module imports from `moduleSpecifier`, for a consumer that re-exports them
   * from its own entry and wants to assert it covers this list.
   */
  imports: string[];
  toString: () => string;
}
/**
 * Compile route sets into a module of types specialised to them.
 *
 * Every strategy emits the same names, so a consumer's signatures do not depend on which was chosen.
 * A stale artefact fails to compile only where an imported name changed, so rename an emitted-surface
 * type whenever its meaning changes.
 */
declare function compileRoutes(sets: RouteSet[], options?: CompileOptions): CompiledRoutes;
//#endregion
export { CompileOptions, CompileStats, CompileStrategy, CompiledRoutes, Route, RouteSegment, RouteSet, compileRoutes };