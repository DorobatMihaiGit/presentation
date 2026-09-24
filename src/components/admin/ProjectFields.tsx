import {
  Checkbox,
  FormSection,
  Select,
  TextField,
  TranslatedField,
} from "./fields";
import { MarkdownField } from "./MarkdownField";

type ProjectText = {
  title: string;
  summary: string;
  role: string;
  outcome: string;
  bodyMd: string;
};

export type ProjectDefaults = {
  slug: string;
  year: number;
  repoUrl: string | null;
  liveUrl: string | null;
  coverMediaId: string | null;
  featured: boolean;
  published: boolean;
  skills: string[];
  en?: ProjectText;
  ro?: ProjectText;
};

export const EMPTY_PROJECT: ProjectDefaults = {
  slug: "",
  year: new Date().getUTCFullYear(),
  repoUrl: null,
  liveUrl: null,
  coverMediaId: null,
  featured: false,
  published: false,
  skills: [],
};

/** Project form fields; `skills` and `images` feed the pickers. */
export function ProjectFields({
  value,
  isNew,
  skills,
  images,
}: {
  value: ProjectDefaults;
  isNew: boolean;
  skills: ReadonlyArray<{ slug: string; name: string }>;
  images: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <>
      <FormSection title="Project">
        <div className="grid gap-4 md:grid-cols-2">
          {isNew ? (
            <TextField
              name="slug"
              label="Slug"
              defaultValue={value.slug}
              required
              hint="Used in the URL. Cannot change later."
            />
          ) : (
            <input type="hidden" name="slug" value={value.slug} />
          )}
          <TextField
            name="year"
            label="Year"
            type="number"
            defaultValue={value.year}
            required
          />
          <TextField
            name="liveUrl"
            label="Live URL"
            type="url"
            defaultValue={value.liveUrl}
          />
          <TextField
            name="repoUrl"
            label="Source URL"
            type="url"
            defaultValue={value.repoUrl}
          />
          <Select
            name="coverMediaId"
            label="Cover image"
            defaultValue={value.coverMediaId ?? ""}
            options={[{ value: "", label: "None" }, ...images]}
          />
        </div>
        <div className="flex flex-wrap gap-6">
          <Checkbox
            name="featured"
            label="Featured"
            defaultChecked={value.featured}
          />
          <Checkbox
            name="published"
            label="Published"
            defaultChecked={value.published}
          />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm text-ink-muted">Skills</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {skills.map((s) => (
              <label
                key={s.slug}
                className="flex items-center gap-2 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  name="skills"
                  value={s.slug}
                  defaultChecked={value.skills.includes(s.slug)}
                />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
      </FormSection>
      <FormSection title="Text">
        <TranslatedField
          name="title"
          label="Title"
          en={value.en?.title ?? ""}
          ro={value.ro?.title ?? ""}
        />
        <TranslatedField
          name="summary"
          label="Summary"
          en={value.en?.summary ?? ""}
          ro={value.ro?.summary ?? ""}
          multiline
          rows={3}
        />
        <TranslatedField
          name="role"
          label="Role"
          en={value.en?.role ?? ""}
          ro={value.ro?.role ?? ""}
        />
        <TranslatedField
          name="outcome"
          label="Outcome"
          en={value.en?.outcome ?? ""}
          ro={value.ro?.outcome ?? ""}
          multiline
          rows={2}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <MarkdownField
            name="en.body"
            label="Case study (EN)"
            defaultValue={value.en?.bodyMd ?? ""}
          />
          <MarkdownField
            name="ro.body"
            label="Case study (RO)"
            defaultValue={value.ro?.bodyMd ?? ""}
          />
        </div>
      </FormSection>
    </>
  );
}
