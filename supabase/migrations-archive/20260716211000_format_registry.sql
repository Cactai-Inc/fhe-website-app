-- FORMAT REGISTRY — the single source of truth for field types across the whole
-- contract system. Each field carries a format_type; the registry defines how that
-- format renders its input, validates, its guidance/placeholder, and how its
-- structured value composes into legal prose. The SAME registry powers:
--   1. the cascade renderer's input controls (front-end reads it),
--   2. the auto-composer (remerge builds prose from structure via the format), and
--   3. the "add a field" modal's format picker.
--
-- Storage model: contract_fields.structured (jsonb) holds the canonical structured
-- value; contract_fields.value continues to hold the COMPOSED prose string that the
-- template {{TOKEN}} substitution consumes (so the legal body keeps working). The
-- composer writes value from structured; hand-entered scalars still write value
-- directly and structured stays null (treated as {text:value}).

-- 1. registry table -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_formats (
  format_type   text PRIMARY KEY,
  label         text NOT NULL,               -- human name for the modal picker
  category      text NOT NULL,               -- 'scalar' | 'party' | 'composite' | 'schedule' | 'choice'
  input_kind    text NOT NULL,               -- which renderer the front-end uses
  guidance      text,                        -- default placeholder / help text
  validate_hint text,                        -- client-side validation hint (regex name or note)
  reusable_as   text,                        -- what app entity this data can feed (e.g. 'phone','person','money')
  sort_order    integer NOT NULL DEFAULT 100
);
ALTER TABLE public.contract_formats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contract_formats_read ON public.contract_formats;
CREATE POLICY contract_formats_read ON public.contract_formats FOR SELECT USING (true);
GRANT SELECT ON public.contract_formats TO authenticated, anon;

-- 2. the canonical format set ---------------------------------------------------
INSERT INTO public.contract_formats (format_type, label, category, input_kind, guidance, validate_hint, reusable_as, sort_order) VALUES
  ('text',        'Free text',          'scalar',    'text',           'Type a short value',                              NULL,        NULL,       10),
  ('longtext',    'Paragraph',          'scalar',    'longtext',       'Describe in full sentences',                      NULL,        NULL,       20),
  ('first_name',  'First name',         'scalar',    'text',           'First name',                                      'name',      'person',   30),
  ('last_name',   'Last name',          'scalar',    'text',           'Last name',                                       'name',      'person',   40),
  ('person_name', 'Full name',          'scalar',    'text',           'Full legal name',                                 'name',      'person',   50),
  ('company',     'Company name',       'scalar',    'text',           'Company / business name',                         NULL,        'company',  60),
  ('phone',       'Phone number',       'scalar',    'phone',          '(555) 555-5555',                                  'phone',     'phone',    70),
  ('email',       'Email address',      'scalar',    'email',          'name@example.com',                                'email',     'email',    80),
  ('website',     'Website',            'scalar',    'text',           'https://example.com',                             'url',       'website',  90),
  ('currency',    'Money',              'scalar',    'currency',       '$0.00',                                           'money',     'money',   100),
  ('percent',     'Percent',            'scalar',    'percent',        '0%',                                               'percent',   NULL,      110),
  ('number',      'Number',             'scalar',    'text',           'A number',                                        'number',    NULL,      120),
  ('date',        'Date',               'scalar',    'date',           'Pick a date',                                     'date',      'date',    130),
  ('address',     'Mailing address',    'composite', 'address',        'Street, city, state, ZIP',                        NULL,        'address', 140),
  ('person',      'Person / contact',   'composite', 'person',         'Name, phone, email, company',                     NULL,        'person',  150),
  ('location',    'Location',           'composite', 'location',       'Barn / facility this refers to',                  NULL,        'location',160),
  ('party',       'Responsible party',  'party',     'party',          'Select the responsible party',                    NULL,        'party',   170),
  ('pair',        'Responsibility + cost','party',   'pair',           'Who manages it, and who pays',                    NULL,        'party',   180),
  ('percent_split','Percentage split',  'party',     'percent_split',  'Split between parties (must total 100%)',          'split',     NULL,      190),
  ('list',        'List',               'scalar',    'list',           'One item per line',                               NULL,        'list',    200),
  ('select',      'Dropdown (choose one)','choice',  'select',         'Choose one',                                      NULL,        NULL,      210),
  ('buttons',     'Multi-select',       'choice',    'buttons',        'Choose any that apply',                           NULL,        NULL,      220),
  ('checkbox',    'Yes / No',           'choice',    'buttons',        'Yes or no',                                       NULL,        NULL,      230),
  ('week_grid',   'Weekly schedule',    'schedule',  'week_grid',      'Days (and optional times) per party',              NULL,        'schedule',240)
ON CONFLICT (format_type) DO UPDATE SET
  label=excluded.label, category=excluded.category, input_kind=excluded.input_kind,
  guidance=excluded.guidance, validate_hint=excluded.validate_hint,
  reusable_as=excluded.reusable_as, sort_order=excluded.sort_order;

-- 3. per-field columns ----------------------------------------------------------
ALTER TABLE public.contract_fields     ADD COLUMN IF NOT EXISTS format_type text;
ALTER TABLE public.contract_fields     ADD COLUMN IF NOT EXISTS structured jsonb;
ALTER TABLE public.contract_field_defs ADD COLUMN IF NOT EXISTS format_type text;

-- 4. derive format_type for existing fields from their current input_kind/value_type,
--    plus the specific overrides that make the data reusable (phones, emails, names…).
UPDATE public.contract_fields SET format_type = COALESCE(format_type, CASE
    WHEN input_kind = 'responsibility' THEN 'party'
    WHEN input_kind = 'contact'        THEN 'person'
    WHEN input_kind IN ('week_grid','select','buttons','currency','date','percent','longtext') THEN input_kind
    ELSE 'text' END);

-- targeted format upgrades by field_key semantics (so the data is reusable)
UPDATE public.contract_fields SET format_type='email'       WHERE format_type='text' AND field_key LIKE '%.EMAIL';
UPDATE public.contract_fields SET format_type='phone'       WHERE format_type='text' AND field_key LIKE '%.PHONE';
UPDATE public.contract_fields SET format_type='person_name' WHERE format_type='text' AND (field_key LIKE '%.FULL_NAME' OR field_key LIKE '%.PRINTED_NAME' OR field_key LIKE '%.VET_NAME' OR field_key LIKE '%.FARRIER_NAME');
UPDATE public.contract_fields SET format_type='address'     WHERE format_type='text' AND field_key LIKE '%.ADDRESS';
UPDATE public.contract_fields SET format_type='currency'    WHERE format_type='text' AND field_key LIKE '%FAIR_MARKET_VALUE';
UPDATE public.contract_fields SET format_type='location'    WHERE format_type='text' AND field_key IN ('HORSE.CURRENT_LOCATION','HORSE.HOME_LOCATION');
UPDATE public.contract_fields SET format_type='number'      WHERE format_type='text' AND field_key LIKE 'TXN.LESSONS_%';
