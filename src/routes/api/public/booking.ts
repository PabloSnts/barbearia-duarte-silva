import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// External booking webhook (e.g. WhatsApp bot). Auth: header `x-booking-token`
// must match the shop's private token shown in Configurações.
const schema = z.object({
  clientName: z.string().min(1).max(120),
  clientPhone: z.string().min(8).max(40),
  startAt: z.string().min(1),
  serviceIds: z.array(z.string().uuid()).min(1).max(10),
});

export const Route = createFileRoute("/api/public/booking")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-booking-token") ?? "";
        if (!z.string().uuid().safeParse(token).success) return Response.json({ error: "unauthorized" }, { status: 401 });
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "invalid payload" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: s } = await supabaseAdmin.from("settings").select("owner_id").eq("webhook_token", token).maybeSingle();
        if (!s) return Response.json({ error: "unauthorized" }, { status: 401 });

        const { createBooking } = await import("@/lib/booking-core");
        const r = await createBooking(supabaseAdmin, s.owner_id, { ...parsed.data, source: "webhook" });
        return Response.json(r, { status: r.ok ? 201 : 422 });
      },
    },
  },
});
