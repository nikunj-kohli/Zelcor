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

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

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
const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY || "";
const ROBOFLOW_DAMAGE_ENDPOINT = process.env.ROBOFLOW_DAMAGE_ENDPOINT || "";
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY || "";
const HUGGINGFACE_IMAGE_MODEL = process.env.HUGGINGFACE_IMAGE_MODEL || "";
const HUGGINGFACE_VIDEO_MODEL = process.env.HUGGINGFACE_VIDEO_MODEL || "";

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
async function analyzeDamageWithRoboflow(mediaUrl) {
  if (!ROBOFLOW_API_KEY || !ROBOFLOW_DAMAGE_ENDPOINT || !mediaUrl) {
    return { provider: "roboflow", skipped: true, reason: "missing-config-or-media" };
  }

  try {
    const endpoint = `${ROBOFLOW_DAMAGE_ENDPOINT}?api_key=${encodeURIComponent(ROBOFLOW_API_KEY)}&image=${encodeURIComponent(mediaUrl)}`;
    const response = await axios.post(endpoint, null, { timeout: 15000 });
    return {
      provider: "roboflow",
      skipped: false,
      topPrediction: response.data?.predictions?.[0] || null,
      predictionsCount: response.data?.predictions?.length || 0,
      raw: response.data,
    };
  } catch (error) {
    return {
      provider: "roboflow",
      skipped: true,
      reason: "request-failed",
      error: error?.response?.data || error.message,
    };
  }
}

