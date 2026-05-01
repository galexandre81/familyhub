module.exports = {
  root: true,
  env: { es2022: true, node: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    project: ["tsconfig.json"],
  },
  ignorePatterns: ["lib/", "node_modules/", "/generated/"],
  plugins: ["@typescript-eslint"],
  rules: {
    quotes: ["error", "double", { allowTemplateLiterals: true }],
    "import/no-unresolved": "off",
    "max-len": "off",
  },
};
