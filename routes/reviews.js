const express = require("express");
const router = express.Router();
const Review = require("../models/Review");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

// POST /api/reviews
router.post("/", protect, async (req, res) => {
  try {
    const isMentee =
  req.user.role === "mentee" ||
  req.user.role === "both" ||
  (req.user.roles && req.user.roles.includes("mentee"));

if (!isMentee)
  return res.status(403).json({ message: "Only mentees can leave reviews" });

    const { mentorId, rating, comment } = req.body;

    const existing = await Review.findOne({ mentor: mentorId, mentee: req.user._id });
    if (existing) return res.status(400).json({ message: "You already reviewed this mentor" });

    const review = await Review.create({
      mentor: mentorId,
      mentee: req.user._id,
      rating,
      comment,
    });

    // Update mentor's average rating
    const allReviews = await Review.find({ mentor: mentorId });
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    await User.findByIdAndUpdate(mentorId, {
      rating: Math.round(avgRating * 10) / 10,
      totalReviews: allReviews.length,
    });

    await review.populate("mentee", "name avatar");
    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/reviews/:mentorId
router.get("/:mentorId", protect, async (req, res) => {
  try {
    const reviews = await Review.find({ mentor: req.params.mentorId })
      .populate("mentee", "name avatar")
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
