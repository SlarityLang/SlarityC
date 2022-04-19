/*

sum(a, b) {
  return a + b
}

main() {
  a = 1
  b = 2
  c = sum(a, b)
}

*/

import {
  BASE_POINTER,
  ClassSummary,
  parseClass,
  resolveClass,
} from "./ClassSummary";
import { CompileContext, transformFullFunctionCallName } from "./Context";
import { warn } from "./Logger";

export interface CodeGeneratable extends Deletable {
  genASM(codes: string[]): void;
}

export interface Deletable {
  genDelASM(codes: string[]): void;
}

export class IfStatement implements CodeGeneratable {
  condition: Evaluable;
  then: CodeBlock;
  else: CodeBlock;
  constructor(cond: Evaluable, th: CodeBlock, el: CodeBlock) {
    this.condition = cond;
    this.then = th;
    this.else = el;
  }
  genASM(codes: string[]): void {
    const tagThen = `IT${codes.length}`;
    const tagElse = `IE${codes.length}`;
    const tagEnd = `IO${codes.length}`;
    this.condition.genASM(codes);
    codes.push(`CMP ${this.condition.getResultVarName()} 0`);
    codes.push(`JE ${tagElse}`);
    codes.push(`JMP ${tagThen}`);
    codes.push(tagThen + ":");
    this.then.genASM(codes);
    codes.push(`JMP ${tagEnd}`);
    codes.push(tagElse + ":");
    this.else.genASM(codes);
    codes.push(tagEnd + ":");
  }
  genDelASM(codes: string[]): void {
    this.condition.genDelASM(codes);
  }
}

export interface Evaluable extends CodeGeneratable {
  getResultVarName(): string; // One Evaluable should tell the compiler where the value stores after eval
  getClass(ctx: CompileContext): ClassSummary; // The class of it
}

export class ReturnStatement implements CodeGeneratable {
  retVal: Evaluable;
  functionName: string;
  delay: boolean;
  constructor(f: string, r: Evaluable, delay = false) {
    this.retVal = r;
    this.functionName = f;
    this.delay = delay;
  }
  genASM(codes: string[]): void {
    this.retVal.genASM(codes);
    codes.push(
      `MOV $${this.functionName}_return ${this.retVal.getResultVarName()}`
    );
    if (!this.delay) {
      codes.push("RET");
    }
  }
  genDelASM(codes: string[]): void {
    this.retVal.genDelASM(codes);
    return; // Will be deleted by parent
  }
}

export class FunctionDefineStatement implements CodeGeneratable {
  functionName: string;
  args: Variable[];
  body: CodeBlock;
  type: string;
  originName: string;
  constructor(
    fName: string,
    originName: string,
    args: Variable[],
    body: CodeBlock,
    type: string
  ) {
    [this.originName] = parseClass(originName);
    this.functionName = fName;
    this.args = args;
    this.type = type;
    this.body = body;
  }
  genASM(codes: string[]): void {
    codes.push(`F${this.functionName}:`);
    let argi = 1;
    for (let a of this.args) {
      codes.push(`MOV ${a.getResultVarName()} $${this.functionName}_${argi}`);
      argi++;
    }
    this.body.genASM(codes);
    // this.body.genDelASM(codes); // Stack should be auto restored by slari
    /*
    argi = 1;
    for (let a of this.args) {
      codes.push(`DEL ${a.getResultVarName()}`); // Just in case
      argi++;
    }
    */
    codes.push("RET"); // Ending return
  }
  genDelASM(_codes: string[]): void {
    return; // I self clean
  }
}

export class WhileLoop implements CodeGeneratable {
  condition: Evaluable;
  body: CodeBlock;
  constructor(condition: Evaluable, body: CodeBlock) {
    this.condition = condition;
    this.body = body;
  }
  genASM(codes: string[]): void {
    const tagStart = `WS${codes.length}`;
    const tagEnd = `WL${codes.length}`;
    codes.push(tagStart + ":");
    this.condition.genASM(codes);
    codes.push(`CMP ${this.condition.getResultVarName()} 0`);
    codes.push(`JE ${tagEnd}`);
    this.body.genASM(codes);
    codes.push(`JMP ${tagStart}`);
    codes.push(tagEnd + ":");
  }
  genDelASM(codes: string[]): void {
    this.condition.genDelASM(codes);
  }
}

export class CodeBlock implements CodeGeneratable {
  content: (CodeGeneratable | null)[];
  constructor(content: (CodeGeneratable | null)[]) {
    this.content = content;
  }
  genASM(codes: string[]): void {
    for (let c of this.content) {
      if (c) {
        c.genASM(codes);
      }
    }
  }
  genDelASM(codes: string[]): void {
    for (let c of this.content) {
      if (c) {
        c.genDelASM(codes);
      }
    }
  }
}

