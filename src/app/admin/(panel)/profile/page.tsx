import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/ActionForm";
import {
  Checkbox,
  FormSection,
  Select,
  TextField,
  TranslatedField,
} from "@/components/admin/fields";
import { saveProfile } from "@/server/actions/profile";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { mediaOptions } from "@/server/queries/admin/media";
import { getProfileForAdmin } from "@/server/queries/admin/profile";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  await requireAdmin();
  const db = getDb();
  const [data, imageOptions, documentOptions] = await Promise.all([
    getProfileForAdmin(db),
    mediaOptions(db, "image"),
    mediaOptions(db, "document"),
  ]);
  if (!data) {
    return <p>No profile yet. Run `pnpm db:seed`.</p>;
  }
  const social = (network: "github" | "linkedin") =>
    data.socials.find((link) => link.network === network)?.url ?? "";
  const images = [{ value: "", label: "None" }, ...imageOptions];
  const documents = [{ value: "", label: "None" }, ...documentOptions];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title text-ink">Profile</h1>
      <ActionForm action={saveProfile} submitLabel="Save profile">
        <FormSection title="Contact">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              name="emailPublic"
              label="Public email"
              type="email"
              defaultValue={data.emailPublic}
              required
            />
            <TextField
              name="location"
              label="Location"
              defaultValue={data.location}
              required
            />
            <TextField
              name="countryCode"
              label="Country code"
              defaultValue={data.countryCode}
              required
            />
            <TextField
              name="yearsExp"
              label="Years of experience"
              type="number"
              defaultValue={data.yearsExp}
              required
            />
            <TextField
              name="github"
              label="GitHub URL"
              type="url"
              defaultValue={social("github")}
            />
            <TextField
              name="linkedin"
              label="LinkedIn URL"
              type="url"
              defaultValue={social("linkedin")}
            />
            <Select
              name="avatarMediaId"
              label="Avatar"
              defaultValue={data.avatarMediaId ?? ""}
              options={images}
            />
          </div>
          <Checkbox
            name="available"
            label="Open to new projects"
            defaultChecked={data.available}
          />
        </FormSection>
        <FormSection title="Text">
          <TranslatedField
            name="fullName"
            label="Full name"
            en={data.en?.fullName ?? ""}
            ro={data.ro?.fullName ?? ""}
          />
          <TranslatedField
            name="headline"
            label="Headline"
            en={data.en?.headline ?? ""}
            ro={data.ro?.headline ?? ""}
            multiline
            rows={2}
          />
          <TranslatedField
            name="summary"
            label="Summary"
            en={data.en?.summaryMd ?? ""}
            ro={data.ro?.summaryMd ?? ""}
            multiline
            rows={5}
          />
          <TranslatedField
            name="seoTitle"
            label="SEO title"
            en={data.en?.seoTitle ?? ""}
            ro={data.ro?.seoTitle ?? ""}
          />
          <TranslatedField
            name="seoDescription"
            label="SEO description"
            en={data.en?.seoDescription ?? ""}
            ro={data.ro?.seoDescription ?? ""}
            multiline
            rows={2}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              name="en.cvPdfMediaId"
              label="CV PDF (EN)"
              defaultValue={data.en?.cvPdfMediaId ?? ""}
              options={documents}
            />
            <Select
              name="ro.cvPdfMediaId"
              label="CV PDF (RO)"
              defaultValue={data.ro?.cvPdfMediaId ?? ""}
              options={documents}
            />
          </div>
        </FormSection>
      </ActionForm>
    </div>
  );
}
