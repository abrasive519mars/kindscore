import { describe, expect, it } from "vitest";
import { PROOF_UPLOAD } from "@/config/constants";
import { ValidationError } from "@/engine/errors";
import { proofExtension, proofPath, validateProofFile } from "@/engine/verification/proofFile";

const MAX = PROOF_UPLOAD.MAX_BYTES;

describe("validateProofFile", () => {
  it.each(["image/png", "image/jpeg", "image/webp"])("accepts %s", (type) => {
    expect(validateProofFile({ type, size: 1024 })).toBe(type);
  });

  it.each(["image/gif", "application/pdf", "text/plain", ""])("refuses %s", (type) => {
    expect(() => validateProofFile({ type, size: 1024 })).toThrow(ValidationError);
  });

  it("accepts exactly the cap and refuses one byte more", () => {
    expect(validateProofFile({ type: "image/png", size: MAX })).toBe("image/png");
    expect(() => validateProofFile({ type: "image/png", size: MAX + 1 })).toThrow(/Max 5 MB/);
  });

  it("refuses an empty file", () => {
    expect(() => validateProofFile({ type: "image/png", size: 0 })).toThrow(ValidationError);
  });

  it("names the field so the form can show the message beside it", () => {
    try {
      validateProofFile({ type: "image/gif", size: 10 });
    } catch (error) {
      expect((error as ValidationError).field).toBe("proof");
    }
  });
});

describe("proofPath", () => {
  it("is {userId}/{verificationId}.{ext} — never the uploaded file name", () => {
    expect(proofPath("user-1", "ver-9", "image/jpeg")).toBe("user-1/ver-9.jpg");
    expect(proofExtension("image/webp")).toBe("webp");
    expect(proofExtension("image/png")).toBe("png");
  });
});
