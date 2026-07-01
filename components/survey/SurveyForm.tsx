"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SECTIONS, type FieldDef } from "@/lib/survey-sections";
import { submitSchema } from "@/lib/validation/survey";
import { saveDraft, submitSurvey, reopenSurvey } from "@/actions/survey";
import type { Lead, Survey } from "@/lib/db/schema";
import type { PhotoRecord } from "@/actions/photo";
import { PhotoUploader } from "@/components/survey/PhotoUploader";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea, Select, FieldRow, Label } from "@/components/ui/field";

type FormValues = Record<string, any>;

/* Build react-hook-form defaults from a persisted survey row. */
function buildDefaults(survey: Survey): FormValues {
  const v: FormValues = {};
  const s = survey as Record<string, unknown>;
  for (const section of SECTIONS) {
    for (const f of section.fields) {
      if (f.name.startsWith("extras.")) continue;
      const raw = s[f.name];
      if (f.type === "bool") {
        v[f.name] = raw === true ? "true" : raw === false ? "false" : "";
      } else if (f.type === "multi") {
        v[f.name] = Array.isArray(raw) ? raw : [];
      } else if (f.type === "int" || f.type === "number") {
        v[f.name] = raw == null ? "" : String(raw);
      } else {
        v[f.name] = raw == null ? "" : String(raw);
      }
    }
  }
  const extras = (survey.extras ?? {}) as Record<string, string>;
  v.extras = {};
  for (const section of SECTIONS) {
    for (const f of section.fields) {
      if (!f.name.startsWith("extras.")) continue;
      const key = f.name.slice("extras.".length);
      v.extras[key] = extras[key] ?? "";
    }
  }
  return v;
}

function getError(errors: Record<string, any>, name: string): string | undefined {
  const parts = name.split(".");
  let cur: any = errors;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur?.message;
}

function FieldControl({
  field,
  register,
  error,
}: {
  field: FieldDef;
  register: UseFormRegister<FormValues>;
  error?: string;
}) {
  const id = field.name;

  if (field.type === "multi") {
    return (
      <div className="space-y-1">
        <Label>{field.label}</Label>
        <div className="flex flex-wrap gap-3 pt-1">
          {field.options?.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={o.value} {...register(field.name)} className="h-4 w-4" />
              {o.label}
            </label>
          ))}
        </div>
      </div>
    );
  }

  const control =
    field.type === "textarea" ? (
      <Textarea id={id} {...register(field.name)} />
    ) : field.type === "bool" ? (
      <Select id={id} {...register(field.name)}>
        <option value="">—</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </Select>
    ) : field.type === "enum" ? (
      <Select id={id} {...register(field.name)}>
        <option value="">—</option>
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    ) : field.type === "number" ? (
      <Input id={id} type="number" step="any" inputMode="decimal" {...register(field.name)} />
    ) : field.type === "int" ? (
      <Input id={id} type="number" step="1" inputMode="numeric" {...register(field.name)} />
    ) : (
      <Input id={id} type="text" {...register(field.name)} />
    );

  return (
    <FieldRow label={field.label} required={field.required} htmlFor={id} hint={field.hint} error={error}>
      {control}
    </FieldRow>
  );
}

