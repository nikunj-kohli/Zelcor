import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import axios from "axios";
import * as cheerio from "cheerio";
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// -------------------------
// Zelcor Rental Module (In-Memory)
// -------------------------
const rentalDemoStore = {
  rentalsById: {},
  rentalOrder: [],
  photosByRentalId: {},
  analysesByRentalId: {},
  settlementsByRentalId: {},
};

function sha256(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function rentalMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function rentalFromInput(input) {
  const deposit = rentalMoney(input.deposit ?? input.depositAmount);
  const ownerBondAmount = rentalMoney(input.ownerBondAmount ?? deposit * 0.5);
  return {
    id: input.id || `rental_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    propertyAddress: input.propertyAddress || input.property || "",
    tenantName: input.tenantName || input.tenant || "",
    landlordName: input.landlordName || input.landlord || "",
    depositAmount: deposit,
    ownerBondAmount,
    ownerBondStatus: "HELD",
    tenantWalletBalance: rentalMoney(input.tenantWalletBalance || 0),
    moveInDate: input.moveInDate || "",
    status: input.status || "READY",
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

function normalizeRentalLabel(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/\b(broken|cracked|crack|damaged|damage|stained|stain|burnt|burn|new|old|move|out|in)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreRentalPair(rental, moveInPhoto, moveOutPhoto) {
  if (!moveInPhoto) {
    return {
      status: "DAMAGE",
      deduction: Math.min(10000, rental.depositAmount * 0.1),
      confidence: 0.82,
      notes: "Move-out image has no matching move-in evidence.",
    };
  }

  if (moveInPhoto.expectedStatus || moveOutPhoto.expectedStatus) {
    const status = moveOutPhoto.expectedStatus || moveInPhoto.expectedStatus;
    return {
      status,
      deduction: status === "DAMAGE" ? Math.min(20000, rental.depositAmount * 0.2) : 0,
      confidence: 0.93,
      notes: "Demo evidence classification.",
    };
  }

  if (moveInPhoto.hash === moveOutPhoto.hash) {
    return {
      status: "PRE_EXISTING",
      deduction: 0,
      confidence: 0.98,
      notes: "Condition appears unchanged from move-in evidence.",
    };
  }

  const label = `${moveInPhoto.label} ${moveOutPhoto.label} ${moveOutPhoto.filename || ""}`.toLowerCase();
  const damageWords = ["broken", "crack", "damage", "stain", "burn", "leak", "hole", "appliance"];
  const hasDamageWord = damageWords.some((word) => label.includes(word));
  if (hasDamageWord) {
    return {
      status: "DAMAGE",
      deduction: Math.min(20000, Math.max(2000, rental.depositAmount * 0.08)),
      confidence: 0.86,
      notes: "New visible damage likely requires repair or replacement.",
    };
  }

  return {
    status: "WEAR_TEAR",
    deduction: 0,
    confidence: 0.78,
    notes: "Difference is treated as normal use without deposit deduction.",
  };
}

function normalizeAiStatus(value) {
  const normalized = String(value || "").toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized.includes("PRE")) return "PRE_EXISTING";
  if (normalized.includes("WEAR")) return "WEAR_TEAR";
  if (normalized.includes("DAMAGE") || normalized.includes("NEW")) return "DAMAGE";
  return "WEAR_TEAR";
}

function imageDataUriToBase64(image = "") {
  return String(image).includes(",") ? String(image).split(",").pop() : String(image);
}

function clampDeduction(value, fallbackValue) {
  const amount = rentalMoney(value);
  if (!Number.isFinite(amount) || amount < 0) return fallbackValue;
  return amount;
}

function roboflowDamageConfig() {
  return {
    endpoint:
      process.env.ROBOFLOW_DAMAGE_LEVEL_ENDPOINT ||
      process.env.ROBOFLOW_DAMAGE_ENDPOINT ||
      process.env.ROBOFLOW_ENDPOINT ||
      "",
    apiKey: process.env.ROBOFLOW_API_KEY || "",
  };
}

function parseDamageModelResult(raw, rental, moveOutPhoto, fallback) {
  const predictions = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.predictions)
      ? raw.predictions
      : [];
  const highestConfidence = predictions.reduce((max, prediction) => Math.max(max, Number(prediction.confidence || prediction.score || 0)), 0);
  const classes = predictions.map((prediction) => String(prediction.class || prediction.label || "").toLowerCase());
  const text = JSON.stringify(raw || {}).toLowerCase();
  const severityText = [...classes, text].join(" ");
  const severity = /severe|critical|heavy|high/.test(severityText)
    ? "severe"
    : /moderate|medium/.test(severityText)
      ? "moderate"
      : /minor|low|light/.test(severityText)
        ? "minor"
        : "";
  const hasDamage =
    classes.some((item) => /damage|crack|broken|stain|hole|leak|burn/.test(item)) ||
    /damage|crack|broken|stain|hole|leak|burn/.test(text) ||
    Boolean(severity);

  if (!hasDamage) {
    return {
      status: fallback.status === "PRE_EXISTING" ? "PRE_EXISTING" : "WEAR_TEAR",
      deduction: 0,
      confidence: highestConfidence || fallback.confidence,
      notes: "Roboflow damage-level model did not detect chargeable damage.",
      modelSource: "roboflow-damage-level",
    };
  }

  const fallbackDamage = Math.min(20000, Math.max(2000, rental.depositAmount * 0.08));
  const severityDeduction =
    severity === "severe"
      ? Math.min(rental.depositAmount, Math.max(fallbackDamage, rental.depositAmount * 0.2))
      : severity === "moderate"
        ? Math.min(rental.depositAmount, Math.max(fallbackDamage, rental.depositAmount * 0.12))
        : severity === "minor"
          ? Math.min(rental.depositAmount, Math.max(1000, rental.depositAmount * 0.04))
          : fallbackDamage;

  return {
    status: "DAMAGE",
    deduction: clampDeduction(raw?.deduction || raw?.deductionAmount, severityDeduction),
    confidence: highestConfidence || Number(raw?.confidence || fallback.confidence || 0.85),
    notes: raw?.notes || `Roboflow damage-level model detected ${severity || "possible"} damage for ${moveOutPhoto.label}.`,
    modelSource: "roboflow-damage-level",
  };
}

async function analyzeRentalPairWithConfiguredImageModel(rental, moveOutPhoto, fallback) {
  const { endpoint: roboflowEndpoint, apiKey: roboflowKey } = roboflowDamageConfig();
  if (roboflowEndpoint && roboflowKey) {
    try {
      const separator = roboflowEndpoint.includes("?") ? "&" : "?";
      const response = await axios.post(
        `${roboflowEndpoint}${separator}api_key=${encodeURIComponent(roboflowKey)}`,
        imageDataUriToBase64(moveOutPhoto.image),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 20000 }
      );
      return parseDamageModelResult(response.data, rental, moveOutPhoto, fallback);
    } catch (error) {
      const status = error.response?.status ? ` (${error.response.status})` : "";
      const detail = error.response?.data?.message || error.response?.data?.error || error.message;
      console.error(`Rental Roboflow damage-level fallback${status}: ${detail}`);
    }
  }

  const huggingFaceModel = process.env.HUGGINGFACE_IMAGE_MODEL;
  const huggingFaceKey = process.env.HUGGINGFACE_API_KEY;
  if (huggingFaceModel && huggingFaceKey) {
    try {
      const modelUrl = huggingFaceModel.startsWith("http")
        ? huggingFaceModel
        : `https://api-inference.huggingface.co/models/${huggingFaceModel}`;
      const response = await axios.post(
        modelUrl,
        Buffer.from(imageDataUriToBase64(moveOutPhoto.image), "base64"),
        {
          headers: {
            Authorization: `Bearer ${huggingFaceKey}`,
            "Content-Type": "application/octet-stream",
          },
          timeout: 30000,
        }
      );
      return parseDamageModelResult(response.data, rental, moveOutPhoto, fallback);
    } catch (error) {
      console.error("Rental HuggingFace comparison fallback:", error.message);
    }
  }

  return null;
}

