import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      if (!userId) return;

      try {
        const res = await axios.get(`${API_URL}/auth/profile/${userId}`);
        setProfile(res.data.profile);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) return <div className="p-12 text-center animate-pulse font-black text-primary uppercase tracking-widest">Loading Identity...</div>;

  return (
    <div className="bg-[#f8f9fc] min-h-screen p-10 font-body-lg">
      <div className="max-w-[800px] mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <h1 className="font-h1 text-4xl tracking-tight">Your Identity</h1>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-100 shadow-sm">
            <span className="material-symbols-outlined text-emerald-500 text-sm">verified</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Google Verified</span>
          </div>
        </header>

        <div className="bg-white rounded-[48px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="h-32 bg-primary relative">
            <div className="absolute -bottom-12 left-12">
              <div className="w-24 h-24 rounded-[32px] bg-white p-1 border-4 border-white shadow-xl">
                <div className="w-full h-full rounded-[24px] bg-slate-50 flex items-center justify-center text-primary font-black text-4xl">
                  {profile?.full_name?.charAt(0)}
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-12 pt-16 space-y-10">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-h2 text-3xl mb-1">{profile?.full_name}</h2>
                <p className="text-slate-400 font-medium">{profile?.email}</p>
              </div>
              <button className="px-6 py-3 bg-slate-50 text-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">Edit Profile</button>
            </div>

            <div className="grid grid-cols-2 gap-8 py-8 border-y border-slate-50">
              <div>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Wallet Address</p>
                <div className="flex items-center gap-2 group cursor-pointer">
                  <p className="font-data-mono text-sm text-primary font-bold">{profile?.wallet_address || 'Not Connected'}</p>
                  <span className="material-symbols-outlined text-sm text-slate-300 group-hover:text-primary transition-colors">content_copy</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Member Since</p>
                <p className="text-sm font-bold text-slate-700">{new Date(profile?.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="font-h3 text-xl">Trust Metrics</h3>
              <div className="grid grid-cols-3 gap-6">
                <MetricCard label="Current Score" val={profile?.trust_score} color="primary" />
                <MetricCard label="Claims Won" val="12" color="emerald" />
                <MetricCard label="Resolutions" val="100%" color="blue" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-4">
             <h4 className="font-h3 text-lg">Blockchain Identity</h4>
             <p className="text-xs text-slate-400 leading-relaxed">Your identity is cryptographically linked to your wallet. Every transaction you complete increases your decentralized reputation.</p>
             <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-black transition-all">View on Etherscan</button>
          </div>
          <div className="bg-[#f27a6b]/5 p-8 rounded-[40px] border border-[#f27a6b]/10 shadow-sm space-y-4">
             <h4 className="font-h3 text-lg text-[#f27a6b]">Enterprise Status</h4>
             <p className="text-xs text-[#f27a6b]/60 leading-relaxed">You are currently a Customer. Switch to Enterprise to start protecting your sales and managing your own company bond.</p>
             <button className="w-full py-4 bg-[#f27a6b] text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:opacity-90 transition-all">Apply as Enterprise</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ label, val, color }) => (
  <div className="bg-slate-50 p-6 rounded-[32px] space-y-1">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    <p className={`text-2xl font-black text-${color}-600`}>{val}</p>
  </div>
);

export default Profile;
