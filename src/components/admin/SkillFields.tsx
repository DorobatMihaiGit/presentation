import { STACK_LAYERS } from "@/content/types";
import { Checkbox, Select, TextField } from "./fields";

export type SkillDefaults = {
  slug: string;
  layer: string;
  name: string;
  level: number;
  years: number;
  featured: boolean;
};

const LAYERS = STACK_LAYERS.map((layer) => ({ value: layer, label: layer }));

/** Skill form fields. The slug is editable only when creating. */
export function SkillFields({
  value,
  isNew,
}: {
  value: SkillDefaults;
  isNew: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {isNew ? (
        <TextField
          name="slug"
          label="Slug"
          defaultValue={value.slug}
          required
          hint="Lowercase letters, digits and dashes. Cannot change later."
        />
      ) : (
        <input type="hidden" name="slug" value={value.slug} />
      )}
      <TextField name="name" label="Name" defaultValue={value.name} required />
      <Select
        name="layer"
        label="Stack layer"
        defaultValue={value.layer}
        options={LAYERS}
      />
      <TextField
        name="level"
        label="Level (1 to 5)"
        type="number"
        defaultValue={value.level}
        required
      />
      <TextField
        name="years"
        label="Years"
        type="number"
        defaultValue={value.years}
        required
      />
      <Checkbox
        name="featured"
        label="Featured"
        defaultChecked={value.featured}
      />
    </div>
  );
}
