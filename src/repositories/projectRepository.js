import prisma from "../config/database.js";

const create = (data) => {
  return prisma.project.create({
    data,
  });
};

export {
  create,
};
