import type { CSSProperties } from "react";

// Inline styles only: most mail clients drop <style> blocks and classes.
export const body: CSSProperties = {
  backgroundColor: "#f4f4f5",
  fontFamily: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "24px 0",
};

export const container: CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: 8,
  margin: "0 auto",
  maxWidth: 560,
  padding: 32,
};

export const heading: CSSProperties = {
  color: "#0b0c0f",
  fontSize: 20,
  lineHeight: "28px",
  margin: "0 0 16px",
};

export const text: CSSProperties = {
  color: "#27272a",
  fontSize: 15,
  lineHeight: "24px",
  margin: "0 0 12px",
};

export const label: CSSProperties = {
  color: "#71717a",
  fontSize: 12,
  letterSpacing: "0.04em",
  margin: "0 0 2px",
  textTransform: "uppercase",
};

export const muted: CSSProperties = {
  color: "#71717a",
  fontSize: 13,
  lineHeight: "20px",
  margin: 0,
};

export const link: CSSProperties = { color: "#0b57d0" };
