import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:3000/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [escrows, setEscrows] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
    if (!userId) return;

    try {
      const [profileRes, escrowsRes, disputesRes] = await Promise.all([
        axios.get(`${API_URL}/auth/profile/${userId}`),
        axios.get(`${API_URL}/user/escrows?user_id=${userId}`),
        axios.get(`${API_URL}/user/disputes?user_id=${userId}`),
      ]);
      setProfile(profileRes.data.profile);
      setEscrows(escrowsRes.data.escrows || []);
      setDisputes(disputesRes.data.disputes || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]">
        <div className="text-primary font-bold">Loading dashboard...</div>
      </div>
    );
  }

  const stats = {
    volume: escrows.reduce((sum, e) => sum + Number(e.amount), 0),
    totalOrders: escrows.length,
    pendingConfirm: escrows.filter((e) => e.status === 'active').length,
    ongoingComplaints: disputes.filter((d) => d.status === 'pending' || d.status === 'under_review').length,
    refundedTotal: escrows.filter((e) => e.status === 'refunded').reduce((sum, e) => sum + Number(e.amount), 0),
    trustScore: profile?.trust_score || 95,
  };

  return (
    <div className="max-w-[1200px] mx-auto w-full space-y-8">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}</h1>
          <p className="text-sm text-slate-500 mt-2">Built for 3 industries: ecommerce, insurance, rental.</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trust Health</p>
          <p className="text-3xl font-black text-primary leading-none mt-1">{stats.trustScore}</p>
        </div>
      </section>

      <section className="grid md:grid-cols-4 gap-6">
        <StatCard label="Protected Volume" val={`₹${stats.volume.toLocaleString()}`} desc="Across all industries" />
        <StatCard label="Total Orders" val={stats.totalOrders} desc={`${stats.pendingConfirm} pending confirmation`} />
        <StatCard label="Refunded Total" val={`₹${stats.refundedTotal.toLocaleString()}`} desc="Credited to Zelcor wallet" />
        <StatCard label="Ongoing Complaints" val={stats.ongoingComplaints} desc="In AI/company review" />
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <IndustryCard
          title="Ecommerce"
          description="Product escrow, delivery verification, damage complaints."
          actionLabel="Open Ecommerce"
          onClick={() => navigate('/shop')}
        />
        <IndustryCard
          title="Insurance"
          description="Claim assurance and payout dispute handling."
          actionLabel="Open Insurance"
          onClick={() => navigate('/insurance')}
        />
        <IndustryCard
          title="Rental"
          description="Deposit protection and move-in/move-out proof."
          actionLabel="Open Rental"
          onClick={() => navigate('/rental')}
        />
      </section>

      <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black tracking-tight">Quick Actions</h3>
          <button onClick={() => navigate('/orders')} className="text-xs font-bold text-primary hover:underline">Go to My Orders</button>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <ActionCard title="Manage Orders" description="Confirm deliveries and raise complaints." buttonLabel="Open Orders" onClick={() => navigate('/orders')} />
          <ActionCard title="Withdraw Refunds" description="Move your available refunds to bank account." buttonLabel="Open Wallet" onClick={() => navigate('/wallet')} />
          <ActionCard title="Track Complaints" description="Review ongoing and resolved complaint outcomes." buttonLabel="Open Complaints" onClick={() => navigate('/complaints')} />
        </div>
      </section>
    </div>
  );
};

const NavItem = ({ icon, label, href, active = false }) => (
  <a href={href} className={`flex items-center gap-4 px-6 py-4 rounded-[20px] transition-all ${active ? 'bg-primary text-white' : 'text-slate-400 hover:text-primary hover:bg-slate-50'}`}>
    <span className="material-symbols-outlined text-xl">{icon}</span>
    <span className={`text-sm font-bold ${active ? 'text-white' : 'text-slate-500'}`}>{label}</span>
  </a>
);

const StatCard = ({ label, val, desc }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100">
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
    <p className="text-4xl font-black tracking-tight text-slate-900 mt-2">{val}</p>
    <p className="text-xs text-slate-500 mt-1">{desc}</p>
  </div>
);

const IndustryCard = ({ title, description, actionLabel, onClick }) => (
  <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
    <h4 className="text-xl font-black">{title}</h4>
    <p className="text-sm text-slate-500">{description}</p>
    <button onClick={onClick} className="w-full py-3 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-widest">{actionLabel}</button>
  </div>
);

const ActionCard = ({ title, description, buttonLabel, onClick }) => (
  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
    <h5 className="font-black text-slate-900">{title}</h5>
    <p className="text-sm text-slate-500 mt-2">{description}</p>
    <button onClick={onClick} className="mt-3 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black text-primary">{buttonLabel}</button>
  </div>
);

export default Dashboard;
