import prisma from "../config/database.js";
import crypto from "crypto"

const createShare = async (projectId) => {
    const token = crypto.randomBytes(20).toString("base64url").slice(0, 20);
    const share = await prisma.$transaction(async (db) => {
        const createdShare = await db.share.create({
            data: {
                token,
                project: { connect: { id: projectId } },
            },
        });
        await db.project.update({
            where: { id: projectId },
            data: { updatedAt: new Date() },
        });
        return createdShare;
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
