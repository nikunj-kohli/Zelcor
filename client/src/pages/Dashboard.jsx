import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ComplaintModal from '../components/ComplaintModal';
import axios from 'axios';
import { ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:3000/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEscrowId, setSelectedEscrowId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [escrows, setEscrows] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ethAddress, setEthAddress] = useState('');
  const [ethBalance, setEthBalance] = useState('0.00');

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
    
    if (!userId) return;

    try {
      const profileRes = await axios.get(`${API_URL}/auth/profile/${userId}`);
      setProfile(profileRes.data.profile);

      const escrowsRes = await axios.get(`${API_URL}/user/escrows?user_id=${userId}`);
      setEscrows(escrowsRes.data.escrows || []);

      setActivities([
        { type: 'payment', message: 'Payment received', amount: 'Protected order added', time: 'Just now', icon: 'payments' },
        { type: 'refund', message: 'Refund received', amount: '₹1,200', time: 'Today, 10:30 AM', icon: 'payments' },
        { type: 'dispute', message: 'Complaint filed', amount: '₹15,000', time: 'Yesterday, 6:00 PM', icon: 'gavel' },
        { type: 'blockchain', message: 'Blockchain proof verified', amount: '#CMP-001', time: 'Apr 25, 2026', icon: 'link' },
      ]);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const balance = await provider.getBalance(address);
        
        setEthAddress(address);
        setEthBalance(ethers.formatEther(balance));
      } catch (error) {
        console.error("Wallet connection failed:", error);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  useEffect(() => {
    fetchData();

    const subscription = supabase
      .channel('public:escrows')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escrows' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const handleConfirmEscrow = async (escrowId) => {
    try {
      await axios.post(`${API_URL}/escrows/confirm`, { escrow_id: escrowId });
      await fetchData();
    } catch (error) {
      alert('Could not confirm order: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f8f9fc] space-y-4">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      <div className="text-sm font-bold text-primary tracking-widest uppercase animate-pulse">Synchronizing Trust...</div>
    </div>
  );

  const stats = {
    volume: escrows.filter(e => e.status === 'active' || e.status === 'disputed').reduce((sum, e) => sum + Number(e.amount), 0),
    activeCount: escrows.filter(e => e.status === 'active' || e.status === 'disputed').length,
    refundedTotal: escrows.filter(e => e.status === 'refunded').reduce((sum, e) => sum + Number(e.amount), 0),
    trustScore: profile?.trust_score || 95,
  };

  return (
    <div className="bg-[#f8f9fc] text-[#191c1e] min-h-screen font-body-lg flex flex-col lg:flex-row">
      <aside className="w-64 bg-white border-r border-slate-100 hidden lg:flex flex-col h-screen sticky top-0">
        <div className="p-8">
          <div className="text-3xl font-black tracking-tighter text-primary">zelcor</div>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <NavItem icon="home" label="Home" href="/dashboard" active />
          <NavItem icon="shopping_bag" label="My Orders" href="/dashboard#orders" />
          <NavItem icon="lock" label="Escrows" href="/dashboard" />
          <NavItem icon="gavel" label="Complaints" href="/complaints" />
          <NavItem icon="verified" label="Certificates" href="/certificates" />
          
          {/* Industry Navigation */}
          <div className="pt-4 mt-4 border-t border-slate-100">
            <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Industries</p>
          </div>
          <NavItem icon="shopping_cart" label="Ecommerce" href="/shop" />
          <NavItem icon="health_and_safety" label="Insurance" href="/insurance" />
          <NavItem icon="apartment" label="Rental" href="/rental" />
          <NavItem icon="school" label="EdTech" href="/edtech" />
          <NavItem icon="local_hospital" label="Hospital" href="/hospital" />
          
          <div className="pt-4 mt-4 border-t border-slate-100">
            <NavItem icon="person" label="Profile" href="/profile" />
            <NavItem icon="settings" label="Settings" href="/settings" />
          </div>
        </nav>
        <div className="p-8 border-t border-slate-50">
          <div className="bg-slate-50 p-4 rounded-2xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Help Center</p>
            <p className="text-xs text-slate-500 mb-4">Need help?</p>
            <button className="w-full py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:shadow-sm transition-all">Support</button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 w-full z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 min-h-20 flex flex-wrap justify-between items-center gap-4 px-4 py-4 sm:px-6 lg:px-10 shadow-sm">
          <div className="lg:hidden text-2xl font-black tracking-tighter text-primary">zelcor</div>
          <div className="hidden lg:block text-slate-400 font-bold text-sm tracking-tight uppercase tracking-[0.2em]">Trust, Encoded.</div>
          
          <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-6 lg:gap-8">
            <div 
              onClick={connectWallet}
              className="flex min-w-0 items-center gap-3 bg-slate-50 px-3 py-2 sm:px-4 rounded-2xl border border-slate-100 cursor-pointer hover:shadow-sm transition-all group"
            >
              <span className={`material-symbols-outlined text-xl transition-colors ${ethAddress ? 'text-emerald-500' : 'text-primary group-hover:animate-bounce'}`}>
                {ethAddress ? 'account_balance_wallet' : 'link'}
              </span>
              <div className="text-left">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">
                  {ethAddress ? `${ethAddress.slice(0, 6)}...` : 'Web3 Wallet'}
                </p>
                <p className="text-sm font-black text-slate-700 leading-none">
                  {ethAddress ? `${parseFloat(ethBalance).toFixed(4)} ETH` : 'Connect Now'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 sm:gap-4 sm:border-l border-slate-200 sm:pl-6 lg:pl-8">
              <button className="material-symbols-outlined text-slate-400 hover:text-primary transition-colors">notifications</button>
              <div onClick={() => navigate('/profile')} className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold shadow-inner cursor-pointer hover:scale-105 transition-all">
                {profile?.full_name?.charAt(0) || 'U'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-10 lg:pt-12 space-y-8 lg:space-y-12 max-w-[1400px] mx-auto w-full">
          <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="font-h1 text-3xl sm:text-[44px] tracking-tight leading-tight mb-2">Welcome back, <span className="text-primary font-black">{profile?.full_name?.split(' ')[0] || 'User'}</span></h2>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <div className="flex min-w-0 items-center gap-2 text-slate-400">
                  <span className="material-symbols-outlined text-sm text-emerald-500">verified_user</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest break-all">
                    Verified Identity: {profile?.email}
                  </span>
                </div>
                <div className="hidden sm:block w-1 h-1 bg-slate-200 rounded-full"></div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-full border border-amber-100">
                  <span className="material-symbols-outlined text-amber-500 text-sm">stars</span>
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Gold Protector</span>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-1">Trust Health</p>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black text-primary">{stats.trustScore}</span>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[10px] font-bold text-emerald-500 flex items-center">
                    <span className="material-symbols-outlined text-xs">arrow_upward</span> +2.4
                  </span>
                  <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-1">this month</span>
                </div>
              </div>
            </div>
          </section>

          <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
            <StatCard label="Protected Volume" val={`₹${stats.volume.toLocaleString()}`} desc="Live assurance active" icon="shield" color="primary" />
            <StatCard label="My Orders" val={stats.activeCount} desc="Awaiting confirmation" icon="shopping_bag" color="secondary" />
            <StatCard label="Refunded Total" val={`₹${stats.refundedTotal.toLocaleString()}`} desc="Money recovered" icon="undo" color="coral" />
            <StatCard label="Resolution Rate" val="100%" desc="Success guarantee" icon="check_circle" color="mint" />
          </section>

          <div className="grid lg:grid-cols-12 gap-6 lg:gap-10">
            <div className="lg:col-span-8 space-y-8 lg:space-y-10 min-w-0">
              <div className="space-y-6" id="orders">
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <h3 className="font-h2 text-2xl text-slate-800 tracking-tight">My Orders <span className="text-slate-300 ml-2">{stats.activeCount}</span></h3>
                  <button className="text-xs font-bold text-primary hover:underline">View All</button>
                </div>
                
                <div className="space-y-4">
                  {escrows.filter(e => e.status === 'active' || e.status === 'disputed').length === 0 ? (
                    <div className="p-8 sm:p-12 lg:p-20 text-center bg-white rounded-[28px] sm:rounded-[40px] border border-dashed border-slate-200 flex flex-col items-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                        <span className="material-symbols-outlined text-4xl">shield_moon</span>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-slate-600">Your shopping is safe</p>
                        <p className="text-sm text-slate-400">Pay through Zelcor to protect your purchase.</p>
                      </div>
                      <button onClick={() => navigate('/shop')} className="px-6 py-3 bg-primary text-white rounded-2xl font-bold text-xs shadow-lg shadow-primary/20 hover:scale-105 transition-all">Shop with Zelcor</button>
                    </div>
                  ) : (
                    escrows.filter(e => e.status === 'active' || e.status === 'disputed').map((item) => (
                      <EscrowCard
                        key={item.id}
                        item={item}
                        onConfirm={() => handleConfirmEscrow(item.id)}
                        onReport={() => {
                          setSelectedEscrowId(item.id);
                          setIsModalOpen(true);
                        }}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="font-h2 text-xl text-slate-800 tracking-tight">Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <QuickActionButton icon="add_circle" label="New Claim" href="/file-complaint" color="#1A5F7A" />
                  <QuickActionButton icon="shopping_bag" label="Shop" href="/shop" color="#2E8A57" />
                  <QuickActionButton icon="verified" label="Certificates" href="/certificates" color="#F2C94C" />
                  <QuickActionButton icon="history" label="Refund History" href="#" color="#F27A6B" />
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-10">
              <div className="bg-white rounded-[28px] sm:rounded-[40px] border border-slate-100 p-5 sm:p-8 shadow-sm space-y-8">
                <h4 className="font-h2 text-xl tracking-tight">Recent Activity</h4>
                <div className="space-y-8">
                  {activities.map((act, i) => (
                    <div key={i} className="flex gap-4 group cursor-pointer min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        act.type === 'refund' ? 'bg-emerald-50 text-emerald-500' : 
                        act.type === 'dispute' ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'
                      }`}>
                        <span className="material-symbols-outlined text-xl">{act.icon}</span>
                      </div>
                      <div className="flex-1 border-b border-slate-50 pb-4 group-last:border-0">
                        <div className="flex flex-wrap justify-between items-start gap-2 mb-1">
                          <p className="text-sm font-bold text-slate-800 leading-tight">{act.message}</p>
                          <p className="text-sm font-black text-slate-700">{act.amount}</p>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{act.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="w-full py-4 text-[10px] font-black text-primary uppercase tracking-[0.3em] hover:bg-slate-50 rounded-2xl transition-all">Full Activity Log</button>
              </div>

              <div className="bg-[#1A5F7A] p-6 sm:p-8 rounded-[28px] sm:rounded-[40px] text-white space-y-6 shadow-2xl shadow-primary/30 relative overflow-hidden group">
                <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
                <div className="relative z-10 space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
                      <span className="material-symbols-outlined text-3xl text-amber-300">emoji_events</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 px-3 py-1 rounded-full border border-white/20">Level 4</span>
                  </div>
                  <div>
                    <h5 className="font-h2 text-2xl mb-1">Gold Protector</h5>
                    <p className="text-white/60 text-[11px] font-medium leading-relaxed">You are in the top 10% of users.</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span>Progress to Platinum</span>
                      <span>850 / 1000</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-300 rounded-full w-[85%]"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <ComplaintModal
        isOpen={isModalOpen}
        escrowId={selectedEscrowId}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEscrowId(null);
        }}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .text-coral { color: #F27A6B; }
        .bg-coral-10 { background: rgba(242, 122, 107, 0.1); }
        .text-mint { color: #2E8A57; }
        .bg-mint-10 { background: rgba(46, 138, 87, 0.1); }
      `}} />
    </div>
  );
};

const NavItem = ({ icon, label, href, active = false }) => (
  <a href={href} className={`flex items-center gap-4 px-6 py-4 rounded-[20px] transition-all group ${active ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-primary hover:bg-slate-50'}`}>
    <span className="material-symbols-outlined text-xl">{icon}</span>
    <span className={`text-sm font-bold ${active ? 'text-white' : 'text-slate-500'}`}>{label}</span>
  </a>
);

const StatCard = ({ label, val, desc, icon, color }) => {
  const colorMap = {
    primary: 'text-primary bg-primary/10',
    secondary: 'text-secondary bg-secondary/10',
    coral: 'text-coral bg-coral-10',
    mint: 'text-mint bg-mint-10'
  };
  return (
    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-all">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{label}</span>
        <span className={`material-symbols-outlined p-2 rounded-xl text-lg ${colorMap[color]}`}>{icon}</span>
      </div>
      <div>
        <p className="font-h2 text-3xl tracking-tighter leading-none mb-1">{val}</p>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{desc}</p>
      </div>
    </div>
  );
};

const QuickActionButton = ({ icon, label, href, color }) => (
  <a href={href} className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-50 rounded-[32px] hover:shadow-xl hover:shadow-slate-100 hover:scale-105 transition-all text-center group">
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg mb-1" style={{ backgroundColor: color }}>
      <span className="material-symbols-outlined text-2xl">{icon}</span>
    </div>
    <span className="text-[10px] font-black uppercase tracking-widest leading-tight text-slate-500 group-hover:text-slate-800 transition-colors">{label}</span>
  </a>
);

const EscrowCard = ({ item, onConfirm, onReport }) => {
  const expiryTime = item.auto_release_at || item.created_at;
  const timeLeft = expiryTime ? Math.max(0, Math.round((new Date(expiryTime) - new Date()) / 3600000)) : 48;
  return (
    <div className="bg-white p-5 sm:p-8 rounded-[28px] sm:rounded-[40px] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8 group hover:shadow-xl hover:shadow-slate-100 transition-all">
      <div className="flex min-w-0 items-center gap-4 sm:gap-6">
        <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary/5 group-hover:text-primary transition-all">
          <span className="material-symbols-outlined text-3xl">shopping_bag</span>
        </div>
        <div className="min-w-0">
          <h4 className="font-h2 text-xl mb-1 text-slate-800 tracking-tight">{item.item_name}</h4>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border ${
              item.status === 'disputed' ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-emerald-50 text-emerald-500 border-emerald-100'
            }`}>
              {item.status}
            </span>
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest"># {item.id.slice(0,8)}</span>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 lg:gap-10">
        <div className="text-left sm:text-right">
          <p className="text-xl font-black text-slate-700 leading-none mb-2">₹{item.amount.toLocaleString()}</p>
          <div className="flex items-center sm:justify-end gap-1.5 text-orange-500">
            <span className="material-symbols-outlined text-sm">schedule</span>
            <span className="text-[10px] font-bold uppercase tracking-widest">{timeLeft}h remaining</span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {item.status === 'active' && (
            <button
              onClick={onConfirm}
              className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all"
            >
              Confirm
            </button>
          )}
          <button 
            onClick={onReport}
            className="px-6 py-3 border border-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-all"
          >Raise Complaint</button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
