import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const ComplaintDetail = () => {
  const { id } = useParams();
  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDispute = async () => {
      try {
        const res = await axios.get(`${API_URL}/disputes/${id}`);
        setDispute(res.data.dispute);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchDispute();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center min-h-screen font-black text-primary animate-pulse">LOADING CASE</div>;
  if (!dispute) return <div className="p-12 text-center font-bold">Case not found</div>;
  let parsedSummary = null;
  try {
    parsedSummary = dispute.ai_analysis_summary ? JSON.parse(dispute.ai_analysis_summary) : null;
  } catch {
    parsedSummary = null;
  }

  return (
    <div className="bg-[#f8f9fc] min-h-screen font-body-lg text-on-surface pb-24">
      <header className="bg-white border-b border-slate-100 h-16 flex items-center px-8 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="material-symbols-outlined text-slate-400 hover:text-primary transition-colors">arrow_back</button>
          <h1 className="font-h2 text-lg font-bold">Complaint Detail</h1>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto p-8 pt-12 space-y-8">
        <section className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="font-h1 text-4xl tracking-tighter">Case #{dispute.id.slice(0, 8)}</h2>
              <span className="bg-primary/10 text-primary px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">{dispute.status}</span>
            </div>
            <div className="flex flex-wrap gap-6 text-sm font-medium text-slate-500">
              <div className="flex items-center gap-2 font-data-mono">
                <span className="material-symbols-outlined text-sm">dataset</span>
                <span>Proof: {dispute.escrows?.blockchain_tx_hash?.slice(0, 10) || 'Pending'}...</span>
              </div>
            </div>
          </div>
          <div className="bg-primary p-6 rounded-[32px] text-white flex items-center gap-6 shadow-xl shadow-primary/20">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-white animate-pulse">schedule</span>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Company Deadline</p>
              <p className="font-h2 text-2xl tracking-tighter">
                {Math.max(0, Math.round((new Date(dispute.escrows.auto_release_at) - new Date()) / 3600000))}h left
              </p>
            </div>
          </div>
        </section>

        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-8">
            <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm space-y-8">
              <h3 className="font-h3 text-xl">Reason for Dispute</h3>
              <p className="text-on-surface-variant leading-relaxed p-6 bg-slate-50 rounded-3xl border border-slate-100 italic">
                "{dispute.reason}"
              </p>
            </div>

            {dispute.evidence && dispute.evidence.length > 0 && (
              <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm space-y-8">
                <h3 className="font-h3 text-xl">Evidence</h3>
                <div className="grid grid-cols-2 gap-4">
                  {dispute.evidence.map((ev, i) => (
                    <div key={i} className="aspect-video rounded-3xl overflow-hidden border border-slate-100">
                      {ev.file_type === 'video' ? (
                        <video className="w-full h-full object-cover" src={ev.file_url} controls />
                      ) : (
                        <img className="w-full h-full object-cover" src={ev.file_url} alt="evidence" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 space-y-8">
            <div className="bg-surface-container-low p-10 rounded-[48px] border-l-8 border-l-primary space-y-6">
              <div className="flex items-center gap-3 text-primary">
                <span className="material-symbols-outlined">smart_toy</span>
                <h4 className="font-h3 text-xl">Zelcor AI Analysis</h4>
              </div>
              <p className="text-on-surface-variant leading-relaxed italic">
                Analysis suggests a validity score of {(dispute.ai_probability_legit * 100).toFixed(1)}%. Suggested Action: {parsedSummary?.suggested_action || dispute.ai_analysis_summary || 'Under Review'}.
              </p>
              {parsedSummary?.media_analysis && (
                <div className="text-xs text-slate-600 bg-white rounded-2xl p-4 border border-slate-100 space-y-1">
                  <p className="font-bold uppercase tracking-widest text-slate-400">Media Security</p>
                  <p>Captured in app: {parsedSummary.media_analysis.captureIntegrity?.capturedInApp ?? 0}</p>
                  <p>Gallery uploads: {parsedSummary.media_analysis.captureIntegrity?.uploadedFromGallery ?? 0}</p>
                </div>
              )}
              {parsedSummary?.auto_resolution && (
                <div className="text-xs text-slate-700 bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                  {parsedSummary.auto_resolution === 'refund_initiated'
                    ? 'Product marked as returned. Refund initiated to your primary bank account.'
                    : 'Complaint is under AI and smart-contract review.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ComplaintDetail;
