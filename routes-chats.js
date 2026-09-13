const express = require("express");
const Chat = require("./models-Chat");
const { protect } = require("./middleware-auth");

const router = express.Router();

const CHAT_POPULATE = [
  { path: "participants", select: "username displayName avatarUrl isOnline lastSeen" },
  { path: "owner", select: "username displayName avatarUrl" },
  { path: "lastMessage" },
];

// @route  GET /api/chats  (chats zote za mtumiaji: direct + group + channel)
router.get("/", protect, async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.user._id })
      .populate(CHAT_POPULATE)
      .sort({ updatedAt: -1 });

    res.json(chats);
  } catch (err) {
    res.status(500).json({ message: "Hitilafu server", error: err.message });
  }
});

// @route  POST /api/chats  (anzisha/pata chat 1-kwa-1)
router.post("/", protect, async (req, res) => {
  try {
    const { participantId } = req.body;
    if (!participantId) {
      return res.status(400).json({ message: "participantId inahitajika" });
    }

    let chat = await Chat.findOne({
      type: "direct",
      participants: { $all: [req.user._id, participantId], $size: 2 },
    }).populate(CHAT_POPULATE);

    if (!chat) {
      chat = await Chat.create({
        type: "direct",
        participants: [req.user._id, participantId],
      });
      chat = await chat.populate(CHAT_POPULATE);
    }

    res.status(201).json(chat);
  } catch (err) {
    res.status(500).json({ message: "Imeshindwa kuunda chat", error: err.message });
  }
});

// @route  POST /api/chats/group  (tengeneza group mpya)
router.post("/group", protect, async (req, res) => {
  try {
    const { name, avatarUrl, participantIds = [] } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Jina la group linahitajika" });
    }

    const participants = [
      ...new Set([...participantIds.map(String), req.user._id.toString()]),
    ];

    let chat = await Chat.create({
      type: "group",
      name,
      avatarUrl: avatarUrl || "",
      owner: req.user._id,
      admins: [req.user._id],
      participants,
    });

    chat = await chat.populate(CHAT_POPULATE);
    res.status(201).json(chat);
  } catch (err) {
    res.status(500).json({ message: "Imeshindwa kuunda group", error: err.message });
  }
});

// @route  POST /api/chats/channel  (tengeneza channel mpya — mmiliki ndiye admin wa kwanza)
router.post("/channel", protect, async (req, res) => {
  try {
    const { name, description, avatarUrl } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Jina la channel linahitajika" });
    }

    let chat = await Chat.create({
      type: "channel",
      name,
      description: description || "",
      avatarUrl: avatarUrl || "",
      owner: req.user._id,
      admins: [req.user._id],
      participants: [req.user._id],
    });

    chat = await chat.populate(CHAT_POPULATE);
    res.status(201).json(chat);
  } catch (err) {
    res.status(500).json({ message: "Imeshindwa kuunda channel", error: err.message });
  }
});

// @route  POST /api/chats/:id/subscribe  (jiunge na channel)
router.post("/:id/subscribe", protect, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat || chat.type !== "channel") {
      return res.status(404).json({ message: "Channel haijapatikana" });
    }

    if (!chat.participants.some((p) => p.equals(req.user._id))) {
      chat.participants.push(req.user._id);
      await chat.save();
    }

    const populated = await chat.populate(CHAT_POPULATE);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: "Imeshindwa kujiunga na channel", error: err.message });
  }
});

// @route  DELETE /api/chats/:id/subscribe  (toka kwenye channel)
router.delete("/:id/subscribe", protect, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat || chat.type !== "channel") {
      return res.status(404).json({ message: "Channel haijapatikana" });
    }

    chat.participants = chat.participants.filter((p) => !p.equals(req.user._id));
    await chat.save();

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: "Imeshindwa kutoka kwenye channel", error: err.message });
  }
});

// @route  PUT /api/chats/:id/members  (group: ongeza/toa wanachama — admin pekee)
router.put("/:id/members", protect, async (req, res) => {
  try {
    const { add = [], remove = [] } = req.body;
    const chat = await Chat.findById(req.params.id);
    if (!chat || chat.type !== "group") {
      return res.status(404).json({ message: "Group haijapatikana" });
    }

    if (!chat.admins.some((a) => a.equals(req.user._id))) {
      return res.status(403).json({ message: "Admin pekee ndiye anaweza kubadilisha wanachama" });
    }

    const current = new Set(chat.participants.map((p) => p.toString()));
    add.forEach((id) => current.add(String(id)));
    remove.forEach((id) => current.delete(String(id)));
    chat.participants = Array.from(current);

    await chat.save();
    const populated = await chat.populate(CHAT_POPULATE);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: "Imeshindwa kusasisha wanachama", error: err.message });
  }
});

// @route  GET /api/chats/:id
router.get("/:id", protect, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id).populate(CHAT_POPULATE);
    if (!chat) return res.status(404).json({ message: "Chat haijapatikana" });
    res.json(chat);
  } catch (err) {
    res.status(500).json({ message: "Hitilafu server", error: err.message });
  }
});

module.exports = router;
