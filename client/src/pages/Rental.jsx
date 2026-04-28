import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const Rental = () => {
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewAgreement, setShowNewAgreement] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState(null);
  const [showComparison, setShowComparison] = useState(false);
  const [inspectionData, setInspectionData] = useState({ images: [], analysis: null });
  
  const [formData, setFormData] = useState({
    property_address: '',
    total_deposit: '',
    monthly_rent: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState(null); // 'upload', 'analysis'

  useEffect(() => {
    fetchAgreements();
  }, []);

  const fetchAgreements = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      
      if (userId) {
        const res = await axios.get(`${API_URL}/rental/list`);
        const allAgreements = res.data.rentals || [];
        // In demo, we might see all, but filter for realism
        setAgreements(allAgreements);
      }
    } catch (error) {
      console.error('Error fetching agreements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgreement = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      
      await axios.post(`${API_URL}/rental/agreement`, {
        tenant_id: userId,
        landlord_id: userId, // Demo self-transaction
        property_address: formData.property_address,
        total_deposit: parseFloat(formData.total_deposit),
        monthly_rent: parseFloat(formData.monthly_rent)
      });
      
      setShowNewAgreement(false);
      setFormData({ property_address: '', total_deposit: '', monthly_rent: '' });
      fetchAgreements();
      alert('Rental agreement created! 50% deposit held in escrow.');
    } catch (error) {
      console.error('Error creating agreement:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadInspection = async (agreementId, type) => {
    setBusy('upload');
    try {
      // Demo photos based on type
      const photos = type === 'move-in' 
        ? [
            { url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=800', label: 'Bedroom Wall' },
            { url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=800', label: 'Kitchen Floor' }
          ]
        : [
            { url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=800', label: 'Bedroom Wall' },
            { url: 'https://images.unsplash.com/photo-1516455590571-18256e5bb9ff?q=80&w=800', label: 'Kitchen Floor' }
          ];

      await axios.post(`${API_URL}/inspection/upload`, {
        agreementId,
        type,
        images: photos
      });
      
      alert(`${type === 'move-in' ? 'Move-in' : 'Move-out'} photos recorded successfully!`);
      fetchAgreements();
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setBusy(null);
    }
  };

  const handleRunAnalysis = async (agreementId) => {
    setBusy('analysis');
    try {
      const res = await axios.post(`${API_URL}/analysis/run`, { agreementId });
      setInspectionData(prev => ({ ...prev, analysis: res.data.analysis }));
      alert('AI analysis complete! Reviewing damage deductions.');
      fetchAgreements();
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setBusy(null);
    }
  };

  const openComparison = async (agreement) => {
    setSelectedAgreement(agreement);
    try {
      const res = await axios.get(`${API_URL}/rental/${agreement.id}`);
      setInspectionData({
        images: res.data.images || [],
        analysis: res.data.rental.ai_assessment
      });
      setShowComparison(true);
    } catch (error) {
      console.error('Error fetching inspection details:', error);
    }
  };

  const handleResolve = async (action) => {
    try {
      await axios.post(`${API_URL}/rental/resolve`, {
        agreement_id: selectedAgreement.id,
        refund_amount: inspectionData.analysis?.final_refund || selectedAgreement.escrow_amount,
        action,
        ai_assessment: inspectionData.analysis
      });
      setShowComparison(false);
      fetchAgreements();
      alert(action === 'accept' ? 'Deposit refund processed!' : 'Sent to arbitrator for review.');
    } catch (error) {
      console.error('Resolution error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-[#191c1e] tracking-tight">Rental Protection</h1>
          <p className="text-slate-500 mt-1">Blockchain-verified deposits with AI damage assessment.</p>
        </div>
        <button
          onClick={() => setShowNewAgreement(true)}
          className="px-6 py-3 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
        >
          <span className="material-symbols-outlined">add_home</span>
          New Agreement
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Agreements</p>
          <p className="text-3xl font-black text-slate-900">{agreements.filter(a => a.status !== 'resolved').length}</p>
        </div>
        <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Escrow Balance</p>
          <p className="text-3xl font-black text-primary">₹{agreements.reduce((sum, a) => sum + (a.status !== 'resolved' ? a.escrow_amount : 0), 0).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Protected Claims</p>
          <p className="text-3xl font-black text-emerald-500">{agreements.filter(a => a.status === 'resolved').length}</p>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-xl font-black text-slate-900">Your Agreements</h2>
          <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500">
            {agreements.length} Total
          </span>
        </div>

        {agreements.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-4xl text-slate-300">home_work</span>
            </div>
            <h3 className="text-xl font-black text-slate-900">No active rentals</h3>
            <p className="text-slate-500 mt-2">Create an agreement to start protecting your deposit.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {agreements.map(agreement => (
              <div key={agreement.id} className="p-8 hover:bg-slate-50/50 transition-all group">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        agreement.status === 'active' ? 'bg-emerald-100 text-emerald-600' :
                        agreement.status === 'inspected' ? 'bg-purple-100 text-purple-600' :
                        agreement.status === 'resolved' ? 'bg-slate-100 text-slate-500' :
                        'bg-amber-100 text-amber-600'
                      }`}>
                        {agreement.status?.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-bold text-slate-400">#{agreement.id.slice(0, 8)}</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mb-2">{agreement.property_address}</h3>
                    <div className="flex flex-wrap gap-4 text-sm font-bold">
                      <span className="text-slate-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-lg">payments</span>
                        Rent: ₹{agreement.monthly_rent?.toLocaleString()}
                      </span>
                      <span className="text-slate-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                        Deposit: ₹{agreement.total_deposit?.toLocaleString()}
                      </span>
                      <span className="text-primary flex items-center gap-1">
                        <span className="material-symbols-outlined text-lg">lock</span>
                        In Escrow: ₹{agreement.escrow_amount?.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {agreement.status === 'pending' && (
                      <button
                        onClick={() => handleUploadInspection(agreement.id, 'move-in')}
                        disabled={busy === 'upload'}
                        className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-lg">photo_camera</span>
                        Record Move-In
                      </button>
                    )}
                    {agreement.status === 'active' && (
                      <button
                        onClick={() => handleUploadInspection(agreement.id, 'move-out')}
                        disabled={busy === 'upload'}
                        className="px-6 py-3 bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-700 transition-all flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-lg">door_open</span>
                        Record Move-Out
                      </button>
                    )}
                    {(agreement.status === 'inspected' || agreement.status === 'resolved') && (
                      <button
                        onClick={() => openComparison(agreement)}
                        className="px-6 py-3 bg-primary/10 text-primary rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-lg">analytics</span>
                        View Comparison
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comparison Modal */}
      {showComparison && selectedAgreement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[40px] w-full max-w-6xl p-8 shadow-2xl my-8">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h3 className="text-3xl font-black text-slate-900">AI Damage Assessment</h3>
                <p className="text-slate-500 mt-1">Comparing move-in and move-out evidence for {selectedAgreement.property_address}</p>
              </div>
              <button onClick={() => setShowComparison(false)} className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4">
                {['Bedroom Wall', 'Kitchen Floor'].map(label => {
                  const moveIn = inspectionData.images.find(img => img.label === label && img.file_type === 'move-in');
                  const moveOut = inspectionData.images.find(img => img.label === label && img.file_type === 'move-out');
                  const report = inspectionData.analysis?.reports?.find(r => r.item === label);

                  return (
                    <div key={label} className="bg-slate-50 rounded-[32px] p-6 border border-slate-100">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-black text-slate-900">{label}</h4>
                        {report && (
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            report.status === 'DAMAGE' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                          }`}>
                            {report.status} • Deducted: ₹{report.deduction}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Move-In</p>
                          {moveIn ? (
                            <img src={moveIn.file_url} className="w-full h-48 object-cover rounded-2xl shadow-sm" alt="Move-in" />
                          ) : (
                            <div className="w-full h-48 bg-slate-200 rounded-2xl flex items-center justify-center italic text-slate-400 text-sm">No photo</div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Move-Out</p>
                          {moveOut ? (
                            <img src={moveOut.file_url} className="w-full h-48 object-cover rounded-2xl shadow-sm" alt="Move-out" />
                          ) : (
                            <div className="w-full h-48 bg-slate-200 rounded-2xl flex items-center justify-center italic text-slate-400 text-sm">No photo</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-6">
                <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-xl">
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">Financial Summary</h4>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Original Deposit</span>
                      <span className="font-black">₹{selectedAgreement.total_deposit?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">In Escrow</span>
                      <span className="font-black">₹{selectedAgreement.escrow_amount?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-rose-400">
                      <span className="font-medium">Total Deductions</span>
                      <span className="font-black">- ₹{inspectionData.analysis?.totalDeductions || 0}</span>
                    </div>
                    <div className="pt-6 border-t border-white/10 flex justify-between items-end">
                      <span className="text-slate-400 font-medium pb-1">Net Refund</span>
                      <span className="text-3xl font-black text-emerald-400">₹{(inspectionData.analysis?.finalRefund || selectedAgreement.escrow_amount).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {!inspectionData.analysis ? (
                  <button
                    onClick={() => handleRunAnalysis(selectedAgreement.id)}
                    disabled={busy === 'analysis'}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                  >
                    {busy === 'analysis' ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">psychology</span>
                        Run AI Analysis
                      </>
                    )}
                  </button>
                ) : selectedAgreement.status !== 'resolved' ? (
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => handleResolve('accept')}
                      className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-700 transition-all"
                    >
                      Accept & Refund
                    </button>
                    <button
                      onClick={() => handleResolve('dispute')}
                      className="w-full py-4 border border-rose-200 text-rose-600 rounded-2xl font-black uppercase tracking-widest hover:bg-rose-50 transition-all"
                    >
                      Dispute Assessment
                    </button>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 rounded-2xl text-center border border-slate-100">
                    <span className="material-symbols-outlined text-emerald-500 text-4xl mb-2">verified</span>
                    <p className="font-black text-slate-900">Resolved</p>
                    <p className="text-xs text-slate-500 mt-1">Transaction completed on blockchain.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Agreement Modal */}
      {showNewAgreement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[40px] w-full max-w-lg p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-slate-900">Create Agreement</h3>
              <button onClick={() => setShowNewAgreement(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                <span className="material-symbols-outlined text-slate-600">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateAgreement} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Property Address</label>
                <input
                  type="text"
                  value={formData.property_address}
                  onChange={(e) => setFormData({ ...formData, property_address: e.target.value })}
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-primary focus:outline-none font-bold"
                  placeholder="e.g. 301, Sunrise Apartments"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Deposit (₹)</label>
                  <input
                    type="number"
                    value={formData.total_deposit}
                    onChange={(e) => setFormData({ ...formData, total_deposit: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-primary focus:outline-none font-bold"
                    placeholder="80000"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Monthly Rent (₹)</label>
                  <input
                    type="number"
                    value={formData.monthly_rent}
                    onChange={(e) => setFormData({ ...formData, monthly_rent: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-primary focus:outline-none font-bold"
                    placeholder="25000"
                    required
                  />
                </div>
              </div>

              <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10">
                <div className="flex items-center gap-3 text-primary mb-2">
                  <span className="material-symbols-outlined">info</span>
                  <p className="font-black text-xs uppercase tracking-widest">Escrow Guarantee</p>
                </div>
                <p className="text-sm text-slate-600 font-medium">
                  50% of the deposit (₹{(formData.total_deposit / 2 || 0).toLocaleString()}) will be locked in Zelcor's smart contract to guarantee a fair refund.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                {submitting ? 'Creating...' : 'Launch Agreement'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rental;