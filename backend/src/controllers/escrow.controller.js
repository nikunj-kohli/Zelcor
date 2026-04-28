import { supabase } from "../config/supabase.js";

export async function createEscrow(req, res, next) {
  try {
    const { user_id, product_name, amount } = req.body;

    if (!user_id || !product_name || !amount) {
      return res.status(400).json({
        success: false,
        error: "user_id, product_name and amount are required",
      });
    }

    const { data, error } = await supabase
      .from("escrows")
      .insert({
        buyer_id: user_id,
        seller_id: user_id,
        item_name: product_name,
        amount,
        status: "demo_paid",
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      escrow: data,
    });
  } catch (error) {
    next(error);
  }
}
