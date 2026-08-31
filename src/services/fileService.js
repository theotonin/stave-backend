import prisma from "../config/database.js";
import fs from "fs/promises";
import path from "path";

const uploadFile = async (file, projectId) => {
  const { originalname, mimetype, size, path: storagePath } = file;

  const uploadedFile = await prisma.file.create({
    data: {
      originalName: originalname,
      mimeType: mimetype,
      size,
      storagePath: `uploads/${file.filename}`,
      projectId: projectId 
    },
  });



  return uploadedFile;
}

const downloadFile = async (fileId) => {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
  });
  
  return file;
}

const deleteFile = async (fileId) => {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
  });

  if (!file) {
    return null;
  }

  await prisma.file.delete({
    where: { id: fileId },
  });

  await fs.unlink(path.resolve(file.storagePath)).catch(() => null);

  return file;
};

const getFiles = async () =>{
  const files = await prisma.file.findMany({})

  return files
}

export {
    uploadFile,
    downloadFile,
  deleteFile,
    getFiles
}