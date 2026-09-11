// =============================================================================
// POST /api/support/attachments — upload a private attachment to the caller's
// support/{uid}/ Storage scope (Admin SDK write; rules also allow owner
// client writes, but this route is the authoritative validation point).
// Conservative types only, 10 MB cap, no public URLs.
// =============================================================================

import { NextResponse } from "next/server";
import { getApiIdentity, jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { saveSupportAttachment } from "@/lib/support-server";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "application/pdf"]);

export async function POST(req: Request) {
  try {
    const identity = await getApiIdentity();
    if (!identity) return NextResponse.json({ code: "unauthorized", message: "Authentication required." }, { status: 401 });

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ code: "invalid_data", message: "No file provided." }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { code: "invalid_data", message: "Only PNG, JPEG or PDF files are supported." },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ code: "invalid_data", message: "Files can be at most 10 MB." }, { status: 400 });
    }

    const saved = await saveSupportAttachment(identity.uid, file);
    return NextResponse.json(saved, { status: 201 });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
