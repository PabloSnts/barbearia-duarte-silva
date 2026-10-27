import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createBooking } from "./booking-core";

const schema = z.object({
  clientId: z.string().uuid().nullable().optional(),
  clientName: z.string().min(1).max(120),
  clientPhone: z.string().max(40),
  startAt: z.string().min(1),
  serviceIds: z.array(z.string().uuid()).min(1).max(10),
});

export const createAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => createBooking(context.supabase, context.userId, data));

export const getTvQueue = createServerFn({ method: "GET" })
  .inputValidator((d: { owner: string }) => z.object({ owner: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: res, error } = await sb.rpc("get_tv_queue", { p_owner: data.owner });
    if (error) throw new Error(error.message);
    return res as TvPayload | null;
  });

export type TvPayload = {
  shop_name: string;
  tv_name_format: string;
  timezone: string;
  vacation_start: string | null;
  vacation_end: string | null;
  absence_message: string;
  queue: { id: string; client_name: string; service_names: string[]; start_at: string; end_at: string; status: string }[];
};
