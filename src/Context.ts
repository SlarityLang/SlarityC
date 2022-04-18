import { ClassSummary } from "./ClassSummary";

export interface CompileContext {
  currentModuleName: string;
  moduleAliasMap: Map<string, string>;
  currentFunction: string;
  functionScopeClassList: Map<string, Map<string, string>>; // [ function -> [ variable -> type ] ]
  functionClassList: Map<string, string>;
  classesMap: Map<string, ClassSummary>;
  shortClassesMap: Map<string, ClassSummary>;
  type: string;
}

export function transformFullClassName(
  clazz: string,
  ctx: CompileContext
): string {
  let [md, ...origin] = clazz.split("::");
  if (origin.length === 0) {
    return clazz;
  }
  let na = origin.join("::");
  let moduleFullName;
  if ((moduleFullName = ctx.moduleAliasMap.get(md))) {
    return moduleFullName + "::" + na;
  } else {
    return clazz;
  }
}

export function transformFullFunctionDefName(
  func: string,
  ctx: CompileContext
): string {
  if (ctx.currentModuleName) {
    return ctx.currentModuleName.replaceAll(".", "_") + "_" + func;
  } else {
    return func;
  }
}

export function transformFullFunctionCallName(
  func: string,
  ctx: CompileContext
): string {
  let [md, ...origin] = func.split("::");
  if (origin.length === 0) {
    return func;
  }
  let na = origin.join("::");
  let moduleFullName;
  if ((moduleFullName = ctx.moduleAliasMap.get(md))) {
    return moduleFullName.replaceAll(".", "_") + "_" + na;
  } else {
    return func;
  }
}

export function mkContext(): CompileContext {
  return {
    moduleAliasMap: new Map(),
    currentModuleName: "",
    functionScopeClassList: new Map(),
    classesMap: new Map(),
    shortClassesMap: new Map(),
    currentFunction: "",
    functionClassList: new Map(),
    type: "",
  };
}
