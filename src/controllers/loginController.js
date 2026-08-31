import { getUserByEmailOrUsername, loginFailure, resetLoginFailure } from "../services/userService.js";
import bcrypt from "bcrypt"
import crypto from "crypto"

const loginReq = async (req,res) =>{
  try {
    const {password, login} = req.body

    const user = await getUserByEmailOrUsername(login)

    if(!user){
      return res.status(401).json({
        message: "Usuário não encontrado"
      })
    }

    if(user.login >= 3){
      return res.status(401).json({
        message: "Tentativas excedidas, tente novamente amanhã"
      })
    }

    const senhaCorreta = await bcrypt.compare(password, user.password)

    if(!senhaCorreta){
      loginFailure(login);
      
      return res.status(401).json({
        message: `Senha incorreta, agora só possui mais ${2 - user.login} tentativas`
      })
    }

    resetLoginFailure(login)

    res.status(200).json({
      message: "Login realizado com sucesso",
      user,
    })

  } catch (error) {
      res.status(500).json({
        message: "Não foi possivel realizar o login",
        error: error.message
      })
  }
}

const exitReq = async (req, res) => {
  try {
    return res.status(200).json({
      message: "Logout realizado com sucesso"
    });
  } catch (error) {
    return res.status(500).json({
      message: "Erro ao realizar logout"
    });
  }
};


export default {loginReq, exitReq}