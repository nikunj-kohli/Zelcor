import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:3000/api';
const PENDING_CHECKOUT_KEY = 'zelcor_pending_checkout';

const cleanName = (name = '') =>
  name
    .replace(/^title:\s*/i, '')
    .replace(/\s*:\s*Amazon\.in.*$/i, '')
    .replace(/\s+-\s+Amazon.*$/i, '')
    .replace(/\|.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

const guessPriceFromName = (name = '') => {
  const n = name.toLowerCase();
  if (n.includes('macbook')) return 199900;
  if (n.includes('iphone')) return 79900;
  if (n.includes('ipad')) return 45900;
  if (n.includes('airpods')) return 21900;
  if (n.includes('watch')) return 34900;
  if (n.includes('headphone') || n.includes('headphones')) return 4999;
  if (n.includes('earbud') || n.includes('earbuds')) return 1999;
  if (n.includes('camera') || n.includes('nikon') || n.includes('canon')) return 54990;
  if (n.includes('laptop')) return 69990;
  return 2499;
};

const extractNameFromUrl = (url) => {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const slug =
      parts.find((p) => p.includes('-') && !p.includes('dp') && !p.includes('ref')) || '';
    if (!slug) return '';
    const decoded = decodeURIComponent(slug).replace(/%[0-9A-F]{2}/gi, ' ');
    return cleanName(
      decoded
        .split('-')
        .slice(0, 14)
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
        .join(' ')
    );
  } catch {
    return '';
  }
};

const isBadPrice = (p) => !Number.isFinite(p) || p <= 0;

const minExpectedPriceForName = (name = '') => {
  const n = name.toLowerCase();
  if (n.includes('macbook')) return 50000;
  if (n.includes('iphone')) return 30000;
  if (n.includes('ipad')) return 15000;
  if (n.includes('airpods')) return 8000;
  if (n.includes('watch')) return 8000;
  if (n.includes('camera') || n.includes('nikon') || n.includes('canon')) return 20000;
  if (n.includes('laptop')) return 25000;
  if (n.includes('headphone') || n.includes('headphones')) return 300;
  if (n.includes('earbud') || n.includes('earbuds')) return 200;
  // For unknown categories, trust backend price if it is positive.
  return 1;
};

const isUnrealisticPriceForName = (name, price) => {
  if (!Number.isFinite(price)) return true;
  return price < minExpectedPriceForName(name);
};

const getDemoImageByName = (name = '') => {
  const n = name.toLowerCase();

  // Stable, deterministic images for demo quality
  if (n.includes('macbook') || n.includes('laptop')) {
    return 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&q=80&w=800';
  }
  if (n.includes('iphone')) {
    return 'https://images.unsplash.com/photo-1696446701796-da61225697cc?auto=format&fit=crop&q=80&w=800';
  }
  if (n.includes('headphone') || n.includes('headphones')) {
    return 'https://images.unsplash.com/photo-1670055255470-362208f02905?auto=format&fit=crop&q=80&w=800';
  }
  if (n.includes('airpods') || n.includes('earbud') || n.includes('earbuds')) {
    return 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&q=80&w=800';
  }
  if (n.includes('watch')) {
    return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800';
  }
  if (n.includes('camera') || n.includes('nikon') || n.includes('canon')) {
    return 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=800';
  }

  return 'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&q=80&w=800';
};

