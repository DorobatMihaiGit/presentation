"use client";

import { useId, useState } from "react";
import Markdown from "react-markdown";
import { FieldError } from "./ActionForm";
import { field, label as labelClass, secondaryButton } from "./styles";

/**
 * Markdown textarea with a rendered preview (spec §5: projects with markdown
 * preview). react-markdown never renders raw HTML, so a preview cannot run
 * scripts from the text.
 */
export function MarkdownField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(false);
  const previewId = useId();

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={name} className={labelClass}>
          {label}
        </label>
        <button
          type="button"
          aria-controls={previewId}
          aria-pressed={preview}
          onClick={() => setPreview((shown) => !shown)}
          className={secondaryButton}
        >
          {preview ? `Edit ${label}` : `Preview ${label}`}
        </button>
      </div>
      <textarea
        id={name}
        name={name}
        rows={10}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        hidden={preview}
        aria-describedby={`${name}-error`}
        className={`${field} font-mono`}
      />
      <div
        id={previewId}
        hidden={!preview}
        className="mt-1.5 flex flex-col gap-3 rounded-control bg-canvas p-4 text-ink ring-1 ring-line [&_a]:underline [&_h2]:text-heading [&_ul]:list-disc [&_ul]:pl-5"
      >
        <Markdown>{value || "Nothing to preview yet."}</Markdown>
      </div>
      <FieldError name={name} />
    </div>
  );
}
