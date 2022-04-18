import {
  CodeBlock,
  CodeGeneratable,
  FunctionDefineStatement,
  Variable,
} from "./AST";
import { CompileContext, transformFullClassName } from "./Context";
import { debug, error, warn } from "./Logger";

export interface ClassSummary {
  module: string;
  identifier: string;
  fields: Map<string, FieldSummary>; // Offset and Type
  methods: Map<string, MethodSummary>;
  size: number;
  parent: string;
}

export const BASE_POINTER: ClassSummary = {
  module: "",
  identifier: "-",
  fields: new Map(),
  methods: new Map(),
  parent: "-",
  size: 1,
};

export interface FieldSummary {
  identifier: string;
  offset: number;
  type: string;
}

export interface MethodSummary {
  identifier: string;
  link: string;
  retType: string;
  argsType: string[];
}

export function resolveClass(
  className: string,
  ctx: CompileContext
): ClassSummary {
  if (className === "-") {
    return BASE_POINTER;
  }
  // className is like String::String or String or slarity.data.string.String::String
  let cs: ClassSummary | undefined;
  if ((cs = ctx.shortClassesMap.get(className)) !== undefined) {
    return cs;
  }
  let fullName = transformFullClassName(className, ctx);
  if ((cs = ctx.classesMap.get(fullName)) !== undefined) {
    return cs;
  }
  let err = "Cannot resolve class: " + className;
  error(err);
  error("Compilation terminated.");
  process.exit(1);
}

export function collectClass(source: string, ctx: CompileContext): void {
  let lns = source.split("\n");
  let clazz: ClassSummary = {
    module: "",
    identifier: "",
    fields: new Map(),
    methods: new Map(),
    size: 0,
    parent: "-",
  };
  for (let ln of lns) {
    let [instr, ...values] = ln.split(" ");
    switch (instr.toUpperCase()) {
      case "MODULE":
        clazz.module = values.join(" ");
        break;
      case "CLASS":
        clazz.identifier = values.join(" ");
        break;
      case "SIZE":
        clazz.size = parseInt(values.join(" "));
        break;
      case "FIELD":
        clazz.fields.set(values[0], {
          identifier: values[0],
          offset: parseInt(values[1]),
          type: values[2],
        });
        break;
      case "METHOD":
        clazz.methods.set(values[0], {
          identifier: values[0],
          retType: values[1],
          link: values[2],
          argsType: values.slice(3),
        });
        break;
      case "EXTEND":
        clazz = mergeClass(clazz, resolveClass(values[0], ctx));
        break;
    }
  }

  if (clazz.identifier.length === 0) {
    warn("Invalid class summary detected: ");
    warn(source);
    warn("This class was skipped.");
    return;
  }

  let shortKey = clazz.identifier.split(".").pop() || "";
  if (ctx.shortClassesMap.get(shortKey) !== undefined) {
    ctx.shortClassesMap.delete(shortKey); // Duplicated
  } else {
    ctx.shortClassesMap.set(shortKey, clazz);
  }
  let fullName = (clazz.module ? clazz.module + "::" : "") + clazz.identifier;
  if (ctx.classesMap.get(fullName) !== undefined) {
    warn("Duplicated class: " + fullName);
    warn("The former one will be overwritten.");
  }
  ctx.classesMap.set(fullName, clazz);
  debug(`Class ${fullName} collected.`);
}

function mergeClass(child: ClassSummary, parent: ClassSummary): ClassSummary {
  let o: ClassSummary = {
    identifier: child.identifier,
    module: child.module,
    size: 0,
    parent: parent.identifier,
    fields: new Map(),
    methods: new Map(),
  };
  let startPtr = parent.size;
  for (let [fi, fc] of parent.fields.entries()) {
    o.fields.set(fi, fc);
    o.size++;
  }
  for (let [fi, fc] of child.fields.entries()) {
    if (!o.fields.get(fi)) {
      fc.offset = startPtr;
      startPtr++;
      o.size++;
    } else {
      fc.offset = o.fields.get(fi)?.offset || 0;
    }
    o.fields.set(fi, fc);
  }
  for (let [mi, mc] of parent.methods.entries()) {
    o.methods.set(mi, mc);
  }
  for (let [mi, mc] of child.methods.entries()) {
    o.methods.set(mi, mc);
  }
  return o;
}

export function parseClass(origin: string): [string, string] {
  let s = origin.split(":");
  return [s.shift() || "", s.join(":")];
}

// Extract class information and produce a related content of methods
export function summarizeClass(
  ast: CodeBlock,
  ctx: CompileContext
): [ClassSummary, CodeGeneratable][] {
  let o: [ClassSummary, CodeGeneratable][] = [];
  for (let c of ast.content) {
    if (!(c instanceof FunctionDefineStatement)) {
      continue;
    }
    let outBlock = [];
    let gOffset = 0;
    let clazz: ClassSummary = {
      module: ctx.currentModuleName,
      identifier: c.originName,
      fields: new Map(),
      methods: new Map(),
      parent: transformFullClassName(c.type, ctx) || "-", // Only an alias
      size: 0,
    };
    for (let prop of c.body.content) {
      if (prop instanceof Variable) {
        clazz.size++;
        clazz.fields.set(prop.identifier, {
          identifier: prop.identifier,
          type: prop.type,
          offset: gOffset,
        });
        gOffset++;
      } else if (prop instanceof FunctionDefineStatement) {
        clazz.methods.set(prop.originName, {
          identifier: prop.originName,
          link: prop.functionName,
          argsType: prop.args.map((a) => {
            return a.type;
          }),
          retType: prop.type,
        });
        outBlock.push(prop);
      }
    }
    //     ctx.shortClassesMap.set(clazz.identifier, clazz);
    //     ctx.classesMap.set(transformFullClassName(clazz.identifier, ctx), clazz);
    o.push([clazz, new CodeBlock(outBlock)]);
  }
  return o;
}

export function dumpClass(summary: ClassSummary): string {
  let o: string[] = [];
  o.push(`MODULE ${summary.module}`);
  o.push(`CLASS ${summary.identifier}`);
  o.push(`SIZE ${summary.size}`);
  for (let [fi, fc] of summary.fields.entries()) {
    o.push(`FIELD ${fi} ${fc.offset} ${fc.type}`);
  }
  for (let [mi, mc] of summary.methods.entries()) {
    o.push(`METHOD ${mi} ${mc.retType} ${mc.link}`);
  }
  if (summary.parent !== "-") {
    o.push(`EXTEND ${summary.parent}`);
  }
  return o.join("\n");
}
