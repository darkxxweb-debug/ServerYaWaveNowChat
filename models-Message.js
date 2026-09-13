const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "video", "audio", "document"],
      default: "text",
    },
    content: {
      type: String, // maandishi ya ujumbe, au URL ya media
      required: true,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    // Nani tayari amepokea na kuhifadhi ujumbe huu local kwenye simu yake.
    // Ukishafika kwa washiriki wote (isipokuwa mtumaji), ujumbe huu unafutwa
    // kwenye server DB — angalia routes-messages.js na socket-index.js.
    deliveredTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
