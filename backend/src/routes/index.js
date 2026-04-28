import { Router } from "express";
import healthRoutes from "./health.routes.js";
import escrowRoutes from "./escrow.routes.js";
import uploadRoutes from "./upload.routes.js";
import insuranceRoutes from "./insurance.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/escrow", escrowRoutes);
router.use("/upload", uploadRoutes);
router.use("/insurance", insuranceRoutes);

export default router;
