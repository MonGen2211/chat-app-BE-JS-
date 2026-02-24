import express from "express";

import { protectedRoute } from "../middleware/protectedRoute.js";
import { createGroup, getGroup, getMessageGroup, sendMessageGroup } from "../controllers/group.controller.js";

const router = express.Router();

router.post("/", protectedRoute, createGroup);
router.get("/", protectedRoute, getGroup);
router.get("/:id", protectedRoute, getMessageGroup);
router.post("/sendMessage/:id", protectedRoute, sendMessageGroup);


export default router;
