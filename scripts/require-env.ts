/** Reads a required variable (from the shell or .env.local) or exits with a clear message. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set. Copy .env.example to .env.local.`);
    process.exit(1);
  }
  return value;
}
