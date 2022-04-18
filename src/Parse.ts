import {
  AssignOperation,
  BiVarCalculation,
  CodeBlock,
  Evaluable,
  FunctionCall,
  FunctionDefineStatement,
  IfStatement,
  ImmediateValue,
  NullValue,
  Operator,
  ReturnStatement,
  Variable,
  WhileLoop,
} from "./AST";
import { parseClass } from "./ClassSummary";
import {
  CompileContext,
  transformFullFunctionCallName,
  transformFullFunctionDefName,
} from "./Context";
// Find the next pair of l
function findNextPair(seq: any[], l: string, r: string): number {
  let i = 0;
  let le = seq.length;
  let c = 0;
  while (i < le) {
    let cur = seq[i];
    if (cur[1] === l) {
      c++;
    }
    if (cur[1] === r) {
      if (c === 0) {
        return i;
      } else {
        c--;
      }
    }
    i++;
  }
  return -1;
}

export function handleEvaluable(
  eva: [string, string][],
  ctx: CompileContext
): Evaluable | null {
  // Like (3 + 5) + sum(1 + 2, 8 / 4) * 7
  // Create all references
  while (handleImmediateValue(eva)) {}
  while (handleVariable(eva, ctx)) {}
  // First pick all function calls
  // Identifier, Left Bracket, *, Right Bracket
  while (findFunctionCall(eva, ctx)) {}
  // Lookup for brackets
  while (handleBracket(eva, ctx)) {}
  // Now that all have been cleared: Eva + Fun * 7
  // Let's pick, first from Dereference
  while (handleDereference(eva, ctx)) {}
  // Now DOT
  while (handleOperator(eva, Operator.DOT, ctx)) {}
  // Now NOT
  while (handleNot(eva, ctx)) {}
  // Now time to +-*/
  while (handleOperator(eva, Operator.MUL, ctx)) {}
  while (handleOperator(eva, Operator.DIV, ctx)) {}
  while (handleOperator(eva, Operator.ADD, ctx)) {}
  while (handleOperator(eva, Operator.SUB, ctx)) {}
  // Compare
  while (handleOperator(eva, Operator.GTE, ctx)) {}
  while (handleOperator(eva, Operator.LTE, ctx)) {}
  while (handleOperator(eva, Operator.GT, ctx)) {}
  while (handleOperator(eva, Operator.LT, ctx)) {}
  while (handleOperator(eva, Operator.EQ, ctx)) {}
  // Logics
  while (handleOperator(eva, Operator.AND, ctx)) {}
  while (handleOperator(eva, Operator.OR, ctx)) {}
  // Assigns
  while (handleAssign(eva, ctx)) {}
  // Pointers
  while (handleOperator(eva, Operator.PTR, ctx)) {}
  // Now there should be only one value left
  return (eva[0] as unknown as Evaluable) || null;
}

function handleVariable(seq: any[], ctx: CompileContext): boolean {
  let cur;
  let i = 0;
  while (
    (cur = seq[i]) &&
    (cur[1] !== "IDENTIFIER" || (seq[i + 1] || [])[1] === "LEFT_BRACKET")
  ) {
    i++;
  }
  if (cur === undefined) {
    return false;
  }
  let target = seq[i];
  seq[i] = new Variable(target[0], ctx);
  return true;
}

function handleImmediateValue(seq: any[]): boolean {
  let cur;
  let i = 0;
  while ((cur = seq[i]) && cur[1] !== "NUMBERS") {
    i++;
  }
  if (cur === undefined) {
    return false;
  }
  let target = seq[i];
  seq[i] = new ImmediateValue(parseInt(target[0]));
  return true;
}

