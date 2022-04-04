export function optimizeAll(codes: string[]): string[] {
  let output = optimizeMultiRET(optimizeNearByStack(codes));
  return output;
}

function optimizeNearByStack(codes: string[]): string[] {
  let o: string[] = [];
  let skipNext = false;
  codes.forEach((c, i) => {
    if (!skipNext) {
      if (c.startsWith("PUSH0")) {
        let var0 = c.split(" ")[1];
        if (
          codes[i + 1] &&
          codes[i + 1].startsWith("POP0") &&
          codes[i + 1].split(" ")[1] === var0
        ) {
          skipNext = true;
        } else {
          o.push(c);
        }
      } else {
        o.push(c);
      }
    } else {
      skipNext = false;
    }
  });
  return o;
}

function optimizeMultiRET(codes: string[]): string[] {
  let prevIsRET = false;
  let o = [];
  for (let c of codes) {
    if (c.startsWith("RET")) {
      if (!prevIsRET) {
        prevIsRET = true;
        o.push(c);
      }
    } else {
      prevIsRET = false;
      o.push(c);
    }
  }
  return o;
}
