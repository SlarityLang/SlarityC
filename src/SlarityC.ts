#!/usr/bin/node
import { Command } from "commander";
import fs from "fs";
import { Lexer } from "./Lex";
import { optimizeAll } from "./Optimize";
import { handleBlockCode } from "./Parse";
const cmd = new Command();
cmd
  .description("Compile Slarit Program (.slarit)")
  .option("-o, --output <output>", "Output file name", "a.slari")
  .argument("<source>", "The source Slarit code")
  .action((source, output) => {
    fs.readFile(source, (e, d) => {
      if (e) {
        console.error("Cannot read input file!");
      } else {
        let source = d.toString();
        let lex = new Lexer();
        for (let t of source) {
          lex.feed(t);
        }
        lex.trim();
        let tokens = lex.dump();
        let code = handleBlockCode(tokens);
        let codes: string[] = [];
        if (!code) {
          console.error("Compile failed! Please check your source.");
        } else {
          code.genASM(codes);
          codes = optimizeAll(codes);
          let outs = codes.join("\n");
          fs.writeFile(output.output, outs, (e) => {
            if (e) {
              console.error("Cannot write to output: " + e);
            } else {
              console.log("Compile OK.");
            }
          });
        }
      }
    });
  });
cmd.parse(process.argv);
