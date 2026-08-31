import prisma from "../config/database.js";

const create = (data) => {
  return prisma.user.create({
    data,
  });
};

export {
  create,
};
