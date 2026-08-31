const jwt = require("jsonwebtoken");
const User = require("./models-User");
const Message = require("./models-Message");
const Chat = require("./models-Chat");

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

        const message = await Message.create({
          chat: chatId,
          sender: socket.userId,
          content,
          type,
          replyTo: replyTo || null,
        });

        await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id });

        const populated = await message.populate("sender", "username displayName avatarUrl");

        io.to(chatId).emit("new_message", populated);
        if (callback) callback({ status: "ok", message: populated });
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
