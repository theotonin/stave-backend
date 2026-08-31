import {uploadFile, downloadFile, deleteFile, getFiles} from "../services/fileService.js";

const uploadFileReq = async (req, res) => {
  
    try{
        const file = await uploadFile(req.file, req.body.projectId);

        res.json({
            message: "Arquivo enviado com sucesso",
            file: file
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Erro ao enviar arquivo",
            error: error.message
        });
    }
};

const downloadFileReq = async (req, res) => {
    try {
        const file = await downloadFile(req.params.fileId);

        if (!file) {
            return res.status(404).json({
                message: "Arquivo não encontrado"
            });
        }

        res.download(file.storagePath, file.originalName);
    } catch (error) {
        res.status(500).json({
            message: "Erro ao baixar arquivo",
            error: error.message
        });
    }
};

const getFilesReq = async (req, res) => {
    try {
        const files = await getFiles();

        res.json({
            message: "Files encontrados",
            file: files
        })
    } catch (error) {
        res.status(500).json({
            message: "Erro ao mostrar files",
            error: error.message
        });
    }
};

const deleteFileReq = async (req, res) => {
    try {
        const deletedFile = await deleteFile(req.params.fileId);

        if (!deletedFile) {
            return res.status(404).json({
                message: "Arquivo não encontrado"
            });
        }

        res.json({
            message: "Arquivo excluído com sucesso",
            file: deletedFile
        });
    } catch (error) {
        res.status(500).json({
            message: "Erro ao excluir arquivo",
            error: error.message
        });
    }
};

export default {
  uploadFileReq,
  downloadFileReq,
  deleteFileReq,
  getFilesReq
};