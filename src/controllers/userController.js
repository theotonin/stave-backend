import { publicUser } from "../services/sessionService.js";
import {
  createUser,
  getUsers,
  updateUser,
  changePassword,
  deleteUser,
  getUser,
  getUserByEmailOrUsername,
  searchUsersByEmailOrUsername,
} from "../services/userService.js";

const createUserReq = async (req, res) => {
  try {
    const { nome, username, email, senha, confirmarSenha,  } = req.body;

    if(senha !== confirmarSenha) {
    return res.status(400).json({ 
      message: "As senhas não coincidem." });
    }

    const user = await createUser(nome, username, email, senha);

    res.status(201).json({
      message: "Usuario criado com sucesso",
      user: publicUser(user)});
  } catch (error) {
    res.status(500).json({
      message: `Algo deu errado`,
      error: error.message})
  }

};

const getUsersReq = async (req, res) => {
  try {
    const users = await getUsers();

    res.status(200).json({
      message: "Usuários encontrados com sucesso!",
      users: users.map(publicUser),
    });
  } catch (error) {
    res.status(500).json({
      message: "Erro ao buscar usuários",
      error: error.message,
    });
  }
};


const getUserReq = async (req, res) =>{
  try {
    const user = await getUser(req.params.id)

    res.status(200).json({
      message: "Usuário encontrado com sucesso!",
      user: publicUser(user)
    })

  } catch (error) {
    res.status(500).json({
      message: "Erro ao buscar usuário",
      error: error.message
    })
  }
}


const updateUserReq = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, username, email, bio } = req.body;

    const user = await updateUser(id, nome, username, email, bio);

    res.status(200).json({
      message: "Usuário atualizado com sucesso!",
      user: publicUser(user),
    });
  } catch (error) {
    res.status(500).json({
      message: "Erro ao atualizar usuário",
      error: error.message,
    });
  }
}

const changePasswordReq = async (req, res) => {
  try {
    const { senhaAtual, novaSenha, confirmarNovaSenha } = req.body;
    const user = await changePassword(
      req.params.id,
      senhaAtual,
      novaSenha,
      confirmarNovaSenha,
      req.sessionToken,
    );

    res.status(200).json({
      message: "Senha alterada com sucesso. As outras sessões foram encerradas.",
      user: publicUser(user),
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Erro ao alterar senha.",
    });
  }
};

const deleteUserReq = async (req, res) => {
  try {
    const { id } = req.params;

    const userDeleted = await deleteUser(id);

    res.status(200).json({
      message: "Usuário deletado com sucesso!",
      userDeleted: publicUser(userDeleted),
    });
  } catch (error) {
    res.status(500).json({
      message: "Erro ao deletar usuário",
      error: error.message,
    });
  }
}

const searchUserReq = async (req, res) => {
  try {
    const rawQuery =
      req.query.emailOrUsername ??
      req.query.query ??
      req.query.q ??
      req.query.username ??
      req.query.email ??
      "";

    const searchValue = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;
    const normalizedQuery = String(searchValue ?? "").trim();

    if (!normalizedQuery) {
      return res.status(400).json({
        message: "Email ou username é obrigatório"
      });
    }

    const users = await searchUsersByEmailOrUsername(normalizedQuery);

    return res.status(200).json({
      message: "Usuários encontrados com sucesso!",
      users: users.map(publicUser)
    });
  } catch (error) {
    res.status(500).json({
      message: "Erro ao buscar usuários",
      error: error.message,
    });
  }
}

export default {
  createUserReq,
  getUsersReq,
  getUserReq,
  updateUserReq,
  changePasswordReq,
  deleteUserReq,
  searchUserReq,
};


// testar
// {	"nome": "leonardo",
// 	"username": "leo",
// 	"email":"leo@gmail.com",
// 	"senha": "oii",
// 	"confirmarSenha": "oii"
// }
