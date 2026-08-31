import {createShare, getShareByToken} from "../services/shareService.js";
import { getProject, downloadProject} from "../services/projectService.js";
import path from "path"


const createShareReq = async (req, res) => {
  try {

    const projeto = await getProject(req.params.projectId)

    const token = req.token


    const projetoPertence = projeto.members.some(member => member.id === token);  

    if(!projetoPertence){
      return res.status(403).json({
        message: `Esse share requisitado do projeto ${projeto.name}, não pertence ao usuário`
      })
    }

    const share = await createShare(req.params.projectId);

    res.status(201).json({
      message: "Compartilhamento criado com sucesso",
      share 
    });

  } catch (error) {
    res.status(500).json({
      message: "Erro ao criar compartilhamento",
      error: error.message
    });
  }
};

const downloadProjectByShare = async (req, res) => {
  try {
    const share = await getShareByToken(req.params.token);

    if (!share) {
      return res.status(404).json({
        message: "Compartilhamento não encontrado"
      });
    }

    const project = await getProject(share.projectId);

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
  createShareReq, downloadProjectByShare
};
