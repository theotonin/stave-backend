import prisma from "../config/database.js";

const create = (data) => {
  return prisma.file.create({
    data,
  });
};

export {
  create,
};
