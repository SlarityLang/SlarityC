const INSTR_CODE: Record<string, number> = {
  MOV: 0x10,
  DEL: 0x11,
  ADD: 0x12,
  SUB: 0x13,
  MUL: 0x14,
  CMP: 0x15,
  AND: 0x16,
  OR: 0x17,
  XOR: 0x18,
  NOT: 0x19,
  DIV: 0x80,
  RET: 0x81,
  CALL: 0x82,
  JMP: 0x83,
  PUSH: 0x84,
  PUSH0: 0x85,
  POP: 0x86,
  POP0: 0x87,
  JE: 0x88,
  JB: 0x89,
  JBE: 0x90,
  JA: 0x91,
  JAE: 0x92,
  INT: 0x93,
  NOP: 0x94,
  END: 0x95,
  OUT: 0x96,
  IN: 0x97,
};
const GAP = 0x99;
const LF = 0x0a;
const MAGIC: string = String.fromCharCode(0x00, 0x00, 0x50, 0x68, 0x69, 0x0a);
export function asm2Bin(source: string[]): string {
  let strs: string[] = [MAGIC];
  for (let l of source) {
    let [op, a1, a2] = l.split(" ");
    strs.push(
      String.fromCharCode(INSTR_CODE[op]),
      String.fromCharCode(GAP),
      a1
    );
    if (a2) {
      strs.push(String.fromCharCode(GAP), a2);
    }
    String.fromCharCode(LF);
  }
  return strs.join("");
}
