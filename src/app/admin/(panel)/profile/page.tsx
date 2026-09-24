import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Profile" };

// Placeholder until the profile editor lands in the next task.
export default async function ProfilePage() {
  await requireAdmin();
  return <h1 className="text-title text-ink">Profile</h1>;
}
