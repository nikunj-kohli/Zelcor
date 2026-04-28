import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:3000/api';

const Wallet = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchWallet = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      if (!userId) return;
      try {
        const res = await axios.get(`${API_URL}/user/escrows?user_id=${userId}`);
        setOrders(res.data?.escrows || []);
      } finally {
        setLoading(false);
      }
    };
    fetchWallet();
  }, []);

  const refundedOrders = useMemo(() => orders.filter((o) => o.status === 'refunded'), [orders]);
  const recentWithdrawals = useMemo(() => orders.filter((o) => o.status === 'completed').slice(0, 4), [orders]);
  const walletBalance = useMemo(
    () => refundedOrders.reduce((sum, o) => sum + Number(o.amount), 0),
    [refundedOrders]
  );

  const handleWithdraw = () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) return setMessage('Enter valid amount');
    if (amount > walletBalance) return setMessage('Amount exceeds available balance');
    setMessage(`Withdrawal request for ₹${amount.toLocaleString()} submitted (prototype).`);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-primary">Loading wallet...</div>;

  return (
    <div className="max-w-[1000px] mx-auto w-full space-y-8">
      <section className="grid md:grid-cols-3 gap-6">
        <Card label="Available Balance" value={`₹${walletBalance.toLocaleString()}`} />
        <Card label="Refund Credits" value={refundedOrders.length} />
        <Card label="Status" value="Prototype Live" />
      </section>

      <section className="bg-white border border-slate-100 rounded-2xl p-6 space-y-4 shadow-sm">
        <h2 className="text-xl font-black">Withdraw to Bank</h2>
        <div className="grid md:grid-cols-[1fr_220px] gap-3">
          <input
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Enter withdrawal amount"
            className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button onClick={handleWithdraw} className="px-6 py-3 rounded-xl bg-primary text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:opacity-90 transition-all">
            Withdraw
          </button>
        </div>
        {message && <p className="text-sm text-slate-600 font-medium">{message}</p>}
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-100 rounded-2xl p-6 space-y-4 shadow-sm">
          <h3 className="text-lg font-black">Linked Bank</h3>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-800">HDFC Bank • **** 1842</p>
            <p className="text-xs text-slate-500 mt-1">Primary payout account</p>
          </div>
          <button className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50 transition-colors">Change Account</button>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-6 space-y-4 shadow-sm">
          <h3 className="text-lg font-black">Recent Payouts</h3>
          {recentWithdrawals.length === 0 ? (
            <p className="text-sm text-slate-400">No payout activity yet.</p>
          ) : (
            recentWithdrawals.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">{item.item_name}</p>
                <p className="text-sm font-black text-slate-700">₹{Number(item.amount).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-black">Refund Credit History</h2>
        {refundedOrders.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-8 text-slate-400 text-center shadow-sm">No refund credits available.</div>
        ) : (
          refundedOrders.map((item) => (
            <div key={item.id} className="bg-white border border-slate-100 rounded-2xl p-5 flex items-center justify-between shadow-sm">
              <div>
                <p className="font-bold text-slate-800">{item.item_name}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(item.created_at).toLocaleString()}</p>
              </div>
              <p className="font-black text-emerald-600">+₹{Number(item.amount).toLocaleString()}</p>
            </div>
          ))
        )}
      </section>
    </div>
  );
};

const Card = ({ label, value }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
    <p className="text-3xl font-black text-slate-900 mt-2">{value}</p>
  </div>
);

export default Wallet;
