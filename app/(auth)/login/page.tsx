"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import { MeshGradient } from "@paper-design/shaders-react";
import { authenticate, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/field";
import { Card, CardBody } from "@/components/ui/card";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState<LoginState, FormData>(authenticate, {});

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated shader backdrop */}
      <div className="fixed inset-0 z-0">
        <MeshGradient
          style={{ height: "100vh", width: "100vw" }}
          distortion={0.8}
          swirl={0.1}
          offsetX={0}
          offsetY={0}
          scale={1}
          rotation={0}
          speed={1}
          colors={["hsl(216, 90%, 27%)", "hsl(243, 68%, 36%)", "hsl(205, 91%, 64%)", "hsl(211, 61%, 57%)"]}
        />
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
        <CardBody className="space-y-6">
          <div className="flex flex-col items-center gap-2">
            <Image
              src="/TreadLighter_Logo.png"
              alt="TreadLighter"
              width={220}
              height={60}
              priority
              className="h-auto w-48"
            />
            <p className="text-sm text-slate-500">Solar Survey Application</p>
          </div>

          <form action={formAction} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Username</Label>
              <Input
                id="email"
                name="email"
                type="text"
                autoComplete="username"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <FieldError message={state.error} />
            <SubmitButton />
          </form>
        </CardBody>
      </Card>
      </main>
    </div>
  );
}
