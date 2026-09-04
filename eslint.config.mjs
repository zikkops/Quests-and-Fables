// eslint-config-next 16 ships a real flat config, so this imports it directly.
// The FlatCompat / @eslint/eslintrc shim create-next-app used to generate is no
// longer needed and no longer works against this version.
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
