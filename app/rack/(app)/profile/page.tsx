import { RackHero } from "@/components/rack/ui";
import { ProfileView } from "@/components/rack/ProfileView";

export const metadata = { title: "Rack Up profile" };

export default function RackProfilePage() {
  return (
    <>
      <RackHero title="Your profile" subtitle="Skill levels decide your race. Link your roster spot to pull your photo and level across." />
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <ProfileView />
      </div>
    </>
  );
}
