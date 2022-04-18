export const TokenType: Record<string, RegExp> = {
  NUMBERS: /[0-9]/,
  IDENTIFIER: /[0-9A-Za-z_\$\%\^\!\?\:\#]/,
  LEFT_BRACKET: /\(/,
  RIGHT_BRACKET: /\)/,
  OPERATOR: /[\+\-\*\/\<\>\=\&\|\.]/,
  AT: /\@/,
  NOT: /\!/,
  LEFT_SECTION_BRACKET: /{/,
  RIGHT_SECTION_BRACKET: /}/,
  COMMA: /,/,
  EOL: /[\n;]/,
};

export class Lexer {
  static TokenKeys = Object.keys(TokenType);
  prevTokens: [string, string][];
  buffer: string;
  bufferType: string;
  expecting: string[];
  constructor() {
    this.expecting = ["IDENTIFIER", "EOL"];
    this.prevTokens = [];
    this.buffer = "";
    this.bufferType = "EMPTY";
  }
  feed(token: string) {
    if (/ /.test(token)) {
      if (this.buffer === "return") {
        this.prevTokens.push([this.buffer, this.bufferType]);
        this.buffer = "";
        this.bufferType = "EMPTY";
        this.expecting = ["NOT", "AT", "NUMBERS", "IDENTIFIER", "LEFT_BRACKET"];
      }
      return;
    }
    let type = "EMPTY";
    for (let k of this.expecting) {
      if (TokenType[k].test(token)) {
        type = k;
        break;
      }
    }
    if (type === "EMPTY") {
      throw `Unexpected token ${token}, expecting: ${this.expecting.join(
        ", "
      )}`;
    }
    switch (type) {
      case "NUMBERS":
        if (this.bufferType === "IDENTIFIER") {
          this.buffer += token;
          this.expecting = [
            "NUMBERS",
            "IDENTIFIER",
            "OPERATOR",
            "LEFT_BRACKET",
            "RIGHT_BRACKET",
            "COMMA",
            "RIGHT_SECTION_BRACKET",
            "EOL",
          ];
        } else if (this.bufferType === "NUMBERS") {
          this.buffer += token;
          this.expecting = [
            "NUMBERS",
            "IDENTIFIER",
            "OPERATOR",
            "RIGHT_BRACKET",
            "COMMA",
            "RIGHT_SECTION_BRACKET",
            "EOL",
          ];
        } else {
          this.prevTokens.push([this.buffer, this.bufferType]);
          this.buffer = token;
          this.bufferType = "NUMBERS";
          this.expecting = [
            "NUMBERS",
            "IDENTIFIER",
            "OPERATOR",
            "COMMA",
            "RIGHT_BRACKET",
            "RIGHT_SECTION_BRACKET",
            "EOL",
          ];
        }
        break;
      case "IDENTIFIER":
        if (this.bufferType === "NUMBERS") {
          this.buffer += token;
          this.bufferType = "IDENTIFIER";
        } else if (this.bufferType === "IDENTIFIER") {
          this.buffer += token;
        } else {
          this.prevTokens.push([this.buffer, this.bufferType]);
          this.buffer = token;
          this.bufferType = "IDENTIFIER";
        }

        this.expecting = [
          "NUMBERS",
          "IDENTIFIER",
          "OPERATOR",
          "LEFT_BRACKET",
          "RIGHT_BRACKET",
          "COMMA",
          "RIGHT_SECTION_BRACKET",
          "LEFT_SECTION_BRACKET",
          "EOL",
        ];
        break;
      case "COMMA":
        this.prevTokens.push([this.buffer, this.bufferType]);
        this.prevTokens.push([token, "COMMA"]);
        this.buffer = "";
        this.bufferType = "EMPTY";
        this.expecting = ["NUMBERS", "IDENTIFIER", "LEFT_BRACKET"];
        break;
      case "LEFT_BRACKET":
        this.prevTokens.push([this.buffer, this.bufferType]);
        this.prevTokens.push([token, "LEFT_BRACKET"]);
        this.buffer = "";
        this.bufferType = "EMPTY";
        this.expecting = [
          "NUMBERS",
          "NOT",
          "AT",
          "IDENTIFIER",
          "LEFT_BRACKET",
          "RIGHT_BRACKET",
        ];
        break;
      case "RIGHT_BRACKET":
        this.prevTokens.push([this.buffer, this.bufferType]);
        this.prevTokens.push([token, "RIGHT_BRACKET"]);
        this.buffer = "";
        this.bufferType = "EMPTY";
        this.expecting = [
          "COMMA",
          "RIGHT_BRACKET",
          "LEFT_SECTION_BRACKET",
          "RIGHT_SECTION_BRACKET",
          "OPERATOR",
          "EOL",
        ];
        break;
      case "OPERATOR":
        if (this.bufferType === "OPERATOR") {
          if (token === "=" || (token === "-" && this.buffer === "<")) {
            this.buffer += token;
            this.prevTokens.push([this.buffer, this.bufferType]);
            this.buffer = "";
            this.bufferType = "EMPTY";
            this.expecting = [
              "NUMBERS",
              "IDENTIFIER",
              "LEFT_BRACKET",
              "NOT",
              "AT",
            ];
          }
        } else {
          this.prevTokens.push([this.buffer, this.bufferType]);
          if (token !== ">" && token !== "<" && token !== "=") {
            // Singleton
            this.prevTokens.push([token, "OPERATOR"]);
            this.buffer = "";
            this.bufferType = "EMPTY";
            this.expecting = [
              "NOT",
              "AT",
              "NUMBERS",
              "IDENTIFIER",
              "LEFT_BRACKET",
            ];
          } else {
            this.buffer = token;
            this.bufferType = "OPERATOR";
            this.expecting = [
              "NUMBERS",
              "IDENTIFIER",
              "LEFT_BRACKET",
              "NOT",
              "AT",
              "OPERATOR",
            ];
          }
        }
        break;
      case "NOT":
        this.prevTokens.push([this.buffer, this.bufferType]);
        this.prevTokens.push([token, "NOT"]);
        this.buffer = "";
        this.bufferType = "EMPTY";
        this.expecting = ["NUMBERS", "IDENTIFIER", "LEFT_BRACKET"];
        break;
      case "AT":
        this.prevTokens.push([this.buffer, this.bufferType]);
        this.prevTokens.push([token, "AT"]);
        this.buffer = "";
        this.bufferType = "EMPTY";
        this.expecting = ["NUMBERS", "IDENTIFIER", "LEFT_BRACKET"];
        break;
      case "EOL":
        this.prevTokens.push([this.buffer, this.bufferType]);
        this.prevTokens.push([token, "EOL"]);
        this.buffer = "";
        this.bufferType = "EMPTY";
        this.expecting = ["IDENTIFIER", "EOL", "RIGHT_SECTION_BRACKET"];
        break;
      case "LEFT_SECTION_BRACKET":
        this.prevTokens.push([this.buffer, this.bufferType]);
        this.prevTokens.push([token, "LEFT_SECTION_BRACKET"]);
        this.buffer = "";
        this.bufferType = "EMPTY";
        this.expecting = ["IDENTIFIER", "EOL", "RIGHT_SECTION_BRACKET"];
        break;
      case "RIGHT_SECTION_BRACKET":
        this.prevTokens.push([this.buffer, this.bufferType]);
        this.prevTokens.push([token, "RIGHT_SECTION_BRACKET"]);
        this.buffer = "";
        this.bufferType = "EMPTY";
        this.expecting = ["IDENTIFIER", "EOL", "RIGHT_SECTION_BRACKET"];
        break;
    }
  }
  trim(): void {
    if (this.buffer.length > 0) {
      this.prevTokens.push([this.buffer, this.bufferType]);
    }
    this.prevTokens = this.prevTokens.filter((v) => {
      return v[0].length > 0;
    });
  }
  dump(): [string, string][] {
    return this.prevTokens;
  }
}
