import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import ComplaintModal from '../components/ComplaintModal';

const API_URL = 'http://localhost:3000/api';

const MyOrders = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [activities, setActivities] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEscrowId, setSelectedEscrowId] = useState(null);

  const fetchOrders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
    if (!userId) return;
    try {
      const [ordersRes, disputesRes] = await Promise.all([
        axios.get(`${API_URL}/user/escrows?user_id=${userId}`),
        axios.get(`${API_URL}/user/disputes?user_id=${userId}`),
      ]);
      setOrders(ordersRes.data?.escrows || []);
      setDisputes(disputesRes.data?.disputes || []);
      setActivities([
        { message: 'Payment received', amount: 'Protected order added', time: 'Just now' },
        { message: 'Refund received', amount: '₹1,200', time: 'Today, 10:30 AM' },
        { message: 'Complaint filed', amount: '₹15,000', time: 'Yesterday, 6:00 PM' },
        { message: 'Model review completed', amount: 'Contract path suggested', time: 'Yesterday, 5:42 PM' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleConfirm = async (escrowId) => {
    await axios.post(`${API_URL}/escrows/confirm`, { escrow_id: escrowId });
    await fetchOrders();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-primary">Loading orders...</div>;

  const activeOrders = orders.filter((o) => o.status === 'active');
  const historyOrders = orders.filter((o) => o.status !== 'active');
  const stats = {
    totalOrders: orders.length,
    activeQueue: activeOrders.length,
    complaints: disputes.length,
    refunded: orders.filter((o) => o.status === 'refunded').reduce((sum, o) => sum + Number(o.amount), 0),
  };

  return (
    <div className="max-w-[1200px] mx-auto w-full space-y-8">
      <section className="grid md:grid-cols-4 gap-6">
        <StatCard label="Total Orders" value={stats.totalOrders} />
        <StatCard label="Active Queue" value={stats.activeQueue} />
        <StatCard label="Complaints" value={stats.complaints} />
        <StatCard label="Refunded" value={`₹${stats.refunded.toLocaleString()}`} />
      </section>

      <section className="space-y-4">
        <h2 className="text-3xl font-black tracking-tight text-slate-900">Active Queue <span className="text-slate-300 ml-2">{activeOrders.length}</span></h2>
        {activeOrders.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-8 text-slate-400 text-center shadow-sm">No active orders found.</div>
        ) : (
          <div className="space-y-3">
            {activeOrders.map((item) => (
              <div key={item.id} className="bg-white border border-slate-100 rounded-2xl p-6 flex items-center justify-between shadow-sm hover:border-primary/20 transition-all">
                <div>
                  <p className="font-bold text-slate-800 text-lg">{item.item_name}</p>
                  <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-black">ID: {item.id.slice(0, 8)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-black text-xl text-slate-900">₹{Number(item.amount).toLocaleString()}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleConfirm(item.id)} className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:opacity-90">Confirm</button>
                    <button
                      onClick={() => {
                        setSelectedEscrowId(item.id);
                        setIsModalOpen(true);
                      }}
                      className="px-5 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-xs font-black uppercase tracking-widest hover:bg-rose-50"
                    >
                      Raise Complaint
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-3xl font-black tracking-tight text-slate-900">Order History <span className="text-slate-300 ml-2">{historyOrders.length}</span></h2>
        {historyOrders.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-8 text-slate-400 text-center shadow-sm">No historical orders available.</div>
        ) : (
          <div className="grid gap-3">
            {historyOrders.map((item) => (
              <div key={item.id} className="bg-white border border-slate-100 rounded-2xl p-5 flex items-center justify-between shadow-sm">
                <div>
                  <p className="font-bold text-slate-800">{item.item_name}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(item.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900">₹{Number(item.amount).toLocaleString()}</p>
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <span className={`w-2 h-2 rounded-full ${item.status === 'completed' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{item.status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-black tracking-tight text-slate-900">Recent Complaints <span className="text-slate-300 ml-2">{disputes.length}</span></h2>
          <button onClick={() => navigate('/complaints')} className="text-xs font-black text-primary hover:underline uppercase tracking-widest">View All</button>
        </div>
        {disputes.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-8 text-slate-400 text-center shadow-sm">No complaints filed yet.</div>
        ) : (
          <div className="grid gap-3">
            {disputes.map((dispute) => (
              <div 
                key={dispute.id} 
                onClick={() => navigate(`/complaint/${dispute.id}`)} 
                className="bg-white border border-slate-100 rounded-2xl p-5 flex items-center justify-between hover:border-primary/20 cursor-pointer shadow-sm transition-all"
              >
                <div>
                  <p className="font-bold text-slate-800">{dispute.escrows?.item_name || dispute.reason}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(dispute.created_at).toLocaleString()}</p>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${dispute.status === 'pending' || dispute.status === 'under_review' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {dispute.status === 'pending' || dispute.status === 'under_review' ? 'Under Review' : 'Resolved'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <ComplaintModal
        isOpen={isModalOpen}
        escrowId={selectedEscrowId}
        onSubmitted={fetchOrders}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEscrowId(null);
        }}
      />
    </div>
  );
};

const StatCard = ({ label, value }) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
    <p className="text-3xl font-black text-slate-900 mt-2">{value}</p>
  </div>
);

export default MyOrders;
