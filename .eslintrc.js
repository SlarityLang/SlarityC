module.exports = {
  env: {
    browser: true,
    es2021: true,
    commonjs: true,
    node: true,
  },
  extends: ["eslint:recommended"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json"],
    ecmaVersion: 12,
    sourceType: "module",
  },
  rules: {
    "no-empty-function": "off",
    "no-empty": "off",
    "no-debugger": "off",
    "prefer-const": "warn",
    "@typescript-eslint/no-empty-interface": "warn",
    "@typescript-eslint/ban-ts-comment": "off",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "react-hooks/rules-of-hooks": "error",
    "@typescript-eslint/no-empty-function": "off",
    "require-await": "warn",
    "@typescript-eslint/no-floating-promises": "warn",
  },
};
