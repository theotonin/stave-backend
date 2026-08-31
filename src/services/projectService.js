import prisma from "../config/database.js";
import { uploadFile } from "./fileService.js";

import { ZipArchive } from "archiver";

import path from "path"

const projectFiles= []

const createProject = async (name, members, scheduledTo, status, type, description) => {
  const project =  await prisma.project.create({
    data: {
      name,
      status: status || "Em andamento",
      type: type,
      description, description,
      scheduledTo: scheduledTo
        ? new Date(scheduledTo)
        : null,
      members: {
        connect: members.map(id => ({
          id
        }))
      }
    }
  });

  return project;
};

const getProjects = async () => {
  const projects = await prisma.project.findMany({
    include: {
      members: true
    }

  });

  return projects;
}

const getProjectsByUserId = async (userId) =>{
  const projects = await prisma.project.findMany({
  where: {
    members: {
      some: {
        id: userId
      }
    }
  }, 
  include: {
    members: true
  },
  orderBy: {
      updatedAt: "desc"
    }
});

  return projects
}

const getProject = async (id) =>{
    const project = await prisma.project.findUnique({
        where:{
            id
        },
        include: {
          files: true,
          members: true
        }
    })

    return project
}

const getProjectByUserId = async (id, userId) => {
  return prisma.project.findFirst({
    where: {
      id,
      members: {
        some: { id: userId }
      }
    },
    include: {
      members: true,
      files: true
    }
  });
};

const updateProject = async (id, data) => {
  return prisma.project.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      type: data.type,
      status: data.status,
      scheduledTo: data.scheduledTo ? new Date(data.scheduledTo) : null
    }
  });
};

const deleteProject = async (id) => {
  return prisma.$transaction([
    prisma.file.deleteMany({ where: { projectId: id } }),
    prisma.share.deleteMany({ where: { projectId: id } }),
    prisma.project.delete({ where: { id } })
  ]);
};

const downloadProject = async (project, res) => {
  if (!project.files || project.files.length === 0) {
    return res.status(404).json({
      message: "O projeto não possui arquivos"
    });
  }

  res.attachment(`${project.name}.zip`);

  const archive = new ZipArchive();

  archive.on("error", (error) => {
    throw error;
  });

  archive.pipe(res);

  project.files.forEach((file) => {
    archive.file(
      path.resolve(file.storagePath),
      {
        name: file.originalName
      }
    );
  });

  await archive.finalize();
};


export {
  createProject,
  getProjects,
  getProject,
  getProjectByUserId,
  updateProject,
  deleteProject,
  downloadProject,
  getProjectsByUserId
};
