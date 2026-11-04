import js from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "backend/data/**", "vision/**", ".claude/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  { files: ["frontend/src/**", "frontend/test/**"], languageOptions: { globals: globals.browser } },
  {
    files: ["backend/**", "*.{js,mjs,cjs,ts}", "frontend/*.{js,mjs,cjs,ts}"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["frontend/**/*.{ts,tsx}"],
    plugins: { "react-hooks": hooks },
    rules: { "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "error" },
  },
);
