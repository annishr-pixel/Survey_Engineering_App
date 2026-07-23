import { auth } from "@/lib/auth";
import { getAllUsers, type UserWithoutPassword } from "@/actions/users";
import { Card, CardBody } from "@/components/ui/card";
import { UserManagement } from "@/components/admin/UserManagement";

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
      <div>
        <h1 className="text-2xl font-semibold">Admin Panel</h1>
        <p className="mt-2 text-sm text-slate-500">
          Manage users, roles, and permissions. Create accounts for surveyors and sales team members.
        </p>
      </div>

      <UserManagement initialUsers={users} />
    </div>
  );
}
