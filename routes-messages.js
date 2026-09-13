const express = require("express");
const Message = require("./models-Message");
const Chat = require("./models-Chat");
const { protect } = require("./middleware-auth");
const { sendPushToUsers } = require("./push");

const router = express.Router();

// @route  GET /api/messages/:chatId  (historia ya ujumbe)
router.get("/:chatId", protect, async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;

    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "username displayName avatarUrl")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ message: "Hitilafu server", error: err.message });
  }
});

// @route  POST /api/messages  (tuma ujumbe kupitia REST — mbadala wa socket)
router.post("/", protect, async (req, res) => {
  try {
    const { chatId, content, type = "text", replyTo } = req.body;

    if (!chatId || !content) {
      return res.status(400).json({ message: "chatId na content vinahitajika" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: "Chat haijapatikana" });

    if (chat.type === "channel" && !chat.admins.some((a) => a.equals(req.user._id))) {
      return res.status(403).json({ message: "Admin/mmiliki pekee ndiye anaweza kutuma kwenye channel hii" });
    }

    const message = await Message.create({
      chat: chatId,
      sender: req.user._id,
      content,
      type,
      replyTo: replyTo || null,
    });

    chat.lastMessage = message._id;
    await chat.save();

    const populated = await message.populate("sender", "username displayName avatarUrl");

    // Tuma pia kupitia socket kwa wale walio online
    const io = req.app.get("io");
    if (io) io.to(chatId).emit("new_message", populated);

    // Push notification kwa waliobaki (kama hawako connected na wamejisajili FCM)
    const recipients = chat.participants.filter((p) => !p.equals(req.user._id));
    sendPushToUsers(recipients, {
      title: populated.sender.displayName || populated.sender.username,
      body: type === "text" ? content : `[${type}]`,
      data: { chatId: chatId.toString() },
    });

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: "Hitilafu server", error: err.message });
  }
});

// @route  POST /api/messages/:id/delivered
// App inaita hii mara ujumbe ushahifadhiwa local (Room DB) kwenye simu — hii
// ndiyo inayosababisha ufutwe kwenye server DB ukishafika kwa washiriki wote.
router.post("/:id/delivered", protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: "Ujumbe haujapatikana" });

    if (!message.deliveredTo.some((u) => u.equals(req.user._id))) {
      message.deliveredTo.push(req.user._id);
      message.status = "delivered";
      await message.save();
    }

    const chat = await Chat.findById(message.chat);
    const io = req.app.get("io");

    if (chat) {
      const others = chat.participants.filter((p) => !p.equals(message.sender));
      const allDelivered = others.every((p) =>
        message.deliveredTo.some((d) => d.equals(p))
      );

      if (allDelivered) {
        await Message.findByIdAndDelete(message._id);
        if (io) io.to(message.chat.toString()).emit("message_status", { messageId: message._id, status: "deleted" });
        return res.json({ message: "Imesajiliwa", deleted: true });
      }
    }

    if (io) io.to(message.chat.toString()).emit("message_status", { messageId: message._id, status: "delivered" });
    res.json({ message: "Imesajiliwa", deleted: false });
  } catch (err) {
    res.status(500).json({ message: "Hitilafu server", error: err.message });
  }
});

module.exports = router;
