// =============================================================================
// GET   /api/account/devices                  → devices (current resolved
//                                               server-side)
// PATCH /api/account/devices  { deviceId, … } → rename | trust | remove
// Ownership is verified server-side for every action.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { listDevices, removeDevice, renameDevice, setDeviceTrusted } from "@/lib/account-server";

export async function GET() {
  try {
    const identity = await requireUser();
    const cookieStore = await cookies();
    const currentDeviceId = cookieStore.get("onenumbr_client_device")?.value ?? null;
    const devices = await listDevices(identity.uid, currentDeviceId);
    return NextResponse.json({ devices });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("rename"),
    deviceId: z.string().trim().min(1),
    deviceName: z.string().trim().min(1).max(60),
  }),
  z.object({
    action: z.literal("trust"),
    deviceId: z.string().trim().min(1),
    trusted: z.boolean(),
  }),
  z.object({
    action: z.literal("remove"),
    deviceId: z.string().trim().min(1),
  }),
]);

export async function PATCH(req: Request) {
  try {
    const identity = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "invalid_data", message: "Unknown action." }, { status: 400 });
    }

    if (parsed.data.action === "rename") {
      await renameDevice({
        uid: identity.uid,
        deviceId: parsed.data.deviceId,
        deviceName: parsed.data.deviceName,
      });
    } else if (parsed.data.action === "trust") {
      await setDeviceTrusted({
        uid: identity.uid,
        deviceId: parsed.data.deviceId,
        trusted: parsed.data.trusted,
      });
    } else {
      await removeDevice({ uid: identity.uid, deviceId: parsed.data.deviceId });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
