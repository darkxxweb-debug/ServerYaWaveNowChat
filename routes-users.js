const express = require("express");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

// @route  GET /api/users/search?q=jina
router.get("/search", protect, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);

  const users = await User.find({
    $or: [
      { username: { $regex: q, $options: "i" } },
      { phone: { $regex: q, $options: "i" } },
    ],
    _id: { $ne: req.user._id },
  }).select("username displayName avatarUrl phone isOnline lastSeen");

  res.json(users);
});

// @route  GET /api/users/:id
router.get("/:id", protect, async (req, res) => {
  const user = await User.findById(req.params.id).select(
    "username displayName avatarUrl about isOnline lastSeen"
  );
  if (!user) return res.status(404).json({ message: "User hajapatikana" });
  res.json(user);
});

// @route  PUT /api/users/me  (update profile)
router.put("/me/update", protect, async (req, res) => {
  const { displayName, about, avatarUrl } = req.body;

  const user = await User.findById(req.user._id);
  if (displayName !== undefined) user.displayName = displayName;
  if (about !== undefined) user.about = about;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

  await user.save();
  res.json({ message: "Profile imesasishwa", user });
});

// @route  POST /api/users/contacts/:id  (ongeza contact)
router.post("/contacts/:id", protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user.contacts.includes(req.params.id)) {
    user.contacts.push(req.params.id);
    await user.save();
  }
  res.json({ message: "Contact imeongezwa" });
});

module.exports = router;
