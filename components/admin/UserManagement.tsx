"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, RotateCcw, Edit2, Plus } from "lucide-react";
import {
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
  type UserWithoutPassword,
} from "@/actions/users";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export function UserManagement({ initialUsers }: { initialUsers: UserWithoutPassword[] }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state for creating new user
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    name: "",
    role: "surveyor" as "surveyor" | "sales",
  });

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "surveyor" as "surveyor" | "sales",
  });

  // Password reset state
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  async function handleCreateUser() {
    clearMessages();
    if (!newUser.email.trim() || !newUser.password.trim()) {
      setError("Email and password are required");
      return;
    }

    setBusy(true);
    const res = await createUser(newUser.email, newUser.password, newUser.name || null, newUser.role);
    if (res.ok) {
      setSuccess("User created successfully");
      setNewUser({ email: "", password: "", name: "", role: "surveyor" });
      setShowCreateForm(false);
      router.refresh();
    } else {
      setError(res.error);
    }
    setBusy(false);
  }

  async function handleUpdateUser(userId: string) {
    clearMessages();
    setBusy(true);
    const res = await updateUser(userId, editForm.name || null, editForm.role);
    if (res.ok) {
      setSuccess("User updated successfully");
      setEditingId(null);
      router.refresh();
    } else {
      setError(res.error);
    }
    setBusy(false);
  }

  async function handleResetPassword(userId: string) {
    clearMessages();
    if (!resetPassword.trim()) {
      setError("Password is required");
      return;
    }
    setBusy(true);
    const res = await resetUserPassword(userId, resetPassword);
    if (res.ok) {
      setSuccess("Password reset successfully");
      setResetPasswordId(null);
      setResetPassword("");
      router.refresh();
    } else {
      setError(res.error);
    }
    setBusy(false);
  }

  async function handleDeleteUser(userId: string) {
    if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }
    clearMessages();
    setBusy(true);
    const res = await deleteUser(userId);
    if (res.ok) {
      setSuccess("User deleted successfully");
      router.refresh();
    } else {
      setError(res.error);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 p-4 text-sm text-green-600">{success}</div>}

      {/* Create User Section */}
      <Card>
        <CardBody className="space-y-4">
          {!showCreateForm ? (
            <Button onClick={() => setShowCreateForm(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Create New User
            </Button>
          ) : (
            <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold text-slate-900">Create New User</h3>

              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="user@example.com"
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  disabled={busy}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Enter password"
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  disabled={busy}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Name (optional)</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Full name"
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  disabled={busy}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as "surveyor" | "sales" })}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  disabled={busy}
                >
                  <option value="surveyor">Surveyor</option>
                  <option value="sales">Sales Team</option>
                </select>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateUser} disabled={busy}>
                  {busy ? "Creating..." : "Create User"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowCreateForm(false);
                    clearMessages();
                  }}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Users List */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Users ({users.length})</h2>
        <div className="space-y-3">
          {users.map((u) => (
            <Card key={u.id}>
              <CardBody className="space-y-3">
                {editingId === u.id ? (
                  // Edit mode
                  <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Name</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="Full name"
                        className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        disabled={busy}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700">Role</label>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value as "surveyor" | "sales" })}
                        className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        disabled={busy}
                      >
                        <option value="surveyor">Surveyor</option>
                        <option value="sales">Sales Team</option>
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleUpdateUser(u.id)}
                        disabled={busy}
                        className="px-3 py-1 min-h-9 text-sm"
                      >
                        {busy ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setEditingId(null)}
                        disabled={busy}
                        className="px-3 py-1 min-h-9 text-sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-semibold">{u.name || "—"}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                        <p className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                          {u.role === "surveyor" ? "🔍 Surveyor" : "📊 Sales Team"}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400">
                        Created: {new Date(u.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditingId(u.id);
                          setEditForm({ name: u.name || "", role: u.role });
                        }}
                        disabled={busy}
                        className="gap-1 px-3 py-1 min-h-9 text-sm"
                      >
                        <Edit2 className="h-4 w-4" /> Edit
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={() => {
                          setResetPasswordId(u.id);
                          setResetPassword("");
                        }}
                        disabled={busy || resetPasswordId === u.id}
                        className="gap-1 px-3 py-1 min-h-9 text-sm"
                      >
                        <RotateCcw className="h-4 w-4" /> Reset Password
                      </Button>

                      <Button
                        variant="danger"
                        onClick={() => handleDeleteUser(u.id)}
                        disabled={busy}
                        className="gap-1 px-3 py-1 min-h-9 text-sm"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    </div>

                    {resetPasswordId === u.id && (
                      <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700">
                            New Password
                          </label>
                          <input
                            type="password"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            placeholder="Enter new password"
                            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
                            disabled={busy}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleResetPassword(u.id)}
                            disabled={busy}
                            className="px-3 py-1 min-h-9 text-sm"
                          >
                            {busy ? "Resetting..." : "Confirm Reset"}
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => setResetPasswordId(null)}
                            disabled={busy}
                            className="px-3 py-1 min-h-9 text-sm"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