function handleAssign(seq: any[], ctx: CompileContext): boolean {
  let cur;
  let i = 0;
  while ((cur = seq[i]) && (cur[1] !== "OPERATOR" || cur[0] !== "=")) {
    i++;
  }
  if (cur === undefined) {
    return false;
  }
  let target = seq[i - 1];
  let vl;
  if (target instanceof Array) {
    if (target[1] === "IDENTIFIER") {
      vl = new Variable(target[0], ctx);
    } else if (target[1] === "NUMBERS") {
      vl = new ImmediateValue(parseInt(target[0]));
    }
  } else {
    vl = target; // It must be an Evaluable
  }
  let target2 = seq[i + 1];
  let vr;
  if (target2 instanceof Array) {
    if (target2[1] === "IDENTIFIER") {
      vr = new Variable(target2[0], ctx);
    } else if (target2[1] === "NUMBERS") {
      vr = new ImmediateValue(parseInt(target2[0]));
    }
  } else {
    vr = target2; // It must be an Evaluable
  }
  let ev = new AssignOperation(vl, vr, ctx);

  seq.splice(i, 2);
  seq[i - 1] = ev;
  return true;
}

function handleOperator(
  seq: any[],
  op: Operator,
  ctx: CompileContext
): boolean {
  let cur;
  let i = 0;
  while ((cur = seq[i]) && (cur[1] !== "OPERATOR" || cur[0] !== op)) {
    i++;
  }
  if (cur === undefined) {
    return false;
  }
  let target = seq[i - 1];
  let vl;
  if (target instanceof Array) {
    if (target[1] === "IDENTIFIER") {
      vl = new Variable(target[0], ctx);
    } else if (target[1] === "NUMBERS") {
      vl = new ImmediateValue(parseInt(target[0]));
    }
  } else {
    vl = target; // It must be an Evaluable
  }
  let target2 = seq[i + 1];
  let vr;
  if (target2 instanceof Array) {
    if (target2[1] === "IDENTIFIER") {
      vr = new Variable(target2[0], ctx);
    } else if (target2[1] === "NUMBERS") {
      vr = new ImmediateValue(parseInt(target2[0]));
    }
  } else {
    vr = target2; // It must be an Evaluable
  }
  let ev = new BiVarCalculation(vl, vr, op, ctx);
  seq.splice(i, 2);
  seq[i - 1] = ev;
  return true;
}

function handleNot(seq: any[], ctx: CompileContext): boolean {
  let cur;
  let i = 0;
  while ((cur = seq[i]) && cur[1] !== "NOT") {
    i++;
  }
  if (cur === undefined) {
    return false;
  }
  let notTarget = seq[i + 1];
  let va;
  if (notTarget instanceof Array) {
    if (notTarget[1] === "IDENTIFIER") {
      va = new Variable(notTarget[0], ctx);
    } else if (notTarget[1] === "NUMBERS") {
      va = new ImmediateValue(parseInt(notTarget[1]));
    }
  } else {
    va = notTarget; // It must be an Evaluable
  }
  let ev = new BiVarCalculation(va, new NullValue(), Operator.NOT, ctx);
  seq.splice(i + 1, 1);
  seq[i] = ev;
  return true;
}

function handleDereference(seq: any[], ctx: CompileContext): boolean {
  let cur;
  let i = 0;
  while ((cur = seq[i]) && cur[1] !== "AT") {
    i++;
  }
  if (cur === undefined) {
    return false;
  }
  let atTarget = seq[i + 1];
  let va;
  if (atTarget instanceof Array) {
    if (atTarget[1] === "IDENTIFIER") {
      va = new Variable(atTarget[0], ctx);
    } else if (atTarget[1] === "NUMBERS") {
      va = new ImmediateValue(parseInt(atTarget[1]));
    }
  } else {
    va = atTarget; // It must be an Evaluable
  }
  let ev = new BiVarCalculation(va, new NullValue(), Operator.AT, ctx);
  seq.splice(i + 1, 1);
  seq[i] = ev;
  return true;
}