export class AssignOperation implements Evaluable {
  left: Variable;
  right: Evaluable;
  constructor(l: Variable, r: Evaluable, ctx: CompileContext) {
    this.left = l;
    this.right = r;
    if (!this.left.explictType) {
      // If not explictly defined, we should use the right as the left
      ctx.functionScopeClassList
        .get(ctx.currentFunction)
        ?.set(
          this.left.getResultVarName(),
          this.right.getClass(ctx).identifier
        );
    }
  }
  genASM(codes: string[]): void {
    if (this.right instanceof ImmediateValue) {
      codes.push(
        `MOV ${this.left.getResultVarName()} ${this.right.getValue()}`
      );
    } else {
      this.right.genASM(codes);
      codes.push(
        `MOV ${this.left.getResultVarName()} ${this.right.getResultVarName()}`
      );
    }
  }
  getClass(ctx: CompileContext): ClassSummary {
    return this.right.getClass(ctx);
  }
  genDelASM(codes: string[]): void {
    this.right.genDelASM(codes); // Left is a variable
  }
  getResultVarName(): string {
    return this.left.getResultVarName();
  }
}
export enum Operator {
  ADD = "+",
  SUB = "-",
  MUL = "*",
  DIV = "/",
  GT = ">",
  LT = "<",
  EQ = "==",
  GTE = ">=",
  LTE = "<=",
  AND = "&",
  OR = "|",
  NOT = "!",
  AT = "@",
  PTR = "<-",
  DOT = ".",
}

