import express from "express";
import cors from "cors";
import crypto from "crypto";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "20mb" }));

const store = {
  rentalsById: {},
  rentalOrder: [],
  inspectionsByAgreementId: {},
  analysesByAgreementId: {},
  settlementByAgreementId: {},
};

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function createDemoAgreement() {
  return {
    id: "RA-2026-0428",
    property: "301, Sunrise Apartments, Andheri East",
    tenant: "Rajesh Sharma",
    landlord: "Prakash Patel",
    deposit: 80000,
    landlordPaid: 40000,
    escrowAmount: 40000,
    moveInDate: "2024-04-28",
    status: "READY",
    createdAt: nowIso(),
  };
}

function createDemoImages(agreementId) {
  const mk = (id, type, label, url, hashSeed) => ({
    id,
    type,
    label,
    url,
    timestamp: nowIso(),
    hash: sha256(hashSeed),
    filename: url.split("/").pop(),
  });

  return [
    // Same wall scratch -> PRE_EXISTING
    mk("img_1", "move-in", "Bedroom Wall", "/images/wall-scratch-before.jpg", "wall-scratch-1"),
    mk("img_2", "move-out", "Bedroom Wall", "/images/wall-scratch-before.jpg", "wall-scratch-1"),

    // Slight difference -> WEAR_TEAR
    mk("img_3", "move-in", "Kitchen Floor", "/images/floor-mark-before.jpg", "kitchen-floor-before"),
    mk("img_4", "move-out", "Kitchen Floor", "/images/floor-mark-after.jpg", "kitchen-floor-after"),

    // Broken item -> DAMAGE (5000)
    mk("img_5", "move-in", "Bathroom Mirror", "/images/mirror-before.jpg", "mirror-before"),
    mk("img_6", "move-out", "Bathroom Mirror", "/images/mirror-broken.jpg", "mirror-broken"),
  ].map((img) => ({ ...img, agreementId }));
}

function bootstrapDemo() {
  const agreement = createDemoAgreement();
  store.rentalsById[agreement.id] = agreement;
  store.rentalOrder.push(agreement.id);
  store.inspectionsByAgreementId[agreement.id] = createDemoImages(agreement.id);
}

bootstrapDemo();

app.get("/rental/health", (_req, res) => {
  res.json({ success: true, service: "rental-module", timestamp: nowIso() });
});

app.get("/rental/list", (_req, res) => {
  const rentals = store.rentalOrder.map((id) => store.rentalsById[id]).filter(Boolean);
  return res.json({ success: true, rentals });
});

app.get("/rental/:id", (req, res) => {
  const agreementId = req.params.id;
  const rental = store.rentalsById[agreementId];
  if (!rental) return res.status(404).json({ success: false, error: "Rental not found." });
  return res.json({
    success: true,
    rental,
    images: store.inspectionsByAgreementId[agreementId] || [],
    analysis: store.analysesByAgreementId[agreementId] || null,
    settlement: store.settlementByAgreementId[agreementId] || null,
  });
});

app.post("/rental/create", (req, res) => {
  const payload = req.body || {};
  const agreement = {
    id:
      payload.id ||
      `RA-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
        .toString(36)
        .slice(2, 5)
        .toUpperCase()}`,
    property: payload.property,
    tenant: payload.tenant,
    landlord: payload.landlord,
    deposit: Number(payload.deposit || 0),
    landlordPaid: Number(payload.landlordPaid || Number(payload.deposit || 0) / 2),
    escrowAmount: Number(payload.escrowAmount || Number(payload.deposit || 0) / 2),
    moveInDate: payload.moveInDate,
    status: "DRAFT",
    createdAt: nowIso(),
  };

  if (!agreement.property || !agreement.tenant || !agreement.landlord || !agreement.deposit) {
    return res.status(400).json({ success: false, error: "Missing required rental fields." });
  }

  store.rentalsById[agreement.id] = agreement;
  if (!store.rentalOrder.includes(agreement.id)) store.rentalOrder.unshift(agreement.id);
  if (!store.inspectionsByAgreementId[agreement.id]) store.inspectionsByAgreementId[agreement.id] = [];
  return res.json({ success: true, agreement });
});

