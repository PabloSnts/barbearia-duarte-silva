import { describe, expect, it } from "vitest";
import {
  durationError,
  formatTvName,
  shiftPreview,
  validateBooking,
  type RuleService,
  type RuleSettings,
} from "./booking-rules";

const settings: RuleSettings = {
  timezone: "America/Sao_Paulo",
  work_days: [1, 2, 3, 4, 5, 6],
  open_time: "08:00",
  close_time: "19:00",
  vacation_start: null,
  vacation_end: null,
};
const svc = (name: string, extra: Partial<RuleService> = {}): RuleService => ({
  id: name, name, duration_min: 30, price: 0, availability: {}, ...extra,
});
// Monday 2026-11-02 10:00 in São Paulo (UTC-3)
const mon10 = new Date("2026-11-02T13:00:00Z");

describe("booking rules", () => {
  it("sums durations: 10h00 with 3x30min ends at 11h30", () => {
    const r = validateBooking({ start: mon10, phone: "", services: [svc("Corte"), svc("Barba"), svc("Pigmentação")], settings, blacklistPhones: [], existing: [] });
    expect(r.duration).toBe(90);
    expect(r.end.toISOString()).toBe("2026-11-02T14:30:00.000Z");
    expect(r.errors).toEqual([]);
  });

  it("blocks overlap in any minute of the full block", () => {
    const r = validateBooking({ start: mon10, phone: "", services: [svc("Corte"), svc("Barba"), svc("P")], settings, blacklistPhones: [],
      existing: [{ id: "x", start_at: "2026-11-02T14:00:00Z", end_at: "2026-11-02T14:30:00Z", status: "scheduled" }] });
    expect(r.errors).toContain("Conflito de horário com outro agendamento.");
  });

  it("blocks blacklisted phones regardless of formatting", () => {
    const r = validateBooking({ start: mon10, phone: "(11) 99999-0000", services: [svc("Corte")], settings, blacklistPhones: ["11999990000"], existing: [] });
    expect(r.errors[0]).toMatch(/blacklist/);
  });

  it("blocks bookings during vacation and on days off", () => {
    expect(validateBooking({ start: mon10, phone: "", services: [svc("C")], settings: { ...settings, vacation_start: "2026-11-01", vacation_end: "2026-11-10" }, blacklistPhones: [], existing: [] }).errors)
      .toContain("A barbearia está em férias nesta data.");
    expect(validateBooking({ start: mon10, phone: "", services: [svc("C")], settings: { ...settings, work_days: [2] }, blacklistPhones: [], existing: [] }).errors.join()).toMatch(/folga/);
  });

  it("enforces service weekday and hour windows", () => {
    const pig = svc("Pigmentação", { availability: { "4": [] } }); // thursdays only
    expect(validateBooking({ start: mon10, phone: "", services: [pig], settings, blacklistPhones: [], existing: [] }).errors.join()).toMatch(/não está disponível/);
    const infantil = svc("Infantil", { availability: { "1": [{ start: "08:00", end: "11:00" }] } });
    expect(validateBooking({ start: mon10, phone: "", services: [infantil], settings, blacklistPhones: [], existing: [] }).errors).toEqual([]);
    const late = new Date("2026-11-02T14:00:00Z"); // 11:00 local
    expect(validateBooking({ start: late, phone: "", services: [infantil], settings, blacklistPhones: [], existing: [] }).errors.length).toBe(1);
  });

  it("accepts only multiples of 30 minutes", () => {
    for (const ok of ["30", "60", "90", "150"]) expect(durationError(ok)).toBeNull();
    for (const bad of ["10", "20", "45", "50", "", "0"]) expect(durationError(bad)).not.toBeNull();
  });

  it("shifts the chosen appointment and all later ones", () => {
    const list = [
      { id: "a", start_at: "2026-11-02T12:00:00.000Z", end_at: "2026-11-02T12:30:00.000Z", status: "done" },
      { id: "b", start_at: "2026-11-02T13:00:00.000Z", end_at: "2026-11-02T13:30:00.000Z", status: "scheduled" },
      { id: "c", start_at: "2026-11-02T14:00:00.000Z", end_at: "2026-11-02T15:00:00.000Z", status: "scheduled" },
    ];
    const r = shiftPreview(list, "b", 15);
    expect(r[0]!.start_at).toBe("2026-11-02T12:00:00.000Z");
    expect(r[1]!.start_at).toBe("2026-11-02T13:15:00.000Z");
    expect(r[2]!.end_at).toBe("2026-11-02T15:15:00.000Z");
  });

  it("formats TV name as 'Nome - Serviços'", () => {
    expect(formatTvName("Pablo Santos", ["Corte", "Barba"], "name_services")).toBe("Pablo - Corte + Barba");
    expect(formatTvName("Pablo Santos", [], "initials")).toBe("P. S.");
  });
});