export class BiVarCalculation implements Evaluable {
  static tmpIndex = 1;
  left: Evaluable;
  right: Evaluable;
  operator: Operator;
  tmpName: string;
  context: CompileContext;
  constructor(l: Evaluable, r: Evaluable, o: Operator, ctx: CompileContext) {
    this.left = l;
    this.right = r;
    this.operator = o;
    this.context = ctx;
    this.tmpName = `%${BiVarCalculation.tmpIndex.toString(16)}`;
    BiVarCalculation.tmpIndex++;
  }
  getClass(ctx: CompileContext): ClassSummary {
    if (this.operator === Operator.DOT) {
      if (this.right instanceof Variable) {
        let n = this.right.getResultVarName();
        let field = this.left.getClass(ctx).fields.get(n);
        if (field === undefined) {
          warn(
            `Cannot find field ${n} on type ${
              this.left.getClass(ctx).identifier
            }`
          );
          return BASE_POINTER;
        }
        return resolveClass(field.type, ctx);
      } else if (this.right instanceof FunctionCall) {
        let n = this.right.functionName;
        let method = this.left.getClass(ctx).methods.get(n);
        if (method === undefined) {
          warn(
            `Cannot find field ${n} on type ${
              this.left.getClass(ctx).identifier
            }`
          );
          return BASE_POINTER;
        }
        return resolveClass(method.retType, ctx);
      } else {
        warn(
          `Cannot use a non-variable value as the right value of DOT: ${this.right.getResultVarName()}`
        );
        return BASE_POINTER;
      }
    } else {
      return this.right.getClass(ctx);
    }
  }
  genASM(codes: string[]): void {
    switch (this.operator) {
      case Operator.ADD:
        this.left.genASM(codes);
        codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
        this.right.genASM(codes);
        codes.push(`ADD ${this.tmpName} ${this.right.getResultVarName()}`);
        break;
      case Operator.SUB:
        this.left.genASM(codes);
        codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
        this.right.genASM(codes);
        codes.push(`SUB ${this.tmpName} ${this.right.getResultVarName()}`);
        break;
      case Operator.MUL:
        this.left.genASM(codes);
        codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
        this.right.genASM(codes);
        codes.push(`MUL ${this.tmpName} ${this.right.getResultVarName()}`);
        break;
      case Operator.DIV:
        this.left.genASM(codes);
        codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
        this.right.genASM(codes);
        codes.push(`DIV ${this.tmpName} ${this.right.getResultVarName()}`);
        break;
      case Operator.GT:
        {
          const tagT = `E${this.tmpName}T`;
          const tagF = `E${this.tmpName}F`;
          const tagE = `E${this.tmpName}E`;
          this.left.genASM(codes);
          codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
          if (this.right instanceof ImmediateValue) {
            codes.push(`CMP ${this.tmpName} ${this.right.getValue()}`);
          } else {
            this.right.genASM(codes);
            codes.push(`CMP ${this.tmpName} ${this.right.getResultVarName()}`);
          }
          codes.push(`JA ${tagT}`);
          codes.push(`JMP ${tagF}`);
          codes.push(tagT + ":");
          codes.push(`MOV ${this.tmpName} 1`);
          codes.push(`JMP ${tagE}`);
          codes.push(tagF + ":");
          codes.push(`MOV ${this.tmpName} 0`);
          codes.push(tagE + ":");
        }
        break;
      case Operator.LT:
        {
          const tagT = `E${this.tmpName}T`;
          const tagF = `E${this.tmpName}F`;
          const tagE = `E${this.tmpName}E`;
          this.left.genASM(codes);
          codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
          if (this.right instanceof ImmediateValue) {
            codes.push(`CMP ${this.tmpName} ${this.right.getValue()}`);
          } else {
            this.right.genASM(codes);
            codes.push(`CMP ${this.tmpName} ${this.right.getResultVarName()}`);
          }
          codes.push(`JB ${tagT}`);
          codes.push(`JMP ${tagF}`);
          codes.push(tagT + ":");
          codes.push(`MOV ${this.tmpName} 1`);
          codes.push(`JMP ${tagE}`);
          codes.push(tagF + ":");
          codes.push(`MOV ${this.tmpName} 0`);
          codes.push(tagE + ":");
        }
        break;
      case Operator.EQ:
        {
          const tagT = `E${this.tmpName}T`;
          const tagF = `E${this.tmpName}F`;
          const tagE = `E${this.tmpName}E`;
          this.left.genASM(codes);
          codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
          if (this.right instanceof ImmediateValue) {
            codes.push(`CMP ${this.tmpName} ${this.right.getValue()}`);
          } else {
            this.right.genASM(codes);
            codes.push(`CMP ${this.tmpName} ${this.right.getResultVarName()}`);
          }
          codes.push(`JE ${tagT}`);
          codes.push(`JMP ${tagF}`);
          codes.push(tagT + ":");
          codes.push(`MOV ${this.tmpName} 1`);
          codes.push(`JMP ${tagE}`);
          codes.push(tagF + ":");
          codes.push(`MOV ${this.tmpName} 0`);
          codes.push(tagE + ":");
        }
        break;
      case Operator.GTE:
        {
          const tagT = `E${this.tmpName}T`;
          const tagF = `E${this.tmpName}F`;
          const tagE = `E${this.tmpName}E`;
          this.left.genASM(codes);
          codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
          if (this.right instanceof ImmediateValue) {
            codes.push(`CMP ${this.tmpName} ${this.right.getValue()}`);
          } else {
            this.right.genASM(codes);
            codes.push(`CMP ${this.tmpName} ${this.right.getResultVarName()}`);
          }
          codes.push(`JAE ${tagT}`);
          codes.push(`JMP ${tagF}`);
          codes.push(tagT + ":");
          codes.push(`MOV ${this.tmpName} 1`);
          codes.push(`JMP ${tagE}`);
          codes.push(tagF + ":");
          codes.push(`MOV ${this.tmpName} 0`);
          codes.push(tagE + ":");
        }
        break;
      case Operator.LTE:
        {
          const tagT = `E${this.tmpName}T`;
          const tagF = `E${this.tmpName}F`;
          const tagE = `E${this.tmpName}E`;
          this.left.genASM(codes);
          codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
          if (this.right instanceof ImmediateValue) {
            codes.push(`CMP ${this.tmpName} ${this.right.getValue()}`);
          } else {
            this.right.genASM(codes);
            codes.push(`CMP ${this.tmpName} ${this.right.getResultVarName()}`);
          }
          codes.push(`JBE ${tagT}`);
          codes.push(`JMP ${tagF}`);
          codes.push(tagT + ":");
          codes.push(`MOV ${this.tmpName} 1`);
          codes.push(`JMP ${tagE}`);
          codes.push(tagF + ":");
          codes.push(`MOV ${this.tmpName} 0`);
          codes.push(tagE + ":");
        }
        break;
      case Operator.AND:
        {
          this.left.genASM(codes);
          codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
          this.right.genASM(codes);
          codes.push(`AND ${this.tmpName} ${this.right.getResultVarName()}`);
        }
        break;
      case Operator.OR:
        {
          this.left.genASM(codes);
          codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
          this.right.genASM(codes);
          codes.push(`OR ${this.tmpName} ${this.right.getResultVarName()}`);
        }
        break;
      case Operator.NOT:
        this.left.genASM(codes);
        codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
        codes.push(`NOT ${this.tmpName}`);

        break;
      case Operator.AT:
        this.left.genASM(codes);
        codes.push(`IN ${this.tmpName} ${this.left.getResultVarName()}`);
        break;
      case Operator.PTR:
        this.left.genASM(codes);
        this.right.genASM(codes);
        codes.push(
          `OUT ${this.left.getResultVarName()} ${this.right.getResultVarName()}`
        );
        break;
      case Operator.DOT:
        {
          if (this.right instanceof FunctionCall) {
            let rn = this.right.functionName;
            let sclz = this.left.getClass(this.context);
            let method = sclz.methods.get(rn);
            if (method === undefined) {
              warn(`Cannot find method ${rn} on type ${sclz.identifier}`);
            } else {
              this.left.genASM(codes);
              let arg0 = [this.left].concat(this.right.args);
              let fun = new FunctionCall(method.link, arg0);
              fun.genASM(codes);
              codes.push(`MOV ${this.tmpName} ${fun.getResultVarName()}`);
            }
          } else if (this.right instanceof Variable) {
            let sclz = this.left.getClass(this.context);
            let rn = this.right.getResultVarName();
            let field = sclz.fields.get(rn);
            if (field === undefined) {
              warn(`Cannot find field ${rn} on type ${sclz.identifier}`);
            } else {
              this.left.genASM(codes);
              let imm = new ImmediateValue(field.offset);
              imm.genASM(codes);
              codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
              codes.push(`ADD ${this.tmpName} ${imm.getResultVarName()}`);
            }
          } else {
            warn(
              `Cannot use a non-variable value as the right value of DOT: ${this.right.getResultVarName()}`
            );
          }
        }
        break;
    }
  }
  getResultVarName(): string {
    return this.tmpName;
  }
  genDelASM(codes: string[]): void {
    this.left.genDelASM(codes);
    this.right.genDelASM(codes);
    codes.push(`DEL ${this.tmpName}`);
  }
}

