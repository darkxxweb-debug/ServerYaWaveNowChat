const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Middleware ya kulinda REST endpoints.
 * App ya Kotlin itatuma token kwenye header:
 *   Authorization: Bearer <token>
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Hakuna token, huwezi kuingia (unauthorized)" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "Token si sahihi — user hayupo" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token si sahihi au imeisha muda", error: err.message });
  }
};

module.exports = { protect };
