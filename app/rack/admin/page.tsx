import { AdminView } from "@/components/rack/AdminView";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function RackAdminPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <AdminView />
    </div>
  );
}
