function invalidField(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseAmount(value, label) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") {
    throw invalidField(`${label} deve ser um valor monetário válido.`);
  }
  const text = String(value).trim();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) {
    throw invalidField(`${label} deve ser positivo ou zero, com até 10 dígitos inteiros e 2 casas decimais.`);
  }
  // Mantém o valor decimal como texto até chegar ao Prisma.
  return text;
}

export function parseProjectDate(value, label = "Data e horário do pagamento") {
  if (value === null || value === "") return null;
  const match = typeof value === "string" && value.match(/^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,3})?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/);
  if (!match) throw invalidField(`${label} deve conter data, horário e fuso no formato ISO 8601.`);
  const calendar = new Date(`${match[1]}T00:00:00.000Z`);
  const date = new Date(value);
  if (value.startsWith("0000") || !Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== match[1] || !Number.isFinite(date.getTime())) {
    throw invalidField(`${label}: data ou horário inválido.`);
  }
  return date;
}

export function normalizeProjectFinance(data) {
  const result = {};
  // Campo omitido preserva o valor atual no PUT; null limpa explicitamente.
  if (data.budgetAmount !== undefined) result.budgetAmount = parseAmount(data.budgetAmount, "Valor orçado");
  if (data.paymentAmount !== undefined) result.paymentAmount = parseAmount(data.paymentAmount, "Valor do pagamento");
  if (data.paymentDate !== undefined) result.paymentDate = parseProjectDate(data.paymentDate);
  return result;
}

export function serializeProject(project) {
  if (!project) return project;
  return {
    ...project,
    scheduledTo: project.scheduledTo?.toISOString() ?? null,
    budgetAmount: project.budgetAmount?.toFixed(2) ?? null,
    paymentAmount: project.paymentAmount?.toFixed(2) ?? null,
    paymentDate: project.paymentDate?.toISOString() ?? null,
  };
}
