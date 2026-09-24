import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/ActionButton";
import { ActionForm, FieldError } from "@/components/admin/ActionForm";
import { FormSection, TextField } from "@/components/admin/fields";
import { field, label } from "@/components/admin/styles";
import { deleteMedia, saveMediaAlt, uploadMedia } from "@/server/actions/media";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { listMediaForAdmin } from "@/server/queries/admin/media";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage() {
  await requireAdmin();
  const items = await listMediaForAdmin(getDb());

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title text-ink">Media</h1>
      <ActionForm action={uploadMedia} submitLabel="Upload">
        <FormSection title="Upload">
          <div>
            <label htmlFor="file" className={label}>
              File (JPEG, PNG, WebP, AVIF or PDF, up to 4 MB)
            </label>
            <input
              id="file"
              name="file"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
              aria-describedby="file-error"
              className={field}
            />
            <FieldError name="file" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField name="altEn" label="Alt text (EN)" />
            <TextField name="altRo" label="Alt text (RO)" />
          </div>
        </FormSection>
      </ActionForm>
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 rounded-panel bg-surface p-4 ring-1 ring-line"
          >
            {item.kind === "image" ? (
              // biome-ignore lint/performance/noImgElement: admin thumbnails of arbitrary uploads; next/image needs known remote hosts.
              <img
                src={item.blobUrl}
                alt={item.altEn}
                width={item.width ?? undefined}
                height={item.height ?? undefined}
                className="h-40 w-full rounded-control bg-canvas object-contain"
                style={
                  item.lqip
                    ? {
                        backgroundImage: `url(${item.lqip})`,
                        backgroundSize: "cover",
                      }
                    : undefined
                }
              />
            ) : (
              <a
                href={item.blobUrl}
                className="text-ink underline underline-offset-4"
              >
                {item.pathname}
              </a>
            )}
            <p className="font-mono text-label text-ink-subtle">
              {item.mime} · {Math.round(item.bytes / 1024)} KB
              {item.width ? ` · ${item.width}×${item.height}` : ""}
            </p>
            <ActionForm
              action={saveMediaAlt}
              submitLabel="Save alt text"
              className="flex flex-col gap-3"
            >
              <input type="hidden" name="id" value={item.id} />
              <TextField
                name="altEn"
                label={`Alt text (EN) for ${item.pathname}`}
                defaultValue={item.altEn}
              />
              <TextField
                name="altRo"
                label={`Alt text (RO) for ${item.pathname}`}
                defaultValue={item.altRo}
              />
            </ActionForm>
            <ActionButton
              action={deleteMedia}
              fields={{ id: item.id }}
              label={`Delete ${item.pathname}`}
              confirmMessage="Delete this file? Anything using it loses it."
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
