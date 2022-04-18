import chalk from "chalk";
let DEBUG = false;

export function setDebug(debug: boolean): void {
  DEBUG = debug;
}
export function debug(msg: string): void {
  if (DEBUG) {
    console.log(
      chalk.whiteBright(new Date().toLocaleTimeString()) +
        " " +
        chalk.cyanBright(msg)
    );
  }
}
export function info(msg: string): void {
  console.log(
    chalk.whiteBright(new Date().toLocaleTimeString()) +
      " " +
      chalk.greenBright(msg)
  );
}
export function warn(msg: string): void {
  console.log(
    chalk.whiteBright(new Date().toLocaleTimeString()) +
      " " +
      chalk.yellowBright(msg)
  );
}
export function error(msg: string): void {
  console.log(
    chalk.whiteBright(new Date().toLocaleTimeString()) +
      " " +
      chalk.redBright(msg)
  );
}