export function SurveyForm({
  survey,
  lead,
  photosBySection,
  submittedHref,
}: {
  survey: Survey;
  lead: Lead | undefined;
  photosBySection: Record<string, PhotoRecord[]>;
  /** Where to go after a successful submit. Defaults to the surveyor confirmation page. */
  submittedHref?: string;
}) {
  const router = useRouter();
  const readOnly = survey.status === "submitted";

  const form = useForm<FormValues>({
    defaultValues: buildDefaults(survey),
    resolver: zodResolver(submitSchema) as any,
  });

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(survey.updatedAt ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autosave on any change.
  useEffect(() => {
    if (readOnly) return;
    const sub = form.watch(() => {
      if (timer.current) clearTimeout(timer.current);
      setSaveState("saving");
      timer.current = setTimeout(async () => {
        const res = await saveDraft(survey.jobId, form.getValues());
        if (res.ok) {
          setSaveState("saved");
          setSavedAt(new Date());
        } else {
          setSaveState("error");
        }
      }, 1500);
    });
    return () => sub.unsubscribe();
  }, [form, survey.jobId, readOnly]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setFormError(null);
    const res = await submitSurvey(survey.jobId, values);
    if (res.ok) {
      router.push(submittedHref ?? `/jobs/${encodeURIComponent(survey.jobId)}/submitted`);
      return;
    }
    if (res.fieldErrors) {
      for (const [name, message] of Object.entries(res.fieldErrors)) {
        form.setError(name as never, { message });
      }
    }
    setFormError(res.error);
    setSubmitting(false);
  }

  async function onReopen() {
    setReopening(true);
    setFormError(null);
    const res = await reopenSurvey(survey.jobId);
    if (res.ok) {
      // Server component re-renders with status="draft" → fields become editable.
      router.refresh();
    } else {
      setFormError(res.error);
      setReopening(false);
    }
  }

  const errors = form.formState.errors as Record<string, any>;

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      {/* Sticky section nav */}
      <nav className="hidden lg:block">
        <ul className="sticky top-20 space-y-1 text-sm">
          <li>
            <a href="#section-3.1" className="block rounded px-2 py-1 text-slate-600 hover:bg-slate-100">
              3.1 Customer & Site
            </a>
          </li>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#section-${s.id}`} className="block rounded px-2 py-1 text-slate-600 hover:bg-slate-100">
                {s.id} {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 3.1 Read-only Notion data */}
        <Card id="section-3.1">
          <CardHeader>
            <CardTitle>3.1 Customer & Site (from Notion)</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <ReadOnly label="Customer" value={lead?.customerName} />
            <ReadOnly label="Job ID" value={survey.jobId} />
            <ReadOnly label="Property" value={lead?.propertyUse} />
            <ReadOnly label="Address" value={lead?.address} />
            <ReadOnly label="Phone" value={lead?.phone} />
            <ReadOnly label="Email" value={lead?.email} />
            <ReadOnly label="Annual kWh" value={lead?.annualConsumptionKwh} />
            <ReadOnly label="Service" value={lead?.serviceInterested?.join(", ")} />
            <ReadOnly
              label="Initial est."
              value={lead?.initialEstimatedAmount ? `£${lead.initialEstimatedAmount}` : null}
            />
          </CardBody>
        </Card>

        {SECTIONS.map((section) => (
          <Card key={section.id} id={`section-${section.id}`}>
            <CardHeader>
              <CardTitle>
                {section.id} {section.title}
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <div key={field.name} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                    <fieldset disabled={readOnly} className="contents">
                      <FieldControl
                        field={field}
                        register={form.register}
                        error={getError(errors, field.name)}
                      />
                    </fieldset>
                  </div>
                ))}
              </div>
              <PhotoUploader
                surveyId={survey.id}
                section={section.id}
                initial={photosBySection[section.id] ?? []}
                readOnly={readOnly}
              />
            </CardBody>
          </Card>
        ))}

        {/* Footer / submit bar */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-md backdrop-blur">
          <SaveIndicator readOnly={readOnly} state={saveState} savedAt={savedAt} />
          <div className="flex items-center gap-3">
            {formError && <span className="text-sm text-red-600">{formError}</span>}
            {readOnly ? (
              <Button type="button" variant="secondary" disabled={reopening} onClick={onReopen}>
                {reopening ? "Enabling edit…" : "Edit survey"}
              </Button>
            ) : (
              <Button type="submit" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit survey"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-slate-800">{value || "—"}</dd>
    </div>
  );
}

function SaveIndicator({
  readOnly,
  state,
  savedAt,
}: {
  readOnly: boolean;
  state: "idle" | "saving" | "saved" | "error";
  savedAt: Date | null;
}) {
  if (readOnly) {
    return <span className="text-sm font-medium text-green-700">Submitted — read only</span>;
  }
  if (state === "saving") return <span className="text-sm text-slate-500">Saving…</span>;
  if (state === "error") return <span className="text-sm text-red-600">Save failed — retrying on next change</span>;
  if (savedAt) {
    return (
      <span className="text-sm text-slate-500">
        Saved ·{" "}
        {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  }
  return <span className="text-sm text-slate-400">Draft</span>;
}
