import { supabase } from "../config/supabase.js";
import OpenAI from "openai";
import Razorpay from "razorpay";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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

export async function createInsuranceClaim(req, res, next) {
  try {
    const { user_id, purchase_id, claim_amount, diagnosis, symptoms, admission_type, hospital_name, doctor_note } = req.body;

    if (!user_id || !claim_amount || !diagnosis) {
      return res.status(400).json({
        success: false,
        error: "user_id, claim_amount and diagnosis are required",
      });
    }

    // 1. AI Analysis
    const prompt = `You are a medical insurance claims analyst for Zelcor, a blockchain-based escrow platform. Analyze this insurance claim and return JSON:
{
  "is_valid": true,
  "urgency": "normal|critical|emergency",
  "diagnosis_keywords": ["keyword1", "keyword2"],
  "confidence_score": 0-100,
  "recommended_deadline_hours": number,
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

    let aiAnalysis = {
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
      aiAnalysis = JSON.parse(response.choices[0]?.message?.content || "{}");
    } catch (e) {
      console.error("AI analysis failed", e);
    }

    // 2. Insert Claim
    const { data: claim, error: claimError } = await supabase
      .from("insurance_claims")
      .insert({
        user_id,
        purchase_id: purchase_id || null, // Allow null for demo if purchase_id is not provided
        claim_amount,
        diagnosis,
        urgency: aiAnalysis.urgency || 'normal',
        deadline_hours: aiAnalysis.recommended_deadline_hours || 720,
        ai_analysis: aiAnalysis,
        status: "pending",
      })
      .select()
      .single();

    if (claimError) throw claimError;

    res.status(201).json({
      success: true,
      claim,
    });
  } catch (error) {
    next(error);
  }
}

export async function getInsuranceClaims(req, res, next) {
  try {
    const { user_id } = req.query;
    let query = supabase.from("insurance_claims").select("*");
    
    if (user_id) {
      query = query.eq("user_id", user_id);
    }
    
    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      claims: data,
    });
  } catch (error) {
    next(error);
  }
}

export async function getInsurancePolicies(req, res, next) {
  try {
    const { data, error } = await supabase
      .from("insurance_policies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      policies: data,
    });
  } catch (error) {
    next(error);
  }
}

export async function createInsuranceOrder(req, res, next) {
  try {
    const { amount, policy_id, user_id } = req.body;

    if (!amount || !policy_id || !user_id) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const options = {
      amount: Math.round(amount * 100), // amount in paise
      currency: "INR",
      receipt: `ins_${Date.now()}`,
      notes: {
        policy_id,
        user_id
      }
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    next(error);
  }
}

export async function buyInsurancePolicy(req, res, next) {
  try {
    const { 
      user_id, 
      policy_id, 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature 
    } = req.body;

    // Verify signature
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({ success: false, error: "Invalid payment signature" });
    }

    // Calculate expiry date (default 12 months)
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const { data, error } = await supabase
      .from("insurance_purchases")
      .insert({
        user_id,
        policy_id,
        razorpay_order_id,
        razorpay_payment_id,
        expiry_date: expiryDate.toISOString(),
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      purchase: data,
    });
  } catch (error) {
    next(error);
  }
}

export async function buyInsurancePolicyDemo(req, res, next) {
  try {
    const { user_id, policy_id } = req.body;

    if (!user_id || !policy_id) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    // Calculate expiry date (default 12 months)
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

    res.status(201).json({
      success: true,
      purchase: data,
    });
  } catch (error) {
    next(error);
  }
}

export async function getInsurancePurchases(req, res, next) {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ success: false, error: "user_id is required" });
    }

    const { data, error } = await supabase
      .from("insurance_purchases")
      .select(`
        *,
        insurance_policies (*)
      `)
      .eq("user_id", user_id)
      .eq("status", "active");

    if (error) throw error;

    res.json({
      success: true,
      purchases: data,
    });
  } catch (error) {
    next(error);
  }
}

export async function respondToInsuranceClaim(req, res, next) {
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

    res.json({ success: true, claim });
  } catch (error) {
    next(error);
  }
}

export async function clearInsuranceClaims(req, res, next) {
  try {
    const user_id = req.body.user_id || req.query.user_id;
    console.log('🗑️ Clearing claims for user:', user_id);

    if (!user_id) {
      return res.status(400).json({ success: false, error: "user_id is required" });
    }

    const { data, error } = await supabase
      .from("insurance_claims")
      .delete()
      .eq("user_id", user_id);

    if (error) {
      console.error('❌ Error deleting claims from Supabase:', error);
      throw error;
    }

    console.log('✅ Claims cleared successfully for user:', user_id);
    res.json({
      success: true,
      message: "Claims cleared successfully",
    });
  } catch (error) {
    console.error('❌ Clear claims catch block error:', error);
    next(error);
  }
}

export async function cancelInsurancePurchase(req, res, next) {
  try {
    const { purchase_id, user_id } = req.body;
    console.log('🚫 Cancelling purchase:', purchase_id, 'for user:', user_id);

    if (!purchase_id || !user_id) {
      return res.status(400).json({ success: false, error: "purchase_id and user_id are required" });
    }

    const { data, error } = await supabase
      .from("insurance_purchases")
      .delete()
      .eq("id", purchase_id)
      .eq("user_id", user_id);

    if (error) {
      console.error('❌ Error cancelling purchase from Supabase:', error);
      throw error;
    }

    console.log('✅ Purchase cancelled successfully:', purchase_id);
    res.json({
      success: true,
      message: "Purchase cancelled successfully",
    });
  } catch (error) {
    console.error('❌ Cancel purchase catch block error:', error);
    next(error);
  }
}