// Only a placeholder, do not rel it!
export class NullValue implements Evaluable {
  genASM(_codes: string[]): void {
    return;
  }
  getResultVarName(): string {
    return "";
  }
  genDelASM(_codes: string[]): void {
    return;
  }
  getClass(_ctx: CompileContext): ClassSummary {
    return BASE_POINTER;
  }
}

export class FunctionCall implements Evaluable, Deletable {
  functionName: string;
  args: Evaluable[];
  isNative: boolean;
  constructor(fName: string, args: Evaluable[]) {
    this.args = args;
    this.functionName = fName;
    this.isNative = this.functionName.startsWith("$");
    if (this.isNative) {
      this.functionName = this.functionName.slice(1);
    }
  }
  getClass(ctx: CompileContext): ClassSummary {
    let func = ctx.functionClassList.get(this.functionName);
    if (func === undefined) {
      return BASE_POINTER;
    } else {
      return resolveClass(func, ctx);
    }
  }
  genASM(codes: string[]): void {
    let argi = 1;
    for (let a of this.args) {
      if (a instanceof ImmediateValue) {
        codes.push(`MOV $${this.functionName}_${argi} ${a.getValue()}`);
      } else {
        a.genASM(codes);
        codes.push(`MOV $${this.functionName}_${argi} ${a.getResultVarName()}`);
      }

      codes.push(`PUSH0 $${this.functionName}_${argi}`);
      argi++;
    }
    argi--;
    while (argi >= 1) {
      codes.push(`POP0 $${this.functionName}_${argi}`);
      argi--;
    }
    if (this.isNative) {
      codes.push(`INT native_${this.functionName}`);
    } else {
      codes.push(`CALL F${this.functionName}`);
    }
  }
  genDelASM(codes: string[]): void {
    let argi = 1;
    for (let a of this.args) {
      a.genDelASM(codes);
      codes.push(`DEL $${this.functionName}_${argi}`);
      argi++;
    }
    codes.push(`DEL $${this.functionName}_return`);
  }
  getResultVarName(): string {
    return `$${this.functionName}_return`;
  }
}

export class Variable implements Evaluable {
  identifier: string;
  type: string;
  explictType: boolean;
  constructor(id: string, ctx: CompileContext) {
    [this.identifier, this.type] = parseClass(
      transformFullFunctionCallName(id, ctx)
    );
    if (this.type) {
      ctx.functionScopeClassList
        .get(ctx.currentFunction) // Assume that it has been created
        ?.set(this.identifier, this.type);
      this.explictType = true;
    } else {
      this.type =
        ctx.functionScopeClassList
          .get(ctx.currentFunction)
          ?.get(this.identifier) || "-";
      this.explictType = false;
    }
  }
  genASM(_codes: string[]): void {
    return;
  }
  genDelASM(codes: string[]): void {
    codes.push(`DEL ${this.identifier}`);
  }
  getResultVarName(): string {
    return this.identifier;
  }
  getClass(ctx: CompileContext): ClassSummary {
    return resolveClass(this.type, ctx);
  }
}
export class ImmediateValue implements Evaluable {
  value: number;
  constructor(v: number) {
    this.value = v;
  }
  getValue(): number {
    return this.value;
  }
  genASM(codes: string[]): void {
    codes.push(`MOV @${this.value} ${this.value}`);
  }
  getResultVarName(): string {
    return `@${this.value}`;
  }
  genDelASM(codes: string[]): void {
    codes.push(`DEL @${this.value}`);
  }
  getClass(_ctx: CompileContext): ClassSummary {
    return BASE_POINTER;
  }
}
