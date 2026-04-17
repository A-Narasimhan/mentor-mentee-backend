const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect } = require("../middleware/auth");

// =====================================
// GET CURRENT USER
// GET /api/users/me
// =====================================
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// =====================================
// UPDATE PROFILE
// PUT /api/users/me
// =====================================
router.put("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Safe field updates
    user.name = req.body.name || user.name;
    user.bio = req.body.bio || user.bio;
    user.domain = req.body.domain || user.domain;
    user.experienceLevel =
      req.body.experienceLevel || user.experienceLevel;

    // Safe array handling
    user.skills = Array.isArray(req.body.skills)
      ? req.body.skills
      : user.skills;

    user.interests = Array.isArray(req.body.interests)
      ? req.body.interests
      : user.interests;

    user.roles = Array.isArray(req.body.roles)
      ? req.body.roles
      : user.roles;

    if (req.body.role) {
      user.role = req.body.role;
    }

    if (typeof req.body.availableForMentoring === "boolean") {
      user.availableForMentoring =
        req.body.availableForMentoring;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      roles: updatedUser.roles,
      bio: updatedUser.bio,
      domain: updatedUser.domain,
      experienceLevel: updatedUser.experienceLevel,
      skills: updatedUser.skills,
      interests: updatedUser.interests,
      availableForMentoring:
        updatedUser.availableForMentoring,
    });
  } catch (err) {
    console.error("PROFILE UPDATE ERROR:", err);

    res.status(500).json({
      message: err.message,
    });
  }
});

// =====================================
// GET MENTORS
// GET /api/users/mentors
// =====================================
router.get("/mentors", protect, async (req, res) => {
  try {
    const { skill, domain, experience, search } = req.query;

    const query = {
      $or: [
        { role: "mentor" },
        { role: "both" },
        { roles: "mentor" },
      ],
    };

    if (skill) {
      query.skills = {
        $in: [new RegExp(skill, "i")],
      };
    }

    if (domain) {
      query.domain = new RegExp(domain, "i");
    }

    if (experience) {
      query.experienceLevel = experience;
    }

    if (search) {
      query.name = new RegExp(search, "i");
    }

    const mentors = await User.find(query).select("-password");

    res.json(mentors);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// =====================================
// GET USER BY ID
// GET /api/users/:id
// =====================================
router.get("/:id", protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

module.exports = router;