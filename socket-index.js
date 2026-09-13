const jwt = require("jsonwebtoken");
const User = require("./models-User");
const Message = require("./models-Message");
const Chat = require("./models-Chat");
const { sendPushToUsers } = require("./push");

/**
 * App ya Kotlin itaunganisha socket namna hii (Socket.IO Java/Kotlin client):
 *
 *   IO.Options options = new IO.Options();
 *   options.auth = Map.of("token", savedJwtToken);
 *   Socket socket = IO.socket("https://your-app.onrender.com", options);
 *   socket.connect();
 *
 * Token hiyo ndiyo ile iliyorudishwa kwenye /api/auth/login au /api/auth/register
 */
function initSocket(io) {
  // Middleware ya kuthibitisha token kabla ya kuruhusu connection
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Token haipo"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error("User hayupo"));

      socket.userId = user._id.toString();
      next();
    } catch (err) {
      next(new Error("Token si sahihi"));
    }
  });

  io.on("connection", async (socket) => {
    console.log(`[SOCKET] ✅ User ameungana: ${socket.userId}`);

    // Weka mtumiaji kuwa online
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      socketId: socket.id,
    });
    socket.broadcast.emit("user_online", { userId: socket.userId });

    // Jiunge na "rooms" za chats zake zote (ili apokee messages moja kwa moja)
    const chats = await Chat.find({ participants: socket.userId }).select("_id");
    chats.forEach((chat) => socket.join(chat._id.toString()));

    // --- EVENT: jiunge na chat mahususi (mfano akifungua chat mpya) ---
    socket.on("join_chat", (chatId) => {
      socket.join(chatId);
    });

    // --- EVENT: tuma ujumbe moja kwa moja kupitia socket ---
    socket.on("send_message", async (data, callback) => {
      try {
        const { chatId, content, type = "text", replyTo } = data;

        const chat = await Chat.findById(chatId);
        if (!chat) throw new Error("Chat haijapatikana");

        if (chat.type === "channel" && !chat.admins.some((a) => a.toString() === socket.userId)) {
          throw new Error("Admin/mmiliki pekee ndiye anaweza kutuma kwenye channel hii");
        }

        const message = await Message.create({
          chat: chatId,
          sender: socket.userId,
          content,
          type,
          replyTo: replyTo || null,
        });

        chat.lastMessage = message._id;
        await chat.save();

        const populated = await message.populate("sender", "username displayName avatarUrl");

        io.to(chatId).emit("new_message", populated);
        if (callback) callback({ status: "ok", message: populated });

        const recipients = chat.participants.filter((p) => p.toString() !== socket.userId);
        sendPushToUsers(recipients, {
          title: populated.sender.displayName || populated.sender.username,
          body: type === "text" ? content : `[${type}]`,
          data: { chatId: chatId.toString() },
        });
      } catch (err) {
        if (callback) callback({ status: "error", error: err.message });
      }
    });

    // --- EVENT: "anaandika..." indicator ---
    socket.on("typing", ({ chatId }) => {
      socket.to(chatId).emit("typing", { chatId, userId: socket.userId });
    });

    socket.on("stop_typing", ({ chatId }) => {
      socket.to(chatId).emit("stop_typing", { chatId, userId: socket.userId });
    });

    // --- EVENT: ujumbe umesomwa ---
    socket.on("message_read", async ({ messageId, chatId }) => {
      await Message.findByIdAndUpdate(messageId, {
        status: "read",
        $addToSet: { readBy: socket.userId },
      });
      socket.to(chatId).emit("message_read", { messageId, userId: socket.userId });
    });

    // --- EVENT: mpokeaji ameshahifadhi ujumbe local (Room DB) kwenye simu yake ---
    // Ukishafika kwa washiriki wote (isipokuwa mtumaji), tunaufuta kwenye server DB
    // na kumjulisha kila mtu kupitia "message_status".
    socket.on("message_delivered", async ({ messageId, chatId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        if (!message.deliveredTo.some((u) => u.toString() === socket.userId)) {
          message.deliveredTo.push(socket.userId);
          message.status = "delivered";
          await message.save();
        }

        const chat = await Chat.findById(chatId);
        if (!chat) return;

        const others = chat.participants.filter((p) => p.toString() !== message.sender.toString());
        const allDelivered = others.every((p) =>
          message.deliveredTo.some((d) => d.toString() === p.toString())
        );

        if (allDelivered) {
          await Message.findByIdAndDelete(messageId);
          io.to(chatId).emit("message_status", { messageId, status: "deleted" });
        } else {
          io.to(chatId).emit("message_status", { messageId, status: "delivered" });
        }
      } catch (err) {
        console.error("[SOCKET] message_delivered error:", err.message);
      }
    });

    // --- DISCONNECT: weka offline + lastSeen ---
    socket.on("disconnect", async () => {
      console.log(`[SOCKET] ❌ User ametoka: ${socket.userId}`);
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date(),
        socketId: null,
      });
      socket.broadcast.emit("user_offline", {
        userId: socket.userId,
        lastSeen: new Date(),
      });
    });
  });
}

module.exports = initSocket;
