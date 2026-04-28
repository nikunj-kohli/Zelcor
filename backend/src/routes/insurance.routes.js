import { Router } from "express";
import {
  createInsuranceClaim,
  getInsuranceClaims,
  getInsurancePolicies,
  buyInsurancePolicy,
  buyInsurancePolicyDemo,
  getInsurancePurchases,
  clearInsuranceClaims,
  cancelInsurancePurchase,
  createInsuranceOrder,
  respondToInsuranceClaim,
} from "../controllers/insurance.controller.js";

const router = Router();

router.get("/claims", getInsuranceClaims);
router.post("/claim", createInsuranceClaim);
router.get("/policies", getInsurancePolicies);
router.post("/create-order", createInsuranceOrder);
router.post("/buy", buyInsurancePolicy);
router.post("/buy-demo", buyInsurancePolicyDemo);
router.get("/purchases", getInsurancePurchases);
router.post("/cancel", cancelInsurancePurchase);
router.delete("/claims/clear", clearInsuranceClaims);
router.post("/respond", respondToInsuranceClaim);

export default router;
