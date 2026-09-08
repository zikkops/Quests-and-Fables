import type { NextConfig } from "next";

/**
 * Emulator mode builds into its own directory.
 *
 * Next refuses to run a second dev server for the same project directory, and
 * the lock it checks lives under the build directory. Without this,
 * `npm run dev:emulator` cannot start while an ordinary `npm run dev` is up,
 * whatever port it is given, and the two modes are exactly the pair you want
 * side by side: one on the real database, one on throwaway emulators.
 *
 * It also keeps the two sets of compiled output apart, so switching between
 * them is not a rebuild every time.
 */
/*
  ⚠️ Development only, and the second half of that condition matters.

  `distDir` decides where the compiled config itself is written, so a config
  whose output location depends on an environment variable is a config that can
  be looked for in the wrong place. A deploy that happened to carry
  NEXT_PUBLIC_FIREBASE_EMULATOR, from a copied env file or a dashboard entry,
  would build into `.next-emulator` while the platform looked in `.next`.

  A production build now always writes to `.next`, whatever the environment
  says. There is no reason for a deploy to want the emulator's directory, and
  every reason for the answer not to depend on a stray variable.
*/
const onEmulator =
  process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1"
  && process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  ...(onEmulator ? { distDir: ".next-emulator" } : {}),
};

export default nextConfig;
