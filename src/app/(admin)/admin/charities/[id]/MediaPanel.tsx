"use client";

import Image from "next/image";
import { useActionState } from "react";
import { CHARITY_MEDIA } from "@/config/constants";
import { removeMedia, uploadMedia } from "@/app/(admin)/admin/charities/actions";
import { charityImageUrl } from "@/lib/charityImages";
import type { CharityMedia } from "@/repositories/interfaces/CharityRepository";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/FormField";

interface MediaPanelProps {
  readonly charityId: string;
  readonly coverPath: string | null;
  readonly media: readonly CharityMedia[];
}

const ACCEPT = CHARITY_MEDIA.ALLOWED_MIME_TYPES.join(",");

/** Cover (one) and gallery (many). Uploads go to the public bucket; seed photos can be replaced, not deleted from disk. */
export function MediaPanel({ charityId, coverPath, media }: MediaPanelProps) {
  const cover = charityImageUrl(coverPath);
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section className="flex flex-col gap-3" aria-label="Cover photo">
        <h3 className="text-lg">Cover</h3>
        <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-2">
          {cover ? (
            <Image src={cover} alt="" fill sizes="30rem" className="object-cover" />
          ) : (
            <p className="p-4 text-sm text-ink-2">No cover yet.</p>
          )}
        </div>
        <UploadForm
          charityId={charityId}
          role="cover"
          label={cover ? "Replace cover" : "Upload cover"}
        />
      </section>

      <section className="flex flex-col gap-3" aria-label="Gallery">
        <h3 className="text-lg">Gallery</h3>
        <ul className="grid grid-cols-2 gap-3">
          {media.map((item) => (
            <GalleryItem key={item.id} charityId={charityId} item={item} />
          ))}
        </ul>
        <UploadForm charityId={charityId} role="gallery" label="Add photo" withAlt />
      </section>
    </div>
  );
}

function UploadForm({
  charityId,
  role,
  label,
  withAlt = false,
}: {
  charityId: string;
  role: "cover" | "gallery";
  label: string;
  withAlt?: boolean;
}) {
  const [state, action, pending] = useActionState(uploadMedia, null);
  const error = state && !state.ok ? state.error.message : null;
  return (
    <form action={action} className="flex flex-col gap-2" noValidate>
      <input type="hidden" name="id" value={charityId} />
      <input type="hidden" name="role" value={role} />
      <input
        type="file"
        name="file"
        accept={ACCEPT}
        required
        className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-line"
      />
      {withAlt && (
        <InputField
          id={`alt-${role}`}
          name="alt"
          label="Describe the photo (for screen readers)"
          placeholder="A teacher and six girls at a blackboard"
        />
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" pending={pending}>
          {label}
        </Button>
        <span className="text-xs text-ink-2">PNG, JPG or WebP · up to 2 MB</span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

function GalleryItem({ charityId, item }: { charityId: string; item: CharityMedia }) {
  const [state, action, pending] = useActionState(removeMedia, null);
  const src = charityImageUrl(item.storagePath);
  return (
    <li className="flex flex-col gap-1">
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-2">
        {src && <Image src={src} alt={item.alt} fill sizes="15rem" className="object-cover" />}
      </div>
      <form action={action} className="flex items-center justify-between gap-2">
        <input type="hidden" name="id" value={charityId} />
        <input type="hidden" name="mediaId" value={item.id} />
        <span className="truncate text-xs text-ink-2" title={item.alt}>
          {item.alt || "No description"}
        </span>
        <Button type="submit" size="sm" variant="ghost" pending={pending}>
          Remove
        </Button>
      </form>
      {state && !state.ok && (
        <p role="alert" className="text-xs text-danger">
          {state.error.message}
        </p>
      )}
    </li>
  );
}
