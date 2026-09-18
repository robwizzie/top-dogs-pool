import { PageHeader } from "@/components/ui/Section";
import { ProfileView } from "@/components/rack/ProfileView";

export const metadata = { title: "Rack Up profile" };

export default function RackProfilePage() {
  return (
    <>
      <PageHeader
        eyebrow="Rack Up"
        title="Your profile"
        subtitle="Skill levels decide your race. Linking your APA number connects this to your roster page."
      />
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <ProfileView />
      </div>
    </>
  );
}
