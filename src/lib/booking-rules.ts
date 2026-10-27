// Pure booking rules shared by the UI, server functions and the public webhook.

export type TimeRange = { start: string; end: string }; // "HH:MM"
export type Availability = Record<string, TimeRange[]>; // weekday "0"-"6" -> ranges

export type RuleService = {
  id: string;
  name: string;
  duration_min: number;
  price: number;
  availability: Availability;
  active?: boolean;
};

export type RuleSettings = {
  timezone: string;
  work_days: number[];
  open_time: string; // "HH:MM" or "HH:MM:SS"
  close_time: string;
  vacation_start: string | null; // YYYY-MM-DD
  vacation_end: string | null;
};

export type RuleAppointment = { id: string; start_at: string; end_at: string; status: string };

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function normalizePhone(p: string): string {
  return (p || "").replace(/\D/g, "");
}

export function isValidStep(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes > 0 && minutes % 30 === 0;
}

/** Returns an error message for a raw duration input, or null when valid. */
export function durationError(raw: string): string | null {
  if (raw.trim() === "") return "Informe a duração.";
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return "Digite um número inteiro de minutos.";
  if (!isValidStep(n)) return "A duração deve ser múltiplo de 30 minutos (30, 60, 90...).";
  return null;
}

export function totalDuration(services: Pick<RuleService, "duration_min">[]): number {
  return services.reduce((s, x) => s + x.duration_min, 0);
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m || 0);
}

export function localParts(date: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const p: Record<string, string> = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p["weekday"] ?? "");
  return {
    weekday: wd,
    minutes: Number(p["hour"]) * 60 + Number(p["minute"]),
    date: `${p["year"]}-${p["month"]}-${p["day"]}`,
  };
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function isOnVacation(date: string, s: Pick<RuleSettings, "vacation_start" | "vacation_end">) {
  return !!s.vacation_start && !!s.vacation_end && date >= s.vacation_start && date <= s.vacation_end;
}

/** Checks whether a service may be performed in [startMin, endMin) on the weekday. */
export function serviceAllowed(svc: RuleService, weekday: number, startMin: number, endMin: number) {
  const av = svc.availability || {};
  if (Object.keys(av).length === 0) return true;
  const ranges = av[String(weekday)];
  if (!ranges) return false;
  if (ranges.length === 0) return true;
  return ranges.some((r) => startMin >= toMinutes(r.start) && endMin <= toMinutes(r.end));
}

export type BookingInput = {
  start: Date;
  phone: string;
  services: RuleService[];
  settings: RuleSettings;
  blacklistPhones: string[];
  existing: RuleAppointment[];
  ignoreId?: string;
};

export function validateBooking(input: BookingInput): { errors: string[]; end: Date; duration: number } {
  const { start, services, settings } = input;
  const errors: string[] = [];
  const duration = totalDuration(services);
  const end = new Date(start.getTime() + duration * 60000);

  const phone = normalizePhone(input.phone);
  if (phone && input.blacklistPhones.map(normalizePhone).includes(phone)) {
    errors.push("Este cliente está na blacklist e não pode realizar reservas.");
  }
  if (services.length === 0) errors.push("Selecione pelo menos um serviço.");

  const sp = localParts(start, settings.timezone);
  const ep = localParts(end, settings.timezone);
  if (isOnVacation(sp.date, settings)) errors.push("A barbearia está em férias nesta data.");
  if (!settings.work_days.includes(sp.weekday)) errors.push(`${WEEKDAYS[sp.weekday]} é dia de folga.`);
  const endMin = ep.date === sp.date ? ep.minutes : 24 * 60 + ep.minutes;
  if (sp.minutes < toMinutes(settings.open_time) || endMin > toMinutes(settings.close_time)) {
    errors.push("O horário está fora do expediente.");
  }

  let cursor = sp.minutes;
  for (const svc of services) {
    const segEnd = cursor + svc.duration_min;
    if (svc.active === false) errors.push(`O serviço "${svc.name}" está inativo.`);
    else if (!serviceAllowed(svc, sp.weekday, cursor, segEnd)) {
      errors.push(`"${svc.name}" não está disponível neste dia/horário.`);
    }
    cursor = segEnd;
  }

  const s = start.getTime();
  const e = end.getTime();
  const clash = input.existing.find(
    (a) =>
      a.id !== input.ignoreId &&
      a.status !== "cancelled" &&
      overlaps(s, e, new Date(a.start_at).getTime(), new Date(a.end_at).getTime()),
  );
  if (clash) errors.push("Conflito de horário com outro agendamento.");

  return { errors, end, duration };
}

/** Preview of a delay/advance: shifts the given appointment and every later one of the list. */
export function shiftPreview<T extends RuleAppointment>(list: T[], fromId: string, deltaMin: number): T[] {
  const sorted = [...list].sort((a, b) => a.start_at.localeCompare(b.start_at));
  const from = sorted.find((a) => a.id === fromId);
  if (!from) return sorted;
  const fromStart = new Date(from.start_at).getTime();
  return sorted.map((a) => {
    const st = new Date(a.start_at).getTime();
    if (a.status === "done" || a.status === "cancelled" || st < fromStart) return a;
    return {
      ...a,
      start_at: new Date(st + deltaMin * 60000).toISOString(),
      end_at: new Date(new Date(a.end_at).getTime() + deltaMin * 60000).toISOString(),
    };
  });
}

export type TvNameFormat = "first_name" | "full_name" | "initials" | "name_services";

export function formatTvName(name: string, services: string[], format: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  switch (format) {
    case "full_name":
      return parts.length > 1 ? `${first} ${parts[parts.length - 1]}` : first;
    case "initials":
      return parts.map((p) => (p[0] ?? "").toUpperCase() + ".").join(" ");
    case "name_services":
      return services.length ? `${first} - ${services.join(" + ")}` : first;
    default:
      return first;
  }
}
