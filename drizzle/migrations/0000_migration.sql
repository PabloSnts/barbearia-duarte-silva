CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE public.settings (
  owner_id uuid PRIMARY KEY DEFAULT auth.uid(),
  shop_name text NOT NULL DEFAULT 'Minha Barbearia',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  work_days int[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
  open_time time NOT NULL DEFAULT '09:00',
  close_time time NOT NULL DEFAULT '19:00',
  vacation_start date,
  vacation_end date,
  absence_message text NOT NULL DEFAULT 'Estamos em recesso de férias até [data]. Retornaremos nossos atendimentos em breve!',
  tv_name_format text NOT NULL DEFAULT 'first_name',
  webhook_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.settings FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own clients" ON public.clients FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  duration_min int NOT NULL DEFAULT 30 CHECK (duration_min > 0 AND duration_min % 30 = 0),
  availability jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own services" ON public.services FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  phone text NOT NULL,
  name text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, phone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blacklist TO authenticated;
GRANT ALL ON public.blacklist TO service_role;
ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own blacklist" ON public.blacklist FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_phone text NOT NULL DEFAULT '',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','done','cancelled')),
  service_ids uuid[] NOT NULL DEFAULT '{}',
  service_names text[] NOT NULL DEFAULT '{}',
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  CONSTRAINT no_overlap EXCLUDE USING gist (owner_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&) WHERE (status <> 'cancelled') DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX ON public.appointments (owner_id, start_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own appointments" ON public.appointments FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.schedule_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  day date NOT NULL,
  delta_min int NOT NULL,
  from_appointment_id uuid,
  previous jsonb NOT NULL,
  reverted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_adjustments TO authenticated;
GRANT ALL ON public.schedule_adjustments TO service_role;
ALTER TABLE public.schedule_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own adjustments" ON public.schedule_adjustments FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Shift all non-cancelled appointments of a day starting at/after a given appointment
CREATE OR REPLACE FUNCTION public.apply_schedule_shift(p_from_id uuid, p_delta int)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_from public.appointments; v_tz text; v_day date; v_prev jsonb; v_id uuid;
BEGIN
  SELECT * INTO v_from FROM appointments WHERE id = p_from_id AND owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado'; END IF;
  SELECT COALESCE((SELECT timezone FROM settings WHERE owner_id = auth.uid()), 'America/Sao_Paulo') INTO v_tz;
  v_day := (v_from.start_at AT TIME ZONE v_tz)::date;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'start_at', start_at, 'end_at', end_at)), '[]'::jsonb) INTO v_prev
    FROM appointments WHERE owner_id = auth.uid() AND status IN ('scheduled','in_progress')
    AND start_at >= v_from.start_at AND (start_at AT TIME ZONE v_tz)::date = v_day;
  UPDATE appointments SET start_at = start_at + make_interval(mins => p_delta), end_at = end_at + make_interval(mins => p_delta)
    WHERE id IN (SELECT (e->>'id')::uuid FROM jsonb_array_elements(v_prev) e);
  INSERT INTO schedule_adjustments (owner_id, day, delta_min, from_appointment_id, previous)
    VALUES (auth.uid(), v_day, p_delta, p_from_id, v_prev) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.revert_schedule_adjustment(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_adj public.schedule_adjustments;
BEGIN
  SELECT * INTO v_adj FROM schedule_adjustments WHERE id = p_id AND owner_id = auth.uid() AND NOT reverted;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ajuste não encontrado'; END IF;
  UPDATE appointments a SET start_at = (e->>'start_at')::timestamptz, end_at = (e->>'end_at')::timestamptz
    FROM jsonb_array_elements(v_adj.previous) e WHERE a.id = (e->>'id')::uuid AND a.owner_id = auth.uid();
  UPDATE schedule_adjustments SET reverted = true WHERE id = p_id;
END $$;

-- Public TV queue (safe fields only)
CREATE OR REPLACE FUNCTION public.get_tv_queue(p_owner uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'shop_name', s.shop_name, 'tv_name_format', s.tv_name_format, 'timezone', s.timezone,
    'vacation_start', s.vacation_start, 'vacation_end', s.vacation_end, 'absence_message', s.absence_message,
    'queue', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'client_name', a.client_name, 'service_names', a.service_names,
        'start_at', a.start_at, 'end_at', a.end_at, 'status', a.status) ORDER BY a.start_at)
      FROM appointments a WHERE a.owner_id = p_owner AND a.status IN ('scheduled','in_progress')
        AND a.end_at >= now() - interval '2 hours' AND a.start_at < (date_trunc('day', now() AT TIME ZONE s.timezone) + interval '1 day') AT TIME ZONE s.timezone), '[]'::jsonb)
  ) FROM settings s WHERE s.owner_id = p_owner;
$$;
REVOKE ALL ON FUNCTION public.get_tv_queue(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tv_queue(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_schedule_shift(uuid,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_schedule_adjustment(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;