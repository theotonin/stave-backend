import bcrypt from "bcrypt";
import prisma from "../config/database.js";

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

const updateUser = async (id, nome, username, email, senha, bio) => {
  const data = {
    name: nome,
    username,
    email,
    bio,
  };

  if (senha && senha.trim()) {
    data.password = await bcrypt.hash(senha, 10);
  }

  const user = await prisma.user.update({
    where: { id },
    data,
  });

  return user;
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
  deleteUser,
  getUserByEmailOrUsername,
  searchUsersByEmailOrUsername,
  loginFailure,
  resetLoginFailure,
};
