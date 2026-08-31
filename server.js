require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const initSocket = require("./socket");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const chatRoutes = require("./routes/chats");
const messageRoutes = require("./routes/messages");

const app = express();
const server = http.createServer(app);

// Socket.io — CORS wazi ili app ya Kotlin (na majaribio ya wavuti) iweze kuunganika
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Unganisha MongoDB (angalia config/db.js kwa maelekezo ya kujaza)
connectDB();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);

// Health check — muhimu kwa Render kuthibitisha server iko hai
app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "DarkX Chat Server inafanya kazi ✅",
    time: new Date().toISOString(),
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Socket.io events
initSocket(io);

// Error handler ya jumla
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Hitilafu isiyotarajiwa ya server" });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[SERVER] 🚀 Inaendesha kwenye port ${PORT}`);
});
