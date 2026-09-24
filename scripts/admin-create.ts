import { stdin, stdout } from "node:process";
import { upsertAdmin } from "@/server/auth/admin";
import { createAuth } from "@/server/auth/create-auth";
import { createDb } from "@/server/db/create-db";
import { requireEnv } from "./require-env";

// `pnpm admin:create` creates the owner account for ADMIN_EMAIL, or resets its
// password. The password comes from ADMIN_PASSWORD (CI, e2e) or a hidden prompt.
async function main() {
  const adminEmail = requireEnv("ADMIN_EMAIL");
  const password =
    process.env.ADMIN_PASSWORD || (await promptHidden("Admin password: "));
  const { db, pool } = createDb(requireEnv("DATABASE_URL"));
  try {
    const auth = createAuth({
      db,
      secret: requireEnv("BETTER_AUTH_SECRET"),
      baseURL: "http://localhost:3000",
      adminEmail,
    });
    const result = await upsertAdmin(auth, {
      email: adminEmail,
      password,
      name: "Owner",
      adminEmail,
    });
    console.log(
      result === "created"
        ? `created admin ${adminEmail}`
        : `reset the password of ${adminEmail} and signed out its sessions`,
    );
  } finally {
    await pool.end();
  }
}

/** Reads one line from the terminal without echoing it. */
function promptHidden(question: string): Promise<string> {
  if (!stdin.isTTY) {
    throw new Error("Set ADMIN_PASSWORD or run this in a terminal.");
  }
  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          stdin.setRawMode(false);
          reject(new Error("Cancelled."));
          return;
        }
        value = char === "\u007f" ? value.slice(0, -1) : value + char;
      }
    };
    stdin.on("data", onData);
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