async function analyzeSyntheticMediaWithHuggingFace(modelId, mediaUrl) {
  if (!HUGGINGFACE_API_KEY || !modelId || !mediaUrl) {
    return { provider: "huggingface", skipped: true, reason: "missing-config-or-media", modelId };
  }

  try {
    // URL payload allows hackathon-friendly inference without binary uploads.
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${modelId}`,
      { inputs: mediaUrl },
      {
        timeout: 20000,
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      provider: "huggingface",
      skipped: false,
      modelId,
      output: response.data,
    };
  } catch (error) {
    return {
      provider: "huggingface",
      skipped: true,
      modelId,
      reason: "request-failed",
      error: error?.response?.data || error.message,
    };
  }
}

async function ensureEvidenceUrls(evidenceItems = []) {
  const uploads = evidenceItems.map(async (item) => {
    if (!item?.url) return null;
    if (!String(item.url).startsWith("data:")) return item;

    const uploadResult = await cloudinary.uploader.upload(item.url, {
      folder: "zelcor/complaints",
      resource_type: item.type === "video" ? "video" : "image",
    });

    return {
      ...item,
      url: uploadResult.secure_url,
    };
  });

  const resolved = await Promise.all(uploads);
  return resolved.filter(Boolean);
}

async function analyzeEvidenceMedia(evidenceItems = []) {
  const firstImage = evidenceItems.find((x) => x?.type === "image" && x?.url)?.url || "";
  const firstVideo = evidenceItems.find((x) => x?.type === "video" && x?.url)?.url || "";
  const anyMediaUrl = firstImage || firstVideo || evidenceItems.find((x) => x?.url)?.url || "";

  const [damage, imageSynthetic, videoSynthetic] = await Promise.all([
    analyzeDamageWithRoboflow(anyMediaUrl),
    analyzeSyntheticMediaWithHuggingFace(HUGGINGFACE_IMAGE_MODEL, firstImage || anyMediaUrl),
    analyzeSyntheticMediaWithHuggingFace(HUGGINGFACE_VIDEO_MODEL, firstVideo || anyMediaUrl),
  ]);

  return {
    evidenceCount: evidenceItems.length,
    hasImage: Boolean(firstImage),
    hasVideo: Boolean(firstVideo),
    captureIntegrity: {
      total: evidenceItems.length,
      capturedInApp: evidenceItems.filter((x) => x?.captured_in_app).length,
      uploadedFromGallery: evidenceItems.filter((x) => x && x.captured_in_app === false).length,
    },
    modelRuns: {
      damage,
      imageSynthetic,
      videoSynthetic,
    },
  };
}

const complaintCategoryToUint = {
  wrong_product: 0,
  damaged: 1,
  missing: 2,
  not_as_described: 3,
  counterfeit: 4,
  other: 5,
};

const urgencyToUint = {
  low: 0,
  medium: 1,
  high: 2,
};

async function classifyComplaint(description, mediaAnalysis) {
  const prompt = `Analyze this complaint and return JSON:
{
  "is_valid": true/false,
  "category": "wrong_product|damaged|missing|not_as_described|counterfeit|other",
  "urgency": "low|medium|high",
  "confidence_score": 0-100,
  "suggested_action": "refund|replace|partial|reject",
  "same_product_match": true/false,
  "condition_summary": "short summary of product condition",
  "key_findings": ["finding 1", "finding 2"]
}

Complaint: ${description}

Model Analysis:
${JSON.stringify(mediaAnalysis || {}, null, 2)}

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
      same_product_match: false,
      condition_summary: "Could not determine exact condition automatically.",
      key_findings: ["Model fallback used due to AI classification error."],
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

app.put("/api/auth/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, wallet_address, avatar_url, is_enterprise } = req.body;

    const updatePayload = {};
    if (typeof full_name === "string") updatePayload.full_name = full_name.trim();
    if (typeof wallet_address === "string") updatePayload.wallet_address = wallet_address.trim();
    if (typeof avatar_url === "string") updatePayload.avatar_url = avatar_url.trim();
    if (typeof is_enterprise === "boolean") updatePayload.is_enterprise = is_enterprise;

    const { data, error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
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

app.get("/api/user/disputes", async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ success: false, error: "user_id is required" });
    }

    const { data, error } = await supabase
      .from("disputes")
      .select("*, escrows(*)")
      .eq("filed_by", user_id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ success: true, disputes: data || [] });
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
    const {
      escrow_id,
      filed_by,
      reason,
      complaint_type = "other",
      evidence_urls = [],
      evidence = [],
    } = req.body;

    const normalizedEvidence = (Array.isArray(evidence) && evidence.length > 0
      ? evidence
      : (Array.isArray(evidence_urls) ? evidence_urls.map((url) => ({ url, type: "image", captured_in_app: null })) : [])
    ).filter((item) => item?.url);

    const hostedEvidence = await ensureEvidenceUrls(normalizedEvidence);
    const mediaAnalysis = await analyzeEvidenceMedia(hostedEvidence);

    // 1. AI Classification
    const aiResult = await classifyComplaint(
      `Complaint Type: ${complaint_type}\n${reason}`,
      mediaAnalysis
    );
    const aiScore = Math.max(0, Math.min(100, Number(aiResult.confidence_score || 0)));
    let complaintTxHash = "";
    let autoResolution = "under_review";

    // 2. Create Dispute
    const { data: dispute, error: dError } = await supabase
      .from("disputes")
      .insert([{
        escrow_id,
        filed_by,
        reason,
        ai_probability_legit: aiScore / 100,
        ai_analysis_summary: JSON.stringify({
          suggested_action: aiResult.suggested_action,
          complaint_type,
          media_analysis: mediaAnalysis,
        }),
        status: aiScore >= 70 ? "under_review" : "pending"
      }])
      .select()
      .single();

    if (dError) throw dError;

    // 3. Save Evidence
    if (hostedEvidence.length > 0) {
      const evidenceData = hostedEvidence.map((item) => ({
        dispute_id: dispute.id,
        file_url: item.url,
        file_type: item.type || "image",
      }));
      await supabase.from("evidence").insert(evidenceData);
    }

    // 4. Trigger smart contract complaint record
    if (process.env.CONTRACT_ADDRESS) {
      try {
        const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ESCROW_ABI, wallet);
        const blockchainHash = generateBlockchainHash(
          JSON.stringify({ escrow_id, reason, evidence: hostedEvidence.map((x) => x.url) })
        );
        const tx = await contract.fileComplaint(
          escrow_id,
          reason,
          complaintCategoryToUint[complaint_type] ?? complaintCategoryToUint.other,
          urgencyToUint[aiResult.urgency] ?? urgencyToUint.medium,
          BigInt(aiScore),
          aiScore >= 70,
          blockchainHash
        );
        await tx.wait();
        complaintTxHash = tx.hash;
      } catch (e) {
        console.log("Complaint smart contract call skipped");
      }
    }

    // 5. If confidence is high and refund suggested, auto-trigger refund flow
    let escrowStatus = "disputed";
    let disputeStatus = aiScore >= 70 ? "under_review" : "pending";
    if (aiResult.suggested_action === "refund" && aiScore >= 85) {
      autoResolution = "refund_initiated";
      escrowStatus = "refunded";
      disputeStatus = "settled";
      if (process.env.CONTRACT_ADDRESS) {
        try {
          const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ESCROW_ABI, wallet);
          const refundTx = await contract.approveRefund(escrow_id);
          await refundTx.wait();
        } catch (e) {
          console.log("Auto refund smart contract call skipped");
        }
      }
    }

    await supabase.from("escrows").update({ status: escrowStatus }).eq("id", escrow_id);
    await supabase.from("disputes").update({
      status: disputeStatus,
      ai_analysis_summary: JSON.stringify({
        suggested_action: aiResult.suggested_action,
        complaint_type,
        media_analysis: mediaAnalysis,
        complaint_tx_hash: complaintTxHash,
        auto_resolution: autoResolution,
      }),
    }).eq("id", dispute.id);

    // 6. Real-time Notification (Pusher)
    pusher.trigger("company-portal", "new-dispute", {
      dispute_id: dispute.id,
      escrow_id: escrow_id,
      reason: reason,
      ai_score: aiScore
    });

    // 7. Email Notification (Resend) to the Company (Seller)
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
                <p><b>AI Validity Score:</b> ${aiScore}%</p>
                <p>Please log in to the Zelcor Enterprise Portal to respond.</p>
              </div>
            `
          });
        }
      }
    } catch (e) { console.log("Email failed", e); }


    res.json({
      success: true,
      dispute: { ...dispute, status: disputeStatus },
      aiResult,
      mediaAnalysis,
      smartContract: {
        complaint_logged: Boolean(complaintTxHash),
        complaint_tx_hash: complaintTxHash || null,
        auto_resolution: autoResolution,
        customer_message: autoResolution === "refund_initiated"
          ? "Product marked as returned. Refund initiated to your primary bank account."
          : "Complaint submitted. Evidence is under AI and smart-contract review.",
      },
    });
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
    const { 
      user_id, 
      purchase_id, 
      claim_amount, 
      diagnosis, 
      symptoms, 
      admission_type, 
      treatment_type, 
      hospital_name, 
      doctor_note, 
      policy_document_url 
    } = req.body;

    // AI Analyze claim
    const prompt = `Analyze this insurance claim and return JSON:
{
  "is_valid": true/false,
  "urgency": "normal|critical|emergency",
  "recommended_deadline_hours": number,
  "confidence_score": 0-100,
  "reason": "short explanation"
}

