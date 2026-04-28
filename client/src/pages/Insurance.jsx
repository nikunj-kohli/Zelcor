import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const Insurance = () => {
  const [activeTab, setActiveTab] = useState('policies'); // 'policies', 'claims'
  const [filter, setFilter] = useState('All');
  const [policies, setPolicies] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFileClaim, setShowFileClaim] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPolicyForPayment, setSelectedPolicyForPayment] = useState(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  
  const [formData, setFormData] = useState({
    purchase_id: '',
    diagnosis: '',
    symptoms: '',
    admission_type: 'OPD / Routine',
    treatment_type: '',
    hospital_name: '',
    claim_amount: '',
    doctor_note: '',
    receipts: null,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchPolicies(),
        fetchPurchases(),
        fetchClaims()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPolicies = async () => {
    try {
      const res = await axios.get(`${API_URL}/insurance/policies`);
      if (res.data.success) {
        setPolicies(res.data.policies || []);
      }
    } catch (error) {
      console.error('Error fetching policies:', error);
    }
  };

  const fetchPurchases = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      if (userId) {
        const res = await axios.get(`${API_URL}/insurance/purchases?user_id=${userId}`);
        if (res.data.success) {
          setPurchases(res.data.purchases || []);
        }
      }
    } catch (error) {
      console.error('Error fetching purchases:', error);
    }
  };

  const fetchClaims = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      if (userId) {
        const res = await axios.get(`${API_URL}/insurance/claims?user_id=${userId}`);
        if (res.data.success) {
          setClaims(res.data.claims || []);
        }
      }
    } catch (error) {
      console.error('Error fetching claims:', error);
    }
  };

  const handleBuyPolicy = (policy) => {
    setSelectedPolicyForPayment(policy);
    setShowPaymentModal(true);
  };

  const handleDemoPaymentComplete = async () => {
    if (!selectedPolicyForPayment) return;
    setIsPurchasing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      const res = await axios.post(`${API_URL}/insurance/buy-demo`, {
        user_id: userId,
        policy_id: selectedPolicyForPayment.id
      });
      if (res.data.success) {
        setShowPaymentModal(false);
        await fetchPurchases();
        setActiveTab('claims');
      }
    } catch (error) {
      alert('Payment failed');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleSubmitClaim = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      
      await axios.post(`${API_URL}/insurance/claim`, {
        user_id: userId,
        purchase_id: formData.purchase_id,
        claim_amount: parseFloat(formData.claim_amount),
        diagnosis: formData.diagnosis,
        symptoms: formData.symptoms,
        admission_type: formData.admission_type,
        treatment_type: formData.treatment_type,
        hospital_name: formData.hospital_name,
        doctor_note: formData.doctor_note,
        policy_document_url: formData.file ? formData.file.name : 'receipt-scanned.pdf',
      });

      setShowFileClaim(false);
      setFormData({ purchase_id: '', diagnosis: '', symptoms: '', admission_type: 'OPD / Routine', treatment_type: '', hospital_name: '', claim_amount: '', doctor_note: '', file: null });
      await fetchClaims();
    } catch (error) {
      alert('Error filing claim');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPolicies = policies.filter(p => filter === 'All' || p.type === filter);

  const totalProtectedValue = claims.reduce((sum, c) => sum + (c.claim_amount || 0), 0);
  const urgentQueueCount = claims.filter(c => c.urgency === 'emergency' || c.urgency === 'critical').length;
  const approvedCount = claims.filter(c => c.status === 'approved').length;

  if (loading) return <div className="p-20 text-center animate-pulse font-black text-primary uppercase tracking-widest">Loading Portal...</div>;

  return (
    <div className="max-w-[1200px] mx-auto space-y-10 pb-20">
      {/* Top Navigation Tabs */}
      <div className="flex justify-end mb-8">
        <div className="flex p-1.5 bg-slate-100/50 rounded-[24px] backdrop-blur-sm">
          <button 
            onClick={() => setActiveTab('policies')}
            className={`px-10 py-3.5 rounded-[20px] font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'policies' ? 'bg-white text-[#1a3a5f] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Policies
          </button>
          <button 
            onClick={() => setActiveTab('claims')}
            className={`px-10 py-3.5 rounded-[20px] font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'claims' ? 'bg-white text-[#1a3a5f] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            My Claims
          </button>
        </div>
      </div>

      {activeTab === 'policies' ? (
        <div className="space-y-12">
          {/* Filters & Search */}
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-1 w-full bg-white border border-slate-100 rounded-[28px] px-6 py-4 flex items-center gap-4 shadow-sm focus-within:border-primary/50 transition-all">
              <span className="material-symbols-outlined text-slate-400">search</span>
              <input type="text" placeholder="Search health, vehicle, life..." className="bg-transparent flex-1 outline-none font-bold text-sm" />
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              {['All', 'Health', 'Vehicle', 'Property', 'Travel'].map(cat => (
                <button 
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all ${filter === cat ? 'bg-slate-900 text-white' : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPolicies.map(policy => (
              <div key={policy.id} className="bg-white rounded-[40px] border border-slate-50 p-8 shadow-sm hover:shadow-xl transition-all group flex flex-col">
                <div className="flex justify-between items-start mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:bg-primary/10 transition-all">
                    <span className="material-symbols-outlined text-3xl">{policy.type === 'Health' ? 'medical_services' : policy.type === 'Vehicle' ? 'directions_car' : 'shield'}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{policy.type}</p>
                    <p className="text-2xl font-black text-slate-900">₹{policy.premium_amount?.toLocaleString()}</p>
                  </div>
                </div>
                
                <h3 className="text-2xl font-black text-slate-900 mb-4 leading-tight">{policy.name}</h3>
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest">
                    Coverage: ₹{policy.coverage_amount?.toLocaleString()}
                  </span>
                </div>
                <p className="text-slate-500 font-medium text-sm leading-relaxed mb-8 flex-1">{policy.description}</p>
                
                <div className="space-y-3 mb-8">
                  {(Array.isArray(policy.terms) ? policy.terms : (policy.terms?.split(',') || [])).slice(0, 2).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      <span className="material-symbols-outlined text-emerald-500 text-sm">verified</span>
                      {f.replace(/[{}" ]/g, '')}
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => handleBuyPolicy(policy)}
                  className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] hover:bg-primary hover:shadow-xl transition-all"
                >
                  Buy Protection
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_380px] gap-10 items-start">
          <div className="space-y-10">
            {/* Row 1: High Impact Stats (matching screenshot) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="bg-[#1a3a5f] p-8 md:p-10 rounded-[48px] text-white shadow-2xl relative overflow-hidden group min-h-[180px] flex flex-col justify-center">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-all group-hover:scale-150 duration-700"></div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Protected Value</p>
                  <p className="text-3xl md:text-4xl font-black tracking-tighter leading-none whitespace-nowrap">₹{totalProtectedValue.toLocaleString()}</p>
               </div>
               <div className="bg-[#eef5ff] p-10 rounded-[48px] text-[#1a3a5f] border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Urgent Queue</p>
                  <p className="text-4xl font-black">{urgentQueueCount}</p>
               </div>
               <div className="bg-[#eef5ff] p-10 rounded-[48px] text-[#1a3a5f] border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Approved</p>
                  <p className="text-4xl font-black">{approvedCount}</p>
               </div>
            </div>

            {/* Row 2: Detailed Metrics (matching screenshot sub-row) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
               <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex items-center gap-6 group hover:border-primary/20 transition-all">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                    <span className="material-symbols-outlined text-3xl">receipt_long</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Claims</p>
                    <p className="text-3xl font-black text-slate-900 leading-none">{claims.length}</p>
                  </div>
               </div>
               <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex items-center gap-6 group hover:border-orange-200 transition-all">
                  <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-400">
                    <span className="material-symbols-outlined text-3xl">hourglass_empty</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pending</p>
                    <p className="text-3xl font-black text-slate-900 leading-none">{claims.filter(c => c.status === 'pending').length}</p>
                  </div>
               </div>
               <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex items-center gap-6 group hover:border-emerald-200 transition-all">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-400">
                    <span className="material-symbols-outlined text-3xl">check_circle</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Approved</p>
                    <p className="text-3xl font-black text-slate-900 leading-none">{approvedCount}</p>
                  </div>
               </div>
               <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex items-center gap-6 group hover:border-red-200 transition-all">
                  <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-400">
                    <span className="material-symbols-outlined text-3xl">report_problem</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Urgent</p>
                    <p className="text-3xl font-black text-slate-900 leading-none">{urgentQueueCount}</p>
                  </div>
               </div>
            </div>

            {/* Claims Main View */}
            <div className="bg-white rounded-[48px] border border-slate-50 p-12 shadow-sm min-h-[500px]">
              <div className="flex justify-between items-center mb-10">
                 <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Your Claims</h3>
                    <p className="text-slate-400 text-sm font-bold">Status, urgency, amount, and AI review signal in one place.</p>
                 </div>
                 <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black text-slate-500">
                       All Packages <span className="material-symbols-outlined text-sm">expand_more</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{claims.length} Records</p>
                 </div>
              </div>

              {claims.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                  <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300">
                    <span className="material-symbols-outlined text-4xl">assignment_late</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">No claims yet</h3>
                  <button 
                    onClick={() => setShowFileClaim(true)}
                    className="px-10 py-5 bg-slate-900 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all"
                  >
                    File First Claim
                  </button>
                </div>
              ) : (
                <div className="space-y-12">
                   {claims.map(claim => (
                      <div key={claim.id} className="relative pb-8 border-b border-slate-50 last:border-0 group">
                         <div className="flex flex-col gap-6">
                            <div className="flex flex-wrap items-center gap-3">
                               <span className="text-[10px] font-mono text-slate-400">#{claim.id.slice(0, 8)}</span>
                               <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                  claim.urgency === 'emergency' ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' :
                                  claim.urgency === 'critical' ? 'bg-rose-100 text-rose-600' :
                                  'bg-blue-100 text-blue-600'
                               }`}>{claim.urgency}</span>
                               <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest">{claim.insurance_policies?.name || 'Comprehensive Health Insurance'}</span>
                               <span className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse">
                                  <span className="material-symbols-outlined text-sm">schedule</span>
                                  PAY WITHIN 48H
                               </span>
                            </div>

                            <div className="flex justify-between items-start">
                               <div className="space-y-1">
                                  <h4 className="text-2xl font-black text-slate-900 leading-tight">{claim.diagnosis}</h4>
                                  <p className="text-sm font-bold text-slate-400">₹{claim.claim_amount?.toLocaleString()} • Filed on {new Date(claim.created_at).toLocaleDateString()}</p>
                                </div>
                                <div className="text-right">
                                   <div className={`text-xl font-black uppercase tracking-widest ${claim.status === 'pending' ? 'text-slate-400' : 'text-emerald-500'}`}>
                                      {claim.status}
                                   </div>
                                   <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/5 rounded-lg text-[9px] font-black text-primary uppercase tracking-widest mt-2">
                                      <span className="material-symbols-outlined text-sm">verified_user</span>
                                      AI Reliability: 80%
                                   </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-[28px] p-6 border border-slate-100 relative">
                               <p className="text-sm text-slate-500 italic leading-relaxed">
                                  "{claim.ai_analysis?.reason || 'Emergency claim due to sudden onset of symptoms requiring immediate hospital admission as indicated in the medical notes.'}"
                               </p>
                               <div className="absolute -top-3 left-8 w-4 h-4 bg-slate-50 border-t border-l border-slate-100 rotate-45"></div>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Latest Case Analysis (High-Fidelity version) */}
          <div className="bg-white rounded-[48px] border border-slate-50 p-10 shadow-sm space-y-10 sticky top-24">
             <div className="flex items-center justify-between">
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Latest Case</p>
                   <h4 className="text-2xl font-black text-slate-900 tracking-tight">
                      {claims[0]?.diagnosis || 'No active claim'}
                   </h4>
                </div>
                <div className={`w-3 h-3 rounded-full animate-pulse ${claims[0]?.status === 'pending' ? 'bg-orange-400' : 'bg-emerald-400'}`}></div>
             </div>
             
             {claims.length > 0 ? (
               <div className="space-y-10">
                  <div className="flex flex-col items-center text-center p-8 bg-slate-50 rounded-[40px] border border-slate-100">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Live Status</p>
                     <span className="px-8 py-3 bg-white text-[#1a3a5f] rounded-full text-[11px] font-black shadow-sm uppercase tracking-[0.2em] border border-slate-100">
                        {claims[0].status?.toUpperCase()}
                     </span>
                  </div>

                  <div className="p-6 bg-red-50 border border-red-100 rounded-[32px] flex items-start gap-4">
                     <span className="material-symbols-outlined text-red-500">gavel</span>
                     <div>
                        <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Escrow Warning</p>
                        <p className="text-[11px] text-red-800/70 font-bold leading-tight">Process within 48h or the insurer's security bond will be compromised.</p>
                     </div>
                  </div>

                  <div className="space-y-8">
                     <div className="space-y-3">
                        <div className="flex justify-between items-center">
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Policy check</p>
                           <p className="text-[10px] font-black text-emerald-500">100%</p>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                           <div className="w-full h-full bg-emerald-500 rounded-full"></div>
                        </div>
                     </div>

                     <div className="space-y-3">
                        <div className="flex justify-between items-center">
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">AI Analysis</p>
                           <p className="text-[10px] font-black text-[#1a3a5f]">{claims[0].ai_analysis?.confidence_score || 80}%</p>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                           <div className="h-full bg-[#1a3a5f] rounded-full transition-all duration-1000" style={{ width: `${claims[0].ai_analysis?.confidence_score || 80}%` }}></div>
                        </div>
                     </div>
                  </div>

                  <div className="pt-8 border-t border-slate-100">
                     <div className="flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined text-[#1a3a5f] text-lg">psychology</span>
                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">AI Findings</p>
                     </div>
                     <div className="p-6 bg-slate-50 rounded-[28px] border border-slate-100">
                        <p className="text-xs text-slate-500 leading-relaxed italic">
                           "{claims[0].ai_analysis?.reason || 'Verification in progress...'}"
                        </p>
                     </div>
                  </div>

                  <button 
                    onClick={() => setShowFileClaim(true)}
                    className="w-full py-5 bg-[#1a3a5f] text-white rounded-[32px] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all group flex items-center justify-center gap-3"
                  >
                     <span className="material-symbols-outlined text-lg">add_circle</span>
                     File New Claim
                  </button>
               </div>
             ) : (
               <div className="py-24 text-center text-slate-300">
                  <span className="material-symbols-outlined text-6xl mb-6 opacity-20">analytics</span>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40">No active cases</p>
               </div>
             )}
          </div>
        </div>
      )}

      {/* Payment Modal (Razorpay Style) */}
      {showPaymentModal && selectedPolicyForPayment && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-xl">
          <div className="bg-white rounded-[48px] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Razorpay Checkout</h3>
              <button onClick={() => setShowPaymentModal(false)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors shadow-sm">
                 <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="p-10 space-y-10 flex flex-col items-center">
              <div className="inline-flex px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-100">Test Mode</div>
              
              <div className="w-56 h-56 bg-white border border-slate-100 rounded-[40px] p-6 shadow-xl relative group">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=pay-insurance-${selectedPolicyForPayment.id}`} className="w-full h-full group-hover:scale-105 transition-transform duration-500" alt="QR" />
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[40px]"></div>
              </div>

              <div className="text-center space-y-2">
                <p className="text-5xl font-black text-slate-900">Rs. {selectedPolicyForPayment.premium_amount?.toLocaleString()}</p>
                <p className="text-sm text-slate-400 font-bold max-w-[200px] mx-auto leading-relaxed">Scan QR to pay for {selectedPolicyForPayment.name}</p>
              </div>

              <button 
                onClick={handleDemoPaymentComplete}
                disabled={isPurchasing}
                className="w-full py-6 bg-emerald-500 text-white rounded-[28px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                {isPurchasing ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-xl">verified</span>}
                Payment Complete
              </button>
              
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest text-center">THIS IS A DUMMY PAYMENT FOR DEMONSTRATION PURPOSES</p>
            </div>
          </div>
        </div>
      )}

      {/* File Claim Modal (Intake Form from screenshot) */}
      {showFileClaim && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-10 bg-slate-900/90 backdrop-blur-3xl">
          <div className="bg-white rounded-[40px] md:rounded-[64px] w-full max-w-2xl h-full max-h-[90vh] shadow-2xl animate-in slide-in-from-bottom-12 duration-700 relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-primary-container"></div>
            
            {/* Modal Header - Fixed */}
            <div className="p-8 md:p-16 pb-0 flex items-center justify-between mb-8">
               <div>
                 <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-2">Claim Intake</p>
                 <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">File Insurance Claim</h2>
               </div>
               <button onClick={() => setShowFileClaim(false)} className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all hover:rotate-90">
                 <span className="material-symbols-outlined text-2xl">close</span>
               </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto px-8 md:px-16 pb-16 custom-scrollbar">
              <form onSubmit={handleSubmitClaim} className="space-y-10">
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Policy Package</label>
                  <select 
                    className="w-full px-8 py-5 rounded-[24px] bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-primary/20 focus:bg-white transition-all outline-none appearance-none"
                    value={formData.purchase_id}
                    onChange={(e) => setFormData({ ...formData, purchase_id: e.target.value })}
                    required
                  >
                    <option value="">Select a purchased policy</option>
                    {purchases.length > 0 ? (
                      purchases.map(p => (
                        <option key={p.id} value={p.id}>{p.insurance_policies?.name} - #{p.id.slice(0, 8)}</option>
                      ))
                    ) : (
                      <option disabled>No active policies found</option>
                    )}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Diagnosis</label>
                  <input 
                    type="text" 
                    className="w-full px-8 py-5 rounded-[24px] bg-slate-50 border-2 border-transparent font-bold placeholder:text-slate-300 focus:border-primary/20 focus:bg-white transition-all outline-none"
                    placeholder="e.g., cardiac arrest, surgery, cancer treatment"
                    value={formData.diagnosis}
                    onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                    required
                  />
                  <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest px-2">Critical keywords can trigger faster insurer response deadlines.</p>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Symptoms / Current Condition</label>
                  <textarea 
                    className="w-full px-8 py-6 rounded-[32px] bg-slate-50 border-2 border-transparent font-medium placeholder:text-slate-300 focus:border-primary/20 focus:bg-white transition-all outline-none min-h-[140px]"
                    placeholder="e.g., chest pain, breathlessness, ICU admission, severe bleeding"
                    value={formData.symptoms}
                    onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
                    required
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Admission Type</label>
                    <select 
                      className="w-full px-8 py-5 rounded-[24px] bg-slate-50 border-2 border-transparent font-bold outline-none focus:border-primary/20 focus:bg-white transition-all"
                      value={formData.admission_type}
                      onChange={(e) => setFormData({ ...formData, admission_type: e.target.value })}
                    >
                      <option value="OPD / Routine">OPD / Routine</option>
                      <option value="Inpatient">Inpatient</option>
                      <option value="Emergency / ICU">Emergency / ICU</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Treatment Type</label>
                    <input 
                      type="text" 
                      className="w-full px-8 py-5 rounded-[24px] bg-slate-50 border-2 border-transparent font-bold placeholder:text-slate-300 outline-none focus:border-primary/20 focus:bg-white transition-all"
                      placeholder="e.g., surgery, chemo, dialysis"
                      value={formData.treatment_type}
                      onChange={(e) => setFormData({ ...formData, treatment_type: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Hospital Name</label>
                  <input 
                    type="text" 
                    className="w-full px-8 py-5 rounded-[24px] bg-slate-50 border-2 border-transparent font-bold placeholder:text-slate-300 focus:border-primary/20 focus:bg-white transition-all outline-none"
                    placeholder="e.g., Apollo Hospital"
                    value={formData.hospital_name}
                    onChange={(e) => setFormData({ ...formData, hospital_name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Claim Amount (₹)</label>
                  <input 
                    type="number" 
                    className="w-full px-8 py-5 rounded-[24px] bg-slate-50 border-2 border-transparent font-bold placeholder:text-slate-300 focus:border-primary/20 focus:bg-white transition-all outline-none"
                    placeholder="e.g., 1200000"
                    value={formData.claim_amount}
                    onChange={(e) => setFormData({ ...formData, claim_amount: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Doctor Note / Medical Summary</label>
                  <textarea 
                    className="w-full px-8 py-6 rounded-[32px] bg-slate-50 border-2 border-transparent font-medium placeholder:text-slate-300 focus:border-primary/20 focus:bg-white transition-all outline-none min-h-[120px]"
                    placeholder="Paste a short discharge summary, doctor note, or medical finding."
                    value={formData.doctor_note}
                    onChange={(e) => setFormData({ ...formData, doctor_note: e.target.value })}
                    required
                  ></textarea>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Policy Document / Hospital Receipts</label>
                  <div 
                    onClick={() => document.getElementById('receipt-upload').click()}
                    className="w-full bg-slate-50 rounded-[24px] p-8 border-2 border-dashed border-slate-200 hover:border-primary/30 transition-all group flex flex-col items-center justify-center gap-2 cursor-pointer"
                  >
                     <input 
                       id="receipt-upload"
                       type="file" 
                       className="hidden" 
                       onChange={(e) => setFormData({ ...formData, file: e.target.files[0] })}
                     />
                     <span className="material-symbols-outlined text-slate-200 group-hover:text-primary transition-colors text-3xl">upload_file</span>
                     <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                       {formData.file ? (
                         <span className="text-primary">{formData.file.name}</span>
                       ) : (
                         <>Choose File <span className="text-slate-300 font-bold ml-1">No file chosen</span></>
                       )}
                     </p>
                  </div>
                </div>

                <div className="flex gap-4 pt-6 sticky bottom-0 bg-white/90 backdrop-blur-md pb-4">
                  <button 
                    type="button"
                    onClick={() => setShowFileClaim(false)}
                    className="flex-1 py-6 border-2 border-slate-100 text-slate-500 rounded-[28px] font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="flex-[2] py-6 bg-[#1a3a5f] text-white rounded-[28px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-black hover:scale-[1.01] transition-all flex items-center justify-center gap-3"
                  >
                    {submitting ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <span className="material-symbols-outlined">analytics</span>}
                    File Verified Claim
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Insurance;