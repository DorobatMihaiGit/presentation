import {
  Checkbox,
  FormSection,
  Select,
  TextField,
  TranslatedField,
} from "./fields";

export type ExperienceDefaults = {
  company: string;
  url: string | null;
  startDate: string;
  endDate: string | null;
  employmentType: string;
  isPublished: boolean;
  en?: { roleTitle: string; descriptionMd: string; highlights: string[] };
  ro?: { roleTitle: string; descriptionMd: string; highlights: string[] };
};

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contract" },
  { value: "freelance", label: "Freelance" },
] as const;

export const EMPTY_EXPERIENCE: ExperienceDefaults = {
  company: "",
  url: null,
  startDate: "",
  endDate: null,
  employmentType: "full_time",
  isPublished: false,
};

/** Fields shared by the create and edit experience forms. */
export function ExperienceFields({ value }: { value: ExperienceDefaults }) {
  return (
    <>
      <FormSection title="Role">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            name="company"
            label="Company"
            defaultValue={value.company}
            required
          />
          <TextField
            name="url"
            label="Company URL"
            type="url"
            defaultValue={value.url}
          />
          <TextField
            name="startDate"
            label="Start (YYYY-MM)"
            type="month"
            defaultValue={value.startDate}
            required
          />
          <TextField
            name="endDate"
            label="End (YYYY-MM)"
            type="month"
            defaultValue={value.endDate}
            hint="Leave empty for your current role."
          />
          <Select
            name="employmentType"
            label="Employment type"
            defaultValue={value.employmentType}
            options={EMPLOYMENT_TYPES}
          />
        </div>
        <Checkbox
          name="isPublished"
          label="Published"
          defaultChecked={value.isPublished}
        />
      </FormSection>
      <FormSection title="Text">
        <TranslatedField
          name="roleTitle"
          label="Role title"
          en={value.en?.roleTitle ?? ""}
          ro={value.ro?.roleTitle ?? ""}
        />
        <TranslatedField
          name="description"
          label="Description"
          en={value.en?.descriptionMd ?? ""}
          ro={value.ro?.descriptionMd ?? ""}
          multiline
          rows={4}
        />
        <TranslatedField
          name="highlights"
          label="Highlights"
          en={(value.en?.highlights ?? []).join("\n")}
          ro={(value.ro?.highlights ?? []).join("\n")}
          multiline
          rows={4}
          hint="One per line."
        />
      </FormSection>
    </>
  );
}
