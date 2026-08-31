const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({
      message: "Token inválido"
    });
  }

  req.token = token;

  next();
};

export default authMiddleware