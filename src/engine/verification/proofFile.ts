import { PROOF_UPLOAD } from "@/config/constants";
import { ValidationError } from "@/engine/errors";

/** The two things we know about an upload before touching its bytes. */
export interface ProofFileMeta {
  readonly type: string;
  readonly size: number;
}

export type ProofMimeType = (typeof PROOF_UPLOAD.ALLOWED_MIME_TYPES)[number];

const EXTENSION: Readonly<Record<ProofMimeType, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const PROOF_FILE_MESSAGE = `Max ${PROOF_UPLOAD.MAX_BYTES / (1024 * 1024)} MB, PNG/JPG/WebP only`;

function isAllowedType(type: string): type is ProofMimeType {
  return (PROOF_UPLOAD.ALLOWED_MIME_TYPES as readonly string[]).includes(type);
}

/** PRD §09 screenshot proof: an image, at most 5 MB. Anything else is refused before any upload. */
export function validateProofFile(file: ProofFileMeta): ProofMimeType {
  if (!isAllowedType(file.type)) throw new ValidationError(PROOF_FILE_MESSAGE, "proof");
  if (file.size <= 0 || file.size > PROOF_UPLOAD.MAX_BYTES) {
    throw new ValidationError(PROOF_FILE_MESSAGE, "proof");
  }
  return file.type;
}

export function proofExtension(type: ProofMimeType): string {
  return EXTENSION[type];
}

/**
 * `{userId}/{verificationId}.{ext}` — the bucket policy allows a member to write only inside
 * their own folder, and the object name comes from ids, never from the uploaded file's name.
 */
export function proofPath(userId: string, verificationId: string, type: ProofMimeType): string {
  return `${userId}/${verificationId}.${proofExtension(type)}`;
}
