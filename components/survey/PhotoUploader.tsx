"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera, Trash2 } from "lucide-react";
import { addPhoto, deletePhoto, type PhotoRecord } from "@/actions/photo";

export function PhotoUploader({
  surveyId,
  section,
  initial,
  readOnly = false,
}: {
  surveyId: string;
  section: string;
  initial: PhotoRecord[];
  readOnly?: boolean;
}) {
  const [items, setItems] = useState<PhotoRecord[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        form.append("surveyId", surveyId);
        form.append("section", section);

        const res = await fetch("/api/photos/upload", { method: "POST", body: form });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Upload failed");
        }
        const blob = (await res.json()) as { url: string; pathname: string };

        const rec = await addPhoto({
          surveyId,
          section,
          blobUrl: blob.url,
          blobPathname: blob.pathname,
          contentType: file.type,
          sizeBytes: file.size,
        });
        setItems((prev) => [...prev, rec]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
    await deletePhoto(id);
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap items-center gap-3">
        {items.map((p) => (
          <div key={p.id} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
            <Image src={p.blobUrl} alt="Survey photo" fill sizes="80px" className="object-cover" />
            {!readOnly && (
              <button
                type="button"
                onClick={() => remove(p.id)}
                aria-label="Delete photo"
                className="absolute right-0.5 top-0.5 rounded bg-black/60 p-1 text-white hover:bg-black/80"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}

        {!readOnly && (
          <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-slate-500 hover:border-brand hover:text-brand">
            <Camera className="h-5 w-5" />
            <span className="text-xs">{busy ? "…" : "Photo"}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              disabled={busy}
              onChange={onFiles}
            />
          </label>
        )}

        {items.length === 0 && readOnly && (
          <span className="text-sm text-slate-400">No photos</span>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
