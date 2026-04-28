import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const TopBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [balance, setBalance] = useState(0);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Home';
    if (path === '/orders') return 'My Orders';
    if (path === '/wallet') return 'Zelcor Wallet';
    if (path === '/complaints') return 'Complaints';
    if (path.startsWith('/complaint/')) return 'Complaint Detail';
    if (path === '/shop') return 'E Commerce';
    if (path === '/insurance') return 'Insurance';
    if (path === '/rental') return 'Rental';
    if (path === '/profile') return 'Profile';
    return 'Zelcor';
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      if (!userId) return;

      try {
        const [profileRes, escrowsRes] = await Promise.all([
          axios.get(`${API_URL}/auth/profile/${userId}`),
          axios.get(`${API_URL}/user/escrows?user_id=${userId}`),
        ]);
        setProfile(profileRes.data.profile);
        
        const refundedTotal = (escrowsRes.data.escrows || [])
          .filter(e => e.status === 'refunded')
          .reduce((sum, e) => sum + Number(e.amount), 0);
        setBalance(refundedTotal);
      } catch (error) {
        console.error('Error fetching TopBar data:', error);
      }
    };

    fetchData();
    
    // Listen for custom event to refresh balance (optional, but good for UX)
    const handleRefresh = () => fetchData();
    window.addEventListener('refresh-topbar', handleRefresh);
    return () => window.removeEventListener('refresh-topbar', handleRefresh);
  }, []);

  return (
    <header className="sticky top-0 w-full z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 h-20 flex justify-between items-center px-8 shadow-sm">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-black tracking-tight text-slate-900">{getPageTitle()}</h2>
        <div className="hidden md:block h-6 w-[1px] bg-slate-200 mx-2"></div>
        <div className="hidden lg:block text-slate-400 font-bold text-[10px] tracking-tight uppercase tracking-[0.2em]">Trust, Encoded.</div>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/wallet')} 
          className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
          <div className="text-left leading-none">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Zelcor Wallet</p>
            <p className="text-sm font-black text-slate-800 mt-1">₹{balance.toLocaleString()}</p>
          </div>
        </button>
        
        <div 
          onClick={() => navigate('/profile')} 
          className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold cursor-pointer hover:bg-primary/20 transition-colors border border-primary/20"
        >
          {profile?.full_name?.charAt(0) || 'U'}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
