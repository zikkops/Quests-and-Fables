/**
 * Strip firestore.rules down to something that pastes into the console.
 *
 *   node scripts/compact-rules.mjs
 *
 * The commented file is the source of truth and the only one to edit. This
 * writes firestore.rules.min, which is generated, gitignored, and safe to
 * delete. Deploying with the CLI needs none of this:
 *
 *   firebase deploy --only firestore:rules,firestore:indexes
 */
import fs from "node:fs";

const source = fs.readFileSync("firestore.rules", "utf8");
const lines = source.split("\n");

/* Guard, per line so it cannot match across two separate strings: a // inside
   a string literal would be mangled by the line-comment strip. */
for (const [at, line] of lines.entries()) {
  if (/'[^']*\/\/[^']*'/.test(line)) {
    throw new Error(`Line ${at + 1} has // inside a string. Strip by hand.`);
  }
}

const compact = source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .map((line) => line.replace(/\/\/.*$/, "").trimEnd())
  .filter((line) => line.trim().length > 0)
  .join("\n")
  .replace(/\n{2,}/g, "\n");

fs.writeFileSync("firestore.rules.min", compact + "\n");
console.log(`${lines.length} lines -> ${compact.split("\n").length} lines`);
