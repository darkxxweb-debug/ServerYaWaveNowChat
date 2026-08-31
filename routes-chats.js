const express = require("express");
const Chat = require("./models-Chat");
const { protect } = require("./middleware-auth");

const router = express.Router();

// @route  GET /api/chats  (chats zote za mtumiaji)
router.get("/", protect, async (req, res) => {
  const chats = await Chat.find({ participants: req.user._id })
    .populate("participants", "username displayName avatarUrl isOnline lastSeen")
    .populate("lastMessage")
    .sort({ updatedAt: -1 });

  res.json(chats);
});

// @route  POST /api/chats  (anzisha chat 1-kwa-1 au group)
router.post("/", protect, async (req, res) => {
  const { participantId, isGroup, groupName, participantIds } = req.body;

  if (isGroup) {
    const chat = await Chat.create({
      isGroup: true,
      groupName,
      participants: [...participantIds, req.user._id],
      admins: [req.user._id],
    });
    return res.status(201).json(chat);
  }

  // Chat 1-kwa-1: angalia kama tayari ipo
  let chat = await Chat.findOne({
    isGroup: false,
    participants: { $all: [req.user._id, participantId], $size: 2 },
  });

  if (!chat) {
    chat = await Chat.create({
      isGroup: false,
      participants: [req.user._id, participantId],
    });
  }

  res.status(201).json(chat);
});

// @route  GET /api/chats/:id
router.get("/:id", protect, async (req, res) => {
  const chat = await Chat.findById(req.params.id).populate(
    "participants",
    "username displayName avatarUrl isOnline lastSeen"
  );
  if (!chat) return res.status(404).json({ message: "Chat haijapatikana" });
  res.json(chat);
});

module.exports = router;
