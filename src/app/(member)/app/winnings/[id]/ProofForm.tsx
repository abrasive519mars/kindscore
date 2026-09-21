"use client";

import { useActionState, useState } from "react";
import { PROOF_UPLOAD } from "@/config/constants";
import { PROOF_FILE_MESSAGE } from "@/engine/verification/proofFile";
import { submitProof } from "@/app/(member)/app/winnings/actions";
import { Button } from "@/components/ui/Button";

interface ProofFormProps {
  readonly verificationId: string;
  /** After a rejection: the last allowed attempt. */
  readonly again: boolean;
}

const ACCEPT = PROOF_UPLOAD.ALLOWED_MIME_TYPES.join(",");

/**
 * Pick a screenshot, see it, send it. The same type/size rule runs here first (instant feedback)
 * and again on the server (the rule that counts).
 */
export function ProofForm({ verificationId, again }: ProofFormProps) {
  const [state, action, pending] = useActionState(submitProof, null);
  const [preview, setPreview] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const serverError = state && !state.ok ? state.error.message : null;

  function onPick(file: File | null) {
    setPreview(null);
    setClientError(null);
    if (!file) return;
    const allowed = (PROOF_UPLOAD.ALLOWED_MIME_TYPES as readonly string[]).includes(file.type);
    if (!allowed || file.size > PROOF_UPLOAD.MAX_BYTES) {
      setClientError(PROOF_FILE_MESSAGE);
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="verificationId" value={verificationId} />
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Screenshot</span>
        <input
          type="file"
          name="proof"
          accept={ACCEPT}
          required
          onChange={(event) => onPick(event.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-line"
        />
      </label>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
        <img src={preview} alt="Preview of your screenshot" className="max-h-72 w-auto rounded-md border border-line" />
      )}
      {(clientError || serverError) && (
        <p role="alert" className="text-sm text-danger">
          {clientError ?? serverError}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="saffron" pending={pending} disabled={Boolean(clientError) || !preview}>
          {again ? "Upload again" : "Upload proof"}
        </Button>
        {again && <span className="text-sm text-ink-2">This is your last attempt for this claim.</span>}
      </div>
    </form>
  );
}