app.post("/inspection/upload", (req, res) => {
  const { agreementId, type, images } = req.body || {};
  const rental = store.rentalsById[agreementId];
  if (!rental) return res.status(404).json({ success: false, error: "Rental not found." });

  if (!agreementId || !type || !Array.isArray(images) || images.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: "agreementId, type and images[] are required." });
  }

  const prepared = images.map((item, idx) => {
    const imageUrl = item.url || item.content || `/images/${item.filename || `upload-${Date.now()}-${idx}.jpg`}`;
    return {
      id: `img_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      agreementId,
      type,
      label: item.label || "General",
      url: imageUrl,
      timestamp: item.timestamp || nowIso(),
      filename: item.filename || `upload-${Date.now()}-${idx}.jpg`,
      hash: sha256(item.content || imageUrl),
    };
  });

  if (!store.inspectionsByAgreementId[agreementId]) store.inspectionsByAgreementId[agreementId] = [];
  store.inspectionsByAgreementId[agreementId] = [
    ...store.inspectionsByAgreementId[agreementId].filter((img) => img.type !== type),
    ...prepared,
  ];

  if (type === "move-in") rental.status = "ACTIVE";
  if (type === "move-out") rental.status = "READY";

  return res.json({ success: true, images: prepared, rental });
});

app.get("/inspection/:id", (req, res) => {
  const agreementId = req.params.id;
  const rental = store.rentalsById[agreementId];
  if (!rental) return res.status(404).json({ success: false, error: "Rental not found." });
  return res.json({
    success: true,
    agreement: rental,
    images: store.inspectionsByAgreementId[agreementId] || [],
  });
});

app.post("/analysis/run", (req, res) => {
  const { agreementId } = req.body || {};
  const rental = store.rentalsById[agreementId];
  if (!rental) return res.status(404).json({ success: false, error: "Rental not found." });
  const images = store.inspectionsByAgreementId[agreementId] || [];
  const moveIns = images.filter((img) => img.type === "move-in");
  const moveOuts = images.filter((img) => img.type === "move-out");

  const reports = [];

  for (const out of moveOuts) {
    const matching = moveIns.find((input) => input.label === out.label);
    if (!matching) {
      reports.push({ item: out.label, status: "DAMAGE", deduction: 5000 });
      continue;
    }

    if (matching.filename === out.filename) {
      reports.push({ item: out.label, status: "PRE_EXISTING", deduction: 0 });
      continue;
    }

    if (matching.label === out.label) {
      const damageDeduction = out.label.toLowerCase().includes("mirror") ? 5000 : 0;
      reports.push({
        item: out.label,
        status: damageDeduction > 0 ? "DAMAGE" : "WEAR_TEAR",
        deduction: damageDeduction,
      });
    }
  }

  const totalDeductions = reports.reduce((sum, row) => sum + Number(row.deduction || 0), 0);
  const finalRefund = Math.max(0, Number(rental.deposit || 0) - totalDeductions);

  const analysis = {
    agreementId,
    reports,
    totalDeductions,
    finalRefund,
    generatedAt: nowIso(),
  };
  store.analysesByAgreementId[agreementId] = analysis;
  return res.json({ success: true, analysis });
});

app.post("/settlement/resolve", (req, res) => {
  const { agreementId, action = "accept" } = req.body || {};
  const rental = store.rentalsById[agreementId];
  if (!rental) return res.status(404).json({ success: false, error: "Rental not found." });
  const analysis = store.analysesByAgreementId[agreementId];
  if (!analysis) {
    return res.status(400).json({ success: false, error: "Run /analysis/run first." });
  }

  const payload = {
    agreementId,
    action,
    totalDeposit: rental.deposit || 0,
    totalDeductions: analysis.totalDeductions,
    finalRefund: analysis.finalRefund,
    status: action === "dispute" ? "SENT_TO_ARBITRATOR" : "ACCEPTED",
  };
  store.settlementByAgreementId[agreementId] = payload;
  rental.status = "COMPLETED";
  return res.json({ success: true, settlement: payload });
});

app.listen(PORT, () => {
  console.log(`\n🏠 ZELCOR RENTAL MODULE | PORT: ${PORT}`);
  console.log("Trust, Encoded.\n");
});

