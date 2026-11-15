import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
      "import/no-anonymous-default-export": "off",
    },
  },
  {
    files: [
      "src/app/(legal)/**",
      "src/app/docs/**",
      "src/app/error.tsx",
      "src/app/offline/page.tsx",
      "src/app/subscription/page.tsx",
      "src/app/invite/**",
      "src/app/compare/**",
      "src/app/page.tsx",
      "src/app/dashboard/page.tsx",
      "src/components/marketing/**",
      "src/components/budget-oracle.tsx",
      "src/components/plan-limit-modal.tsx",
    ],
    rules: {
    },
  },
  {
    files: [
      "src/app/dashboard/**",
      "src/app/tools/**",
      "src/app/invite/**",
      "src/app/onboarding/**",
      "src/app/team/**",
      "src/app/page.tsx",
      "src/components/auth/**",
      "src/components/dashboard/**",
      "src/components/live-chat.tsx",
      "src/components/error-boundary.tsx",
    ],
    rules: {
      "prefer-rest-params": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
