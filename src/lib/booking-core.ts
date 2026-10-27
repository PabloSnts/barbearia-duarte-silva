import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { normalizePhone, validateBooking, type Availability, type RuleSettings } from "./booking-rules";

export type CreateBookingInput = {
  clientId?: string | null | undefined;
  clientName: string;
  clientPhone: string;
  startAt: string; // ISO
  serviceIds: string[];
  source?: string | undefined;
};

export const DEFAULT_SETTINGS: RuleSettings = {
  timezone: "America/Sao_Paulo",
  work_days: [1, 2, 3, 4, 5, 6],
  open_time: "09:00",
  close_time: "19:00",
  vacation_start: null,
  vacation_end: null,
};

/** Validates and inserts an appointment. Same rules for manual and webhook bookings. */
export async function createBooking(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  input: CreateBookingInput,
): Promise<{ ok: true; id: string } | { ok: false; errors: string[] }> {
  const start = new Date(input.startAt);
  if (Number.isNaN(start.getTime())) return { ok: false, errors: ["Data/hora inválida."] };
  if (!input.clientName.trim()) return { ok: false, errors: ["Informe o nome do cliente."] };

  const dayFrom = new Date(start.getTime() - 24 * 3600e3).toISOString();
  const dayTo = new Date(start.getTime() + 24 * 3600e3).toISOString();
  const [settingsRes, servicesRes, blRes, apptRes] = await Promise.all([
    supabase.from("settings").select("*").eq("owner_id", ownerId).maybeSingle(),
    supabase.from("services").select("*").eq("owner_id", ownerId).in("id", input.serviceIds.length ? input.serviceIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("blacklist").select("phone").eq("owner_id", ownerId),
    supabase.from("appointments").select("id,start_at,end_at,status").eq("owner_id", ownerId).gte("end_at", dayFrom).lte("start_at", dayTo),
  ]);
  const err = settingsRes.error || servicesRes.error || blRes.error || apptRes.error;
  if (err) return { ok: false, errors: [err.message] };

  const settings: RuleSettings = settingsRes.data
    ? {
        timezone: settingsRes.data.timezone,
        work_days: settingsRes.data.work_days,
        open_time: settingsRes.data.open_time,
        close_time: settingsRes.data.close_time,
        vacation_start: settingsRes.data.vacation_start,
        vacation_end: settingsRes.data.vacation_end,
      }
    : DEFAULT_SETTINGS;

  // keep the order chosen by the user
  const services = input.serviceIds
    .map((id) => servicesRes.data!.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map((s) => ({ ...s, price: Number(s.price), availability: (s.availability ?? {}) as Availability }));
  if (services.length !== input.serviceIds.length) return { ok: false, errors: ["Serviço inválido."] };

  const { errors, end } = validateBooking({
    start,
    phone: input.clientPhone,
    services,
    settings,
    blacklistPhones: blRes.data!.map((b) => b.phone),
    existing: apptRes.data!,
  });
  if (errors.length) return { ok: false, errors };

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      owner_id: ownerId,
      client_id: input.clientId ?? null,
      client_name: input.clientName.trim(),
      client_phone: normalizePhone(input.clientPhone),
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      service_ids: services.map((s) => s.id),
      service_names: services.map((s) => s.name),
      total_price: services.reduce((t, s) => t + s.price, 0),
      source: input.source ?? "manual",
    })
    .select("id")
    .single();
  if (error) {
    if (error.message.includes("no_overlap")) return { ok: false, errors: ["Conflito de horário com outro agendamento."] };
    return { ok: false, errors: [error.message] };
  }
  return { ok: true, id: data.id };
}
