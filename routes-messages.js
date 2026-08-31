const express = require("express");
const Message = require("./models-Message");
const Chat = require("./models-Chat");
const { protect } = require("./middleware-auth");

const router = express.Router();

// @route  GET /api/messages/:chatId  (historia ya ujumbe)
router.get("/:chatId", protect, async (req, res) => {
  const { page = 1, limit = 30 } = req.query;

  const messages = await Message.find({ chat: req.params.chatId })
    .populate("sender", "username displayName avatarUrl")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json(messages.reverse());
});

// @route  POST /api/messages  (tuma ujumbe kupitia REST — mbadala wa socket)
router.post("/", protect, async (req, res) => {
  const { chatId, content, type = "text", replyTo } = req.body;

  if (!chatId || !content) {
    return res.status(400).json({ message: "chatId na content vinahitajika" });
  }

  const message = await Message.create({
    chat: chatId,
    sender: req.user._id,
    content,
    type,
    replyTo: replyTo || null,
  });

  await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id });

  const populated = await message.populate("sender", "username displayName avatarUrl");

  // Tuma pia kupitia socket kama recipient yuko online
  const io = req.app.get("io");
  if (io) {
    io.to(chatId).emit("new_message", populated);
  }

  res.status(201).json(populated);
});

module.exports = router;
