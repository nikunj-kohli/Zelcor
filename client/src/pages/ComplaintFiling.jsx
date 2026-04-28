import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:3000/api';

const ComplaintFiling = () => {
  const [step, setStep] = useState(1);
  const [selectedTx, setSelectedTx] = useState(null);
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEscrows = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await axios.get(`${API_URL}/user/escrows?user_id=${session.user.id}`);
        setEscrows(res.data.escrows.filter(e => e.status === 'active'));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchEscrows();
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await axios.post(`${API_URL}/disputes/file`, {
        escrow_id: selectedTx,
        filed_by: session.user.id,
        reason,
        evidence_urls: [] // Placeholder
      });
      navigate(`/complaint/${res.data.dispute.id}`);
    } catch (e) {
      alert('Error filing complaint: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen font-black text-primary animate-pulse">LOADING ESCROWS</div>;

  return (
    <div className="bg-[#f8f9fc] min-h-screen font-body-lg text-on-surface">
      <header className="bg-white border-b border-slate-100 h-16 flex items-center px-8 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="material-symbols-outlined text-slate-400 hover:text-primary transition-colors">arrow_back</button>
          <h1 className="font-h2 text-lg font-bold">File a Complaint</h1>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto p-8 pt-12">
        {/* Step Progress */}
        <div className="mb-12 flex justify-between items-center relative">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -translate-y-1/2 z-0"></div>
          {[1, 2, 3].map((s) => (
            <div key={s} className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${step >= s ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                {s}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white p-12 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 min-h-[500px]">
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="font-h2 text-3xl tracking-tight text-primary">Select Transaction</h2>
              <div className="space-y-4">
                {escrows.map((tx) => (
                  <label key={tx.id} className={`flex items-center justify-between p-6 rounded-3xl border-2 transition-all cursor-pointer ${selectedTx === tx.id ? 'border-primary bg-primary/5' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-6">
                      <input type="radio" className="w-6 h-6 text-primary" checked={selectedTx === tx.id} onChange={() => setSelectedTx(tx.id)} />
                      <div>
                        <p className="font-h3 text-lg">{tx.item_name}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">₹{tx.amount.toLocaleString()}</p>
                      </div>
                    </div>
                  </label>
                ))}
                {escrows.length === 0 && <p className="text-center text-slate-400">No active transactions eligible for complaint.</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="font-h2 text-3xl tracking-tight text-primary">Upload Evidence</h2>
              <div className="border-4 border-dashed border-slate-100 rounded-[32px] p-12 text-center space-y-4 cursor-pointer hover:border-primary/20 transition-all">
                <span className="material-symbols-outlined text-4xl text-slate-300">cloud_upload</span>
                <p className="font-h3 text-lg">Upload Photos/Videos</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="font-h2 text-3xl tracking-tight text-primary">Details</h2>
              <textarea 
                className="w-full p-6 bg-slate-50 border-none rounded-[32px] font-body-lg focus:ring-2 focus:ring-primary min-h-[200px]" 
                placeholder="Explain the issue..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              ></textarea>
            </div>
          )}

          <div className="mt-12 flex justify-between">
            {step > 1 && <button onClick={() => setStep(step - 1)} className="px-8 py-4 text-primary font-bold">Back</button>}
            <button 
              onClick={() => step < 3 ? setStep(step + 1) : handleSubmit()}
              disabled={submitting || (step === 1 && !selectedTx)}
              className="ml-auto px-12 py-4 bg-primary text-white font-h3 rounded-2xl shadow-xl transition-all"
            >
              {submitting ? 'Submitting...' : (step < 3 ? 'Continue' : 'Submit Claim')}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ComplaintFiling;
