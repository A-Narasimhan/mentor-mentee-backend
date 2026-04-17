const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

// ✅ FIX 1: Flexible CORS (important for deployment)
const allowedOrigin = process.env.CLIENT_URL || "*";

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: allowedOrigin
}));
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ✅ FIX 2: Root route (for testing deployment)
app.get("/", (req, res) => {
  res.send("Backend is running successfully 🚀");
});

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/match", require("./routes/match"));
app.use("/api/sessions", require("./routes/sessions"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/reviews", require("./routes/reviews"));

// Socket.io for real-time chat
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (userId) => {
    const id = userId.toString();
    onlineUsers.set(id, socket.id);
    socket.join(id);
    console.log(`User ${id} joined room`);
  });

  socket.on("sendMessage", ({ senderId, receiverId, message }) => {
    const receiverRoom = receiverId.toString();
    const senderRoom = senderId.toString();

    console.log(`Message from ${senderRoom} to ${receiverRoom}: ${message}`);

    io.to(receiverRoom).emit("receiveMessage", {
      senderId: senderRoom,
      message,
      timestamp: new Date(),
    });
  });

  socket.on("disconnect", () => {
    onlineUsers.forEach((value, key) => {
      if (value === socket.id) onlineUsers.delete(key);
    });
    console.log("User disconnected:", socket.id);
  });
});

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");

    // ✅ FIX 3: Proper PORT handling
    const PORT = process.env.PORT || 5000;

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    // ✅ FIX 4: Better error visibility
    console.error("❌ MongoDB connection error:", err.message);
  });