async function analyzeRentalPairWithConfiguredTextModel(rental, moveInPhoto, moveOutPhoto, fallback) {
  if (!aiApiKey || !openai) return null;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            "You are Zelcor's rental checkout comparison model.",
            "Classify the move-out item as PRE_EXISTING, WEAR_TEAR, or DAMAGE and estimate a fair deduction.",
            "Use strict JSON with keys: status, deduction, confidence, notes.",
            "Rules: identical hashes mean PRE_EXISTING with deduction 0. Normal ageing is WEAR_TEAR with deduction 0. New broken/cracked/stained/leaking items are DAMAGE.",
            `Deposit amount: ${rental.depositAmount}. Owner bond: ${rental.ownerBondAmount}.`,
            `Move-in evidence: ${JSON.stringify({
              label: moveInPhoto?.label || null,
              filename: moveInPhoto?.filename || null,
              hash: moveInPhoto?.hash || null,
              timestamp: moveInPhoto?.timestamp || null,
            })}.`,
            `Move-out evidence: ${JSON.stringify({
              label: moveOutPhoto.label,
              filename: moveOutPhoto.filename,
              hash: moveOutPhoto.hash,
              timestamp: moveOutPhoto.timestamp,
            })}.`,
            `Deterministic baseline: ${JSON.stringify(fallback)}.`,
          ].join(" "),
        },
      ],
    });

    const parsed = JSON.parse(response.choices?.[0]?.message?.content || "{}");
    return {
      status: normalizeAiStatus(parsed.status),
      deduction: clampDeduction(parsed.deduction, fallback.deduction),
      confidence: Number(parsed.confidence || fallback.confidence || 0.8),
      notes: parsed.notes || fallback.notes,
      modelSource: AI_MODEL,
    };
  } catch (error) {
    console.error("Rental configured text model fallback:", error.message);
    return null;
  }
}

async function analyzeRentalPairWithAi(rental, moveInPhoto, moveOutPhoto, fallback) {
  const configuredModelResult = await analyzeRentalPairWithConfiguredImageModel(rental, moveOutPhoto, fallback);
  if (configuredModelResult) return configuredModelResult;

  const canUseVisionModel = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "test-key";
  if (!canUseVisionModel || !openai) {
    const textModelResult = await analyzeRentalPairWithConfiguredTextModel(rental, moveInPhoto, moveOutPhoto, fallback);
    return textModelResult || { ...fallback, modelSource: "deterministic-fallback" };
  }

  try {
    const prompt = [
      "You are a rental security deposit inspection assistant.",
      "Compare the move-in and move-out evidence and return strict JSON only.",
      "Allowed status values: PRE_EXISTING, WEAR_TEAR, DAMAGE.",
      "PRE_EXISTING and WEAR_TEAR should have deduction 0 unless a repair is clearly justified.",
      `Deposit amount: ${rental.depositAmount}.`,
      `Inspection label: ${moveOutPhoto.label}.`,
    ].join(" ");

    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...(moveInPhoto?.image
              ? [{ type: "image_url", image_url: { url: moveInPhoto.image } }]
              : []),
            { type: "image_url", image_url: { url: moveOutPhoto.image } },
          ],
        },
      ],
    });

    const parsed = JSON.parse(response.choices?.[0]?.message?.content || "{}");
    return {
      status: normalizeAiStatus(parsed.status),
      deduction: Math.max(0, rentalMoney(parsed.deduction)),
      confidence: Number(parsed.confidence || fallback.confidence || 0.8),
      notes: parsed.notes || fallback.notes,
      modelSource: "openai-vision",
    };
  } catch (error) {
    console.error("Rental AI analysis fallback:", error.message);
    const textModelResult = await analyzeRentalPairWithConfiguredTextModel(rental, moveInPhoto, moveOutPhoto, fallback);
    return textModelResult || { ...fallback, modelSource: "deterministic-fallback" };
  }
}

function preloadRentalDemoData() {
  const demo = rentalFromInput({
    id: "rental_demo_maple",
    propertyAddress: "A-1204, Maple Residency, Pune",
    tenantName: "Riya Sharma",
    landlordName: "Arjun Mehta",
    depositAmount: 100000,
    moveInDate: "2026-01-10",
    status: "READY",
  });

  rentalDemoStore.rentalsById[demo.id] = demo;
  rentalDemoStore.rentalOrder = [demo.id];
  rentalDemoStore.photosByRentalId[demo.id] = [];
}

preloadRentalDemoData();

function getRentalBundle(rentalId) {
  updateOverdueSettlement(rentalId);
  return {
    rental: rentalDemoStore.rentalsById[rentalId] || null,
    photos: rentalDemoStore.photosByRentalId[rentalId] || [],
    analysis: rentalDemoStore.analysesByRentalId[rentalId] || null,
    settlement: rentalDemoStore.settlementsByRentalId[rentalId] || null,
  };
}

function buildRentalSummary() {
  for (const id of rentalDemoStore.rentalOrder) updateOverdueSettlement(id);

  const rentals = rentalDemoStore.rentalOrder
    .map((id) => rentalDemoStore.rentalsById[id])
    .filter(Boolean);

  return rentals.reduce(
    (summary, rental) => {
      const analysis = rentalDemoStore.analysesByRentalId[rental.id];
      const settlement = rentalDemoStore.settlementsByRentalId[rental.id];
      summary.totalRentals += 1;
      summary.activeRentals += rental.status === "ACTIVE" ? 1 : 0;
      summary.completedRentals += rental.status === "COMPLETED" ? 1 : 0;
      summary.totalDeposit += Number(rental.depositAmount || 0);
      summary.ownerBondHeld += Number(rental.ownerBondAmount || 0);
      summary.totalDeduction += Number(analysis?.totalDeduction || settlement?.totalDeduction || 0);
      summary.totalRefund += Number(analysis?.refund || settlement?.refund || 0);
      summary.tenantWalletBalance += Number(rental.tenantWalletBalance || 0);
      return summary;
    },
    {
      totalRentals: 0,
      activeRentals: 0,
      completedRentals: 0,
      totalDeposit: 0,
      ownerBondHeld: 0,
      totalDeduction: 0,
      totalRefund: 0,
      tenantWalletBalance: 0,
    }
  );
}

function startOwnerReviewClock(rental) {
  if (rental.reviewStartedAt && rental.reviewDeadline) return;
  const reviewStartedAt = new Date().toISOString();
  rental.reviewStartedAt = reviewStartedAt;
  rental.reviewDeadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
}

function createOwnerReviewSettlement(rental, analysis) {
  startOwnerReviewClock(rental);
  const ownerDueAmount = analysis.refund;
  const bondDeductionAmount = Math.min(rental.ownerBondAmount, ownerDueAmount);
  return {
    id: `settlement_${Date.now()}`,
    rentalId: rental.id,
    status: "OWNER_REVIEW",
    ownerPaymentStatus: "PENDING",
    transferStatus: "AWAITING_OWNER_PAYMENT",
    deposit: rental.depositAmount,
    ownerBondAmount: rental.ownerBondAmount,
    totalDeduction: analysis.totalDeduction,
    refund: analysis.refund,
    ownerDueAmount,
    bondDeductionAmount,
    shortfallAmount: rentalMoney(Math.max(0, ownerDueAmount - bondDeductionAmount)),
    reviewStartedAt: rental.reviewStartedAt,
    reviewDeadline: rental.reviewDeadline,
    tenantWalletCredited: false,
    tenantWalletCreditAmount: 0,
    createdAt: new Date().toISOString(),
  };
}

