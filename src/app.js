import assistantRoutes from "./assistant/routes.js";
import "dotenv/config";
import cors from "cors";
import express from "express";

import userRoutes from "./routes/userRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import shareRoutes from "./routes/shareRoutes.js";
import loginRoutes from "./routes/loginRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/users", userRoutes);
app.use("/files", fileRoutes);
app.use("/projects", projectRoutes);        
app.use("/shares", shareRoutes);
app.use("/login", loginRoutes)

app.use("/assistant", assistantRoutes);
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(error.statusCode || 500).json({message:error.statusCode ? error.message : "Não foi possível concluir a operação."});
});
export default app;
