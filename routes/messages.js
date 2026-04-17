const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const { protect } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create uploads directory if it doesn't exist
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// POST /api/messages/send — text or emoji
router.post("/send", protect, async (req, res) => {
  try {
    const { receiverId, content, type } = req.body;
    if (!receiverId || !content)
      return res.status(400).json({ message: "receiverId and content required" });

    const message = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      content,
      type: type || "text",
    });
    await message.populate("sender", "name avatar");
    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/messages/upload — file or image
router.post("/upload", protect, upload.single("file"), async (req, res) => {
  try {
    const { receiverId } = req.body;
    if (!receiverId || !req.file)
      return res.status(400).json({ message: "receiverId and file required" });

    const isImage = req.file.mimetype.startsWith("image/");
    const fileUrl = `https://mentor-backend-8zgn.onrender.com/uploads/${req.file.filename}`;
    const fileSizeKB = (req.file.size / 1024).toFixed(1) + " KB";

    const message = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      content: isImage ? "📷 Image" : `📎 ${req.file.originalname}`,
      type: isImage ? "image" : "file",
      fileUrl,
      fileName: req.file.originalname,
      fileSize: fileSizeKB,
    });
    await message.populate("sender", "name avatar");
    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/messages/conversations — get all conversations
router.get("/conversations", protect, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [{ sender: req.user._id }, { receiver: req.user._id }],
    })
      .populate("sender", "name avatar role")
      .populate("receiver", "name avatar role")
      .sort({ createdAt: -1 });

    const seen = new Set();
    const conversations = [];
    for (const msg of messages) {
      const partner =
        msg.sender._id.toString() === req.user._id.toString()
          ? msg.receiver
          : msg.sender;
      if (!seen.has(partner._id.toString())) {
        seen.add(partner._id.toString());
        conversations.push({ partner, lastMessage: msg });
      }
    }
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/messages/:userId — get conversation with one user
router.get("/:userId", protect, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user._id },
      ],
    })
      .populate("sender", "name avatar")
      .sort({ createdAt: 1 });

    await Message.updateMany(
      { sender: req.params.userId, receiver: req.user._id, read: false },
      { read: true }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;