function updateOverdueSettlement(rentalId, force = false) {
  const settlement = rentalDemoStore.settlementsByRentalId[rentalId];
  const rental = rentalDemoStore.rentalsById[rentalId];
  if (!settlement || !rental || settlement.status !== "OWNER_REVIEW") return settlement;
  if (!force && Date.now() <= new Date(settlement.reviewDeadline).getTime()) return settlement;

  settlement.status = "AUTO_DEDUCTED";
  settlement.ownerPaymentStatus = "OVERDUE";
  settlement.transferStatus = "CREDITED_TO_TENANT_WALLET";
  settlement.autoDeductedAt = new Date().toISOString();
  settlement.transferredToTenant = settlement.bondDeductionAmount;
  settlement.tenantWalletCredited = true;
  settlement.tenantWalletCreditAmount = settlement.bondDeductionAmount;
  settlement.tenantWalletCreditedAt = new Date().toISOString();
  rental.ownerBondAmount = rentalMoney(Math.max(0, rental.ownerBondAmount - settlement.bondDeductionAmount));
  rental.ownerBondStatus = rental.ownerBondAmount > 0 ? "PARTIALLY_DEDUCTED" : "DEDUCTED";
  rental.tenantWalletBalance = rentalMoney(Number(rental.tenantWalletBalance || 0) + settlement.bondDeductionAmount);
  rental.status = "COMPLETED";
  return settlement;
}

