import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const Rental = () => {
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewAgreement, setShowNewAgreement] = useState(false);
  const [formData, setFormData] = useState({
    property_address: '',
    total_deposit: '',
    monthly_rent: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAgreements();
  }, []);

  const fetchAgreements = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      
      if (userId) {
        // For demo, fetch all and filter
        const res = await axios.get(`${API_URL}/rental/agreements`);
        const allAgreements = res.data.agreements || [];
        const filtered = allAgreements.filter(a => a.tenant_id === userId || a.landlord_id === userId);
        setAgreements(filtered);
      }
    } catch (error) {
      console.error('Error fetching agreements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      
      // For demo, use self as landlord
      const landlordId = userId;
      
      await axios.post(`${API_URL}/rental/agreement`, {
        tenant_id: userId,
        landlord_id: landlordId,
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
      alert('Error creating agreement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMoveIn = async (agreementId) => {
    try {
      // Demo photos
      const demoPhotos = ['photo1.jpg', 'photo2.jpg', 'photo3.jpg'];
      await axios.post(`${API_URL}/rental/move-in`, {
        agreement_id: agreementId,
        photos: demoPhotos
      });
      fetchAgreements();
      alert('Move-in photos recorded on blockchain!');
    } catch (error) {
      console.error('Error recording move-in:', error);
    }
  };

  const handleMoveOut = async (agreementId) => {
    try {
      const demoPhotos = ['photo1_out.jpg', 'photo2_out.jpg', 'photo3_out.jpg'];
      await axios.post(`${API_URL}/rental/move-out`, {
        agreement_id: agreementId,
        photos: demoPhotos
      });
      fetchAgreements();
      alert('Move-out photos recorded! AI is comparing...');
    } catch (error) {
      console.error('Error recording move-out:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'move_in_recorded': return 'bg-green-100 text-green-700';
      case 'active': return 'bg-blue-100 text-blue-700';
      case 'ai_assessed': return 'bg-purple-100 text-purple-700';
      case 'resolved': return 'bg-gray-100 text-gray-700';
      case 'disputed': return 'bg-red-100 text-red-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8f9fc]">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-[#191c1e] tracking-tight">Rental Protection</h1>
          <p className="text-slate-500 mt-1">Protect your security deposit with blockchain-verified move-in proof.</p>
        </div>
        <button
          onClick={() => setShowNewAgreement(true)}
          className="bg-primary text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all active:scale-[0.98]"
        >
          + New Agreement
        </button>
      </div>

      {/* How It Works */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl p-6 border border-primary/20">
          <h3 className="font-bold text-lg mb-4">How Zelcor Rental Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">1</div>
              <div>
                <div className="font-medium">Create Agreement</div>
                <div className="text-slate-500">50% deposit to escrow</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">2</div>
              <div>
                <div className="font-medium">Move-In Photos</div>
                <div className="text-slate-500">Hash on blockchain</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">3</div>
              <div>
                <div className="font-medium">Move-Out Photos</div>
                <div className="text-slate-500">AI compares damage</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">4</div>
              <div>
                <div className="font-medium">Auto Refund</div>
                <div className="text-slate-500">No dispute = full refund</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Agreements List */}
      <div className="max-w-6xl mx-auto px-6 pb-8">
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-lg">Your Rental Agreements</h2>
          </div>
          
          {agreements.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🏠</div>
              <h3 className="text-xl font-bold text-slate-700">No agreements yet</h3>
              <p className="text-slate-500 mt-2">Create your first rental agreement to protect your deposit</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {agreements.map((agreement) => (
                <div key={agreement.id} className="p-6 hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono text-slate-400">#{agreement.id.slice(0, 8)}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(agreement.status)}`}>
                          {agreement.status?.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold mt-2">{agreement.property_address}</h3>
                      <div className="flex gap-6 mt-2 text-sm text-slate-500">
                        <span>💰 Deposit: ₹{agreement.total_deposit?.toLocaleString()}</span>
                        <span>📦 Escrow: ₹{agreement.escrow_amount?.toLocaleString()}</span>
                        <span>🏠 Rent: ₹{agreement.monthly_rent?.toLocaleString()}/mo</span>
                      </div>
                      {agreement.ai_assessment && (
                        <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                          <div className="text-sm font-medium text-purple-700">AI Assessment</div>
                          <div className="text-sm text-purple-600">
                            Recommended Refund: ₹{agreement.ai_assessment.recommended_refund || agreement.escrow_amount}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {agreement.status === 'pending' && (
                        <button
                          onClick={() => handleMoveIn(agreement.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                        >
                          📸 Record Move-In
                        </button>
                      )}
                      {agreement.status === 'move_in_recorded' && (
                        <button
                          onClick={() => handleMoveOut(agreement.id)}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
                        >
                          📸 Record Move-Out
                        </button>
                      )}
                      {agreement.status === 'ai_assessed' && (
                        <button
                          onClick={async () => {
                            await axios.post(`${API_URL}/rental/resolve`, {
                              agreement_id: agreement.id,
                              refund_amount: agreement.ai_assessment?.recommended_refund || agreement.escrow_amount,
                              action: 'accept'
                            });
                            fetchAgreements();
                          }}
                          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
                        >
                          ✅ Accept & Refund
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Agreement Modal */}
      {showNewAgreement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">Create Rental Agreement</h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Property Address</label>
                  <input
                    type="text"
                    value={formData.property_address}
                    onChange={(e) => setFormData({ ...formData, property_address: e.target.value })}
                    placeholder="e.g., 301, Sunrise Apartments, Andheri East"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Security Deposit (₹)</label>
                  <input
                    type="number"
                    value={formData.total_deposit}
                    onChange={(e) => setFormData({ ...formData, total_deposit: e.target.value })}
                    placeholder="e.g., 80000"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Rent (₹)</label>
                  <input
                    type="number"
                    value={formData.monthly_rent}
                    onChange={(e) => setFormData({ ...formData, monthly_rent: e.target.value })}
                    placeholder="e.g., 25000"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                    required
                  />
                </div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg mt-4 text-sm text-yellow-700">
                💡 50% of deposit (₹{Math.round(formData.total_deposit || 0) / 2}) will be held in Zelcor escrow
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewAgreement(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Agreement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rental;