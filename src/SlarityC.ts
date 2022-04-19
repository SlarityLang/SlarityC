#!/usr/bin/node
import { Command } from "commander";
import fs, { writeFile } from "fs/promises";
import path from "path";
import { asm2Bin } from "./Bytecode";
import { collectClass, dumpClass, summarizeClass } from "./ClassSummary";
import { mkContext, transformFullClassName } from "./Context";
import { Lexer } from "./Lex";
import { error, info, setDebug } from "./Logger";
import { removeComments } from "./MetaParser";
import { optimizeAll } from "./Optimize";
import { handleBlockCode } from "./Parse";
import { preprocess } from "./Preprocessor";
const cmd = new Command();
cmd
  .description("Compile Slarity Program (.slarity)")
  .option("-o, --output <output>", "Specify output file name.", "a.slari")
  .option("-v, --verbose", "Enable extra outputs.")
  .option("-c, --compile-only", "Only compile, do not link. (Ignore -o and -l)")
  .option("-k, --classes <clazz...>", "Class summary files to link.")
  .option("-l, --link <file...>", "Link compiled files.")
  .option(
    "-s, --share-context",
    "Use the same compile context to compile all files. (Be careful, this can produce MANY BUGS if not used properly!)"
  )
  .option("-b, --bytecode", "Generate bytecode output. ")
  .argument("<source...>", "The source Slarity code files.")
  .action(async (source, opts) => {
    setDebug(opts.verbose);
    let outExtension = opts.bytecode ? ".slarib" : ".slari";
    if (!opts.compileOnly) {
      await writeFile(opts.output, "");
    }
    let ctx = mkContext();
    if (opts.classes) {
      for (let c of opts.classes) {
        collectClass((await fs.readFile(c)).toString(), ctx);
      }
    }
    for (let f of source) {
      ctx.currentModuleName = "";
      ctx.functionScopeClassList.clear();
      ctx.moduleAliasMap.clear();
      ctx.type = "";
      info("Now compiling " + f);
      let d = await fs.readFile(f);
      let processedSource = removeComments(preprocess(d.toString(), ctx));
      let lex = new Lexer();
      for (let t of processedSource) {
        lex.feed(t);
      }
      lex.trim();
      let tokens = lex.dump();
      let code = handleBlockCode(tokens, ctx);
      let codes: string[] = [];
      if (!code) {
        error("Compile failed! Please check your source.");
      } else {
        let outs;
        if (ctx.type === "CLASS") {
          let clazz = summarizeClass(code, ctx);
          for (let c of clazz) {
            outs = dumpClass(c[0]);
            collectClass(outs, ctx); // Self collect
            let nn = path.join(
              path.dirname(f),
              transformFullClassName(c[0].identifier, ctx) + ".slaritz"
            );
            await fs.writeFile(nn, outs);
            let codes: string[] = [];
            c[1].genASM(codes);
            let out0;
            if (opts.bytecode) {
              out0 = asm2Bin(codes);
            } else {
              out0 = codes.join("\n");
            }
            out0 += "\n";
            if (opts.compileOnly) {
              let nn = path.join(
                path.dirname(f),
                transformFullClassName(c[0].identifier, ctx) + outExtension
              );
              await fs.writeFile(nn, out0);
            } else {
              await fs.appendFile(opts.output, out0);
            }
          }
        } else {
          code.genASM(codes);
          codes = optimizeAll(codes);
          let outs;
          if (opts.bytecode) {
            outs = asm2Bin(codes);
          } else {
            outs = codes.join("\n");
          }
          outs += "\n";
          if (opts.compileOnly) {
            let nn = path.join(
              path.dirname(f),
              path.basename(f, ".slarity") + outExtension
            );
            await fs.writeFile(nn, outs);
          } else {
            await fs.appendFile(opts.output, outs);
          }
        }
      }
    }
    if (!opts.compileOnly) {
      if (opts.link) {
        for (let f of opts.link) {
          await fs.appendFile(
            opts.output,
            (await fs.readFile(f)).toString() + "\n"
          );
        }
      }
    }
    info("Compile OK.");
  });
cmd.parse(process.argv);
