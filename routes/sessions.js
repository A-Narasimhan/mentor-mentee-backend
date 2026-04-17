const express = require("express");
const router = express.Router();
const Session = require("../models/Session");
const { protect } = require("../middleware/auth");

// POST /api/sessions — book a session (mentee)
router.post("/", protect, async (req, res) => {
  try {
    const isMentee =
  req.user.role === "mentee" ||
  req.user.role === "both" ||
  (req.user.roles && req.user.roles.includes("mentee"));

if (!isMentee)
  return res.status(403).json({ message: "Only mentees can book sessions" });

    const { mentorId, title, description, scheduledAt, duration } = req.body;
    const session = await Session.create({
      mentor: mentorId,
      mentee: req.user._id,
      title,
      description,
      scheduledAt,
      duration: duration || 60,
    });
    await session.populate(["mentor", "mentee"]);
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sessions/my — get my sessions
router.get("/my", protect, async (req, res) => {
  try {
    const isBoth =
      req.user.role === "both" ||
      (req.user.roles && req.user.roles.includes("mentor") && req.user.roles.includes("mentee"));

    let query;
    if (isBoth) {
      query = { $or: [{ mentor: req.user._id }, { mentee: req.user._id }] };
    } else if (req.user.role === "mentor") {
      query = { mentor: req.user._id };
    } else {
      query = { mentee: req.user._id };
    }

    const sessions = await Session.find(query)
      .populate("mentor", "-password")
      .populate("mentee", "-password")
      .sort({ createdAt: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/sessions/:id — update session status (mentor)
router.put("/:id", protect, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.mentor.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorized" });

    session.status = req.body.status || session.status;
    session.meetLink = req.body.meetLink || session.meetLink;
    await session.save();
    await session.populate(["mentor", "mentee"]);
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
