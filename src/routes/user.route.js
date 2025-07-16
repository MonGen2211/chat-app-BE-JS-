import express from "express";
import {
  check,
  login,
  logout,
  signup,
  updateProfile,
} from "../controllers/user.controller.js";
import { protectedRoute } from "../middleware/protectedRoute.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.get("/check", protectedRoute, check);
router.put("/update-profilefic", protectedRoute, updateProfile);

export default router;
