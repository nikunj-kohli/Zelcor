import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import MyOrders from './pages/MyOrders';
import CompanyDashboard from './pages/CompanyDashboard';
import ComplaintsList from './pages/ComplaintsList';
import ComplaintDetail from './pages/ComplaintDetail';
import BlockchainCertificates from './pages/BlockchainCertificates';
import Support from './pages/Support';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import ZelcorShop from './pages/ZelcorShop';
import Insurance from './pages/Insurance';
import Rental from './pages/Rental';
import PaymentSuccess from './pages/PaymentSuccess';
import Layout from './components/Layout';
import Wallet from './pages/Wallet';


function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Listen for Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={session ? <Navigate to="/dashboard" /> : <Auth />} />
      
      {/* Protected Routes with Layout */}
      <Route element={session ? <Layout /> : <Navigate to="/auth" />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/orders" element={<MyOrders />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/company" element={<CompanyDashboard />} />
        <Route path="/complaints" element={<ComplaintsList />} />
        <Route path="/complaint/:id" element={<ComplaintDetail />} />
        <Route path="/certificates" element={<BlockchainCertificates />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/shop" element={<ZelcorShop />} />
        <Route path="/insurance" element={<Insurance />} />
        <Route path="/rental" element={<Rental />} />
      </Route>

      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="/support" element={<Support />} />
    </Routes>
  );
}




export default App;

