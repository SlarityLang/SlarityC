export function parseMeta(source: string): Map<string, string> {
  let l = source.split("\n");
  let regex = /( )+?/;
  let o = new Map();
  for (let l0 of l) {
    l0 = l0.trim();
    if (l0.startsWith(";")) {
      let pair = l0.slice(1);
      let [k, v] = pair.split(regex);
      o.set(k.trim(), v.trim());
    }
  }
  return o;
}

const COMMENT1 = /(\/\/).*/g;
const COMMENT2 = /\/\*[^(\*\/)]*\*\//g;
export function removeComments(source: string): string {
  return source.replace(COMMENT1, "").replace(COMMENT2, "");
}
