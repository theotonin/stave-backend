import {createUser, getUsers, updateUser, deleteUser, getUser} from"../services/userService.js";

const createUserReq = async (req, res) => {
  try {
    const { nome, username, email, senha, confirmarSenha,  } = req.body;

    if(senha !== confirmarSenha) {
    return res.status(400).json({ 
      message: `${senha} e ${confirmarSenha} estão diferentes`, 
      error: error.message });
    }

    const user = await createUser(nome, username, email, senha);

    res.status(201).json({
      message: "Usuario criado com sucesso",
      user});
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
      users,
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
      user
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
    const { nome, username, email, senha, bio } = req.body;

    const user = await updateUser(id, nome, username, email, senha, bio);

    res.status(200).json({
      message: "Usuário atualizado com sucesso!",
      user,
    });
  } catch (error) {
    res.status(500).json({
      message: "Erro ao atualizar usuário",
      error: error.message,
    });
  }
}

const deleteUserReq = async (req, res) => {
  try {
    const { id } = req.params;

    const userDeleted = await deleteUser(id);

    res.status(200).json({
      message: "Usuário deletado com sucesso!",
      userDeleted,
    });
  } catch (error) {
    res.status(500).json({
      message: "Erro ao deletar usuário",
      error: error.message,
    });
  }
}

export default {
  createUserReq,
  getUsersReq,
  getUserReq,
  updateUserReq,
  deleteUserReq,
};


// testar
// {	"nome": "leonardo",
// 	"username": "leo",
// 	"email":"leo@gmail.com",
// 	"senha": "oii",
// 	"confirmarSenha": "oii"
// }