import bcrypt from "bcrypt";
import prisma from "../config/database.js";
import { tokenHash } from "./sessionService.js";

function validateNewPassword(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw Object.assign(new Error("A nova senha deve ter entre 8 e 128 caracteres."), {statusCode:400});
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw Object.assign(new Error("A nova senha deve conter letra maiúscula, letra minúscula e número."), {statusCode:400});
  }
}

const createUser = async (nome, username, email, senha) => {
  const senhaHash = await bcrypt.hash(senha, 10);

  const user = await prisma.user.create({
    data: {
      name: nome,
      username,
      email,
      password: senhaHash,
      bio: "",
    },
  });

  return user;
};

const getUsers = async () => {
  const users = await prisma.user.findMany();

  return users;
};

const getUser = async (id) =>{
  const user = await prisma.user.findUnique({where: { id }})

  return user
}

const getUserByEmailOrUsername = async (emailOrUsername) =>{
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        {
          email: emailOrUsername
        },
        {
          username: emailOrUsername
        }
      ]
    }
  })

  return user
}

const searchUsersByEmailOrUsername = async (query) => {
  const normalizedQuery = String(query ?? "").trim();

  if (!normalizedQuery) {
    return [];
  }

  return prisma.user.findMany({
    where: {
      OR: [
        {
          email: {
            contains: normalizedQuery,
            mode: "insensitive"
          }
        },
        {
          username: {
            contains: normalizedQuery,
            mode: "insensitive"
          }
        },
        {
          name: {
            contains: normalizedQuery,
            mode: "insensitive"
          }
        }
      ]
    },
    take: 6,
    orderBy: [
      { username: "asc" },
      { email: "asc" }
    ]
  });
}

const updateUser = async (id, nome, username, email, bio) => {
  const data = {
    name: nome,
    username,
    email,
    bio,
  };

  const user = await prisma.user.update({
    where: { id },
    data,
  });

  return user;
}

const changePassword = async (id, currentPassword, newPassword, confirmation, currentToken) => {
  if (typeof currentPassword !== "string" || !currentPassword) {
    throw Object.assign(new Error("Informe sua senha atual."), {statusCode:400});
  }
  validateNewPassword(newPassword);
  if (newPassword !== confirmation) {
    throw Object.assign(new Error("A confirmação da nova senha não coincide."), {statusCode:400});
  }

  const user = await prisma.user.findUnique({where:{id}});
  if (!user || !await bcrypt.compare(currentPassword,user.password)) {
    throw Object.assign(new Error("A senha atual está incorreta."), {statusCode:401});
  }
  if (await bcrypt.compare(newPassword,user.password)) {
    throw Object.assign(new Error("A nova senha deve ser diferente da senha atual."), {statusCode:400});
  }

  const password = await bcrypt.hash(newPassword, 12);
  return prisma.$transaction(async db => {
    const updatedUser = await db.user.update({where:{id},data:{password}});
    await db.session.deleteMany({
      where: {userId:id,...(currentToken&&{tokenHash:{not:tokenHash(currentToken)}})},
    });
    return updatedUser;
  });
}

const loginFailure = async (emailOrUsername) => {
  const userId = await getUserByEmailOrUsername(emailOrUsername)

  if(!userId){
    return null
  }

  const user = await prisma.user.update({
    where: { 
      id: userId.id
    },
    data: {
      login:{
        increment: 1
      }
    },
  });

}

const resetLoginFailure = async (emailOrUsername) =>{
  const userId = await getUserByEmailOrUsername(emailOrUsername)

  const user = await prisma.user.update({
    where: { 
      id: userId.id
     },
    data: {
      login:0
    },
  });

}

const deleteUser = async (id) =>{
  const userDeleted = await prisma.user.delete({
    where: { id },
  });

  return userDeleted;
} 

export{
  createUser,
  getUsers,
  getUser,
  updateUser,
  changePassword,
  deleteUser,
  getUserByEmailOrUsername,
  searchUsersByEmailOrUsername,
  loginFailure,
  resetLoginFailure,
};
