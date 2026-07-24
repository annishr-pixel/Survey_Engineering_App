import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { getAllUsers, type UserWithoutPassword } from "@/actions/users";
import { Card, CardBody } from "@/components/ui/card";
import { UserManagement } from "@/components/admin/UserManagement";
import { HeroBanner } from "@/components/HeroBanner";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "sales") {
    return (
      <Card>
        <CardBody className="text-center text-red-600">
          Unauthorized: Only sales team members can access the admin panel.
        </CardBody>
      </Card>
    );
  }

  let users: UserWithoutPassword[] = [];
  let error: string | null = null;

  try {
    users = await getAllUsers();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load users";
  }

  if (error) {
    return (
      <Card>
        <CardBody className="text-center text-red-600">{error}</CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Link href="/sales" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
          <ChevronLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
      </div>

      <HeroBanner
        title="Admin Control Panel"
        subtitle="Manage users, assign roles, and control team permissions"
        imageUrl="https://images.unsplash.com/photo-1552664730-d307ca884978?w=300&h=300&fit=crop"
        imageAlt="Admin Dashboard"
      />

      <UserManagement initialUsers={users} />
    </div>
  );
}
