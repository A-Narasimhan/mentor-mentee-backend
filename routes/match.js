const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect } = require("../middleware/auth");

// Smart matching score algorithm
const calculateMatchScore = (mentee, mentor) => {
  let score = 0;

  // Common skills: +2 each
  const commonSkills = mentee.skills.filter((s) =>
    mentor.skills.map((m) => m.toLowerCase()).includes(s.toLowerCase())
  );
  score += commonSkills.length * 2;

  // Common interests: +1 each
  const commonInterests = mentee.interests.filter((i) =>
    mentor.interests.map((m) => m.toLowerCase()).includes(i.toLowerCase())
  );
  score += commonInterests.length;

  // Experience gap bonus (mentor should be more experienced)
  const levels = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
  const mentorLevel = levels[mentor.experienceLevel] || 1;
  const menteeLevel = levels[mentee.experienceLevel] || 1;
  const gap = mentorLevel - menteeLevel;
  if (gap > 0) score += gap; // Positive gap = mentor is more experienced

  // Domain match: +3
  if (mentor.domain && mentee.interests.some((i) => i.toLowerCase().includes(mentor.domain.toLowerCase()))) {
    score += 3;
  }

  // Rating bonus
  score += mentor.rating * 0.5;

  return { mentor, score, commonSkills, commonInterests };
};

// GET /api/match/recommendations
router.get("/recommendations", protect, async (req, res) => {
  try {
    const canGetRecommendations =
  req.user.role === "mentee" ||
  req.user.role === "both" ||
  (req.user.roles && req.user.roles.includes("mentee"));

if (!canGetRecommendations) {
  return res.status(403).json({ message: "Only mentees can get recommendations" });
}

    const mentors = await User.find({
      $or: [{ role: "mentor" }, { role: "both" }, { roles: "mentor" }],
      isAvailable: true,
      _id: { $ne: req.user._id },
    }).select("-password");
    const scored = mentors
      .map((mentor) => calculateMatchScore(req.user, mentor))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    res.json(scored);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
