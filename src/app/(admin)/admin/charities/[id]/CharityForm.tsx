"use client";

import { useActionState } from "react";
import { saveCharity } from "@/app/(admin)/admin/charities/actions";
import type { Charity } from "@/repositories/interfaces/CharityRepository";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/FormField";

/** Create or edit. The slug comes from the name on the server; the outcome line is the one sentence members see everywhere. */
export function CharityForm({ charity }: { charity?: Charity }) {
  const [state, action, pending] = useActionState(saveCharity, null);
  const error = state && !state.ok ? state.error : null;
  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {charity && <input type="hidden" name="id" value={charity.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          id="name"
          name="name"
          label="Name"
          defaultValue={charity?.name}
          required
          error={fieldError("name")}
        />
        <InputField
          id="category"
          name="category"
          label="Cause"
          placeholder="Education, Water, Health…"
          defaultValue={charity?.category}
          required
          error={fieldError("category")}
        />
        <InputField
          id="city"
          name="city"
          label="City"
          defaultValue={charity?.city}
          error={fieldError("city")}
        />
        <InputField
          id="websiteUrl"
          name="websiteUrl"
          label="Website"
          type="url"
          placeholder="https://"
          defaultValue={charity?.websiteUrl ?? ""}
          error={fieldError("websiteUrl")}
        />
      </div>
      <InputField
        id="tagline"
        name="tagline"
        label="Tagline"
        hint="One line under the name."
        defaultValue={charity?.tagline}
        error={fieldError("tagline")}
      />
      <InputField
        id="outcomeLine"
        name="outcomeLine"
        label="Outcome line"
        hint="“₹50 a month = 5 school days for one girl” — the sentence shown wherever money is."
        defaultValue={charity?.outcomeLine}
        error={fieldError("outcomeLine")}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Story</span>
        <textarea
          name="description"
          rows={8}
          defaultValue={charity?.description}
          className="rounded-md border border-line bg-surface px-3 py-2 text-[16px] focus:border-saffron focus:outline-none"
          placeholder="Two or three paragraphs. Blank line between paragraphs."
        />
        {fieldError("description") && (
          <span role="alert" className="text-sm text-danger">
            {fieldError("description")}
          </span>
        )}
      </label>
      {error && !error.field && (
        <p role="alert" className="text-sm text-danger">
          {error.message}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" pending={pending}>
          {charity ? "Save changes" : "Create charity"}
        </Button>
        {state?.ok && (
          <span role="status" className="text-sm text-success">
            Saved.
          </span>
        )}
      </div>
    </form>
  );
}
