import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ShaderBackground } from "@/components/ui/shader-background";
import { signOutAction } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const home = role === "sales" ? "/sales" : "/jobs";

  return (
    <div className="relative min-h-screen">
      <ShaderBackground />
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-900/80 text-white backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href={home} className="flex items-center gap-3">
            <Image
              src="/TreadLighter_Logo.png"
              alt="TreadLighter"
              width={160}
              height={44}
              className="h-8 w-auto"
            />
            <span className="hidden text-sm font-medium text-slate-300 sm:inline">
              Solar Survey
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <nav className="flex items-center gap-1">
              {role === "sales" ? (
                <>
                  <Link href="/sales" className="rounded px-2 py-1 text-slate-300 hover:bg-slate-700 hover:text-white">
                    Sales-Pitch
                  </Link>
                  <Link href="/sales/survey-approvals" className="rounded px-2 py-1 text-slate-300 hover:bg-slate-700 hover:text-white">
                    Survey Approvals
                  </Link>
                  <Link href="/sales/final-quotation" className="rounded px-2 py-1 text-slate-300 hover:bg-slate-700 hover:text-white">
                    Final Quotation
                  </Link>
                  <Link href="/sales/reports" className="rounded px-2 py-1 text-slate-300 hover:bg-slate-700 hover:text-white">
                    Reports
                  </Link>
                </>
              ) : (
                <Link href="/jobs" className="rounded px-2 py-1 text-slate-300 hover:bg-slate-700 hover:text-white">
                  Jobs
                </Link>
              )}
            </nav>
            <span className="hidden text-slate-300 sm:inline">
              {session.user.email}
              <span className="ml-2 rounded bg-slate-700 px-2 py-0.5 text-xs uppercase">
                {role}
              </span>
            </span>
            <form action={signOutAction}>
              <Button variant="secondary" type="submit" className="min-h-9 px-3 py-1">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-5xl px-4 py-6">
        <div className="rounded-2xl bg-slate-50/85 p-4 shadow-2xl ring-1 ring-white/50 backdrop-blur-xl sm:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
