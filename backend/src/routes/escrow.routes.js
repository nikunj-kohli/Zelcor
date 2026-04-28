import { Router } from "express";
import { createEscrow } from "../controllers/escrow.controller.js";

const router = Router();

router.post("/create", createEscrow);

export default router;
