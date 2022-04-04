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
    const tagThen = `if_T${codes.length}`;
    const tagElse = `if_E${codes.length}`;
    const tagEnd = `if_O${codes.length}`;
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
}

export class ReturnStatement implements CodeGeneratable {
  retVal: Evaluable;
  functionName: string;
  constructor(f: string, r: Evaluable) {
    this.retVal = r;
    this.functionName = f;
  }
  genASM(codes: string[]): void {
    this.retVal.genASM(codes);
    codes.push(
      `MOV $${this.functionName}_return ${this.retVal.getResultVarName()}`
    );
    codes.push("RET");
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
  constructor(fName: string, args: Variable[], body: CodeBlock) {
    this.functionName = fName;
    this.args = args;
    this.body = body;
  }
  genASM(codes: string[]): void {
    codes.push(`func_${this.functionName}:`);
    let argi = 1;
    for (let a of this.args) {
      codes.push(
        `MOV ${a.getResultVarName()} $${this.functionName}_arg${argi}`
      );
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
    const tagStart = `while_S${codes.length}`;
    const tagEnd = `while_L${codes.length}`;
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
  constructor(l: Variable, r: Evaluable) {
    this.left = l;
    this.right = r;
  }
  genASM(codes: string[]): void {
    if (this.right instanceof ImmediateValue) {
      codes.push(`MOV ${this.left.getResultVarName()} ${this.right.value}`);
    } else {
      this.right.genASM(codes);
      codes.push(
        `MOV ${this.left.getResultVarName()} ${this.right.getResultVarName()}`
      );
    }
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
}

export class BiVarCalculation implements Evaluable {
  static tmpIndex = 1;
  left: Evaluable;
  right: Evaluable;
  operator: Operator;
  tmpName: string;
  constructor(l: Evaluable, r: Evaluable, o: Operator) {
    this.left = l;
    this.right = r;
    this.operator = o;
    this.tmpName = `$tmp_${BiVarCalculation.tmpIndex.toString(16)}`;
    BiVarCalculation.tmpIndex++;
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
          const tagT = `eval_${this.tmpName}_T`;
          const tagF = `eval_${this.tmpName}_F`;
          const tagE = `eval_${this.tmpName}_E`;
          this.left.genASM(codes);
          codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
          if (this.right instanceof ImmediateValue) {
            codes.push(`CMP ${this.tmpName} ${this.right.value}`);
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
          const tagT = `eval_${this.tmpName}_T`;
          const tagF = `eval_${this.tmpName}_F`;
          const tagE = `eval_${this.tmpName}_E`;
          this.left.genASM(codes);
          codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
          if (this.right instanceof ImmediateValue) {
            codes.push(`CMP ${this.tmpName} ${this.right.value}`);
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
          const tagT = `eval_${this.tmpName}_T`;
          const tagF = `eval_${this.tmpName}_F`;
          const tagE = `eval_${this.tmpName}_E`;
          this.left.genASM(codes);
          codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
          if (this.right instanceof ImmediateValue) {
            codes.push(`CMP ${this.tmpName} ${this.right.value}`);
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
          const tagT = `eval_${this.tmpName}_T`;
          const tagF = `eval_${this.tmpName}_F`;
          const tagE = `eval_${this.tmpName}_E`;
          this.left.genASM(codes);
          codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
          if (this.right instanceof ImmediateValue) {
            codes.push(`CMP ${this.tmpName} ${this.right.value}`);
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
          const tagT = `eval_${this.tmpName}_T`;
          const tagF = `eval_${this.tmpName}_F`;
          const tagE = `eval_${this.tmpName}_E`;
          this.left.genASM(codes);
          codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
          if (this.right instanceof ImmediateValue) {
            codes.push(`CMP ${this.tmpName} ${this.right.value}`);
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
        {
          this.left.genASM(codes);
          codes.push(`MOV ${this.tmpName} ${this.left.getResultVarName()}`);
          codes.push(`NOT ${this.tmpName}`);
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
}

// TODO: push all vars
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
  genASM(codes: string[]): void {
    let argi = 1;
    for (let a of this.args) {
      a.genASM(codes);
      codes.push(
        `MOV $${this.functionName}_arg${argi} ${a.getResultVarName()}`
      );
      codes.push(`PUSH0 $${this.functionName}_arg${argi}`);
      argi++;
    }
    argi--;
    while (argi >= 1) {
      codes.push(`POP0 $${this.functionName}_arg${argi}`);
      argi--;
    }
    if (this.isNative) {
      codes.push(`INT native_${this.functionName}`);
    } else {
      codes.push(`CALL func_${this.functionName}`);
    }
  }
  genDelASM(codes: string[]): void {
    let argi = 1;
    for (let a of this.args) {
      a.genDelASM(codes);
      codes.push(`DEL $${this.functionName}_arg${argi}`);
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
  constructor(id: string) {
    this.identifier = id;
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
    codes.push(`MOV $imm_${this.value} ${this.value}`);
  }
  getResultVarName(): string {
    return `$imm_${this.value}`;
  }
  genDelASM(codes: string[]): void {
    codes.push(`DEL $imm_${this.value}`);
  }
}
