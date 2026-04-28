import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:3000/api';

const ZelcorShop = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const products = [
    { id: 'p1', name: 'MacBook Air M2', price: 95000, image: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&q=80&w=300' },
    { id: 'p2', name: 'iPhone 15 Pro', price: 125000, image: 'https://images.unsplash.com/photo-1696446701796-da61225697cc?auto=format&fit=crop&q=80&w=300' },
    { id: 'p3', name: 'Sony WH-1000XM5', price: 24900, image: 'https://images.unsplash.com/photo-1670055255470-362208f02905?auto=format&fit=crop&q=80&w=300' },
    { id: 'p4', name: 'AirPods Pro 2', price: 21900, image: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&q=80&w=300' }
  ];

  const handleBuy = async (product) => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
    
    if (!userId) {
      alert('Please login first');
      navigate('/auth');
      return;
    }

    try {
      // Create a real escrow in the backend
      const res = await axios.post(`${API_URL}/escrows/create`, {
        buyer_id: userId,
        seller_id: '88888888-8888-8888-8888-888888888888', // Demo Store ID
        item_name: product.name,
        amount: product.price,
        company_wallet: '0x321...456',
        inspection_period_hours: 48
      });

      if (res.data.success) {
        alert(`🎉 Transaction Protected! ₹${product.price} held in Zelcor Escrow. Check your Dashboard.`);
        navigate('/dashboard');
      }
    } catch (error) {
      alert('Checkout error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen font-body-lg">
      <header className="h-20 border-b border-slate-100 flex items-center justify-between px-10 sticky top-0 bg-white/90 backdrop-blur-md z-50">
        <div className="flex items-center gap-10">
          <div className="text-2xl font-black tracking-tighter text-slate-900">demo.shop</div>
          <nav className="flex gap-8 text-sm font-bold text-slate-400">
            <span className="text-slate-900">Electronics</span>
            <span>Fashion</span>
            <span>Home</span>
          </nav>
        </div>
        <div className="flex items-center gap-6">
           <span className="material-symbols-outlined text-slate-400">search</span>
           <span className="material-symbols-outlined text-slate-400">shopping_cart</span>
           <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-primary/10 text-primary rounded-xl font-bold text-xs">Back to Zelcor</button>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto p-12 space-y-12">
        <div className="bg-slate-900 p-16 rounded-[48px] text-white relative overflow-hidden">
          <div className="relative z-10 space-y-4 max-w-[500px]">
             <span className="px-3 py-1 bg-primary text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em]">Partner Integration</span>
             <h2 className="font-h1 text-6xl tracking-tight leading-none">Shop with Confidence.</h2>
             <p className="text-slate-400 text-lg">Zelcor is now integrated as the primary payment protection layer for demo.shop.</p>
          </div>
          <div className="absolute top-[-50px] right-[-50px] w-96 h-96 bg-primary/20 rounded-full blur-[100px]"></div>
        </div>

        <div className="grid md:grid-cols-4 gap-8">
          {products.map((p) => (
            <div key={p.id} className="group cursor-pointer">
              <div className="aspect-square bg-slate-50 rounded-[40px] overflow-hidden mb-4 relative">
                <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name} />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all"></div>
              </div>
              <div className="space-y-3">
                <h3 className="font-h3 text-xl">{p.name}</h3>
                <p className="font-black text-2xl">₹{p.price.toLocaleString()}</p>
                <button 
                  onClick={() => handleBuy(p)}
                  disabled={loading}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">shield</span>
                  {loading ? 'Processing...' : 'Buy with Zelcor'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="p-12 text-center border-t border-slate-50">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">
          Powered by Zelcor Escrow Protocol <br /> Trust, Encoded.
        </p>
      </footer>
    </div>
  );
};

export default ZelcorShop;
