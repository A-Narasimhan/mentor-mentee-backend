const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect } = require("../middleware/auth");

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

  // Experience gap bonus
  const levels = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
  const mentorLevel = levels[mentor.experienceLevel] || 1;
  const menteeLevel = levels[mentee.experienceLevel] || 1;
  const gap = mentorLevel - menteeLevel;
  if (gap > 0) score += gap;

  // Domain match: +3
  if (
    mentor.domain &&
    mentee.interests.some((i) =>
      i.toLowerCase().includes(mentor.domain.toLowerCase())
    )
  ) {
    score += 3;
  }

  // ─────────────────────────────────────────────────────────
  // FIX 1 OF 3 — Guard against undefined rating
  // ─────────────────────────────────────────────────────────
  // REMOVE: score += mentor.rating * 0.5;
  // REPLACE WITH:
  score += (mentor.rating || 0) * 0.5;
  // WHY: If mentor.rating is undefined or null, multiplying by 0.5
  // produces NaN. NaN spreads — once score is NaN, sort() breaks
  // because NaN compared to any number returns false both ways,
  // making the sort order random/wrong.
  // ─────────────────────────────────────────────────────────

  return { mentor, score, commonSkills, commonInterests };
};

// ─────────────────────────────────────────────────────────
// FIX 2 OF 3 — Score normalization helper
// ─────────────────────────────────────────────────────────
// ADD this new function (did not exist before):
const normalizeScores = (scoredList) => {
  if (scoredList.length === 0) return [];
  const maxScore = Math.max(...scoredList.map((s) => s.score));
  // If every mentor scored 0 (mentee has no skills/interests yet),
  // avoid division by zero and just return 0% for all.
  if (maxScore === 0) {
    return scoredList.map((s) => ({ ...s, matchPercent: 0 }));
  }
  return scoredList.map((s) => ({
    ...s,
    // Round to nearest integer, cap at 100
    matchPercent: Math.min(Math.round((s.score / maxScore) * 100), 100),
  }));
};
// WHY: Raw scores (7, 12, 3) are meaningless to display as "%".
// Normalizing makes the highest-scoring mentor = 100% and all others
// proportional. This is exactly how your UI formula implies it should work.
// ─────────────────────────────────────────────────────────

router.get("/recommendations", protect, async (req, res) => {
  try {
    const canGetRecommendations =
      req.user.role === "mentee" ||
      req.user.role === "both" ||
      (req.user.roles && req.user.roles.includes("mentee"));

    if (!canGetRecommendations) {
      return res
        .status(403)
        .json({ message: "Only mentees can get recommendations" });
    }

    // ─────────────────────────────────────────────────────────
    // FIX 3 OF 3 — Wrong field name: isAvailable → availableForMentoring
    // ─────────────────────────────────────────────────────────
    // REMOVE:
    //   const mentors = await User.find({
    //     $or: [{ role: "mentor" }, { role: "both" }, { roles: "mentor" }],
    //     isAvailable: true,
    //     _id: { $ne: req.user._id },
    //   }).select("-password");
    //
    // REPLACE WITH:
    const mentors = await User.find({
      $or: [
        { role: "mentor" },
        { role: "both" },
        { roles: { $in: ["mentor"] } },
      ],
      availableForMentoring: true,   // ← was isAvailable (field does not exist)
      _id: { $ne: req.user._id },
    }).select("-password");
    // WHY: Your User model and users.js both use `availableForMentoring`.
    // Querying a field that doesn't exist in MongoDB returns 0 documents
    // silently — no error, just an empty array. This is why "For You"
    // showed nothing even when mentors existed in the database.
    // ─────────────────────────────────────────────────────────

    // Guard against mentee having empty skills/interests arrays
    // so .filter() inside calculateMatchScore doesn't crash
    const safeMentee = {
      ...req.user.toObject(),
      skills:    req.user.skills    || [],
      interests: req.user.interests || [],
    };

    const scored = mentors
      .map((mentor) => {
        // Guard mentor arrays too
        const safeMentor = mentor.toObject();
        safeMentor.skills    = safeMentor.skills    || [];
        safeMentor.interests = safeMentor.interests || [];
        return calculateMatchScore(safeMentee, safeMentor);
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // Apply normalization so frontend gets matchPercent directly
    const result = normalizeScores(scored);

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;