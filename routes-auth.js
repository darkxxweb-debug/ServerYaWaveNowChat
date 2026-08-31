const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("./models-User");
const { protect } = require("./middleware-auth");

const router = express.Router();

// Tengeneza JWT token — HII NDIYO "TOKEN" ambayo app ya Kotlin itatumia
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });
};

// @route  POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, phone, password, displayName } = req.body;

    if (!username || !phone || !password) {
      return res.status(400).json({ message: "Jaza username, phone na password" });
    }

    const exists = await User.findOne({ $or: [{ username }, { phone }] });
    if (exists) {
      return res.status(400).json({ message: "Username au namba ya simu tayari imesajiliwa" });
    }

    const user = await User.create({ username, phone, password, displayName });
    const token = generateToken(user._id);

    res.status(201).json({
      message: "Umesajiliwa kikamilifu",
      token, // <-- app ya Kotlin ihifadhi hii token (SharedPreferences / DataStore)
      user: {
        id: user._id,
        username: user.username,
        phone: user.phone,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Hitilafu server", error: err.message });
  }
});

// @route  POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Username au password si sahihi" });
    }

    const token = generateToken(user._id);

    res.json({
      message: "Umeingia kikamilifu",
      token,
      user: {
        id: user._id,
        username: user.username,
        phone: user.phone,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Hitilafu server", error: err.message });
  }
});

// @route  GET /api/auth/me  (thibitisha token bado ni sahihi)
router.get("/me", protect, async (req, res) => {
  res.json({
    id: req.user._id,
    username: req.user.username,
    phone: req.user.phone,
    displayName: req.user.displayName,
    avatarUrl: req.user.avatarUrl,
    about: req.user.about,
  });
});

module.exports = router;
