import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Routes the authenticated user to their role's home.
export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(session.user.role === "sales" ? "/sales" : "/jobs");
}
