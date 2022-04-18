import { CompileContext } from "./Context";
import { debug } from "./Logger";

export function preprocess(source: string, ctx: CompileContext): string {
  let lines = [];
  let defines: Map<string, string> = new Map();
  let sources = source.split("\n");
  let cli = false;
  let pair = 0;
  for (let s of sources) {
    s = s.trim();
    if (s.startsWith("#")) {
      let instr = s.indexOf(" ");
      let args;
      let oper;
      if (instr === -1) {
        oper = s;
        args = "";
      } else {
        args = s.slice(instr + 1).trim();
        oper = s.slice(0, instr).toLowerCase();
      }
      if (cli && oper !== "#endif" && oper !== "#else") {
        continue;
      }
      switch (oper) {
        case "#define": {
          let tod = args.split(" ");
          let k = tod.shift() || "";
          let v = tod.join(" ").trim();
          defines.set(k, v);
          debug(`Define ${k} = ${v}`);
          break;
        }
        case "#undef": {
          let k = args.split(" ").shift();
          defines.delete(k || "");
          debug(`Undef ${k}`);
          break;
        }
        case "#ifdef": {
          let k = args.split(" ").shift();
          pair++;
          if (![...defines.keys()].includes(k || "")) {
            cli = true;
          }
          break;
        }
        case "#ifndef": {
          let k = args.split(" ").shift();
          pair++;
          if ([...defines.keys()].includes(k || "")) {
            cli = true;
          }
          break;
        }
        case "#endif": {
          pair--;
          if (pair <= 0) {
            cli = false;
          }
          break;
        }
        case "#else": {
          cli = !cli;
          break;
        }
        case "#module": {
          let k = args.split(" ").shift();
          ctx.currentModuleName = k || "";
          break;
        }
        case "#type": {
          ctx.type = (args.split(" ").shift() || "").toUpperCase();
          break;
        }
        case "#use": {
          let tod = args.split(" ");
          let k = tod.shift() || "";
          let v = tod.join(" ").trim();
          if (v.length > 0) {
            ctx.moduleAliasMap.set(v, k);
          } else {
            let name = k.split(".").pop() || "";
            ctx.moduleAliasMap.set(name, k);
          }
          break;
        }
      }
    } else {
      for (let [r, t] of defines.entries()) {
        s = s.replaceAll(r, t);
      }
      if (!cli) {
        lines.push(s);
      }
    }
  }
  return lines.join("\n");
}
