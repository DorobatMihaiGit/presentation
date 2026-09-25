import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Everything that decides what a poster looks like. Editing any of these
 * files makes the committed posters stale until `pnpm assets:posters` runs
 * again (tests/unit/posters.test.ts compares the hash).
 */
export const POSTER_SOURCES = [
  "src/experience/Stage.tsx",
  "src/experience/director",
  "src/experience/postfx",
  "src/experience/scenes",
];

function files(path: string): string[] {
  if (!statSync(path).isDirectory()) {
    return [path];
  }
  return readdirSync(path).flatMap((name) => files(join(path, name)));
}

/** Short sha256 over the poster sources (paths and contents, sorted). */
export function posterSourceHash(root = process.cwd()): string {
  const hash = createHash("sha256");
  const all = POSTER_SOURCES.flatMap((path) => files(join(root, path)))
    .map((file) => relative(root, file).split("\\").join("/"))
    .sort();
  for (const file of all) {
    hash.update(file);
    hash.update("\0");
    hash.update(readFileSync(join(root, file)));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}
