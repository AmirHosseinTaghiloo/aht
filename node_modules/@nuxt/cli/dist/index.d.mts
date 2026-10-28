//#region ../../node_modules/.pnpm/citty@0.2.2_patch_hash=24c57c383378e5de0f0b955a987077b0d3ab2cc2f1d3919c5193e801c7afadac/node_modules/citty/dist/index.d.mts
//#region src/types.d.ts
type ArgType = "boolean" | "string" | "enum" | "positional" | undefined;
type _ArgDef<T extends ArgType, VT extends boolean | number | string> = {
  type?: T;
  description?: string;
  valueHint?: string;
  hidden?: boolean;
  alias?: string | string[];
  default?: VT;
  required?: boolean;
  multiple?: boolean;
  inherit?: boolean;
  options?: string[];
};
type BooleanArgDef = Omit<_ArgDef<"boolean", boolean>, "options" | "multiple"> & {
  negativeDescription?: string;
};
type StringArgDef = Omit<_ArgDef<"string", string>, "options">;
type EnumArgDef = _ArgDef<"enum", string>;
type PositionalArgDef = Omit<_ArgDef<"positional", string>, "alias" | "options" | "hidden" | "inherit">;
type ArgDef = BooleanArgDef | StringArgDef | PositionalArgDef | EnumArgDef;
type ArgsDef = Record<string, ArgDef>;
type ResolveScalarArgType<T extends ArgDef, VT> = T extends {
  default?: any;
  required?: boolean;
} ? T["default"] extends NonNullable<VT> ? VT : T["required"] extends true ? VT : VT | undefined : VT | undefined;
type ResolveParsedArgType<T extends ArgDef, VT> = T extends {
  multiple: true;
} ? VT[] : ResolveScalarArgType<T, VT>;
type ParsedPositionalArg<T extends ArgDef> = T extends {
  type: "positional";
} ? ResolveParsedArgType<T, string> : never;
type ParsedStringArg<T extends ArgDef> = T extends {
  type: "string";
} ? ResolveParsedArgType<T, string> : never;
type ParsedBooleanArg<T extends ArgDef> = T extends {
  type: "boolean";
} ? ResolveParsedArgType<T, boolean> : never;
type ParsedEnumArg<T extends ArgDef> = T extends {
  type: "enum";
  options: infer U;
} ? U extends Array<any> ? ResolveParsedArgType<T, U[number]> : never : never;
type RawArgs = {
  _: string[];
};
type ParsedArg<T extends ArgDef> = T["type"] extends "positional" ? ParsedPositionalArg<T> : T["type"] extends "boolean" ? ParsedBooleanArg<T> : T["type"] extends "string" ? ParsedStringArg<T> : T["type"] extends "enum" ? ParsedEnumArg<T> : never;
type ParsedArgs<T extends ArgsDef = ArgsDef> = RawArgs & { [K in keyof T]: ParsedArg<T[K]>; } & { [K in keyof T as T[K] extends {
  alias: string;
} ? T[K]["alias"] : never]: ParsedArg<T[K]>; } & { [K in keyof T as T[K] extends {
  alias: string[];
} ? T[K]["alias"][number] : never]: ParsedArg<T[K]>; } & Record<string, string | number | boolean | string[]>;
interface CommandMeta {
  name?: string;
  version?: string;
  description?: string;
  hidden?: boolean;
  alias?: string | string[];
}
type SubCommandsDef = Record<string, Resolvable<CommandDef<any>>>;
type CommandDef<T extends ArgsDef = ArgsDef> = {
  meta?: Resolvable<CommandMeta>;
  args?: Resolvable<T>;
  default?: Resolvable<string>;
  subCommands?: Resolvable<SubCommandsDef>;
  plugins?: Resolvable<CittyPlugin>[];
  setup?: (context: CommandContext<T>) => any | Promise<any>;
  cleanup?: (context: CommandContext<T>) => any | Promise<any>;
  run?: (context: CommandContext<T>) => any | Promise<any>;
};
type CommandContext<T extends ArgsDef = ArgsDef> = {
  rawArgs: string[];
  args: ParsedArgs<T>;
  cmd: CommandDef<T>;
  subCommand?: CommandDef<T>;
  data?: any;
};
type CittyPlugin = {
  name: string;
  setup?(context: CommandContext<any>): void | Promise<void>;
  cleanup?(context: CommandContext<any>): void | Promise<void>;
};
type Resolvable<T> = T | Promise<T> | (() => T) | (() => Promise<T>);
//#endregion
//#region src/main.d.ts
export declare const main: CommandDef<any>;
//#endregion
//#region src/run.d.ts
export declare function runMain(): Promise<void>;
export declare function runCommand(name: string, argv?: string[], data?: {
  overrides?: Record<string, any>;
}): Promise<{
  result: unknown;
}>;
//#endregion