Claim Data:
- Diagnosis: ${diagnosis}
- Symptoms: ${symptoms}
- Admission Type: ${admission_type}
- Hospital: ${hospital_name}
- Claim Amount: ₹${claim_amount}
- Doctor Note: ${doctor_note}

Return only valid JSON.`;

    let aiResult = {
      urgency: 'normal',
      confidence_score: 50,
      recommended_deadline_hours: 720,
      reason: 'AI analysis pending'
    };

    try {
      const response = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      aiResult = JSON.parse(response.choices[0]?.message?.content || "{}");
    } catch (e) {
      console.error("AI analysis failed", e);
    }

    // Create claim in database
    const { data: claim, error } = await supabase
      .from("insurance_claims")
      .insert([{
        user_id,
        purchase_id: purchase_id || null,
        claim_amount,
        diagnosis,
        symptoms,
        admission_type,
        treatment_type,
        hospital_name,
        doctor_note,
        policy_document_url: policy_document_url || 'demo-policy.pdf',
        urgency: aiResult.urgency || 'normal',
        deadline_hours: aiResult.recommended_deadline_hours || 720,
        status: "pending",
        ai_analysis: aiResult
      }])
      .select()
      .single();

    if (error) throw error;

    // Blockchain hash (demo)
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

app.get("/api/insurance/policies", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("insurance_policies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ success: true, policies: data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get("/api/insurance/purchases", async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ success: false, error: "user_id is required" });

    const { data, error } = await supabase
      .from("insurance_purchases")
      .select(`
        *,
        insurance_policies (*)
      `)
      .eq("user_id", user_id)
      .eq("status", "active");

    if (error) throw error;
    res.json({ success: true, purchases: data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/insurance/buy-demo", async (req, res) => {
  try {
    const { user_id, policy_id } = req.body;
    if (!user_id || !policy_id) return res.status(400).json({ success: false, error: "Missing fields" });

    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const { data, error } = await supabase
      .from("insurance_purchases")
      .insert({
        user_id,
        policy_id,
        razorpay_order_id: `demo_order_${Date.now()}`,
        razorpay_payment_id: `demo_pay_${Date.now()}`,
        expiry_date: expiryDate.toISOString(),
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, purchase: data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/insurance/cancel", async (req, res) => {
  try {
    const { purchase_id, user_id } = req.body;
    const { error } = await supabase
      .from("insurance_purchases")
      .delete()
      .eq("id", purchase_id)
      .eq("user_id", user_id);

    if (error) throw error;
    res.json({ success: true, message: "Policy cancelled" });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.delete("/api/insurance/claims/clear", async (req, res) => {
  try {
    const { user_id } = req.query;
    const { error } = await supabase
      .from("insurance_claims")
      .delete()
      .eq("user_id", user_id);

    if (error) throw error;
    res.json({ success: true, message: "Claims cleared" });
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

app.get("/api/rental/list", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("rental_agreements")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    res.json({ success: true, rentals: data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get("/api/rental/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: rental, error } = await supabase
      .from("rental_agreements")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    
    const { data: evidence, error: eError } = await supabase
      .from("evidence")
      .select("*")
      .eq("agreement_id", id);

    res.json({ 
      success: true, 
      rental, 
      images: evidence || [] 
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/inspection/upload", async (req, res) => {
  try {
    const { agreementId, type, images } = req.body;
    
    const evidenceData = images.map(img => ({
      agreement_id: agreementId,
      file_url: img.url,
      file_type: type, // 'move-in' or 'move-out'
      created_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from("evidence")
      .insert(evidenceData)
      .select();

    if (error) throw error;

    // Update status
    const status = type === 'move-in' ? 'active' : 'inspected';
    await supabase.from("rental_agreements").update({ status }).eq("id", agreementId);

    res.json({ success: true, images: data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/analysis/run", async (req, res) => {
  try {
    const { agreementId } = req.body;
    
    // Fetch evidence
    const { data: evidence } = await supabase.from("evidence").select("*").eq("agreement_id", agreementId);
    
    // AI Compare (Mock logic for demo, calls compareRentalPhotos)
    const aiResult = await compareRentalPhotos(agreementId, evidence.filter(e => e.file_type === 'move-out'));
    
    await supabase.from("rental_agreements").update({ 
      ai_assessment: aiResult,
      status: 'inspected' 
    }).eq("id", agreementId);

    res.json({ success: true, analysis: aiResult });
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
        ai_assessment: { ... (req.body.ai_assessment || {}), final_refund: refund_amount }
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