import { Router } from "express";
import {
  createInsuranceClaim,
  getInsuranceClaims,
} from "../controllers/insurance.controller.js";

const router = Router();

router.get("/claims", getInsuranceClaims);
router.post("/claim", createInsuranceClaim);

export default router;
