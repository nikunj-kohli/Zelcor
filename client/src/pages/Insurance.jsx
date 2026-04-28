import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const Insurance = () => {
  const [activeTab, setActiveTab] = useState('policies'); // 'policies' or 'claims'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSubCategory, setSelectedSubCategory] = useState('All');
  const [selectedPurchaseFilter, setSelectedPurchaseFilter] = useState('All');
  const [claims, setClaims] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFileClaim, setShowFileClaim] = useState(false);
  const [backendPolicies, setBackendPolicies] = useState([]);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPolicyForPayment, setSelectedPolicyForPayment] = useState(null);

  const categories = ['All', 'Health', 'Vehicle', 'Property', 'Travel'];
  const healthSubCategories = ['All', 'Full Body', 'Body Parts'];
  
  const mockPolicies = [
    {
      id: 'p1',
      name: 'Full Body Protection Plus',
      category: 'Health',
      subCategory: 'Full Body',
      description: 'Comprehensive coverage for all major organs and general health emergencies.',
      price: 15000,
      icon: 'body_system',
      features: ['24/7 ICU support', 'Organ transplant cover', 'Full diagnostic scans']
    },
    {
      id: 'p2',
      name: 'Cardiac & Heart Shield',
      category: 'Health',
      subCategory: 'Body Parts',
      description: 'Focused coverage for heart-related treatments and surgeries.',
      price: 8500,
      icon: 'cardiology',
      features: ['Pacemaker cover', 'Bypass surgery support', 'Regular heart checkups']
    },
    {
      id: 'p3',
      name: 'Limb & Ortho Guard',
      category: 'Health',
      subCategory: 'Body Parts',
      description: 'Specialized insurance for bones, joints, and accidental limb injuries.',
      price: 5000,
      icon: 'orthopedics',
      features: ['Fracture support', 'Physiotherapy sessions', 'Prosthetic coverage']
    },
    {
      id: 'p4',
      name: 'EV Comprehensive Shield',
      category: 'Vehicle',
      description: 'Protection for Electric Vehicles including battery replacement and fire damage.',
      price: 12000,
      icon: 'electric_car',
      features: ['Battery warranty', 'Charging station damage', 'Zero depreciation']
    },
    {
      id: 'p5',
      name: 'Global Travel Safe',
      category: 'Travel',
      description: 'Medical and baggage protection for international travelers.',
      price: 2500,
      icon: 'flight_takeoff',
      features: ['Emergency evacuation', 'Loss of passport', 'Trip cancellation']
    }
  ];

  const displayPolicies = backendPolicies.length > 0 ? backendPolicies : mockPolicies;

  const filteredPolicies = displayPolicies.filter(p => {
    const name = p.name || p.policy_name || '';
    const desc = p.description || '';
    const category = p.category || p.type || '';
    const subCategory = p.subCategory || p.subtype || '';

    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSubCategory = selectedCategory !== 'Health' || 
                               selectedSubCategory === 'All' || 
                               subCategory.toLowerCase().replace(' ', '_') === selectedSubCategory.toLowerCase().replace(' ', '_');
    return matchesSearch && matchesCategory && matchesSubCategory;
  });

  const handleBuyPolicy = async (policy) => {
    console.log('Initiating purchase for policy:', policy);
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
    
    if (!userId) {
      alert('Please login to buy a policy');
      return;
    }

    setSelectedPolicyForPayment(policy);
    setShowPaymentModal(true);
  };

  const handleCancelPurchase = async (purchaseId) => {
    if (!window.confirm('Are you sure you want to cancel this insurance policy? This will remove your coverage immediately.')) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      
      const res = await axios.post(`${API_URL}/insurance/cancel`, {
        user_id: userId,
        purchase_id: purchaseId
      });

      if (res.data.success) {
        alert('Policy cancelled successfully.');
        await fetchPurchases();
      }
    } catch (error) {
      console.error('Error cancelling purchase:', error);
      alert('Failed to cancel policy: ' + (error.response?.data?.error || error.message));
    }
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
        alert(`Payment Successful! Policy ${selectedPolicyForPayment.name || selectedPolicyForPayment.policy_name} is now active.`);
        setShowPaymentModal(false);
        await Promise.all([
          fetchPurchases(),
          fetchClaims()
        ]);
        setActiveTab('claims');
      }
    } catch (error) {
      console.error('Error completing demo payment:', error);
      alert('Payment failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsPurchasing(false);
    }
  };

  const [formData, setFormData] = useState({
    purchase_id: '',
    diagnosis: '',
    symptoms: '',
    admission_type: 'opd',
    treatment_type: '',
    hospital_name: '',
    doctor_note: '',
    claim_amount: '',
    policy_document: null,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchClaims(),
        fetchPolicies(),
        fetchPurchases()
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
        setBackendPolicies(res.data.policies || []);
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
        setClaims(res.data.claims || []);
      }
    } catch (error) {
      console.error('Error fetching claims:', error);
    }
  };

  const handleClearClaims = async () => {
    if (!window.confirm('Are you sure you want to clear all your insurance claims? This action cannot be undone.')) {
      return;
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      
      console.log('Attempting to clear claims for user:', userId);

      if (userId) {
        const response = await axios.delete(`${API_URL}/insurance/claims/clear`, { 
          params: { user_id: userId } 
        });
        
        console.log('Clear claims response:', response.data);
        
        if (response.data.success) {
          setClaims([]);
          alert('Claims cleared successfully.');
        } else {
          alert('Failed to clear claims: ' + (response.data.error || 'Unknown error'));
        }
      } else {
        alert('User ID not found. Please login.');
      }
    } catch (error) {
      console.error('Error clearing claims:', error);
      alert('Failed to clear claims: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      
      if (!formData.purchase_id) {
        alert('Please select a purchased policy package first');
        setSubmitting(false);
        return;
      }

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
        policy_document_url: formData.policy_document?.name || 'demo-policy.pdf',
      });

      setShowFileClaim(false);
      setFormData({
        purchase_id: '',
        diagnosis: '',
        symptoms: '',
        admission_type: 'opd',
        treatment_type: '',
        hospital_name: '',
        doctor_note: '',
        claim_amount: '',
        policy_document: null,
      });
      await fetchClaims();
      alert('Claim filed successfully. AI is analyzing urgency.');
    } catch (error) {
      console.error('Error filing claim:', error);
      alert('Error filing claim: ' + (error.response?.data?.error || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'critical':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'emergency':
        return 'bg-red-600 text-white border-red-600';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'text-emerald-600';
      case 'rejected':
        return 'text-red-600';
      case 'penalty_triggered':
        return 'text-orange-600';
      case 'ai_reviewed':
        return 'text-purple-600';
      default:
        return 'text-slate-600';
    }
  };

  const totalAmount = claims.reduce((sum, claim) => sum + Number(claim.claim_amount || 0), 0);
  const pendingCount = claims.filter((claim) => claim.status === 'pending').length;
  const approvedCount = claims.filter((claim) => claim.status === 'approved').length;
  const urgentCount = claims.filter((claim) => claim.urgency === 'critical' || claim.urgency === 'emergency').length;
  const latestClaim = claims[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8f9fc]">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f9fc] min-h-screen text-[#191c1e]">
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <a href="/dashboard" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-primary">
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Dashboard
              </a>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Insurance Portal</h1>
                <p className="text-slate-500 mt-1">Browse policies, buy protection, and file AI-assisted claims.</p>
              </div>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('policies')}
                className={`px-6 py-2 rounded-lg font-bold transition ${activeTab === 'policies' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Policies
              </button>
              <button
                onClick={() => setActiveTab('claims')}
                className={`px-6 py-2 rounded-lg font-bold transition ${activeTab === 'claims' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                My Claims
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {activeTab === 'policies' ? (
          <section className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
              <div className="flex flex-col w-full md:w-auto gap-4">
                <div className="relative w-full md:w-96">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                  <input
                    type="text"
                    placeholder="Search health, vehicle, life..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                  />
                </div>
                {selectedCategory === 'Health' && (
                  <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                    {healthSubCategories.map(sub => (
                      <button
                        key={sub}
                        onClick={() => setSelectedSubCategory(sub)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${selectedSubCategory === sub ? 'bg-primary/10 text-primary border-primary/20 border' : 'bg-slate-50 text-slate-500 border-transparent border hover:bg-slate-100'}`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setSelectedSubCategory('All');
                    }}
                    className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition ${selectedCategory === cat ? 'bg-primary text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPolicies.map(p => {
                const policy = {
                  id: p.id,
                  name: p.name || p.policy_name || 'Unnamed Policy',
                  description: p.description || 'No description available',
                  price: p.price || p.premium_amount || 0,
                  category: p.category || p.type || 'General',
                  icon: p.icon || (p.type === 'health' ? 'health_and_safety' : p.type === 'vehicle' ? 'directions_car' : 'security'),
                  features: Array.isArray(p.features) ? p.features : (p.terms ? [p.terms] : ['Standard Protection', 'AI Claim Analysis', 'Fast Settlements'])
                };

                const isPurchased = purchases.some(pur => pur.policy_id === policy.id);

                return (
                  <div key={policy.id} className="bg-white rounded-[32px] border border-slate-100 p-6 flex flex-col hover:shadow-xl transition-all group relative overflow-hidden">
                    {isPurchased && (
                      <div className="absolute top-0 right-0 bg-emerald-500 text-white px-4 py-1 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest z-10">
                        Active
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl">{policy.icon}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{policy.category}</p>
                        <p className="text-xl font-black text-primary">Rs. {policy.price.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-black mb-2 group-hover:text-primary transition-colors">{policy.name}</h3>
                      <p className="text-slate-500 text-sm mb-4 leading-relaxed line-clamp-2">{policy.description}</p>
                      <div className="space-y-2 mb-6">
                        {policy.features.slice(0, 3).map((f, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-600">
                            <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                            {f}
                          </div>
                        ))}
                      </div>
                    </div>
                    {isPurchased ? (
                      <div className="grid grid-cols-2 gap-3 mt-auto">
                        <button
                          onClick={() => {
                            setActiveTab('claims');
                            setShowFileClaim(true);
                            setFormData(prev => ({ ...prev, purchase_id: purchases.find(pur => pur.policy_id === policy.id)?.id || '' }));
                          }}
                          className="py-4 rounded-2xl font-black transition shadow-lg bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-emerald-50 hover:bg-emerald-100 flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">add_circle</span>
                          Claim
                        </button>
                        <button
                          onClick={() => handleCancelPurchase(purchases.find(pur => pur.policy_id === policy.id)?.id)}
                          className="py-4 rounded-2xl font-black transition shadow-lg bg-red-50 text-red-600 border border-red-100 shadow-red-50 hover:bg-red-100 flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">cancel</span>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleBuyPolicy(policy)}
                        disabled={isPurchasing}
                        className={`w-full py-4 rounded-2xl font-black transition shadow-lg bg-primary text-white shadow-primary/20 hover:bg-primary/90 ${isPurchasing ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isPurchasing ? 'Processing...' : 'Buy Protection'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <>
            <section className="grid lg:grid-cols-[1.4fr_0.9fr] gap-6">
              <div className="bg-primary rounded-[28px] p-6 sm:p-8 text-white shadow-xl shadow-primary/20 overflow-hidden relative">
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10"></div>
                <div className="relative z-10 max-w-2xl space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                    <span className="material-symbols-outlined text-sm">health_and_safety</span>
                    Claim Protection
                  </div>
                  <div>
                    <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Emergency claims get surfaced first.</h2>
                    <p className="mt-3 text-white/75">
                      Zelcor tags urgency, tracks insurer response windows, and keeps a clear record of every claim milestone.
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <MiniMetric label="Protected Value" value={`Rs. ${totalAmount.toLocaleString()}`} />
                    <MiniMetric label="Urgent Queue" value={urgentCount} />
                    <MiniMetric label="Approved" value={approvedCount} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[28px] border border-slate-100 p-6 sm:p-8 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Latest Case</p>
                    <h3 className="mt-2 text-xl font-black text-slate-900">
                      {latestClaim ? latestClaim.diagnosis : 'No active claim'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowFileClaim(true)}
                    className="material-symbols-outlined text-primary bg-primary/10 rounded-2xl p-3 hover:bg-primary/20 transition"
                  >
                    add_circle
                  </button>
                </div>
                <div className="mt-6 space-y-4">
                  <ProgressRow label="Pending Review" value={pendingCount} total={Math.max(claims.length, 1)} />
                  <ProgressRow label="Approved" value={approvedCount} total={Math.max(claims.length, 1)} tone="green" />
                  <ProgressRow label="Urgent" value={urgentCount} total={Math.max(claims.length, 1)} tone="red" />
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Claims" value={claims.length} icon="description" tone="primary" />
              <StatCard label="Pending" value={pendingCount} icon="hourglass_empty" tone="amber" />
              <StatCard label="Approved" value={approvedCount} icon="check_circle" tone="green" />
              <StatCard label="Urgent" value={urgentCount} icon="warning" tone="red" />
            </section>

            <section className="bg-white rounded-[28px] border border-slate-100 overflow-hidden shadow-sm">
              <div className="px-5 sm:px-6 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-black text-xl">Your Claims</h2>
                  <p className="text-sm text-slate-500">Status, urgency, amount, and AI review signal in one place.</p>
                </div>
                <div className="flex items-center gap-4">
                  {purchases.length > 0 && (
                    <select
                      value={selectedPurchaseFilter}
                      onChange={(e) => setSelectedPurchaseFilter(e.target.value)}
                      className="text-xs font-bold border-slate-200 rounded-lg py-1 px-2 focus:outline-none focus:border-primary"
                    >
                      <option value="All">All Packages</option>
                      {purchases.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.insurance_policies?.name || 'Policy'}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {claims.length} records
                  </div>
                  {claims.length > 0 && (
                    <button
                      onClick={handleClearClaims}
                      className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 transition"
                    >
                      <span className="material-symbols-outlined text-sm">delete_sweep</span>
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {claims.length === 0 ? (
                <div className="p-8 sm:p-12 text-center">
                  <div className="mx-auto mb-5 h-16 w-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl">clinical_notes</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-700">No claims yet</h3>
                  <p className="text-slate-500 mt-2 max-w-md mx-auto">
                    Start with diagnosis, claim amount, and policy document. Zelcor will classify urgency after submission.
                  </p>
                  <button
                    onClick={() => setShowFileClaim(true)}
                    className="mt-6 inline-flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-xl font-bold hover:bg-primary/90 transition"
                  >
                    <span className="material-symbols-outlined text-lg">add_circle</span>
                    File First Claim
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {claims
                    .filter(claim => {
                      const matchesPurchase = selectedPurchaseFilter === 'All' || claim.purchase_id === selectedPurchaseFilter;
                      const isValidPurchase = !claim.purchase_id || purchases.some(p => p.id === claim.purchase_id);
                      return matchesPurchase && isValidPurchase;
                    })
                    .map((claim) => {
                      const associatedPurchase = purchases.find(p => p.id === claim.purchase_id);
                      const policyName = associatedPurchase?.insurance_policies?.name || associatedPurchase?.insurance_policies?.policy_name || 'General Claim';

                      return (
                        <div key={claim.id} className="p-5 sm:p-6 hover:bg-slate-50 transition">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-sm font-mono text-slate-400">#{String(claim.id || '').slice(0, 8)}</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getUrgencyColor(claim.urgency)}`}>
                                  {(claim.urgency || 'standard').toUpperCase()}
                                </span>
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  {policyName}
                                </span>
                                <span className={`inline-flex items-center gap-1 text-xs font-bold ${claim.urgency === 'critical' || claim.urgency === 'emergency' ? 'text-red-600' : 'text-slate-500'}`}>
                                  <span className="material-symbols-outlined text-sm">schedule</span>
                                  {claim.deadline_hours || 72}h response window
                                </span>
                              </div>
                              <h3 className="text-lg font-black mt-2 text-slate-900">{claim.diagnosis}</h3>
                              <div className="flex flex-wrap gap-x-5 gap-y-1 text-slate-500 text-sm mt-1">
                                <span>Rs. {Number(claim.claim_amount || 0).toLocaleString()}</span>
                                <span>Filed on {claim.created_at ? new Date(claim.created_at).toLocaleDateString() : 'N/A'}</span>
                              </div>
                            </div>
                            <div className="lg:text-right min-w-[160px]">
                              <div className={`font-black ${getStatusColor(claim.status)}`}>
                                {(claim.status || 'pending').replace('_', ' ').toUpperCase()}
                              </div>
                              {claim.ai_analysis?.confidence_score && (
                                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-purple-50 text-purple-700 rounded-lg border border-purple-100 text-xs font-bold">
                                  <span className="material-symbols-outlined text-sm">psychology</span>
                                  AI Reliability: {claim.ai_analysis.confidence_score}%
                                </div>
                              )}
                              {claim.ai_analysis?.reason && (
                                <div className="text-[11px] text-slate-500 mt-2 max-w-xs lg:ml-auto italic bg-slate-50 p-2 rounded-lg border border-dashed border-slate-200">
                                  "{claim.ai_analysis.reason}"
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {showPaymentModal && selectedPolicyForPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[28px] w-full max-w-md overflow-hidden border border-slate-100 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="bg-primary p-6 text-white flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">Razorpay Checkout</h2>
                <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">Test Mode</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="material-symbols-outlined hover:rotate-90 transition-transform">close</button>
            </div>
            
            <div className="p-8 text-center space-y-6">
              <div className="flex justify-center">
                <div className="bg-slate-50 p-6 rounded-[32px] border-2 border-dashed border-slate-200 relative group">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=zelcor_payment_${selectedPolicyForPayment.id}`} 
                    alt="Payment QR" 
                    className="w-48 h-48 opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/40 backdrop-blur-[2px] rounded-[32px]">
                    <span className="material-symbols-outlined text-primary text-4xl">qr_code_scanner</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-black text-slate-900">Rs. {(selectedPolicyForPayment.price || selectedPolicyForPayment.premium_amount || 0).toLocaleString()}</h3>
                <p className="text-slate-500 font-medium mt-1">Scan QR to pay for {selectedPolicyForPayment.name || selectedPolicyForPayment.policy_name}</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleDemoPaymentComplete}
                  disabled={isPurchasing}
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black hover:bg-emerald-600 transition shadow-lg shadow-emerald-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isPurchasing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <span className="material-symbols-outlined">check_circle</span>
                  )}
                  Payment Complete
                </button>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                  This is a dummy payment for demonstration purposes
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFileClaim && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[28px] w-full max-w-xl max-h-[92vh] overflow-y-auto border border-slate-100 shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Claim Intake</p>
                <h2 className="text-2xl font-black mt-1">File Insurance Claim</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowFileClaim(false)}
                className="material-symbols-outlined text-slate-400 hover:text-slate-900"
              >
                close
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Policy Package</label>
                  <select
                    value={formData.purchase_id}
                    onChange={(e) => setFormData({ ...formData, purchase_id: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none bg-white"
                    required
                  >
                    <option value="">Select a purchased policy</option>
                    {purchases.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.insurance_policies?.name || p.insurance_policies?.policy_name || 'Policy'} - #{p.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                  {purchases.length === 0 && (
                    <p className="text-xs text-red-500 mt-2">You need to buy a policy before filing a claim.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Diagnosis</label>
                  <input
                    type="text"
                    value={formData.diagnosis}
                    onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                    placeholder="e.g., cardiac arrest, surgery, cancer treatment"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-2">Critical keywords can trigger faster insurer response deadlines.</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Symptoms / Current Condition</label>
                  <textarea
                    value={formData.symptoms}
                    onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
                    placeholder="e.g., chest pain, breathlessness, ICU admission, severe bleeding"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none min-h-[96px]"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Admission Type</label>
                    <select
                      value={formData.admission_type}
                      onChange={(e) => setFormData({ ...formData, admission_type: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none bg-white"
                    >
                      <option value="opd">OPD / Routine</option>
                      <option value="inpatient">Inpatient</option>
                      <option value="icu">ICU</option>
                      <option value="emergency">Emergency</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Treatment Type</label>
                    <input
                      type="text"
                      value={formData.treatment_type}
                      onChange={(e) => setFormData({ ...formData, treatment_type: e.target.value })}
                      placeholder="e.g., surgery, chemo, dialysis"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Hospital Name</label>
                  <input
                    type="text"
                    value={formData.hospital_name}
                    onChange={(e) => setFormData({ ...formData, hospital_name: e.target.value })}
                    placeholder="e.g., Apollo Hospital"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Claim Amount (Rs.)</label>
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
                  <label className="block text-sm font-bold text-slate-700 mb-2">Doctor Note / Medical Summary</label>
                  <textarea
                    value={formData.doctor_note}
                    onChange={(e) => setFormData({ ...formData, doctor_note: e.target.value })}
                    placeholder="Paste a short discharge summary, doctor note, or medical finding."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none min-h-[110px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Policy Document</label>
                  <input
                    type="file"
                    onChange={(e) => setFormData({ ...formData, policy_document: e.target.files[0] })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 p-6 pt-0">
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

const toneStyles = {
  primary: 'bg-primary/10 text-primary',
  amber: 'bg-amber-50 text-amber-600',
  green: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
};

const MiniMetric = ({ label, value }) => (
  <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
    <div className="text-2xl font-black leading-none">{value}</div>
    <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-white/60">{label}</div>
  </div>
);

const ProgressRow = ({ label, value, total, tone = 'primary' }) => {
  const percent = Math.min(100, Math.round((value / total) * 100));
  const barColor = tone === 'red' ? 'bg-red-500' : tone === 'green' ? 'bg-emerald-500' : 'bg-primary';

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-bold text-slate-600">{label}</span>
        <span className="font-black text-slate-900">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }}></div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon, tone = 'primary' }) => (
  <div className="bg-white rounded-[28px] border border-slate-100 p-5 shadow-sm">
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${toneStyles[tone] || toneStyles.primary}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-xl font-black text-slate-900">{value}</p>
      </div>
    </div>
  </div>
);

export default Insurance;