function handleBracket(seq: any[], ctx: CompileContext): boolean {
  let i = 0;
  let cur;
  while ((cur = seq[i]) && cur[1] !== "LEFT_BRACKET") {
    i++;
  }
  if (cur === undefined) {
    return false; // That's the end
  }
  let s0 = seq.slice(i + 1);
  let pair = findNextPair(s0, "LEFT_BRACKET", "RIGHT_BRACKET");
  if (pair === -1) {
    return false;
  }
  let brak = seq.concat().splice(i + 1, pair + 1); // Leave the first to replace
  brak.pop(); // Remove the last
  let ev = handleEvaluable(brak, ctx);
  if (!ev) {
    return false;
  }
  seq.splice(i + 1, pair + 1);
  seq[i] = ev;
  return true;
}

const KEYWORDS = ["if", "while"];

function findFunctionCall(seq: any[], ctx: CompileContext): boolean {
  // This function will modify the original array and put a FunctionCall to replace the token sequence
  let i = 0;
  let cur;
  let identifier = "";
  while (true) {
    while (
      (cur = seq[i]) &&
      (cur[1] !== "IDENTIFIER" || KEYWORDS.includes(cur[0]))
    ) {
      i++;
    }
    if (cur === undefined) {
      return false;
    }
    if (seq[i + 1] && seq[i + 1][1] !== "LEFT_BRACKET") {
      i++;
    } else {
      identifier = seq[i][0];
      let s0 = seq.slice(i + 2);
      let pair = findNextPair(s0, "LEFT_BRACKET", "RIGHT_BRACKET");
      if (pair !== -1) {
        let funcCallSeq = seq.concat().splice(i + 1, pair + 2); // Leave the first to replace
        funcCallSeq.unshift([identifier, "IDENTIFIER"]);
        let fun = extractFunctionCall(funcCallSeq, ctx);
        if (!fun) {
          continue;
        }
        seq.splice(i + 1, pair + 2);
        seq[i] = fun;
        return true;
      }
    }
  }
}
function extractFunctionCall(
  restSeq: [string, string][],
  ctx: CompileContext
): FunctionCall | null {
  if (restSeq[0][1] !== "IDENTIFIER") {
    return null;
  }
  let s = restSeq.concat();
  let identifier = (s.shift() as [string, string])[0];
  if (s[0][1] !== "LEFT_BRACKET") {
    return null;
  }
  let o: [string, string][] = [];
  s.shift();
  let r = findNextPair(s, "LEFT_BRACKET", "RIGHT_BRACKET");
  for (let i = 0; i < r; i++) {
    o.push(s.shift() as [string, string]);
  }
  s.shift();
  let cli = 0;
  let args: [string, string][][] = [];
  let buf: [string, string][] = [];
  for (let a of o) {
    if (a[1] === "EOL") {
      continue; // EOL is ignored in args list since expressions are splitted by comma
    }
    if (a[1] === "RIGHT_BRACKET") {
      cli--;
    }
    if (a[1] === "LEFT_BRACKET") {
      cli++;
    }
    if (a[1] !== "COMMA") {
      buf.push(a);
    } else {
      if (cli === 0) {
        // Can break
        args.push(buf);
        buf = [];
      } else {
        // Cannot break
        buf.push(a);
      }
    }
  }
  if (buf.length > 0) {
    args.push(buf);
  }
  let evas: (Evaluable | null)[] = args.map((a) => {
    return handleEvaluable(a, ctx);
  });

  return new FunctionCall(
    parseClass(transformFullFunctionCallName(identifier, ctx))[0],
    // @ts-ignore
    evas
  );
}

export function handleBlockCode(
  seq: any[],
  ctx: CompileContext
): CodeBlock | null {
  while (handleFunctionDefine(seq, ctx)) {}
  while (handleIfStatement(seq, ctx)) {}
  while (handleWhileStatement(seq, ctx)) {}
  let buf: [string, string][] = [];
  let out = [];
  for (let s of seq) {
    if (s[1] === "EOL") {
      let e = handleEvaluable(buf, ctx);
      buf = [];
      out.push(e);
    } else if (
      s instanceof IfStatement ||
      s instanceof WhileLoop ||
      s instanceof FunctionDefineStatement
    ) {
      let e = handleEvaluable(buf, ctx);
      buf = [];
      out.push(e);
      out.push(s);
    } else {
      buf.push(s);
    }
  }
  if (buf.length > 0) {
    let e = handleEvaluable(buf, ctx);
    buf = [];
    out.push(e);
  }
  return new CodeBlock(out);
}

