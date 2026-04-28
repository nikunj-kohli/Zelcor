import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const Hospital = () => {
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewPackage, setShowNewPackage] = useState(false);
  const [formData, setFormData] = useState({
    package_name: '',
    package_amount: '',
    included_items: '',
    excluded_items: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAdmissions();
  }, []);

  const fetchAdmissions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      
      if (userId) {
        const res = await axios.get(`${API_URL}/hospital/admissions`);
        const allAdmissions = res.data.admissions || [];
        const filtered = allAdmissions.filter(a => a.patient_id === userId || a.hospital_id === userId);
        setAdmissions(filtered);
      }
    } catch (error) {
      console.error('Error fetching admissions:', error);
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
      
      // For demo, use a mock hospital
      const hospitalId = '00000000-0000-0000-0000-000000000003';
      
      await axios.post(`${API_URL}/hospital/package`, {
        patient_id: userId,
        hospital_id: hospitalId,
        package_name: formData.package_name,
        package_amount: parseFloat(formData.package_amount),
        included_items: formData.included_items,
        excluded_items: formData.excluded_items
      });
      
      setShowNewPackage(false);
      setFormData({ package_name: '', package_amount: '', included_items: '', excluded_items: '' });
      fetchAdmissions();
      alert('Package agreement created! 70% paid to hospital, 30% held in escrow.');
    } catch (error) {
      console.error('Error creating package:', error);
      alert('Error creating package agreement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConsent = async (admissionId) => {
    const item = prompt('Enter item name (e.g., Premium Implant):');
    const amount = prompt('Enter amount (₹):');
    if (!item || !amount) return;
    
    try {
      await axios.post(`${API_URL}/hospital/consent`, {
        admission_id: admissionId,
        item,
        amount: parseFloat(amount),
        reason: 'Recommended by doctor'
      });
      fetchAdmissions();
      alert('Consent recorded on blockchain!');
    } catch (error) {
      console.error('Error recording consent:', error);
    }
  };

  const handleDischarge = async (admissionId) => {
    try {
      await axios.post(`${API_URL}/hospital/discharge`, {
        admission_id: admissionId
      });
      fetchAdmissions();
      alert('Discharge initiated! AI is analyzing final bill...');
    } catch (error) {
      console.error('Error initiating discharge:', error);
    }
  };

  const handlePay = async (admissionId, isDisputed = false) => {
    try {
      await axios.post(`${API_URL}/hospital/pay`, {
        admission_id: admissionId,
        pay_amount: isDisputed ? 0 : admissions.find(a => a.id === admissionId)?.package_amount,
        is_disputed: isDisputed
      });
      fetchAdmissions();
      alert(isDisputed ? 'Disputed amount held in escrow!' : 'Payment successful!');
    } catch (error) {
      console.error('Error processing payment:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'package_agreed': return 'bg-green-100 text-green-700';
      case 'treatment_active': return 'bg-blue-100 text-blue-700';
      case 'discharge': return 'bg-purple-100 text-purple-700';
      case 'bill_disputed': return 'bg-red-100 text-red-700';
      case 'resolved': return 'bg-gray-100 text-gray-700';
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
    <div className="bg-[#f8f9fc] min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-[#191c1e]">Hospital Bills</h1>
              <p className="text-slate-500 mt-1">Protect against hidden charges with package agreements</p>
            </div>
            <button
              onClick={() => setShowNewPackage(true)}
              className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition"
            >
              + New Package
            </button>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-2xl p-6 border border-red-200">
          <h3 className="font-bold text-lg mb-4">How Zelcor Hospital Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">1</div>
              <div>
                <div className="font-medium">Sign Package</div>
                <div className="text-slate-500">70% to hospital, 30% escrow</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">2</div>
              <div>
                <div className="font-medium">Consent Required</div>
                <div className="text-slate-500">Every extra charge needs approval</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">3</div>
              <div>
                <div className="font-medium">AI Bill Analysis</div>
                <div className="text-slate-500">Compare package vs final bill</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">4</div>
              <div>
                <div className="font-medium">Pay Only Agreed</div>
                <div className="text-slate-500">Disputed amounts held</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admissions List */}
      <div className="max-w-6xl mx-auto px-6 pb-8">
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-lg">Your Hospital Admissions</h2>
          </div>
          
          {admissions.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🏥</div>
              <h3 className="text-xl font-bold text-slate-700">No admissions yet</h3>
              <p className="text-slate-500 mt-2">Create a package agreement to protect against hidden charges</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {admissions.map((admission) => (
                <div key={admission.id} className="p-6 hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono text-slate-400">#{admission.id.slice(0, 8)}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(admission.status)}`}>
                          {admission.status?.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold mt-2">{admission.package_name}</h3>
                      <div className="flex gap-6 mt-2 text-sm text-slate-500">
                        <span>💰 Package: ₹{admission.package_amount?.toLocaleString()}</span>
                        <span>🏥 Paid: ₹{admission.paid_to_hospital?.toLocaleString()}</span>
                        <span>🔒 Escrow: ₹{admission.held_in_escrow?.toLocaleString()}</span>
                      </div>
                      
                      {admission.included_items && (
                        <div className="mt-3 p-3 bg-green-50 rounded-lg">
                          <div className="text-sm font-medium text-green-700">Included:</div>
                          <div className="text-sm text-green-600">{admission.included_items}</div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {admission.status === 'package_agreed' && (
                        <button
                          onClick={() => handleConsent(admission.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                        >
                          ✓ Record Consent
                        </button>
                      )}
                      {(admission.status === 'package_agreed' || admission.status === 'treatment_active') && (
                        <button
                          onClick={() => handleDischarge(admission.id)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                        >
                          🏥 Request Discharge
                        </button>
                      )}
                      {admission.status === 'discharge' && (
                        <div className="text-right">
                          <button
                            onClick={() => handlePay(admission.id, false)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 block mb-2"
                          >
                            💳 Pay Authorized
                          </button>
                          <button
                            onClick={() => handlePay(admission.id, true)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                          >
                            ⚠️ Dispute
                          </button>
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

      {/* New Package Modal */}
      {showNewPackage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">Create Hospital Package</h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Package Name</label>
                  <input
                    type="text"
                    value={formData.package_name}
                    onChange={(e) => setFormData({ ...formData, package_name: e.target.value })}
                    placeholder="e.g., Knee Replacement Surgery"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Package Amount (₹)</label>
                  <input
                    type="number"
                    value={formData.package_amount}
                    onChange={(e) => setFormData({ ...formData, package_amount: e.target.value })}
                    placeholder="e.g., 150000"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Included Items</label>
                  <textarea
                    value={formData.included_items}
                    onChange={(e) => setFormData({ ...formData, included_items: e.target.value })}
                    placeholder="e.g., Room, surgery, medicines, doctor fees, 3 days stay"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                    rows="2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Excluded Items</label>
                  <textarea
                    value={formData.excluded_items}
                    onChange={(e) => setFormData({ ...formData, excluded_items: e.target.value })}
                    placeholder="e.g., Premium implants, private room upgrade"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                    rows="2"
                  />
                </div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg mt-4 text-sm text-red-700">
                💡 70% (₹{Math.round(formData.package_amount || 0) * 0.7}) paid to hospital, 30% held in escrow. Extra charges require your consent.
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewPackage(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Hospital;