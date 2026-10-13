import { blobImageHost } from "./blob-host";
import {
  createAppEnv,
  type RuntimeEnv,
  type StandardIssue,
} from "./create-app-env";

// The pure part of `pnpm deploy:check` (scripts/deploy-check.ts): the app's
// own env schema plus the rules that only production needs. Results carry
// variable names and messages, never values.

export type Check = { name: string; ok: boolean; message: string };

/** The .env.example value: fine for local development, never for a deploy. */
export const EXAMPLE_AUTH_SECRET = "dev-only-better-auth-secret-change-me-0123";

const VARIABLES: (keyof RuntimeEnv)[] = [
  "DATABASE_URL",
  "SITE_URL",
  "BETTER_AUTH_SECRET",
  "ADMIN_EMAIL",
  "BLOB_READ_WRITE_TOKEN",
  "BLOB_PUBLIC_HOST",
  "RESEND_API_KEY",
  "CONTACT_FROM_EMAIL",
  "CONTACT_TO_EMAIL",
  "NEXT_PUBLIC_ASSET_BASE",
];

function present(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== "";
}

/** Parses KEY=value lines (comments and blank lines skipped, quotes dropped). */
export function parseEnvFile(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) {
      env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  }
  return env;
}

export function deployChecks(env: RuntimeEnv): Check[] {
  const checks: Check[] = [];
  let schemaIssues: Map<string, string> = new Map();
  try {
    createAppEnv(env, {
      isServer: true,
      onValidationError: (issues) => {
        throw new SchemaError(issues);
      },
    });
  } catch (error) {
    schemaIssues = issuesByName(error);
  }
  for (const name of VARIABLES) {
    const issue = schemaIssues.get(name);
    checks.push({
      name,
      ok: !issue,
      message: issue ?? (present(env[name]) ? "valid" : "not set (optional)"),
    });
  }

  const site = present(env.SITE_URL) ? safeUrl(env.SITE_URL) : null;
  checks.push({
    name: "SITE_URL is https",
    ok: site?.protocol === "https:",
    message: site
      ? site.protocol === "https:"
        ? "https"
        : "production needs https (secure cookies, passkeys, HSTS)"
      : "set SITE_URL to the production origin",
  });

  const secret = env.BETTER_AUTH_SECRET ?? "";
  checks.push({
    name: "BETTER_AUTH_SECRET is a real secret",
    ok: secret.length >= 32 && secret !== EXAMPLE_AUTH_SECRET,
    message:
      secret === EXAMPLE_AUTH_SECRET
        ? "still the .env.example value: openssl rand -base64 32"
        : secret.length >= 32
          ? "32 or more characters"
          : "at least 32 characters: openssl rand -base64 32",
  });

  if (present(env.RESEND_API_KEY)) {
    const from = env.CONTACT_FROM_EMAIL?.split("@")[1]?.toLowerCase();
    const host = site?.hostname.replace(/^www\./, "").toLowerCase();
    checks.push({
      name: "CONTACT_FROM_EMAIL is on the site's domain",
      ok: Boolean(from && host && (from === host || from.endsWith(`.${host}`))),
      message:
        from && host
          ? "Resend sends only from a verified domain: use the site's"
          : "needs CONTACT_FROM_EMAIL and SITE_URL",
    });
  }

  if (present(env.BLOB_READ_WRITE_TOKEN)) {
    checks.push({
      name: "Blob uploads have an image host",
      ok: blobImageHost(env) !== undefined,
      message:
        "BLOB_PUBLIC_HOST, or a vercel_blob_rw_<store>_<secret> token to derive it",
    });
  }
  return checks;
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

class SchemaError extends Error {
  constructor(readonly issues: readonly StandardIssue[]) {
    super("Invalid environment variables");
  }
}

/** Variable name → first schema message (the messages carry no values). */
function issuesByName(error: unknown): Map<string, string> {
  const issues = new Map<string, string>();
  if (!(error instanceof SchemaError)) {
    issues.set("environment", String((error as Error)?.message ?? error));
    return issues;
  }
  for (const issue of error.issues) {
    const first = issue.path?.[0];
    const name = String(
      typeof first === "object" && first !== null ? first.key : (first ?? ""),
    );
    if (name && !issues.has(name)) {
      issues.set(name, issue.message);
    }
  }
  return issues;
}