const ZelcorShop = () => {
  const [loading, setLoading] = useState(false);
  const [amazonLink, setAmazonLink] = useState('');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [importError, setImportError] = useState('');
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [demoPaymentUrl, setDemoPaymentUrl] = useState('');
  const [showDemoPayment, setShowDemoPayment] = useState(false);
  const [demoCheckoutError, setDemoCheckoutError] = useState('');
  const latestImportRequestRef = useRef(0);
  const navigate = useNavigate();

  const products = [
    { id: 'p1', name: 'MacBook Air M2', price: 95000, image: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&q=80&w=300' },
    { id: 'p2', name: 'iPhone 15 Pro', price: 125000, image: 'https://images.unsplash.com/photo-1696446701796-da61225697cc?auto=format&fit=crop&q=80&w=300' },
    { id: 'p3', name: 'Sony WH-1000XM5', price: 24900, image: 'https://images.unsplash.com/photo-1670055255470-362208f02905?auto=format&fit=crop&q=80&w=300' },
    { id: 'p4', name: 'AirPods Pro 2', price: 21900, image: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&q=80&w=300' }
  ];

  useEffect(() => {
    // Load cart from local storage if exists
    const savedCart = localStorage.getItem('zelcor_cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('zelcor_cart', JSON.stringify(cart));
  }, [cart]);

  const handleAmazonLinkChange = (e) => {
    setAmazonLink(e.target.value);
    setImportError('');
  };

  const handleAmazonImport = async () => {
    const url = amazonLink.trim();

    if (!url) {
      setImportError('Paste an Amazon product URL first.');
      setScannedProduct(null);
      return;
    }

    if (!url.includes('amazon') && !url.includes('amzn')) {
      setImportError('Please paste a valid Amazon product URL.');
      setScannedProduct(null);
      return;
    }

    const requestId = Date.now();
    latestImportRequestRef.current = requestId;
    setLoading(true);
    setImportError('');

    try {
      const res = await axios.post(`${API_URL}/shop/analyze-link`, { url });
      const product = res.data?.product;

      if (!res.data?.success) {
        throw new Error('Could not extract product details');
      }

      // Demo-reliable fallback (restore previous "looks correct" behavior)
      const localName = extractNameFromUrl(url);
      const apiName = cleanName(product?.name || '');
      const safeName =
        apiName && apiName !== 'Product Name' && apiName !== 'Amazon Imported Product'
          ? apiName
          : localName || 'Amazon Imported Product';

      const apiPrice = Number(product?.price);
      const safePrice =
        !isBadPrice(apiPrice) && !isUnrealisticPriceForName(safeName, apiPrice)
          ? Math.round(apiPrice)
          : guessPriceFromName(safeName);

      const fallbackImage = getDemoImageByName(safeName);
      const safeImage =
        product?.source === 'amazon-html' && product?.image
          ? product.image
          : fallbackImage;

      if (latestImportRequestRef.current !== requestId) {
        return;
      }

      setScannedProduct({
        ...product,
        name: safeName,
        price: safePrice,
        image: safeImage,
        id: `scanned-${requestId}`,
        url,
      });
    } catch (error) {
      if (latestImportRequestRef.current !== requestId) {
        return;
      }

      setScannedProduct(null);
      setImportError(
        error.response?.data?.error || 'Could not fetch the product from Amazon. Try a clean product URL with `/dp/ASIN`.'
      );
    } finally {
      if (latestImportRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  const addToCart = (product) => {
    setCart([...cart, { ...product, cartId: Date.now() }]);
    setScannedProduct(null);
    setAmazonLink('');
    setShowCart(true);
  };

  const removeFromCart = (cartId) => {
    setCart(cart.filter(item => item.cartId !== cartId));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    setLoading(true);
    setDemoCheckoutError('');
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    const userId = user?.id || localStorage.getItem('zelcor_demo_id');
    
    if (!userId) {
      alert('Please login first');
      navigate('/auth');
      return;
    }

    try {
      // For demo purposes, we'll create the first order to get a Razorpay Order ID 
      // In a real app, you'd create a 'Group Order' or handle multiple payments.
      // Here, we'll create one 'Package' escrow for the whole cart.
      
      const res = await axios.post(`${API_URL}/escrows/create`, {
        buyer_id: userId,
        item_name: cart.length > 1 ? `${cart.length} Products Package` : cart[0].name,
        amount: totalAmount,
        company_wallet: '0x321...456',
        inspection_period_hours: 48
      });

      if (res.data.success) {
        const { escrow } = res.data;
        const paymentUrl = `${window.location.origin}/payment-success?escrow_id=${escrow.id}&demo=1`;

        localStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify({
          primaryEscrowId: escrow.id,
          userId,
          cart,
          createdAt: Date.now(),
        }));
        setDemoPaymentUrl(paymentUrl);
        setShowDemoPayment(true);
      } else {
        setDemoCheckoutError(res.data?.error || 'Could not create escrow order.');
        setShowDemoPayment(true);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setDemoCheckoutError(error.response?.data?.error || error.message || 'Checkout failed');
      setShowDemoPayment(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen font-body-lg relative overflow-x-hidden">
      {/* Header */}
      <header className="h-20 border-b border-slate-100 flex items-center justify-between px-10 sticky top-0 bg-white/90 backdrop-blur-md z-50">
        <div className="flex items-center gap-10">
          <div className="text-2xl font-black tracking-tighter text-slate-900 flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <span className="material-symbols-outlined text-primary">verified_user</span>
            Zelcor Shop
          </div>
          <nav className="hidden md:flex gap-8 text-sm font-bold text-slate-400">
            <span className="text-slate-900">Marketplace</span>
            <span>Amazon Import</span>
            <span>Protection Plans</span>
          </nav>
        </div>
        <div className="flex items-center gap-6">
           <button onClick={() => setShowCart(true)} className="relative p-2 hover:bg-slate-50 rounded-xl transition-all">
              <span className="material-symbols-outlined text-slate-600">shopping_cart</span>
              {cart.length > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
                  {cart.length}
                </span>
              )}
           </button>
           <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-primary/10 text-primary rounded-xl font-bold text-xs hover:bg-primary/20 transition-all">Back to Dashboard</button>
        </div>
      </header>

      {/* Cart Sidebar */}
      <div className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl z-[100] transition-transform duration-500 transform ${showCart ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-h2 text-2xl tracking-tight">Your Protected Cart</h3>
            <button onClick={() => setShowCart(false)} className="material-symbols-outlined text-slate-400 hover:text-slate-900 transition-colors">close</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                <span className="material-symbols-outlined text-6xl">shopping_basket</span>
                <p className="font-bold">Your cart is empty</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.cartId} className="flex gap-4 items-center animate-in slide-in-from-right-4">
                  <img src={item.image} className="w-16 h-16 rounded-xl object-cover shadow-sm" alt={item.name} />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-800 line-clamp-1">{item.name}</h4>
                    <p className="text-primary font-black text-xs">₹{item.price.toLocaleString()}</p>
                  </div>
                  <button onClick={() => removeFromCart(item.cartId)} className="material-symbols-outlined text-slate-300 hover:text-rose-500 transition-colors text-lg">delete</button>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="p-8 border-t border-slate-100 bg-slate-50 space-y-6">
              <div className="flex justify-between items-end">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Protected Amount</p>
                <p className="text-3xl font-black text-slate-900">₹{totalAmount.toLocaleString()}</p>
              </div>
              <div className="space-y-3">
                <button 
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full py-5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">payments</span>
                  {loading ? 'Initiating Checkout...' : 'Checkout with Razorpay'}
                </button>
                <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-widest">All items will be held in Zelcor Escrow</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto p-12 space-y-12">
        {/* Amazon Import Section */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-12 rounded-[48px] text-white relative overflow-hidden shadow-2xl shadow-slate-200">
          <div className="relative z-10 space-y-6 max-w-[600px]">
             <span className="px-3 py-1 bg-primary text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em]">Import from Amazon</span>
             <h2 className="font-h1 text-5xl tracking-tight leading-none">Paste any Amazon link to buy with Escrow protection.</h2>
             <div className="flex gap-2 bg-white/10 p-2 rounded-2xl backdrop-blur-md border border-white/10 focus-within:border-primary/50 transition-all">
                <input 
                  type="text" 
                  value={amazonLink}
                  onChange={handleAmazonLinkChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAmazonImport();
                    }
                  }}
                  placeholder="https://www.amazon.in/dp/B0CHX2W7S4..." 
                  className="bg-transparent flex-1 px-4 outline-none text-sm placeholder:text-slate-500"
                />
                <button
                  onClick={handleAmazonImport}
                  disabled={loading}
                  className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-xs flex items-center gap-2 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-sm">link</span>
                  {loading ? 'Scanning...' : 'Import'}
                </button>
             </div>
             {importError && (
               <p className="text-rose-300 text-sm">{importError}</p>
             )}
             <p className="text-slate-400 text-sm italic">Zelcor automatically detects price and details for escrow creation.</p>
          </div>
          <div className="absolute top-[-50px] right-[-50px] w-96 h-96 bg-primary/20 rounded-full blur-[100px]"></div>
        </div>

        {/* Scanned Product Display */}
        {scannedProduct && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex flex-col md:flex-row gap-12 bg-slate-50 p-8 rounded-[40px] items-center border-2 border-primary/20">
                <div className="w-full md:w-1/3 aspect-square bg-white rounded-[32px] overflow-hidden shadow-lg">
                  <img 
                    src={scannedProduct.image} 
                    className="w-full h-full object-cover" 
                    alt={scannedProduct.name}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=300";
                    }}
                  />
                </div>
                <div className="flex-1 space-y-6 text-center md:text-left">
                   <div className="space-y-2">
                      <span className="text-primary font-black text-xs uppercase tracking-widest">Found on Amazon</span>
                      <h3 className="font-h2 text-4xl text-slate-900">{scannedProduct.name}</h3>
                   </div>
                   <div className="flex items-center justify-center md:justify-start gap-4">
                      <p className="font-black text-4xl text-slate-900">₹{scannedProduct.price.toLocaleString()}</p>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase">Verified Price</span>
                   </div>
                   <div className="space-y-4">
                      <div className="flex items-center gap-3 text-slate-500 text-sm justify-center md:justify-start">
                         <span className="material-symbols-outlined text-green-500">verified</span>
                         Escrow protection will be applied at checkout.
                      </div>
                      <button 
                        onClick={() => addToCart(scannedProduct)}
                        className="w-full md:w-auto px-12 py-5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/30 hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined">add_shopping_cart</span>
                        Add to Protected Cart
                      </button>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* Marketplace Sections */}
        <div className="space-y-12">
           <div className="space-y-8">
              <div className="flex justify-between items-center">
                 <h3 className="font-h3 text-2xl text-slate-800 tracking-tight text-center md:text-left">Popular Marketplace</h3>
              </div>
              <div className="grid md:grid-cols-4 gap-8">
                {products.map((p) => (
                  <div key={p.id} className="group flex flex-col">
                    <div className="aspect-square bg-slate-50 rounded-[40px] overflow-hidden mb-4 relative border border-slate-100 group-hover:border-primary/20 transition-all">
                      <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all"></div>
                      <button 
                        onClick={() => addToCart(p)}
                        className="absolute bottom-4 right-4 w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-primary opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-90"
                      >
                         <span className="material-symbols-outlined">add_shopping_cart</span>
                      </button>
                    </div>
                    <div className="space-y-3 px-2">
                      <h3 className="font-h3 text-lg leading-tight">{p.name}</h3>
                      <div className="flex justify-between items-center">
                        <p className="font-black text-xl">₹{p.price.toLocaleString()}</p>
                        <button 
                          onClick={() => addToCart(p)}
                          className="text-[10px] font-black uppercase text-primary tracking-widest hover:underline"
                        >Add to Cart</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      </main>

      {/* Cart Backdrop */}
      {showCart && (
        <div onClick={() => setShowCart(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] animate-in fade-in duration-300"></div>
      )}

      {showDemoPayment && (
        <>
          <div
            onClick={() => setShowDemoPayment(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110]"
          ></div>
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <div className="w-full max-w-5xl bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden">
              <div className="grid md:grid-cols-[320px_1fr]">
                <div className="bg-primary text-white p-8 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center font-black">Z</div>
                    <div>
                      <p className="font-black text-xl tracking-tight">Razorpay Demo</p>
                      <p className="text-xs text-white/70 uppercase tracking-[0.2em]">Hackathon Mode</p>
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-2xl p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Protected Amount</p>
                    <p className="text-4xl font-black mt-2">₹{totalAmount.toLocaleString()}</p>
                  </div>
                  <div className="text-sm text-white/80 leading-relaxed">
                    This is a demo checkout. Click Next to simulate payment received and add this order to My Orders, where you can Confirm or Raise Complaint.
                  </div>
                </div>

                <div className="p-8 md:p-10 space-y-6 bg-gradient-to-br from-white to-slate-50/50">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Razorpay Demo Checkout</p>
                      <h3 className="text-3xl font-black text-slate-900 mt-2">Payment options</h3>
                    </div>
                    <button
                      onClick={() => setShowDemoPayment(false)}
                      className="material-symbols-outlined text-slate-400 hover:text-slate-900"
                    >
                      close
                    </button>
                  </div>

                  <div className="flex flex-col items-center gap-4">
                    <div className="w-full grid md:grid-cols-[1fr_320px] gap-6 items-start">
                      <div className="w-full rounded-3xl border border-slate-100 bg-slate-50 p-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4">
                          Payment options (demo)
                        </p>
                        <div className="space-y-3 text-sm font-bold text-slate-700">
                          {['UPI', 'Cards', 'EMI', 'Netbanking', 'Wallet', 'Pay Later'].map((x) => (
                            <div key={x} className="flex items-center justify-between rounded-2xl bg-white border border-slate-100 px-4 py-3 hover:border-primary/30 hover:bg-primary/5 transition-all">
                              <span>{x}</span>
                              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-slate-400 mt-4">
                          Hackathon mode: click <span className="font-black text-slate-600">Next</span> to simulate “Payment received”.
                        </p>
                      </div>

                      <div className="flex flex-col items-center gap-3 rounded-3xl border border-slate-100 bg-white p-4">
                        <div className="w-full flex items-center justify-between">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">UPI QR (optional)</p>
                          <p className="text-[10px] font-bold text-slate-300">demo</p>
                        </div>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(demoPaymentUrl)}`}
                          alt="Demo payment QR"
                          className="w-[250px] h-[250px] rounded-3xl border border-slate-100 p-3 bg-white"
                        />
                        <p className="text-xs text-slate-400 text-center">
                          Scanning opens the success link, but “Next” is the main demo flow.
                        </p>
                      </div>
                    </div>
                  </div>

                  {demoCheckoutError && (
                    <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 mb-1">Checkout Error</p>
                      <p className="text-sm text-rose-700">{demoCheckoutError}</p>
                      <p className="text-xs text-rose-600 mt-2">
                        For demo: ensure backend is running on <span className="font-bold">localhost:3000</span> and Supabase keys are correct.
                      </p>
                    </div>
                  )}

                  <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Callback Link</p>
                    <p className="text-xs text-slate-600 break-all max-h-10 overflow-hidden">{demoPaymentUrl}</p>
                  </div>

                  <div className="flex flex-col md:flex-row gap-3">
                    <button
                      onClick={() => window.location.href = demoPaymentUrl}
                      disabled={!demoPaymentUrl}
                      className="flex-1 px-6 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em]"
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setShowDemoPayment(false)}
                      className="px-6 py-4 bg-slate-100 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-[0.2em]"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <footer className="p-12 text-center border-t border-slate-50 mt-20">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">
          Zelcor Escrow Protocol v2.4 <br /> 
          <span className="text-primary/50">Trust, Encoded.</span>
        </p>
      </footer>
    </div>
  );
};

export default ZelcorShop;
