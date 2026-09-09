-- Restaura data e horário; as datas sem hora passam a 00:00 em São Paulo.
-- O timestamp armazenado segue a convenção UTC do Prisma.
-- Horários descartados na conversão anterior para DATE não são recuperáveis aqui.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='Project' AND column_name='scheduledTo' AND data_type='date') THEN
    ALTER TABLE "Project" ALTER COLUMN "scheduledTo" TYPE TIMESTAMP(3)
      USING (("scheduledTo"::timestamp AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='Project' AND column_name='paymentDate' AND data_type='date') THEN
    ALTER TABLE "Project" ALTER COLUMN "paymentDate" TYPE TIMESTAMP(3)
      USING (("paymentDate"::timestamp AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC');
  END IF;
END $$;
