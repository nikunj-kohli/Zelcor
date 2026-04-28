import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:3000/api';

const ComplaintsList = () => {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [complaints, setComplaints] = useState([]);

  useEffect(() => {
    const fetchComplaints = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return setLoading(false);
      try {
        const res = await axios.get(`${API_URL}/user/disputes?user_id=${session.user.id}`);
        setComplaints(res.data?.disputes || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchComplaints();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'active') return complaints.filter((c) => c.status === 'pending' || c.status === 'under_review');
    if (filter === 'resolved') return complaints.filter((c) => c.status === 'settled' || c.status === 'escalated');
    return complaints;
  }, [complaints, filter]);

  const navigate = useNavigate();

  return (
    <div className="max-w-[1200px] mx-auto w-full space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight">Case History</h1>
          <p className="text-slate-500">Track the progress of all your filed disputes and resolution status.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
            <span className="material-symbols-outlined text-slate-400">search</span>
            <input type="text" placeholder="Search cases..." className="bg-transparent border-none text-sm focus:ring-0 w-48 outline-none" />
          </div>
          <button onClick={() => navigate('/orders')} className="bg-primary text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-xl hover:-translate-y-1 transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-sm">add</span>
            File New Complaint
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-4 p-1.5 bg-slate-100/50 rounded-2xl w-fit border border-slate-100">
        <button onClick={() => setFilter('all')} className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${filter === 'all' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>All Cases</button>
        <button onClick={() => setFilter('active')} className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${filter === 'active' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Active</button>
        <button onClick={() => setFilter('resolved')} className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${filter === 'resolved' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Resolved</button>
      </div>

      {/* Complaints Table */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="px-10 py-6">Complaint ID</th>
              <th className="px-6 py-6">Item / Service</th>
              <th className="px-6 py-6">Amount</th>
              <th className="px-6 py-6">Status</th>
              <th className="px-6 py-6">Date</th>
              <th className="px-10 py-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {!loading && filtered.map((comp) => (
              <tr key={comp.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => navigate(`/complaint/${comp.id}`)}>
                <td className="px-10 py-8 font-mono text-xs text-slate-400">#{comp.id.slice(0, 8)}</td>
                <td className="px-6 py-8">
                  <div>
                    <p className="font-bold text-slate-800 mb-1">{comp.escrows?.item_name || 'Escrow complaint'}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Escrow #{comp.escrow_id?.slice(0, 8)}</p>
                  </div>
                </td>
                <td className="px-6 py-8 font-black text-primary text-lg">₹{Number(comp.escrows?.amount || 0).toLocaleString()}</td>
                <td className="px-6 py-8">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
                    comp.status === 'settled' || comp.status === 'escalated' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {comp.status}
                  </span>
                </td>
                <td className="px-6 py-8 text-sm font-bold text-slate-500">{new Date(comp.created_at).toLocaleDateString()}</td>
                <td className="px-10 py-8 text-right">
                  <button className="material-symbols-outlined text-slate-200 group-hover:text-primary transition-all">chevron_right</button>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan="6" className="px-10 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No cases found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ComplaintsList;
