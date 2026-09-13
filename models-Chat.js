const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    // "direct" (1-kwa-1), "group", au "channel" — hii ndiyo field ambayo
    // app ya Kotlin inaitumia kutofautisha aina ya chat (Chat.kt -> type)
    type: {
      type: String,
      enum: ["direct", "group", "channel"],
      default: "direct",
    },
    name: {
      type: String,
      default: "",
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    // Mmiliki wa group/channel (aliyeiunda)
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Kwa "direct": washiriki wawili. Kwa "group": wanachama.
    // Kwa "channel": wale waliojisajili (subscribers).
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    // Kwa group: wanaoweza kusimamia wanachama. Kwa channel: wanaoweza kutuma ujumbe.
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", chatSchema);
