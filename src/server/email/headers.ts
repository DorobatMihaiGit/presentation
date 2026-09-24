// Anything that ends up in a mail header (subject, display names, addresses)
// must be one line: a CR or LF there could start a new header such as `Bcc:`.

// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point.
const CONTROL = /[\x00-\x1f\x7f]+/g;

/** Single-line header value: control characters become spaces, then trimmed and shortened. */
export function headerText(value: string, max = 200): string {
  const line = value.replace(CONTROL, " ").replace(/ {2,}/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** `"Display Name" <address>` with the name quoted per RFC 5322. */
export function mailbox(name: string, address: string): string {
  const quoted = headerText(name, 100).replace(/[\\"]/g, "\\$&");
  return `"${quoted}" <${headerText(address, 254)}>`;
}
