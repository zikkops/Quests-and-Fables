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
const onEmulator = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1";

const nextConfig: NextConfig = {
  ...(onEmulator ? { distDir: ".next-emulator" } : {}),
};

export default nextConfig;
