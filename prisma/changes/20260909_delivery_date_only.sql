-- O frontend anterior enviava os horários locais convertidos para UTC.
-- Preserva o dia exibido em São Paulo antes de remover o horário.
-- A condição evita deslocar novamente as datas se o script for repetido.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Project'
      AND column_name = 'scheduledTo' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "Project"
      ALTER COLUMN "scheduledTo" TYPE DATE
      USING (("scheduledTo" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date;
  END IF;
END $$;
