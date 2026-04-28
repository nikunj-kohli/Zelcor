import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:3000/api';

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    full_name: '',
    wallet_address: '',
    avatar_url: '',
    is_enterprise: false,
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      if (!userId) return;

      try {
        const res = await axios.get(`${API_URL}/auth/profile/${userId}`);
        setProfile(res.data.profile);
        setForm({
          full_name: res.data.profile?.full_name || '',
          wallet_address: res.data.profile?.wallet_address || '',
          avatar_url: res.data.profile?.avatar_url || '',
          is_enterprise: Boolean(res.data.profile?.is_enterprise),
        });
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) return <div className="p-12 text-center animate-pulse font-black text-primary uppercase tracking-widest">Loading Identity...</div>;

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      const res = await axios.put(`${API_URL}/auth/profile/${userId}`, form);
      setProfile(res.data.profile);
      setMessage('Profile updated successfully.');
    } catch (error) {
      setMessage(error?.response?.data?.error || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[800px] mx-auto space-y-8">
      <div className="bg-white rounded-[48px] border border-slate-100 shadow-xl overflow-hidden">
        <div className="h-40 bg-gradient-to-r from-primary to-primary-dark relative">
          <div className="absolute -bottom-16 left-12">
            <div className="w-32 h-32 rounded-[40px] bg-white p-1 border-8 border-white shadow-2xl relative group">
              <div className="w-full h-full rounded-[32px] bg-slate-50 flex items-center justify-center text-primary font-black text-5xl">
                {profile?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-[32px] opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                <span className="material-symbols-outlined text-white">edit</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-12 pt-20 space-y-10">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-black tracking-tight mb-1">{form.full_name || profile?.full_name}</h2>
              <p className="text-slate-400 font-medium">{profile?.email}</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 shadow-xl shadow-slate-200"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Full Name</label>
              <input
                className="w-full p-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="Full Name"
                value={form.full_name}
                onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Wallet Address</label>
              <input
                className="w-full p-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="Wallet Address"
                value={form.wallet_address}
                onChange={(e) => setForm((prev) => ({ ...prev, wallet_address: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Avatar URL</label>
              <input
                className="w-full p-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="Avatar URL (optional)"
                value={form.avatar_url}
                onChange={(e) => setForm((prev) => ({ ...prev, avatar_url: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                  checked={form.is_enterprise}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_enterprise: e.target.checked }))}
                />
                <span className="text-sm font-bold text-slate-700">Enable Enterprise Dashboard features</span>
              </label>
            </div>
            {message && (
              <div className={`md:col-span-2 p-4 rounded-2xl text-sm font-bold ${message.includes('success') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                {message}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-8 py-8 border-y border-slate-50">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Zelcor Identity</p>
              <div className="flex items-center gap-2 group cursor-pointer">
                <p className="font-mono text-xs text-primary font-bold truncate max-w-[200px]">{profile?.id}</p>
                <span className="material-symbols-outlined text-sm text-slate-300 group-hover:text-primary transition-colors">content_copy</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Member Since</p>
              <p className="text-sm font-bold text-slate-700">{new Date(profile?.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-black tracking-tight">Trust Insights</h3>
            <div className="grid grid-cols-3 gap-6">
              <MetricCard label="Trust Score" val={profile?.trust_score} />
              <MetricCard label="Claims Won" val="12" />
              <MetricCard label="Resolutions" val="100%" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-4">
           <h4 className="text-lg font-black">Blockchain Identity</h4>
           <p className="text-xs text-slate-400 leading-relaxed">Your identity is cryptographically linked to your wallet. Every transaction you complete increases your decentralized reputation.</p>
           <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-black transition-all">View on Explorer</button>
        </div>
        <div className="bg-[#f27a6b]/5 p-8 rounded-[40px] border border-[#f27a6b]/10 shadow-sm space-y-4">
           <h4 className="text-lg font-black text-[#f27a6b]">Enterprise Status</h4>
           <p className="text-xs text-[#f27a6b]/60 leading-relaxed">You are currently a Customer. Switch to Enterprise to start protecting your sales and managing your own company bond.</p>
           <button className="w-full py-4 bg-[#f27a6b] text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:opacity-90 transition-all">Apply for Enterprise</button>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ label, val }) => (
  <div className="bg-slate-50 p-6 rounded-[32px] space-y-1">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    <p className="text-2xl font-black text-slate-800">{val || 0}</p>
  </div>
);

export default Profile;
