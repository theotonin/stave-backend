import prisma from "../config/database.js";
import { uploadFile } from "./fileService.js";

import { ZipArchive } from "archiver";

import path from "path"

const projectFiles= []

const createProject = async (name, members, scheduledTo, status, type, description) => {
  const ids = Array.isArray(members) ? members.filter(Boolean) : [];

  const project = await prisma.project.create({
    data: {
      name,
      status: status || "Em andamento",
      type: Array.isArray(type) ? type : [],
      description: description || "",
      scheduledTo: scheduledTo ? new Date(scheduledTo) : null,
      ...(ids.length > 0 && {
        members: {
          connect: ids.map((id) => ({ id })),
        },
      }),
    },
    include: {
      members: true,
    },
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
  const updateData = {
    name: data.name,
    description: data.description,
    type: Array.isArray(data.type) ? data.type : [],
    status: data.status,
    scheduledTo: data.scheduledTo ? new Date(data.scheduledTo) : null,
  };

  if (Array.isArray(data.members)) {
    const memberIds = data.members
      .map((member) => (typeof member === "string" ? member : member?.id || null))
      .filter(Boolean);

    if (memberIds.length > 0) {
      updateData.members = {
        set: memberIds.map((memberId) => ({ id: memberId })),
      };
    }
  }

  return prisma.project.update({
    where: { id },
    data: updateData,
    include: {
      members: true,
      files: true,
    },
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
