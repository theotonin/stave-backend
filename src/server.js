import { startWorker } from "./assistant/worker.js";
import app from "./app.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

startWorker().catch(() => console.error("Worker indisponível: verifique o schema e a conexão do banco."));
