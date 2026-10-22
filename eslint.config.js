import js from "@eslint/js";
import globals from "globals";
import sonarjs from "eslint-plugin-sonarjs";

/**
 * Flat config, same complexity budget as the Halloween project: a module that
 * outgrows it gets split, the limit does not get raised.
 */
const COMPLEXITY_BUDGET = {
  complexity: ["error", { max: 8 }],
  "max-lines-per-function": [
    "error",
    { max: 40, skipBlankLines: true, skipComments: true },
  ],
  "max-lines": ["error", { max: 220, skipBlankLines: true, skipComments: true }],
  "max-depth": ["error", 3],
  "max-params": ["error", 4],
  "max-statements": ["error", 20],
  "max-nested-callbacks": ["error", 2],
  "sonarjs/cognitive-complexity": ["error", 10],
};

const COMMON_RULES = {
  eqeqeq: ["error", "always"],
  "no-var": "error",
  "prefer-const": "error",
  "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
};

export default [
  { ignores: ["node_modules/**", "coverage/**", ".idea/**", "out/**", ".claude/**"] },

  js.configs.recommended,
  sonarjs.configs.recommended,

  {
    // Statistics engine, simulation and report generators: plain Node.
    files: ["src/**/*.js", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules: { ...COMPLEXITY_BUDGET, ...COMMON_RULES },
  },

  {
    // Shared with the web game, which imports these modules in the browser:
    // no Node built-in may creep in.
    files: ["src/core/**/*.js", "src/sim/**/*.js", "src/config/**/*.js", "src/replay/**/*.js", "src/schedule/**/*.js"],
    languageOptions: { globals: {} },
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["node:*"], message: "Code partagé avec le navigateur : pas de module Node." }] }],
    },
  },

  {
    // The web game: browser ES modules served by `npm run play`.
    files: ["web/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
    },
    rules: { ...COMPLEXITY_BUDGET, ...COMMON_RULES },
  },

  {
    // Inlined into the HTML report as a classic <script>, so that the page
    // still works when opened over file:// (ES modules would not).
    files: ["src/report/page/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser, REPORT_DATA: "readonly" },
    },
  },

  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      ...COMPLEXITY_BUDGET,
      ...COMMON_RULES,
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-statements": "off",
      "max-nested-callbacks": ["error", 4],
      "sonarjs/no-duplicate-string": "off",
    },
  },

  {
    files: ["*.js"],
    languageOptions: { globals: globals.node },
  },
];
