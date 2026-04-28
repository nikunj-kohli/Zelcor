import { supabase } from "../config/supabase.js";

export async function createInsuranceClaim(req, res, next) {
  try {
    const { user_id, policy_id, hospital_name, claim_amount, documents = [] } = req.body;

    if (!user_id || !policy_id || !hospital_name || !claim_amount) {
      return res.status(400).json({
        success: false,
        error: "user_id, policy_id, hospital_name and claim_amount are required",
      });
    }

    if (!Array.isArray(documents)) {
      return res.status(400).json({
        success: false,
        error: "documents must be an array of URLs",
      });
    }

    const { data: claim, error: claimError } = await supabase
      .from("insurance_claims")
      .insert({
        user_id,
        policy_id,
        hospital_name,
        claim_amount,
        status: "pending",
      })
      .select()
      .single();

    if (claimError) throw claimError;

    if (documents.length > 0) {
      const claimDocuments = documents.map((fileUrl) => ({
        claim_id: claim.id,
        file_url: fileUrl,
        type: "report",
      }));

      const { error: documentsError } = await supabase
        .from("claim_documents")
        .insert(claimDocuments);

      if (documentsError) throw documentsError;
    }

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
    const { data, error } = await supabase
      .from("insurance_claims")
      .select("*, claim_documents(*)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      claims: data,
    });
  } catch (error) {
    next(error);
  }
}
