import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import CompanyDashboard from './pages/CompanyDashboard';
import ComplaintsList from './pages/ComplaintsList';
import ComplaintFiling from './pages/ComplaintFiling';
import ComplaintDetail from './pages/ComplaintDetail';
import BlockchainCertificates from './pages/BlockchainCertificates';
import Support from './pages/Support';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import ZelcorShop from './pages/ZelcorShop';
import Insurance from './pages/Insurance';
import EdTech from './pages/EdTech';
import Hospital from './pages/Hospital';
import PaymentSuccess from './pages/PaymentSuccess';
import RentalDemo from './pages/RentalDemo';


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
      <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/auth" />} />
      <Route path="/company" element={session ? <CompanyDashboard /> : <Navigate to="/auth" />} />
      <Route path="/complaints" element={session ? <ComplaintsList /> : <Navigate to="/auth" />} />
      <Route path="/file-complaint" element={session ? <ComplaintFiling /> : <Navigate to="/auth" />} />
      <Route path="/complaint/:id" element={session ? <ComplaintDetail /> : <Navigate to="/auth" />} />
      <Route path="/certificates" element={session ? <BlockchainCertificates /> : <Navigate to="/auth" />} />
      <Route path="/profile" element={session ? <Profile /> : <Navigate to="/auth" />} />
      <Route path="/settings" element={session ? <Settings /> : <Navigate to="/auth" />} />
      <Route path="/shop" element={<ZelcorShop />} />
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="/support" element={<Support />} />
      <Route path="/rental-demo" element={<RentalDemo />} />
      
      {/* Industry Routes */}
      <Route path="/insurance" element={session ? <Insurance /> : <Navigate to="/auth" />} />
      <Route path="/rental" element={session ? <RentalDemo /> : <Navigate to="/auth" />} />
      <Route path="/edtech" element={session ? <EdTech /> : <Navigate to="/auth" />} />
      <Route path="/hospital" element={session ? <Hospital /> : <Navigate to="/auth" />} />

    </Routes>
  );
}




export default App;

