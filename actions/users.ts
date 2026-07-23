"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { logEvent } from "@/lib/logger";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "sales") {
    throw new Error("Unauthorized: Only sales team can manage users");
  }
  return session.user;
}

export type UserActionResult = { ok: true } | { ok: false; error: string };

export type UserWithoutPassword = {
  id: string;
  email: string;
  name: string | null;
  role: "surveyor" | "sales";
  createdAt: Date;
};

/**
 * Get all users (sales team only)
 */
export async function getAllUsers(): Promise<UserWithoutPassword[]> {
  await requireAdmin();
  const allUsers = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    createdAt: users.createdAt,
  }).from(users);
  return allUsers as UserWithoutPassword[];
}

/**
 * Create a new user (sales team only)
 */
export async function createUser(
  email: string,
  password: string,
  name: string | null,
  role: "surveyor" | "sales",
): Promise<UserActionResult> {
  const user = await requireAdmin();

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPassword = (password ?? "").trim();
  const trimmedName = (name ?? "").trim() || null;

  if (!trimmedEmail) {
    return { ok: false, error: "Email is required" };
  }
  if (!trimmedPassword) {
    return { ok: false, error: "Password is required" };
  }
  if (!["surveyor", "sales"].includes(role)) {
    return { ok: false, error: "Invalid role" };
  }

  try {
    // Check if user already exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, trimmedEmail));

    if (existing.length > 0) {
      return { ok: false, error: "User already exists with this email" };
    }

    // Hash password
    const passwordHash = await hash(trimmedPassword);

    // Create user
    await db.insert(users).values({
      email: trimmedEmail,
      passwordHash,
      name: trimmedName,
      role,
    });

    await logEvent("info", "user.created", {
      actorId: user.id,
      createdEmail: trimmedEmail,
      createdRole: role,
    });

    revalidatePath("/sales/admin");
    return { ok: true };
  } catch (e) {
    await logEvent("error", "user.create_failed", {
      actorId: user.id,
      email: trimmedEmail,
      error: e,
    });
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create user",
    };
  }
}

/**
 * Update user details (name and role) - sales team only
 */
export async function updateUser(
  userId: string,
  name: string | null,
  role: "surveyor" | "sales",
): Promise<UserActionResult> {
  const user = await requireAdmin();

  if (!userId) {
    return { ok: false, error: "User ID is required" };
  }
  if (!["surveyor", "sales"].includes(role)) {
    return { ok: false, error: "Invalid role" };
  }

  const trimmedName = (name ?? "").trim() || null;

  try {
    await db
      .update(users)
      .set({ name: trimmedName, role })
      .where(eq(users.id, userId));

    await logEvent("info", "user.updated", {
      actorId: user.id,
      updatedUserId: userId,
      newRole: role,
    });

    revalidatePath("/sales/admin");
    return { ok: true };
  } catch (e) {
    await logEvent("error", "user.update_failed", {
      actorId: user.id,
      userId,
      error: e,
    });
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update user",
    };
  }
}

/**
 * Reset user password - sales team only
 */
export async function resetUserPassword(
  userId: string,
  newPassword: string,
): Promise<UserActionResult> {
  const user = await requireAdmin();

  if (!userId) {
    return { ok: false, error: "User ID is required" };
  }

  const trimmedPassword = (newPassword ?? "").trim();
  if (!trimmedPassword) {
    return { ok: false, error: "Password is required" };
  }

  try {
    const passwordHash = await hash(trimmedPassword);

    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId));

    await logEvent("info", "user.password_reset", {
      actorId: user.id,
      resetUserId: userId,
    });

    revalidatePath("/sales/admin");
    return { ok: true };
  } catch (e) {
    await logEvent("error", "user.password_reset_failed", {
      actorId: user.id,
      userId,
      error: e,
    });
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to reset password",
    };
  }
}

/**
 * Delete a user - sales team only
 */
export async function deleteUser(userId: string): Promise<UserActionResult> {
  const user = await requireAdmin();

  if (!userId) {
    return { ok: false, error: "User ID is required" };
  }

  try {
    // Prevent self-deletion
    if (userId === user.id) {
      return { ok: false, error: "Cannot delete your own account" };
    }

    await db.delete(users).where(eq(users.id, userId));

    await logEvent("info", "user.deleted", {
      actorId: user.id,
      deletedUserId: userId,
    });

    revalidatePath("/sales/admin");
    return { ok: true };
  } catch (e) {
    await logEvent("error", "user.delete_failed", {
      actorId: user.id,
      userId,
      error: e,
    });
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to delete user",
    };
  }
}
