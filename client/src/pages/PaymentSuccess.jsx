import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';

const API_URL = 'http://localhost:3000/api';
const PENDING_CHECKOUT_KEY = 'zelcor_pending_checkout';
const PROCESSED_PREFIX = 'zelcor_processed_payment_';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Finalizing your protected checkout...');

  useEffect(() => {
    const finalizeCheckout = async () => {
      const escrowId = searchParams.get('escrow_id');
      const pendingRaw = localStorage.getItem(PENDING_CHECKOUT_KEY);

      if (!escrowId) {
        setStatus('error');
        setMessage('Invalid payment callback. Missing escrow reference.');
        return;
      }

      try {
        const processedKey = `${PROCESSED_PREFIX}${escrowId}`;
        const alreadyProcessed = localStorage.getItem(processedKey) === '1';
        const pendingCheckout = pendingRaw ? JSON.parse(pendingRaw) : null;

        if (!alreadyProcessed && pendingCheckout?.cart?.length > 1) {
          for (let i = 1; i < pendingCheckout.cart.length; i++) {
            const item = pendingCheckout.cart[i];
            await axios.post(`${API_URL}/escrows/create`, {
              buyer_id: pendingCheckout.userId,
              item_name: item.name,
              amount: item.price,
              company_wallet: '0x321...456',
              inspection_period_hours: 48,
            });
          }
        }

        localStorage.removeItem('zelcor_cart');
        localStorage.removeItem(PENDING_CHECKOUT_KEY);
        localStorage.setItem(processedKey, '1');
        setStatus('success');
        setMessage('Payment completed! Your order has been added to My Orders. You can now Confirm or Raise Complaint.');
      } catch (error) {
        setStatus('error');
        setMessage(error.response?.data?.error || 'Payment completed, but checkout finalization failed.');
      }
    };

    finalizeCheckout();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white border border-slate-100 rounded-[40px] p-10 text-center space-y-7 shadow-sm">
        <div className="relative w-24 h-24 mx-auto">
          {status === 'success' && (
            <span className="absolute inset-0 rounded-full bg-emerald-200/60 animate-ping"></span>
          )}
          <div className={`relative w-24 h-24 rounded-full flex items-center justify-center border-4 ${
            status === 'success'
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
              : status === 'error'
              ? 'bg-rose-50 text-rose-600 border-rose-200'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            <span className={`material-symbols-outlined text-5xl ${status === 'success' ? 'animate-bounce' : ''}`}>
              {status === 'success' ? 'check_circle' : status === 'error' ? 'error' : 'hourglass_top'}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Razorpay Demo Flow</p>
          <h1 className="text-3xl font-black text-slate-900">
            {status === 'success' ? 'Payment Successful' : status === 'error' ? 'Payment Needs Attention' : 'Confirming Payment'}
          </h1>
          <p className="text-slate-500 leading-relaxed">{message}</p>
        </div>

        {status === 'success' && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700 font-semibold">
            Order created in <span className="font-black">My Orders</span> on your dashboard.
          </div>
        )}

        <div className="flex justify-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-primary text-white rounded-2xl font-bold text-sm"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => navigate('/shop')}
            className="px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold text-sm"
          >
            Back to Shop
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
