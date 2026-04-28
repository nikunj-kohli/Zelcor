import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const CompanyDashboard = () => {
  const [activeTab, setActiveTab] = useState('Overview');
  const [expandedCase, setExpandedCase] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const isDemoCompany = localStorage.getItem('zelcor_demo_role') === 'company';
      
      const companyId = isDemoCompany ? '88888888-8888-8888-8888-888888888888' : session?.user?.id;
      if (!companyId) return;


      try {
        const res = await axios.get(`${API_URL}/company/dashboard?company_id=${companyId}`);
        setDisputes(res.data.disputes || []);
        setStats(res.data.stats);
      } catch (e) {

        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleRespond = async (disputeId, action) => {
    try {
      await axios.post(`${API_URL}/company/respond`, { dispute_id: disputeId, action });
      alert('Action successful');
      window.location.reload();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen font-black text-primary animate-pulse">LOADING ENTERPRISE PORTAL</div>;

  return (
    <div className="bg-[#f8f9fc] text-[#191c1e] min-h-screen flex flex-col lg:flex-row font-body-lg">
      {/* Sidebar (Same as before but active state linked) */}
      <aside className="bg-slate-900 w-full lg:w-64 lg:fixed lg:h-screen left-0 top-0 z-50 flex flex-col py-5 lg:py-8">
        <div className="px-6 lg:px-8 mb-5 lg:mb-12">
          <div className="text-white font-black text-2xl tracking-tighter">zelcor</div>
        </div>
        <nav className="flex-1 flex gap-2 overflow-x-auto px-4 lg:block lg:space-y-2">
          {['Overview', 'Complaints', 'Analytics', 'Settings'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`shrink-0 lg:w-full flex items-center gap-4 px-5 lg:px-6 py-3 lg:py-4 rounded-2xl transition-all ${activeTab === tab ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}>
              <span className="font-bold text-sm whitespace-nowrap">{tab}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="lg:ml-64 flex-1 p-4 sm:p-6 lg:p-12 min-w-0">
        <header className="mb-8 lg:mb-12">
          <h1 className="font-h1 text-3xl sm:text-4xl tracking-tighter">Enterprise Portal</h1>
        </header>

        <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-8 mb-8 lg:mb-12">
          {[
            { label: 'Total Volume', value: `₹${stats?.total_volume?.toLocaleString() || '0'}`, color: 'primary' },
            { label: 'Active Disputes', value: stats?.active_disputes || '0', color: 'error' },
            { label: 'Completed', value: stats?.completed || '0', color: 'secondary' },
            { label: 'Refunded', value: stats?.refunded || '0', color: 'tertiary' }
          ].map((stat) => (
            <div key={stat.label} className="bg-white p-5 sm:p-8 rounded-[28px] sm:rounded-[40px] border border-slate-100 shadow-sm">
              <p className="font-h2 text-2xl sm:text-3xl tracking-tighter break-words">{stat.value}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
            </div>
          ))}
        </section>

        <section className="bg-white rounded-[28px] sm:rounded-[48px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-10 py-6">ID</th>
                <th className="px-6 py-6">Status</th>
                <th className="px-6 py-6">AI Score</th>
                <th className="px-10 py-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {disputes.map((item) => (
                <React.Fragment key={item.id}>
                  <tr className="cursor-pointer" onClick={() => setExpandedCase(expandedCase === item.id ? null : item.id)}>
                    <td className="px-10 py-8 font-data-mono text-sm">{item.id.slice(0, 8)}</td>
                    <td className="px-6 py-8 font-bold text-primary">{item.status}</td>
                    <td className="px-6 py-8">{(item.ai_probability_legit * 100).toFixed(0)}%</td>
                    <td className="px-10 py-8 text-right"><span className="material-symbols-outlined">expand_more</span></td>
                  </tr>
                  {expandedCase === item.id && (
                    <tr className="bg-slate-50">
                      <td colSpan="4" className="px-10 py-10">
                        <div className="space-y-6">
                          <p className="italic">Reason: "{item.reason}"</p>
                          <div className="flex gap-4">
                            <button onClick={() => handleRespond(item.id, 'approve_refund')} className="px-8 py-4 bg-primary text-white font-bold rounded-2xl">Approve Refund</button>
                            <button className="px-8 py-4 bg-white border border-slate-200 font-bold rounded-2xl">Request More Info</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {disputes.length === 0 && <tr><td colSpan="4" className="p-12 text-center text-slate-400">No disputes found.</td></tr>}
            </tbody>
          </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default CompanyDashboard;
