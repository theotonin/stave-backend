-- Alteração aditiva: mantém projetos existentes e seus dados.
ALTER TABLE "Project"
  ADD COLUMN "budgetAmount" DECIMAL(12,2),
  ADD COLUMN "paymentAmount" DECIMAL(12,2),
  ADD COLUMN "paymentDate" DATE;
