import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';

const API_URL = 'http://localhost:3000/api';
const PENDING_CHECKOUT_KEY = 'zelcor_pending_checkout';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Finalizing your protected checkout...');

  useEffect(() => {
    const finalizeCheckout = async () => {
      const escrowId = searchParams.get('escrow_id');
      const pendingRaw = localStorage.getItem(PENDING_CHECKOUT_KEY);

      if (!escrowId || !pendingRaw) {
        setStatus('error');
        setMessage('No pending checkout was found for this payment session.');
        return;
      }

      try {
        const pendingCheckout = JSON.parse(pendingRaw);

        if (pendingCheckout.cart?.length > 1) {
          for (let i = 1; i < pendingCheckout.cart.length; i++) {
            const item = pendingCheckout.cart[i];
            const createRes = await axios.post(`${API_URL}/escrows/create`, {
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
        setStatus('success');
        setMessage('Payment received. Your order is now in My Orders and ready for confirmation or complaint filing.');
      } catch (error) {
        setStatus('error');
        setMessage(error.response?.data?.error || 'Payment completed, but checkout finalization failed.');
      }
    };

    finalizeCheckout();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white border border-slate-100 rounded-[40px] p-10 text-center space-y-6 shadow-sm">
        <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
          status === 'success' ? 'bg-emerald-50 text-emerald-600' :
          status === 'error' ? 'bg-rose-50 text-rose-600' :
          'bg-slate-100 text-slate-500'
        }`}>
          <span className="material-symbols-outlined text-4xl">
            {status === 'success' ? 'check_circle' : status === 'error' ? 'error' : 'hourglass_top'}
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Demo Payment Flow</p>
          <h1 className="text-3xl font-black text-slate-900">
            {status === 'success' ? 'Payment Successful' : status === 'error' ? 'Payment Needs Attention' : 'Confirming Payment'}
          </h1>
          <p className="text-slate-500">{message}</p>
        </div>

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
