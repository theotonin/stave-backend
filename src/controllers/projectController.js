import {
  createProject,
  getProjects,
  getProject,
  getProjectByUserId,
  updateProject,
  deleteProject,
  downloadProject,
  getProjectsByUserId
} from "../services/projectService.js";

import { getUser} from"../services/userService.js";

const createProjectReq = async (req, res) => {
  try {
    const { name, members, scheduledTo, status, type, description} = req.body;

    const project = await createProject(name, members, scheduledTo, status, type, description);

    res.status(201).json({
      message: "Projeto criado com sucesso",
      project
    });

  } catch (error) {
    res.status(500).json({
      message: "Erro ao criar projeto",
      error: error.message
    });
  }
};

const getProjectsReq = async (req, res) => {
  try {
    const projects = await getProjects();

    res.status(200).json({
      message: "Projetos encontrados com sucesso",
      projects
    });

  } catch (error) {
    res.status(500).json({
      message: "Erro ao buscar projetos",
      error: error.message
    });
  }
}

const getProjectsByUserIdReq = async (req,res) =>{
  try {
    const userId = req.headers.authorization;

    const user = await getUser(userId);
    
    const projects = await getProjectsByUserId(userId);

    res.status(200).json({
      message: "Projetos encontrados com sucesso",
      projects, 
      user,
    });

  } catch (error) {
    res.status(500).json({
      message: "Erro ao buscar projetos",
      error: error.message
    });
  }
}

const getProjectReq = async (req, res) =>{
  try {
    const project = await getProjectByUserId(
      req.params.id,
      req.headers.authorization
    );

    if (!project) {
      return res.status(404).json({ message: "Projeto não encontrado" });
    }

    res.status(200).json({
      message: "Projeto encontrado com sucesso",
      project
    });
  } catch (error) {
    res.status(500).json({
      message: "Erro ao buscar projeto",
      error: error.message
    });
  }
}

const updateProjectReq = async (req, res) => {
  try {
    const project = await getProjectByUserId(
      req.params.id,
      req.headers.authorization
    );

    if (!project) {
      return res.status(404).json({ message: "Projeto não encontrado" });
    }

    const updatedProject = await updateProject(req.params.id, req.body);

    res.status(200).json({
      message: "Projeto atualizado com sucesso",
      project: updatedProject
    });
  } catch (error) {
    res.status(500).json({
      message: "Erro ao atualizar projeto",
      error: error.message
    });
  }
};

const deleteProjectReq = async (req, res) => {
  try {
    const project = await getProjectByUserId(
      req.params.id,
      req.headers.authorization
    );

    if (!project) {
      return res.status(404).json({ message: "Projeto não encontrado" });
    }

    await deleteProject(req.params.id);

    res.status(200).json({ message: "Projeto excluído com sucesso" });
  } catch (error) {
    res.status(500).json({
      message: "Erro ao excluir projeto",
      error: error.message
    });
  }
};

const downloadProjectReq = async (req, res) => {
  try {
    const project = await getProject(req.params.id);

    if (!project) {
      return res.status(404).json({
        message: "Projeto não encontrado"
      });
    }

    await downloadProject(project, res);

  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        message: "Erro ao baixar projeto",
        error: error.message
      });
    }
  }
};

export default {
  createProjectReq,
  getProjectsReq,
  getProjectReq,
  updateProjectReq,
  deleteProjectReq,
  downloadProjectReq,
  getProjectsByUserIdReq
};
