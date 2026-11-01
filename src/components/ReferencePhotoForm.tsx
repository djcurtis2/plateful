"use client";
import { useState, useTransition } from "react";

/** Admin: upload or replace the photo of the real restaurant dish for a cook-off. */
export function ReferencePhotoForm({ action, hasPhoto }: { action: (fd: FormData) => Promise<{ ok: boolean; message?: string }>; hasPhoto: boolean }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-center gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => setMsg((await action(fd)).message ?? ""));
      }}
    >
      <span className="label">{hasPhoto ? "Replace reference photo" : "Add reference photo"}</span>
      <input name="reference" type="file" accept="image/jpeg,image/png,image/webp" required className="max-w-56 text-xs" />
      <button className="btn btn-ghost btn-sm" disabled={pending}>
        {pending ? "Uploading…" : "Save"}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </form>
  );
}
