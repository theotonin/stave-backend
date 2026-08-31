import prisma from "../config/database.js";
import crypto from "crypto"

const createShare = async (projectId) => {
    const token = crypto.randomBytes(20).toString("base64url").slice(0, 20);
    const share = await prisma.share.create({
        data:{
            token: token,
            project: {
                connect: {
                    id: projectId 
                }
            }   
        }            
    })
    return share
}

const getShareByToken = async (token) =>{
    const share = await prisma.share.findUnique({
        where: {
            token
        }
    })
    return share
}

export {
    createShare, getShareByToken
}