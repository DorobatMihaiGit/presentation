import type { ReactNode } from "react";
import { FieldError } from "./ActionForm";
import { field, label as labelClass } from "./styles";

type InputProps = {
  name: string;
  /** Defaults to `name`; set it when the same form repeats on one page. */
  id?: string;
  label: string;
  defaultValue?: string | number | null;
  type?: "text" | "email" | "url" | "number" | "month";
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  hint?: string;
};

/** Labelled input or textarea with its validation message. */
export function TextField({
  name,
  id = name,
  label,
  defaultValue,
  type = "text",
  required,
  multiline,
  rows = 4,
  hint,
}: InputProps) {
  const common = {
    id,
    name,
    required,
    defaultValue: defaultValue ?? "",
    "aria-describedby": `${id}-error`,
    className: field,
  };
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {multiline ? (
        <textarea rows={rows} {...common} />
      ) : (
        <input type={type} {...common} />
      )}
      {hint ? (
        <span className="mt-1 block text-sm text-ink-subtle">{hint}</span>
      ) : null}
      <FieldError name={name} id={`${id}-error`} />
    </div>
  );
}

/**
 * EN and RO inputs side by side (spec §5). English is required; a blank
 * Romanian value falls back to English on /ro and is flagged here.
 */
export function TranslatedField({
  name,
  label,
  en,
  ro,
  multiline,
  rows,
  hint,
}: {
  name: string;
  label: string;
  en: string;
  ro: string;
  multiline?: boolean;
  rows?: number;
  hint?: string;
}) {
  const missing = en.trim() !== "" && ro.trim() === "";
  return (
    <fieldset className="grid gap-4 md:grid-cols-2">
      <legend className="mb-2 flex items-center gap-3 text-ink">
        {label}
        {missing ? <MissingBadge /> : null}
      </legend>
      <TextField
        name={`en.${name}`}
        label={`${label} (EN)`}
        defaultValue={en}
        required
        multiline={multiline}
        rows={rows}
        hint={hint}
      />
      <TextField
        name={`ro.${name}`}
        label={`${label} (RO)`}
        defaultValue={ro}
        multiline={multiline}
        rows={rows}
        hint={hint}
      />
    </fieldset>
  );
}

export function MissingBadge() {
  return (
    <span className="rounded-full px-2 py-0.5 font-mono text-label uppercase text-ink-muted ring-1 ring-line-strong">
      RO missing
    </span>
  );
}

export function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

export function Select({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className={field}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError name={name} />
    </div>
  );
}

export function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-panel bg-surface p-6 ring-1 ring-line">
      <h2 className="text-heading text-ink">{title}</h2>
      {children}
    </section>
  );
}
