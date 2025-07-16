import express from "express";
import {
  getMessage,
  getUsers,
  sendMessage,
} from "../controllers/message.controller.js";
import { protectedRoute } from "../middleware/protectedRoute.js";

const router = express.Router();

router.get("/users", protectedRoute, getUsers);
router.get("/:id", protectedRoute, getMessage);
router.post("/sendMessage/:id", protectedRoute, sendMessage);
export default router;
