const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect } = require("../middleware/auth");

// GET /api/users/me
router.get("/me", protect, async (req, res) => {
  res.json(req.user);
});

// PUT /api/users/me
router.put("/me", protect, async (req, res) => {
  try {
    const updates = req.body;
    delete updates.password; // Never update password here
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/mentors — search & filter
router.get("/mentors", protect, async (req, res) => {
  try {
    const { skill, domain, experience, search } = req.query;
    const query = {
  $or: [{ role: "mentor" }, { role: "both" }, { roles: "mentor" }],
};

    if (skill) query.skills = { $in: [new RegExp(skill, "i")] };
    if (domain) query.domain = new RegExp(domain, "i");
    if (experience) query.experienceLevel = experience;
    if (search) query.name = new RegExp(search, "i");

    const mentors = await User.find(query).select("-password");
    res.json(mentors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/:id
router.get("/:id", protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
