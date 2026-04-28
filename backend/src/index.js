import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
      model: "gpt-4o-mini",
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

    const auto_release_at = new Date();
    auto_release_at.setHours(auto_release_at.getHours() + (inspection_period_hours || 48));

    // Create escrow in database
    const { data, error } = await supabase
      .from("escrows")
      .insert([{
        buyer_id,
        seller_id,
        item_name,
        amount,
        status: "active",
        inspection_period_hours: inspection_period_hours || 48,
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

    res.json({ success: true, escrow: { ...data, blockchain_tx_hash: txHash } });
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

// Start server
app.listen(PORT, () => {
  console.log(`
  🛡️ ZELCOR API SERVER | PORT: ${PORT}
  Trust, Encoded.
  `);
});

export default app;