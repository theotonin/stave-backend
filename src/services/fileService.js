import prisma from "../config/database.js";
import fs from "fs/promises";
import path from "path";

const uploadFile = async (file, projectId) => {
  const { originalname, mimetype, size, path: storagePath } = file;

  const uploadedFile = await prisma.$transaction(async (db) => {
    const createdFile = await db.file.create({
      data: {
        originalName: originalname,
        mimeType: mimetype,
        size,
        storagePath: `uploads/${file.filename}`,
        projectId,
      },
    });

    await db.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    return createdFile;
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

  await prisma.$transaction(async (db) => {
    await db.file.delete({ where: { id: fileId } });
    await db.project.update({
      where: { id: file.projectId },
      data: { updatedAt: new Date() },
    });
  });

  await fs.unlink(path.resolve(file.storagePath)).catch(() => null);

  return file;
};

const getFiles = async (userId) =>{
  const files = await prisma.file.findMany({where:{project:{members:{some:{id:userId}}}}})

  return files
}

export {
    uploadFile,
    downloadFile,
  deleteFile,
    getFiles
}
