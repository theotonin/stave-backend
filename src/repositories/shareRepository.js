import prisma from "../config/database.js";

const create = (data) => {
  return prisma.share.create({
    data,
  });
};

export {
  create,
};
