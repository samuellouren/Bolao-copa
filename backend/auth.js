const jwt = require("jsonwebtoken");

const SECRET_KEY = process.env.JWT_SECRET;

function criarToken(usuario) {
  return jwt.sign({ id: usuario.id, email: usuario.email }, SECRET_KEY, {
    expiresIn: "7d",
  });
}

function verificarToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ erro: "Token não fornecido" });
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ erro: "Token invalido ou expirado" });
    }
    req.usuario = decoded;
    next();
  });
}

module.exports = { criarToken, verificarToken };
