import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const Insurance = () => {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFileClaim, setShowFileClaim] = useState(false);
  const [formData, setFormData] = useState({
    diagnosis: '',
    claim_amount: '',
    policy_document: null
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      
      if (userId) {
        const res = await axios.get(`${API_URL}/insurance/claims?user_id=${userId}`);
        setClaims(res.data.claims || []);
      }
    } catch (error) {
      console.error('Error fetching claims:', error);
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
      
      // For demo, use a mock insurer
      const insurerId = '00000000-0000-0000-0000-000000000001';
      
      await axios.post(`${API_URL}/insurance/claim`, {
        user_id: userId,
        insurer_id: insurerId,
        claim_amount: parseFloat(formData.claim_amount),
        diagnosis: formData.diagnosis,
        policy_document_url: formData.policy_document?.name || 'demo-policy.pdf'
      });
      
      setShowFileClaim(false);
      setFormData({ diagnosis: '', claim_amount: '', policy_document: null });
      fetchClaims();
      alert('Claim filed successfully! AI is analyzing urgency...');
    } catch (error) {
      console.error('Error filing claim:', error);
      alert('Error filing claim');
    } finally {
      setSubmitting(false);
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'emergency': return 'bg-red-600 text-white';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'text-green-600';
      case 'rejected': return 'text-red-600';
      case 'penalty_triggered': return 'text-orange-600';
      case 'ai_reviewed': return 'text-purple-600';
      default: return 'text-gray-600';
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
    <div className="bg-[#f8f9fc] min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-[#191c1e]">Health Insurance</h1>
              <p className="text-slate-500 mt-1">File claims, track urgency, get instant approvals</p>
            </div>
            <button
              onClick={() => setShowFileClaim(true)}
              className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition"
            >
              + File New Claim
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Total Claims" value={claims.length} icon="description" />
          <StatCard label="Pending" value={claims.filter(c => c.status === 'pending').length} icon="hourglass_empty" />
          <StatCard label="Approved" value={claims.filter(c => c.status === 'approved').length} icon="check_circle" />
          <StatCard label="Critical" value={claims.filter(c => c.urgency === 'critical').length} icon="warning" color="red" />
        </div>
      </div>

      {/* Claims List */}
      <div className="max-w-6xl mx-auto px-6 pb-8">
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-lg">Your Claims</h2>
          </div>
          
          {claims.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🏥</div>
              <h3 className="text-xl font-bold text-slate-700">No claims yet</h3>
              <p className="text-slate-500 mt-2">File your first insurance claim through Zelcor</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {claims.map((claim) => (
                <div key={claim.id} className="p-6 hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono text-slate-400">#{claim.id.slice(0, 8)}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getUrgencyColor(claim.urgency)}`}>
                          {claim.urgency?.toUpperCase()}
                        </span>
                        {claim.urgency === 'critical' && (
                          <span className="text-xs text-red-500 font-bold">
                            ⏰ {claim.deadline_hours}h deadline
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold mt-2">{claim.diagnosis}</h3>
                      <p className="text-slate-500 text-sm mt-1">
                        ₹{claim.claim_amount?.toLocaleString()} • Filed on {new Date(claim.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${getStatusColor(claim.status)}`}>
                        {claim.status?.replace('_', ' ').toUpperCase()}
                      </div>
                      {claim.ai_analysis?.confidence_score && (
                        <div className="text-sm text-slate-500 mt-1">
                          AI Score: {claim.ai_analysis.confidence_score}%
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* File Claim Modal */}
      {showFileClaim && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">File Insurance Claim</h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Diagnosis</label>
                  <input
                    type="text"
                    value={formData.diagnosis}
                    onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                    placeholder="e.g., Breast Cancer, Cardiac Arrest"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">Keywords like "cancer" trigger 24hr critical deadline</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Claim Amount (₹)</label>
                  <input
                    type="number"
                    value={formData.claim_amount}
                    onChange={(e) => setFormData({ ...formData, claim_amount: e.target.value })}
                    placeholder="e.g., 1200000"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Policy Document</label>
                  <input
                    type="file"
                    onChange={(e) => setFormData({ ...formData, policy_document: e.target.files[0] })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowFileClaim(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? 'Filing...' : 'File Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, icon, color = 'primary' }) => (
  <div className="bg-white rounded-xl border border-slate-100 p-4">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg bg-${color}/10 flex items-center justify-center`}>
        <span className="material-icons text-${color}">{icon}</span>
      </div>
      <div>
        <div className="text-2xl font-black">{value}</div>
        <div className="text-sm text-slate-500">{label}</div>
      </div>
    </div>
  </div>
);

export default Insurance;