function saveRentalPhotos(rentalId, phase, photos) {
  const prepared = photos.map((photo, index) => {
    const image = photo.image || photo.content || photo.url;
    return {
      id: `photo_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
      rentalId,
      phase,
      label: photo.label || "General",
      image,
      hash: sha256(image),
      timestamp: photo.timestamp || new Date().toISOString(),
      filename: photo.filename || `inspection-${index + 1}.jpg`,
    };
  });

  rentalDemoStore.photosByRentalId[rentalId] = [
    ...(rentalDemoStore.photosByRentalId[rentalId] || []).filter((photo) => photo.phase !== phase),
    ...prepared,
  ];

  return prepared;
}

// Public runtime config for frontend (safe values only)
app.get("/api/public-config", (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  });
});

app.get("/rental-api/rentals", (_req, res) => {
  const rentals = rentalDemoStore.rentalOrder
    .map((id) => rentalDemoStore.rentalsById[id])
    .filter(Boolean);

  res.json({ success: true, rentals, summary: buildRentalSummary() });
});

app.get("/rental-api/rentals/:id", (req, res) => {
  const bundle = getRentalBundle(req.params.id);
  if (!bundle.rental) return res.status(404).json({ success: false, error: "Rental not found." });
  res.json({ success: true, ...bundle });
});

app.post("/rental-api/rentals", (req, res) => {
  const rental = rentalFromInput(req.body || {});
  if (!rental.propertyAddress || !rental.tenantName || !rental.landlordName || !rental.depositAmount || !rental.moveInDate) {
    return res.status(400).json({ success: false, error: "Property address, tenant, landlord, deposit, and move-in date are required." });
  }

  rentalDemoStore.rentalsById[rental.id] = rental;
  rentalDemoStore.rentalOrder.unshift(rental.id);
  rentalDemoStore.photosByRentalId[rental.id] = [];
  rentalDemoStore.analysesByRentalId[rental.id] = null;
  rentalDemoStore.settlementsByRentalId[rental.id] = null;

  res.json({ success: true, rental });
});

app.post("/rental-api/rentals/:id/inspection", (req, res) => {
  const rental = rentalDemoStore.rentalsById[req.params.id];
  if (!rental) return res.status(404).json({ success: false, error: "Rental not found." });

  const { phase, photos } = req.body || {};
  if (!["move-in", "move-out"].includes(phase) || !Array.isArray(photos) || photos.length === 0) {
    return res.status(400).json({ success: false, error: "phase and photos[] are required." });
  }

  const prepared = saveRentalPhotos(rental.id, phase, photos);
  if (phase === "move-in") rental.status = "ACTIVE";
  if (phase === "move-out") {
    rental.status = "READY";
    startOwnerReviewClock(rental);
  }
  rentalDemoStore.analysesByRentalId[rental.id] = null;
  rentalDemoStore.settlementsByRentalId[rental.id] = null;

  res.json({ success: true, rental, photos: prepared });
});

app.post("/rental-api/rentals/:id/analyze", async (req, res) => {
  const rental = rentalDemoStore.rentalsById[req.params.id];
  if (!rental) return res.status(404).json({ success: false, error: "Rental not found." });

  const photos = rentalDemoStore.photosByRentalId[rental.id] || [];
  const moveIns = photos.filter((photo) => photo.phase === "move-in");
  const moveOuts = photos.filter((photo) => photo.phase === "move-out");
  if (!moveIns.length || !moveOuts.length) {
    return res.status(400).json({ success: false, error: "Move-in and move-out photos are required before analysis." });
  }

  const reports = [];
  const usedMoveInIds = new Set();
  for (const moveOutPhoto of moveOuts) {
    const normalizedMoveOut = normalizeRentalLabel(moveOutPhoto.label);
    const moveInPhoto =
      moveIns.find((photo) => !usedMoveInIds.has(photo.id) && normalizeRentalLabel(photo.label) === normalizedMoveOut) ||
      moveIns.find((photo) => !usedMoveInIds.has(photo.id) && normalizeRentalLabel(photo.label) && normalizedMoveOut.includes(normalizeRentalLabel(photo.label))) ||
      moveIns.find((photo) => !usedMoveInIds.has(photo.id)) ||
      null;
    if (moveInPhoto) usedMoveInIds.add(moveInPhoto.id);
    const fallback = scoreRentalPair(rental, moveInPhoto, moveOutPhoto);
    const result = await analyzeRentalPairWithAi(rental, moveInPhoto, moveOutPhoto, fallback);
    reports.push({
      id: `report_${moveOutPhoto.id}`,
      label: moveOutPhoto.label,
      moveInPhotoId: moveInPhoto?.id || null,
      moveOutPhotoId: moveOutPhoto.id,
      status: result.status,
      deduction: rentalMoney(result.deduction),
      confidence: result.confidence,
      notes: result.notes,
      modelSource: result.modelSource || "deterministic-fallback",
    });
  }

  const totalDeduction = Math.min(
    rental.depositAmount,
    reports.reduce((sum, report) => sum + Number(report.deduction || 0), 0)
  );

  const analysis = {
    id: `rental_analysis_${Date.now()}`,
    rentalId: rental.id,
    createdAt: new Date().toISOString(),
    reports,
    totalDeduction,
    refund: rentalMoney(rental.depositAmount - totalDeduction),
    model: reports.find((report) => report.modelSource !== "deterministic-fallback")?.modelSource || "deterministic-fallback",
  };
  rentalDemoStore.analysesByRentalId[rental.id] = analysis;
  rentalDemoStore.settlementsByRentalId[rental.id] = createOwnerReviewSettlement(rental, analysis);
  updateOverdueSettlement(rental.id);

  res.json({ success: true, analysis, settlement: rentalDemoStore.settlementsByRentalId[rental.id] });
});

app.post("/rental-api/rentals/:id/owner-payment", (req, res) => {
  const rental = rentalDemoStore.rentalsById[req.params.id];
  if (!rental) return res.status(404).json({ success: false, error: "Rental not found." });

  const settlement = rentalDemoStore.settlementsByRentalId[rental.id];
  if (!settlement) return res.status(400).json({ success: false, error: "Run analysis before marking payment." });
  if (settlement.status !== "OWNER_REVIEW") {
    return res.status(400).json({ success: false, error: "Owner review is no longer pending." });
  }

  settlement.status = "OWNER_PAID";
  settlement.ownerPaymentStatus = "PAID";
  settlement.transferStatus = "PAID_DIRECTLY_BY_OWNER";
  settlement.ownerPaidAt = new Date().toISOString();
  settlement.transferredToTenant = settlement.ownerDueAmount;
  rental.status = "COMPLETED";

  res.json({ success: true, rental, settlement });
});

app.post("/rental-api/rentals/:id/auto-deduct", (req, res) => {
  const rental = rentalDemoStore.rentalsById[req.params.id];
  if (!rental) return res.status(404).json({ success: false, error: "Rental not found." });

  const settlement = rentalDemoStore.settlementsByRentalId[rental.id];
  if (!settlement) return res.status(400).json({ success: false, error: "Run analysis before auto deduction." });
  if (settlement.status !== "OWNER_REVIEW") {
    return res.status(400).json({ success: false, error: "Owner review is no longer pending." });
  }
  if (Date.now() <= new Date(settlement.reviewDeadline).getTime() && !req.body?.force) {
    return res.status(400).json({ success: false, error: "The 2-day owner review period is still active." });
  }

  const updated = updateOverdueSettlement(rental.id, true);
  res.json({ success: true, rental, settlement: updated });
});

app.post("/rental-api/rentals/:id/resolve", (req, res) => {
  const rental = rentalDemoStore.rentalsById[req.params.id];
  if (!rental) return res.status(404).json({ success: false, error: "Rental not found." });

  const { action } = req.body || {};
  if (action !== "dispute") {
    return res.status(400).json({ success: false, error: "action must be dispute." });
  }

  const analysis = rentalDemoStore.analysesByRentalId[rental.id];
  if (!analysis) return res.status(400).json({ success: false, error: "Run analysis before resolving." });

  const settlement = {
    id: `settlement_${Date.now()}`,
    rentalId: rental.id,
    action,
    status: "DISPUTED",
    ownerPaymentStatus: "ON_HOLD",
    transferStatus: "SENT_TO_REVIEW",
    deposit: rental.depositAmount,
    ownerBondAmount: rental.ownerBondAmount,
    totalDeduction: analysis.totalDeduction,
    refund: analysis.refund,
    createdAt: new Date().toISOString(),
  };
  rentalDemoStore.settlementsByRentalId[rental.id] = settlement;
  rental.status = "COMPLETED";

  res.json({ success: true, rental, settlement });
});

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize AI (OpenAI or Groq Fallback)
const aiApiKey = (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'test-key') 
  ? process.env.OPENAI_API_KEY 
  : process.env.GROQ_API_KEY;

const aiBaseUrl = (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'test-key')
  ? undefined
  : "https://api.groq.com/openai/v1";

const AI_MODEL = (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'test-key')
  ? (process.env.OPENAI_MODEL || "gpt-4o-mini")
  : (process.env.GROQ_MODEL || "llama-3.1-8b-instant");

const openai = new OpenAI({
  apiKey: aiApiKey,
  baseURL: aiBaseUrl,
});

// Initialize Ethereum
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);

// Initialize Resend
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Pusher
import Pusher from "pusher";
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_APP_KEY,
  secret: process.env.PUSHER_APP_SECRET,
  cluster: process.env.PUSHER_APP_CLUSTER,
  useTLS: true,
});


// Initialize Cloudinary
import { v2 as cloudinary } from "cloudinary";
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Initialize Razorpay
import Razorpay from "razorpay";
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Contract ABI (simplified)
const ESCROW_ABI = [
  "function createEscrow(string transactionId, address company) external payable",
  "function confirmReceipt(string transactionId) external",
  "function fileComplaint(string transactionId, string description, uint8 category, uint8 urgency, uint256 aiScore, bool aiApproved, string blockchainHash) external",
  "function approveRefund(string transactionId) external",
  "function claimAutoRefund(string transactionId) external",
  "function getEscrowStatus(string transactionId) external view returns (address, address, uint256, uint256, uint8, uint256)",
  "function getCompanyBond(address companyAddress) external view returns (uint256, bool, uint256)",
];


// Helper: Generate SHA-256 hash for blockchain proof
function generateBlockchainHash(data) {
  return "0x" + crypto.createHash("sha256").update(data).digest("hex");
}

async function getProfileById(profileId) {
  if (!profileId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, is_enterprise")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function resolveSellerId(preferredSellerId, buyerId) {
  const preferredSeller = await getProfileById(preferredSellerId);
  if (preferredSeller) {
    return preferredSeller.id;
  }

  const { data: enterpriseSeller, error: enterpriseError } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_enterprise", true)
    .limit(1)
    .maybeSingle();

  if (enterpriseError) {
    throw enterpriseError;
  }

  if (enterpriseSeller?.id) {
    return enterpriseSeller.id;
  }

  const buyerProfile = await getProfileById(buyerId);
  if (buyerProfile) {
    return buyerProfile.id;
  }

  throw new Error("No valid seller profile found for escrow creation");
}

function normalizeAmazonUrl(rawUrl) {
  const parsedUrl = new URL(rawUrl);
  const asinMatch =
    parsedUrl.pathname.match(/\/dp\/([A-Z0-9]{10})/i) ||
    parsedUrl.pathname.match(/\/gp\/product\/([A-Z0-9]{10})/i) ||
    parsedUrl.pathname.match(/\/product\/([A-Z0-9]{10})/i);

  if (asinMatch) {
    return `${parsedUrl.origin}/dp/${asinMatch[1].toUpperCase()}`;
  }

  return `${parsedUrl.origin}${parsedUrl.pathname}`;
}

function cleanProductName(name = "") {
  return name
    .replace(/\s+/g, " ")
    .replace(/^title:\s*/i, "")
    .replace(/\|.*$/, "")
    .replace(/\s*:\s*Amazon\.in.*$/i, "")
    .replace(/\s+-\s+Amazon.*$/i, "")
    .trim();
}

function parseAmazonPrice(rawPrice = "") {
  const normalized = rawPrice.replace(/[^\d.,]/g, "").replace(/,/g, "");
  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function guessPriceFromName(name = "") {
  const n = name.toLowerCase();

  if (n.includes("macbook")) return 199900;
  if (n.includes("iphone")) return 79900;
  if (n.includes("ipad")) return 45900;
  if (n.includes("airpods")) return 21900;
  if (n.includes("watch")) return 34900;
  if (n.includes("headphone") || n.includes("headphones")) return 4999;
  if (n.includes("earbud") || n.includes("earbuds")) return 1999;
  if (n.includes("camera") || n.includes("nikon") || n.includes("canon")) return 54990;
  if (n.includes("laptop")) return 69990;

  // sensible demo floor so we never show ₹500 for premium items
  return 2499;
}

function isClearlyBadPrice(price) {
  return !Number.isFinite(price) || price <= 0 || price < 800;
}

function extractProductFromAmazonHtml(html, pageUrl) {
  const $ = cheerio.load(html);

  const name = cleanProductName(
    $("#productTitle").first().text() ||
      $('meta[name="title"]').attr("content") ||
      $('meta[property="og:title"]').attr("content") ||
      $("title").text()
  );

  const priceCandidates = [
    $(".a-price.aok-align-center .a-offscreen").first().text(),
    $("#corePrice_feature_div .a-offscreen").first().text(),
    $("#corePriceDisplay_desktop_feature_div .a-offscreen").first().text(),
    $("#priceblock_dealprice").text(),
    $("#priceblock_ourprice").text(),
    $("#priceblock_saleprice").text(),
    $('meta[property="product:price:amount"]').attr("content"),
  ];

  const image =
    $("#landingImage").attr("src") ||
    $("#imgTagWrapperId img").attr("src") ||
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="og:image"]').attr("content") ||
    "";

  const price = priceCandidates.map(parseAmazonPrice).find(Boolean) || null;

  if (!name || !price) {
    throw new Error("Unable to parse Amazon HTML");
  }

  return {
    name,
    price,
    image,
    source: "amazon-html",
    url: pageUrl,
  };
}

function extractProductFromText(pageContent, pageUrl) {
  const lines = pageContent
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const titleLine =
    lines.find(
      (line) =>
        line.length > 20 &&
        !/^https?:\/\//i.test(line) &&
        !/^\d[\d,.\s]*$/.test(line) &&
        !/delivery|returns|visit the|prime|add to cart/i.test(line)
    ) || "";

  const priceMatch = pageContent.match(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
  const imageMatch = pageContent.match(/https?:\/\/[^\s)]+(?:jpg|jpeg|png|webp)/i);

  if (!titleLine || !priceMatch) {
    throw new Error("Unable to parse fallback text");
  }

  return {
    name: cleanProductName(titleLine),
    price: parseAmazonPrice(priceMatch[1]),
    image: imageMatch ? imageMatch[0] : "",
    source: "jina-text",
    url: pageUrl,
  };
}

function extractNameFromUrlSlug(pageUrl) {
  try {
    const u = new URL(pageUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    const slug = parts.find((p) => p.includes("-") && !p.includes("dp") && !p.includes("ref")) || "";
    if (!slug) return "";
    return cleanProductName(
      slug
        .replace(/%[0-9A-F]{2}/gi, " ")
        .split("-")
        .slice(0, 14)
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" ")
    );
  } catch {
    return "";
  }
}

async function resolveFinalUrl(inputUrl) {
  // Works better than HEAD for Amazon short links
  try {
    const res = await axios.get(inputUrl, {
      timeout: 8000,
      maxRedirects: 6,
      responseType: "text",
      maxContentLength: 250_000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      validateStatus: (s) => s >= 200 && s < 400,
    });

    const finalUrl =
      res?.request?.res?.responseUrl ||
      res?.request?.path ||
      inputUrl;

    // If we got a path instead of URL, just return input
    if (typeof finalUrl === "string" && finalUrl.startsWith("http")) return finalUrl;
    return inputUrl;
  } catch {
    return inputUrl;
  }
}

function demoGuessProductFromUrl(pageUrl) {
  const name = extractNameFromUrlSlug(pageUrl) || "Amazon Imported Product";
  return {
    name,
    price: guessPriceFromName(name),
    image: `https://source.unsplash.com/featured/?product,${encodeURIComponent(name.split(" ").slice(0, 2).join(" "))}`,
    source: "demo-guess",
    url: pageUrl,
  };
}

// ===================
// SHOP ROUTES
// ===================

app.post("/api/shop/analyze-link", async (req, res) => {
  try {
    let { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: "URL is required" });
    }
    
    // 0. Resolve short links (amzn.in / other redirects)
    url = await resolveFinalUrl(url);

    url = normalizeAmazonUrl(url);

    try {
      const pageResponse = await axios.get(url, {
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept-Language": "en-IN,en;q=0.9",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        },
      });

      const product = extractProductFromAmazonHtml(pageResponse.data, url);
      return res.json({ success: true, product });
    } catch (error) {
      console.log("Direct Amazon scrape failed, falling back to text extraction");
    }

    // 1. Visit the link using Jina Reader
    let pageContent = "";
    try {
      const jinaRes = await axios.get(`https://r.jina.ai/${url}`, { timeout: 8000 });
      pageContent = jinaRes.data;
      
      // Basic cleaning to remove noise BUT KEEP TEXT
      pageContent = pageContent
        .replace(/!\[.*?\]\(.*?\)/g, (match) => match.includes('media-amazon') ? match : '') // Keep Amazon images
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Keep the text [THIS], remove the link (THAT)
        .slice(0, 8000); 
    } catch (e) {
      console.log("Jina Scrape failed, falling back to URL analysis");
    }

    try {
      const product = extractProductFromText(pageContent, url);
      if (product?.price && !isClearlyBadPrice(product.price)) {
        return res.json({ success: true, product });
      }
      throw new Error("Bad price from text");
    } catch (error) {
      console.log("Text extraction failed, using AI fallback");
    }

    // 2. Demo-safe deterministic fallback (no AI/network dependency)
    // This keeps hackathon demos stable even when Amazon blocks scrapes.
    try {
      const demoProduct = demoGuessProductFromUrl(url);
      if (demoProduct?.name && demoProduct?.price) {
        return res.json({ success: true, product: demoProduct });
      }
    } catch {}

    const prompt = `You are a professional product data extractor. 
    
    TASK: Extract the ACTUAL Product Name, Price (in INR), and a valid Image URL from the provided content.
    
    CONTENT:
    ${pageContent}
    
    URL: ${url}
    
    STRICT RULES:
    1. PRODUCT NAME: 
       - Look for the main <h1> or the boldest title.
       - DO NOT use random numbers, session IDs, or order IDs as the name.
       - IGNORE patterns like '525-0972295-6186439' or similar numeric strings.
       - If you can't find a clear title in the content, use the URL slug (e.g., "Zebronics Bluetooth Headphone").
    
    2. PRICE: Extract only the number (e.g., 1999).
    
    3. IMAGE: Must be a direct URL to an image.
    
    OUTPUT FORMAT (JSON ONLY):
    {
      "name": "Product Title",
      "price": 0,
      "image": "url"
    }
    
    If data is missing, make a best guess based on the product type.`;

    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    const cleanedName = cleanProductName(result?.name || "") || extractNameFromUrlSlug(url) || "Amazon Imported Product";
    const parsedPrice = Number.isFinite(result?.price) ? Number(result.price) : parseAmazonPrice(String(result?.price || ""));
    const safePrice = isClearlyBadPrice(parsedPrice) ? guessPriceFromName(cleanedName) : Math.round(parsedPrice);
    res.json({
      success: true,
      product: {
        ...result,
        name: cleanedName,
        price: safePrice,
        source: "ai-fallback",
        url,
      },
    });
  } catch (error) {
    console.error("Link analysis error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Helper: Classify complaint using OpenAI
async function classifyComplaint(description, images) {
  const prompt = `Analyze this complaint and return JSON:
{
  "is_valid": true/false,
  "category": "wrong_product|damaged|missing|not_as_described|counterfeit|other",
  "urgency": "low|medium|high",
  "confidence_score": 0-100,
  "suggested_action": "refund|replace|partial|reject"
}

Complaint: ${description}

Return only valid JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0]?.message?.content || "{}");
  } catch (error) {
    console.error("OpenAI classification error:", error);
    return {
      is_valid: true,
      category: "other",
      urgency: "medium",
      confidence_score: 50,
      suggested_action: "refund",
    };
  }
}

// ===================
// AUTH ROUTES
// ===================

app.post("/api/auth/register", async (req, res) => {
  try {
    const { id, email, full_name, wallet_address, is_enterprise } = req.body;

    const { data, error } = await supabase
      .from("profiles")
      .insert([{ id, email, full_name, wallet_address, is_enterprise: is_enterprise || false }])
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, user: data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get("/api/auth/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    res.json({ success: true, profile: data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ===================
// ESCROW ROUTES
// ===================

app.get("/api/user/escrows", async (req, res) => {
  try {
    const { user_id } = req.query;

    const { data, error } = await supabase
      .from("escrows")
      .select("*")
      .or(`buyer_id.eq.${user_id},seller_id.eq.${user_id}`)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ success: true, escrows: data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/escrows/create", async (req, res) => {
  try {
    const { buyer_id, seller_id, item_name, amount, company_wallet, inspection_period_hours } = req.body;
    const resolvedSellerId = await resolveSellerId(seller_id, buyer_id);

    const auto_release_at = new Date();
    auto_release_at.setHours(auto_release_at.getHours() + (inspection_period_hours || 48));

    // Create escrow in database
    const { data, error } = await supabase
      .from("escrows")
      .insert([{
        buyer_id,
        seller_id: resolvedSellerId,
        item_name,
        amount,
        status: "active",
        auto_release_at: auto_release_at.toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;

    // Razorpay Order (for frontend checkout)
    let razorpayOrderId = "";
    if (amount > 0) {
      try {
        const order = await razorpay.orders.create({
          amount: amount * 100, // in paise
          currency: "INR",
          receipt: data.id,
        });
        razorpayOrderId = order.id;
        
        await supabase.from("escrows").update({ razorpay_order_id: razorpayOrderId }).eq("id", data.id);
      } catch (e) { console.log("Razorpay skipped"); }
    }

    // Blockchain escrow (optional for demo)
    let txHash = "";
    if (process.env.CONTRACT_ADDRESS && amount > 0) {
      try {
        const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ESCROW_ABI, wallet);
        const tx = await contract.createEscrow(data.id, company_wallet, {
          value: ethers.parseEther(amount.toString()),
        });
        await tx.wait();
        txHash = tx.hash;
        
        await supabase.from("escrows").update({ blockchain_tx_hash: txHash }).eq("id", data.id);
      } catch (e) { console.log("Blockchain skipped"); }
    }

    res.json({ success: true, escrow: { ...data, seller_id: resolvedSellerId, blockchain_tx_hash: txHash } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/escrows/confirm", async (req, res) => {
  try {
    const { escrow_id } = req.body;

    const { data, error } = await supabase
      .from("escrows")
      .update({ status: "completed" })
      .eq("id", escrow_id)
      .select()
      .single();

    if (error) throw error;

    // Blockchain release
    if (process.env.CONTRACT_ADDRESS) {
      try {
        const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ESCROW_ABI, wallet);
        const tx = await contract.confirmReceipt(escrow_id);
        await tx.wait();
      } catch (e) {}
    }

    res.json({ success: true, escrow: data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ===================
// DISPUTE ROUTES
// ===================

app.post("/api/disputes/file", async (req, res) => {
  try {
    const { escrow_id, filed_by, reason, evidence_urls } = req.body;

    // 1. AI Classification
    const aiResult = await classifyComplaint(reason, evidence_urls);

    // 2. Create Dispute
    const { data: dispute, error: dError } = await supabase
      .from("disputes")
      .insert([{
        escrow_id,
        filed_by,
        reason,
        ai_probability_legit: aiResult.confidence_score / 100,
        ai_analysis_summary: aiResult.suggested_action,
        status: aiResult.confidence_score >= 70 ? "under_review" : "pending"
      }])
      .select()
      .single();

    if (dError) throw dError;

    // 3. Save Evidence
    if (evidence_urls && evidence_urls.length > 0) {
      const evidenceData = evidence_urls.map(url => ({
        dispute_id: dispute.id,
        file_url: url,
        file_type: "image"
      }));
      await supabase.from("evidence").insert(evidenceData);
    }

    // 4. Update Escrow status
    await supabase.from("escrows").update({ status: "disputed" }).eq("id", escrow_id);

    // 5. Real-time Notification (Pusher)
    pusher.trigger("company-portal", "new-dispute", {
      dispute_id: dispute.id,
      escrow_id: escrow_id,
      reason: reason,
      ai_score: aiResult.confidence_score
    });

    // 6. Email Notification (Resend) to the Company (Seller)
    try {
      const { data: escrow } = await supabase
        .from("escrows")
        .select("seller_id")
        .eq("id", escrow_id)
        .single();

      if (escrow?.seller_id) {
        const { data: company } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", escrow.seller_id)
          .single();

        if (company?.email) {
          await resend.emails.send({
            from: "Zelcor <alerts@zelcor.io>",
            to: company.email,
            subject: `🚨 NEW DISPUTE: ${dispute.id.slice(0, 8)}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #ff4d4d;">New Dispute Filed</h2>
                <p>Hello <b>${company.full_name}</b>,</p>
                <p>A customer has filed a dispute for an active escrow.</p>
                <hr/>
                <p><b>Reason:</b> ${reason}</p>
                <p><b>AI Validity Score:</b> ${aiResult.confidence_score}%</p>
                <p>Please log in to the Zelcor Enterprise Portal to respond.</p>
              </div>
            `
          });
        }
      }
    } catch (e) { console.log("Email failed", e); }


    res.json({ success: true, dispute, aiResult });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get("/api/disputes/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("disputes")
      .select("*, evidence(*), escrows(*)")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    res.json({ success: true, dispute: data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/disputes/refund", async (req, res) => {
  try {
    const { escrow_id } = req.body;

    const { data: escrow, error: txError } = await supabase
      .from("escrows")
      .select("*")
      .eq("id", escrow_id)
      .single();

    if (txError) throw txError;

    if (new Date() < new Date(escrow.auto_release_at)) {
      return res.status(400).json({ success: false, error: "Auto-release timer not expired" });
    }

    if (process.env.CONTRACT_ADDRESS) {
      try {
        const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ESCROW_ABI, wallet);
        const tx = await contract.claimAutoRefund(escrow_id);
        await tx.wait();
      } catch (e) {}
    }

    const { data, error } = await supabase
      .from("escrows")
      .update({ status: "refunded" })
      .eq("id", escrow_id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, escrow: data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ===================
// COMPANY ROUTES
// ===================

app.post("/api/company/respond", async (req, res) => {
  try {
    const { dispute_id, action } = req.body;

    const { data: dispute, error: cmpError } = await supabase
      .from("disputes")
      .select("*, escrows(*)")
      .eq("id", dispute_id)
      .single();

    if (cmpError) throw cmpError;

    if (action === "approve_refund") {
      if (process.env.CONTRACT_ADDRESS) {
        try {
          const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ESCROW_ABI, wallet);
          const tx = await contract.approveRefund(dispute.escrow_id);
          await tx.wait();
        } catch (e) {}
      }

      await supabase.from("disputes").update({ status: "settled" }).eq("id", dispute_id);
      await supabase.from("escrows").update({ status: "refunded" }).eq("id", dispute.escrow_id);
    }

    res.json({ success: true, message: `Action ${action} completed` });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get("/api/company/dashboard", async (req, res) => {
  try {
    const { company_id } = req.query;

    const { data: escrows, error: txError } = await supabase
      .from("escrows")
      .select("*")
      .eq("seller_id", company_id);

    if (txError) throw txError;

    const { data: disputes, error: dError } = await supabase
      .from("disputes")
      .select("*, escrows!inner(*)")
      .eq("escrows.seller_id", company_id);

    if (dError) throw dError;

    const stats = {
      total_volume: escrows?.reduce((sum, e) => sum + e.amount, 0) || 0,
      active_disputes: disputes?.filter(d => d.status === "pending" || d.status === "under_review").length || 0,
      completed: escrows?.filter(e => e.status === "completed").length || 0,
      refunded: escrows?.filter(e => e.status === "refunded").length || 0
    };

    res.json({ success: true, disputes, stats });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ===================
// INDUSTRY-SPECIFIC AI PROMPTS
// ===================

// Helper: Generate industry-specific AI prompt
function getIndustryPrompt(industry, data) {
  const prompts = {
    insurance: `You are a medical insurance claims analyst for Zelcor, a blockchain-based escrow platform. Analyze this insurance claim and return JSON:
{
  "is_valid": true/false,
  "urgency": "normal|critical|emergency",
  "diagnosis_keywords": ["keyword1", "keyword2"],
  "confidence_score": 0-100,
  "recommended_deadline_hours": number,
  "suggested_action": "approve|request_info|reject|penalty"
}

Claim Data:
- Diagnosis: ${data.diagnosis || 'N/A'}
- Claim Amount: ₹${data.claimAmount || 'N/A'}
- Policy: ${data.policy || 'N/A'}

Return only valid JSON.`,

    rental: `You are a property damage assessor for Zelcor, a blockchain-based rental deposit escrow platform. Compare move-in and move-out photos and return JSON:
{
  "is_valid": true/false,
  "damage_items": [{"item": "wall", "condition": "pre_existing|new_damage|wear_tear", "deduction": 0}],
  "total_deduction": 0-100,
  "recommended_refund": 0-100,
  "confidence_score": 0-100,
  "suggested_action": "full_refund|partial_refund|full_deduction|dispute"
}

Move-in Notes: ${data.moveInNotes || 'N/A'}
Move-out Notes: ${data.moveOutNotes || 'N/A'}

Return only valid JSON.`,

    edtech: `You are an edtech course quality analyst for Zelcor, a blockchain-based course fee escrow platform. Analyze this student complaint and return JSON:
{
  "is_valid": true/false,
  "validity_score": 0-100,
  "findings": {
    "platform_response_time_days": number,
    "content_outdated": true/false,
    "similar_complaints": number,
    "money_back_guarantee_found": true/false
  },
  "refund_recommendation": 0-100,
  "suggested_action": "full_refund|partial_refund|no_refund|escalate"
}

Complaint: ${data.complaint || 'N/A'}
Course Completion: ${data.completionPercentage || 0}%
Platform Promise: ${data.platformPromise || 'N/A'}

Return only valid JSON.`,

    hospital: `You are a hospital billing analyst for Zelcor, a blockchain-based medical package escrow platform. Compare package agreement vs final bill and return JSON:
{
  "is_valid": true/false,
  "authorized_items": [{"item": "name", "amount": 0, "status": "authorized|disputed"}],
  "disputed_amount": 0-100,
  "authorized_amount": 0-100,
  "confidence_score": 0-100,
  "suggested_action": "pay_full|pay_partial|dispute"
}

Package Agreement: ${data.packageAgreement || 'N/A'}
Final Bill: ${data.finalBill || 'N/A'}
Consented Extras: ${data.consentedExtras || 'N/A'}

Return only valid JSON.`
  };
  return prompts[industry] || prompts.ecommerce;
}

// ===================
// INSURANCE ROUTES
// ===================

app.post("/api/insurance/claim", async (req, res) => {
  try {
    const { user_id, insurer_id, claim_amount, diagnosis, policy_document_url } = req.body;

    // AI Analyze urgency
    const aiResult = await classifyInsuranceClaim(diagnosis, claim_amount);
    
    // Create claim in database
    const { data: claim, error } = await supabase
      .from("insurance_claims")
      .insert([{
        user_id,
        insurer_id,
        claim_amount,
        diagnosis,
        urgency: aiResult.urgency,
        deadline_hours: aiResult.recommended_deadline_hours,
        status: "ai_reviewed",
        ai_analysis: aiResult
      }])
      .select()
      .single();

    if (error) throw error;

    // Blockchain hash
    const policyHash = generateBlockchainHash(policy_document_url || claim.id);
    
    res.json({ 
      success: true, 
      claim: { ...claim, policy_hash: policyHash },
      aiResult 
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get("/api/insurance/claims", async (req, res) => {
  try {
    const { user_id, insurer_id } = req.query;
    
    let query = supabase.from("insurance_claims").select("*");
    if (user_id) query = query.eq("user_id", user_id);
    if (insurer_id) query = query.eq("insurer_id", insurer_id);
    
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    
    res.json({ success: true, claims: data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get all rental agreements (for demo)
app.get("/api/rental/agreements", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("rental_agreements")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    res.json({ success: true, agreements: data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get all edtech enrollments (for demo)
app.get("/api/edtech/enrollments", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("course_enrollments")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    res.json({ success: true, enrollments: data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get all hospital admissions (for demo)
app.get("/api/hospital/admissions", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("hospital_admissions")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    res.json({ success: true, admissions: data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/insurance/respond", async (req, res) => {
  try {
    const { claim_id, action } = req.body;
    
    const { data: claim, error } = await supabase
      .from("insurance_claims")
      .update({ 
        status: action === "approve" ? "approved" : action === "reject" ? "rejected" : "pending_info",
        insurer_response_at: new Date().toISOString()
      })
      .eq("id", claim_id)
      .select()
      .single();

    if (error) throw error;
    
    // Trigger penalty if critical and no response
    if (claim.urgency === "critical") {
      // Schedule penalty check job
    }
    
    res.json({ success: true, claim });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ===================
// RENTAL ROUTES
// ===================

app.post("/api/rental/agreement", async (req, res) => {
  try {
    const { tenant_id, landlord_id, property_address, total_deposit, monthly_rent } = req.body;

    const { data: agreement, error } = await supabase
      .from("rental_agreements")
      .insert([{
        tenant_id,
        landlord_id,
        property_address,
        total_deposit,
        monthly_rent,
        escrow_amount: total_deposit / 2,
        status: "pending"
      }])
      .select()
      .single();

    if (error) throw error;
    
    res.json({ success: true, agreement });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/rental/move-in", async (req, res) => {
  try {
    const { agreement_id, photos } = req.body;

    // Store photos and create blockchain hash
    const photoHashes = photos.map(p => generateBlockchainHash(p));
    
    const { data: agreement, error } = await supabase
      .from("rental_agreements")
      .update({ 
        status: "move_in_recorded",
        move_in_photos: photoHashes,
        move_in_at: new Date().toISOString()
      })
      .eq("id", agreement_id)
      .select()
      .single();

    if (error) throw error;
    
    res.json({ success: true, agreement, photo_hashes: photoHashes });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/rental/move-out", async (req, res) => {
  try {
    const { agreement_id, photos } = req.body;

    const photoHashes = photos.map(p => generateBlockchainHash(p));
    
    // AI Compare photos
    const aiResult = await compareRentalPhotos(agreement_id, photoHashes);
    
    const { data: agreement, error } = await supabase
      .from("rental_agreements")
      .update({ 
        status: "ai_assessed",
        move_out_photos: photoHashes,
        move_out_at: new Date().toISOString(),
        ai_assessment: aiResult
      })
      .eq("id", agreement_id)
      .select()
      .single();

    if (error) throw error;
    
    res.json({ success: true, agreement, ai_assessment: aiResult });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/rental/resolve", async (req, res) => {
  try {
    const { agreement_id, refund_amount, action } = req.body;

    const { data: agreement, error } = await supabase
      .from("rental_agreements")
      .update({ 
        status: action === "accept" ? "resolved" : "disputed",
        refund_amount
      })
      .eq("id", agreement_id)
      .select()
      .single();

    if (error) throw error;
    
    res.json({ success: true, agreement });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ===================
// EDTECH ROUTES
// ===================

app.post("/api/edtech/enroll", async (req, res) => {
  try {
    const { student_id, platform_id, course_name, total_fee, milestone_count } = req.body;

    const { data: enrollment, error } = await supabase
      .from("course_enrollments")
      .insert([{
        student_id,
        platform_id,
        course_name,
        total_fee,
        milestone_count,
        released_amount: 0,
        status: "enrolled"
      }])
      .select()
      .single();

    if (error) throw error;
    
    res.json({ success: true, enrollment });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/edtech/milestone", async (req, res) => {
  try {
    const { enrollment_id, milestone_number } = req.body;

    const { data: enrollment, error: eError } = await supabase
      .from("course_enrollments")
      .select("*")
      .eq("id", enrollment_id)
      .single();

    if (eError) throw eError;

    const milestoneAmount = enrollment.total_fee / enrollment.milestone_count;
    const newReleased = enrollment.released_amount + milestoneAmount;
    
    const { data: updated, error } = await supabase
      .from("course_enrollments")
      .update({ 
        released_amount: newReleased,
        status: newReleased < enrollment.total_fee ? "milestone_based" : "completed"
      })
      .eq("id", enrollment_id)
      .select()
      .single();

    if (error) throw error;
    
    res.json({ 
      success: true, 
      enrollment: updated,
      milestone_released: milestoneAmount
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/edtech/complaint", async (req, res) => {
  try {
    const { enrollment_id, complaint_text, screenshots } = req.body;

    // AI Analyze complaint
    const aiResult = await analyzeEdTechComplaint(enrollment_id, complaint_text);
    
    const { data: enrollment, error } = await supabase
      .from("course_enrollments")
      .update({ 
        status: "complaint_filed",
        complaint: complaint_text,
        ai_validity_score: aiResult.validity_score,
        ai_findings: aiResult.findings
      })
      .eq("id", enrollment_id)
      .select()
      .single();

    if (error) throw error;
    
    res.json({ success: true, enrollment, ai_analysis: aiResult });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/edtech/refund", async (req, res) => {
  try {
    const { enrollment_id, refund_amount, action } = req.body;

    const { data: enrollment, error } = await supabase
      .from("course_enrollments")
      .update({ 
        status: action === "accept" ? "refund_processed" : "escalated",
        refund_amount: action === "accept" ? refund_amount : 0
      })
      .eq("id", enrollment_id)
      .select()
      .single();

    if (error) throw error;
    
    res.json({ success: true, enrollment });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ===================
// HOSPITAL ROUTES
// ===================

app.post("/api/hospital/package", async (req, res) => {
  try {
    const { patient_id, hospital_id, package_name, package_amount, included_items, excluded_items } = req.body;

    const { data: admission, error } = await supabase
      .from("hospital_admissions")
      .insert([{
        patient_id,
        hospital_id,
        package_name,
        package_amount,
        included_items,
        excluded_items,
        paid_to_hospital: package_amount * 70 / 100,
        held_in_escrow: package_amount * 30 / 100,
        status: "package_agreed"
      }])
      .select()
      .single();

    if (error) throw error;
    
    res.json({ success: true, admission });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/hospital/consent", async (req, res) => {
  try {
    const { admission_id, item, amount, reason } = req.body;

    const { data: consent, error } = await supabase
      .from("hospital_consents")
      .insert([{
        admission_id,
        item,
        amount,
        reason,
        status: "consented"
      }])
      .select()
      .single();

    if (error) throw error;
    
    res.json({ success: true, consent });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/hospital/discharge", async (req, res) => {
  try {
    const { admission_id } = req.body;

    const { data: admission, error } = await supabase
      .from("hospital_admissions")
      .update({ status: "discharge" })
      .eq("id", admission_id)
      .select()
      .single();

    if (error) throw error;
    
    res.json({ success: true, admission });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/hospital/bill-analyze", async (req, res) => {
  try {
    const { admission_id, final_bill_items } = req.body;

    // Get original package
    const { data: admission, error: aError } = await supabase
      .from("hospital_admissions")
      .select("*")
      .eq("id", admission_id)
      .single();

    if (aError) throw aError;

    // Get consents
    const { data: consents } = await supabase
      .from("hospital_consents")
      .select("*")
      .eq("admission_id", admission_id);

    // AI Analyze bill
    const aiResult = await analyzeHospitalBill(admission, final_bill_items, consents);
    
    res.json({ 
      success: true, 
      analysis: aiResult,
      authorized_amount: aiResult.authorized_amount,
      disputed_amount: aiResult.disputed_amount
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/hospital/pay", async (req, res) => {
  try {
    const { admission_id, pay_amount, is_disputed } = req.body;

    const { data: admission, error } = await supabase
      .from("hospital_admissions")
      .update({ 
        status: is_disputed ? "bill_disputed" : "resolved",
        final_payment: pay_amount
      })
      .eq("id", admission_id)
      .select()
      .single();

    if (error) throw error;
    
    res.json({ success: true, admission });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ===================
// INDUSTRY HELPER FUNCTIONS
// ===================

async function classifyInsuranceClaim(diagnosis, amount) {
  const prompt = getIndustryPrompt("insurance", { diagnosis, claimAmount: amount });
  
  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    return JSON.parse(response.choices[0]?.message?.content || "{}");
  } catch (error) {
    return {
      is_valid: true,
      urgency: diagnosis?.toLowerCase().includes("cancer") ? "critical" : "normal",
      diagnosis_keywords: [],
      confidence_score: 50,
      recommended_deadline_hours: diagnosis?.toLowerCase().includes("cancer") ? 24 : 720,
      suggested_action: "approve"
    };
  }
}

async function compareRentalPhotos(agreementId, moveOutPhotos) {
  const prompt = getIndustryPrompt("rental", { 
    moveInNotes: "Photos recorded at move-in", 
    moveOutPhotos 
  });
  
  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    return JSON.parse(response.choices[0]?.message?.content || "{}");
  } catch (error) {
    return {
      is_valid: true,
      damage_items: [],
      total_deduction: 0,
      recommended_refund: 100,
      confidence_score: 50,
      suggested_action: "full_refund"
    };
  }
}

async function analyzeEdTechComplaint(enrollmentId, complaint) {
  const prompt = getIndustryPrompt("edtech", { 
    complaint, 
    completionPercentage: 50,
    platformPromise: "100% money-back guarantee" 
  });
  
  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    return JSON.parse(response.choices[0]?.message?.content || "{}");
  } catch (error) {
    return {
      is_valid: true,
      validity_score: 75,
      findings: { platform_response_time_days: 6, content_outdated: true, similar_complaints: 67, money_back_guarantee_found: true },
      refund_recommendation: 50,
      suggested_action: "partial_refund"
    };
  }
}

async function analyzeHospitalBill(admission, finalBill, consents) {
  const prompt = getIndustryPrompt("hospital", {
    packageAgreement: admission.included_items,
    finalBill: finalBill,
    consentedExtras: consents?.map(c => c.item).join(", ")
  });
  
  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    return JSON.parse(response.choices[0]?.message?.content || "{}");
  } catch (error) {
    return {
      is_valid: true,
      authorized_items: [],
      disputed_amount: 0,
      authorized_amount: admission.package_amount,
      confidence_score: 50,
      suggested_action: "pay_full"
    };
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`
  🛡️ ZELCOR API SERVER | PORT: ${PORT}
  Trust, Encoded.
  `);
});

export default app;