export function handleIfStatement(seq: any[], ctx: CompileContext): boolean {
  let i = 0;
  let cur;
  while (true) {
    while ((cur = seq[i]) && (cur[1] !== "IDENTIFIER" || cur[0] !== "if")) {
      i++;
    }
    if (cur === undefined) {
      return false;
    }
    if (seq[i + 1] && seq[i + 1][1] !== "LEFT_BRACKET") {
      i++;
    } else {
      let s0 = seq.slice(i + 2);
      let conditionPair = findNextPair(s0, "LEFT_BRACKET", "RIGHT_BRACKET");
      if (conditionPair == -1) {
        return false;
      }
      let cond = seq.concat().splice(i + 2, conditionPair);
      let bodyStart = s0.slice(conditionPair + 2);
      let bodyEnd = findNextPair(
        bodyStart,
        "LEFT_SECTION_BRACKET",
        "RIGHT_SECTION_BRACKET"
      );
      if (bodyEnd === -1) {
        return false;
      }
      let elseStart = bodyStart.slice(bodyEnd + 1);
      let elseBody = [];
      let hasElse = false;
      let elseLength = -2;
      elseLength += shiftEOL(elseStart);
      if (elseStart[0] && elseStart[0][0] === "else") {
        elseStart.shift(); // Shift 'else'
        elseLength += shiftEOL(elseStart);
        elseStart.shift(); // Shift '{'
        let elseEnd = findNextPair(
          elseStart,
          "LEFT_SECTION_BRACKET",
          "RIGHT_SECTION_BRACKET"
        );
        if (elseEnd !== -1) {
          elseBody = elseStart.slice(0, elseEnd);
          elseLength += elseEnd + 1;
          hasElse = true;
        }
      }
      let body = seq.concat().splice(i + 4 + conditionPair, bodyEnd);
      let bodyCode = handleBlockCode(body, ctx);
      let condition = handleEvaluable(cond, ctx);

      let elseBodyCode = hasElse ? handleBlockCode(elseBody, ctx) : null;
      if (bodyCode === null || condition === null) {
        continue;
      }
      let _if;
      if (hasElse) {
        // @ts-ignore
        _if = new IfStatement(condition, bodyCode, elseBodyCode);
      } else {
        _if = new IfStatement(condition, bodyCode, new CodeBlock([]));
      }
      seq.splice(i + 1, conditionPair + bodyEnd + elseLength + 8);
      seq[i] = _if;
      return true;
    }
  }
}

function shiftEOL(seq: any[]): number {
  let i = 0;
  try {
    while (seq[0][1] === "EOL") {
      seq.shift();
      i++;
    }
  } catch {}
  return i;
}

export function handleWhileStatement(seq: any[], ctx: CompileContext): boolean {
  let i = 0;
  let cur;
  while (true) {
    while ((cur = seq[i]) && (cur[1] !== "IDENTIFIER" || cur[0] !== "while")) {
      i++;
    }
    if (cur === undefined) {
      return false;
    }
    if (seq[i + 1] && seq[i + 1][1] !== "LEFT_BRACKET") {
      i++;
    } else {
      let s0 = seq.slice(i + 2);
      let conditionPair = findNextPair(s0, "LEFT_BRACKET", "RIGHT_BRACKET");
      if (conditionPair == -1) {
        return false;
      }
      let cond = seq.concat().splice(i + 2, conditionPair);
      let bodyStart = s0.slice(conditionPair + 2);
      let bodyEnd = findNextPair(
        bodyStart,
        "LEFT_SECTION_BRACKET",
        "RIGHT_SECTION_BRACKET"
      );
      if (bodyEnd === -1) {
        return false;
      }
      let body = seq.concat().splice(i + 4 + conditionPair, bodyEnd);
      let bodyCode = handleBlockCode(body, ctx);
      let condition = handleEvaluable(cond, ctx);
      if (bodyCode === null || condition === null) {
        continue;
      }
      let wh = new WhileLoop(condition, bodyCode);
      seq.splice(i + 1, conditionPair + bodyEnd + 4);
      seq[i] = wh;
      return true;
    }
  }
}

export function handleFunctionDefine(seq: any[], ctx: CompileContext): boolean {
  let i = 0;
  let cur;
  while (true) {
    while (
      (cur = seq[i]) &&
      (cur[1] !== "IDENTIFIER" || KEYWORDS.includes(cur[0]))
    ) {
      i++;
    }
    if (cur === undefined) {
      return false;
    }
    if (seq[i + 1] && seq[i + 1][1] !== "LEFT_BRACKET") {
      i++;
    } else {
      let s0 = seq.slice(i + 2);
      let identifier = cur[0];
      let argsPair = findNextPair(s0, "LEFT_BRACKET", "RIGHT_BRACKET");
      if (argsPair == -1) {
        return false;
      }
      let args = seq.concat().splice(i + 2, argsPair);
      let bodyStart = s0.slice(argsPair + 2);
      let bodyEnd = findNextPair(
        bodyStart,
        "LEFT_SECTION_BRACKET",
        "RIGHT_SECTION_BRACKET"
      );
      if (bodyEnd === -1) {
        return false;
      }
      let body = seq.concat().splice(i + 4 + argsPair, bodyEnd);
      // Define function scope
      let [qid, type] = parseClass(
        transformFullFunctionDefName(identifier, ctx)
      );
      ctx.currentFunction = qid;
      ctx.functionClassList.set(qid, type || "-");
      ctx.functionScopeClassList.set(qid, new Map());
      let argsList = a2e(args, ctx);
      while (handleReturnStatement(qid, body, ctx)) {}
      let bodyCode = handleBlockCode(body, ctx);
      if (bodyCode === null) {
        continue;
      }
      let wh = new FunctionDefineStatement(
        qid,
        identifier,
        argsList,
        bodyCode,
        type
      );
      seq.splice(i + 1, argsPair + bodyEnd + 4);
      seq[i] = wh;
      ctx.currentFunction = ""; // Undef
      return true;
    }
  }
}

// Arguments to Evaluables
function a2e(args: any[], ctx: CompileContext): Variable[] {
  let o: Variable[] = [];
  let var0: string = "";
  for (let a of args) {
    if (a[1] === "COMMA") {
      if (var0.length > 0) {
        o.push(new Variable(var0, ctx));
      }
    } else {
      var0 = a[0];
    }
  }
  if (var0.length > 0) {
    o.push(new Variable(var0, ctx));
  }
  return o;
}

// Replace return statement with corresponding AST component
function handleReturnStatement(
  fName: string,
  seq: any[],
  ctx: CompileContext
): boolean {
  let i = 0;
  let cur;
  while (
    (cur = seq[i]) &&
    (cur[1] !== "IDENTIFIER" || (cur[0] !== "return" && cur[0] !== "return?"))
  ) {
    i++;
  } // Find EOL or RIGHT_SECTION_BRACKET

  let i2 = i + 1;
  let cur2;
  while (
    (cur2 = seq[i2]) &&
    cur2[1] !== "EOL" &&
    cur2[1] !== "RIGHT_SECTION_BRACKET"
  ) {
    i2++;
  }
  if (!cur) {
    return false;
  }
  if (!cur2) {
    i2--;
    cur2 = seq[i2];
  }
  let delay = cur[0] === "return?";
  let evas = seq.splice(i + 1, i2 - i - 1);
  let e = handleEvaluable(evas, ctx);
  seq[i] = new ReturnStatement(fName, e || new ImmediateValue(0), delay);
  return true;
}
