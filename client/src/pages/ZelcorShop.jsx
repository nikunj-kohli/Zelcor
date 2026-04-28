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

  useEffect(() => {
    const savedCart = localStorage.getItem('zelcor_cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('zelcor_cart', JSON.stringify(cart));
  }, [cart]);

  const handleAmazonImport = async () => {
    const url = amazonLink.trim();
    if (!url) {
      setImportError('Paste an Amazon product URL first.');
      return;
    }
    if (!url.includes('amazon') && !url.includes('amzn')) {
      setImportError('Please paste a valid Amazon product URL.');
      return;
    }

    const requestId = Date.now();
    latestImportRequestRef.current = requestId;
    setLoading(true);
    setImportError('');

    try {
      const res = await axios.post(`${API_URL}/shop/analyze-link`, { url });
      const product = res.data?.product;

      if (!res.data?.success) throw new Error('Extraction failed');

      const safeName = cleanName(product?.name) || extractNameFromUrl(url) || 'Imported Product';
      const safePrice = Number(product?.price) > 0 ? Math.round(product.price) : guessPriceFromName(safeName);

      if (latestImportRequestRef.current !== requestId) return;

      setScannedProduct({
        ...product,
        name: safeName,
        price: safePrice,
        image: product?.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800',
        id: `scanned-${requestId}`,
        url,
      });
    } catch (error) {
      if (latestImportRequestRef.current !== requestId) return;
      setImportError('Could not fetch the product. Please check the URL.');
    } finally {
      if (latestImportRequestRef.current === requestId) setLoading(false);
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
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      
      if (!userId) {
        navigate('/auth');
        return;
      }

      const res = await axios.post(`${API_URL}/escrows/create`, {
        buyer_id: userId,
        item_name: cart.length > 1 ? `${cart.length} Items Package` : cart[0].name,
        amount: totalAmount,
        company_wallet: '0x321...456',
        inspection_period_hours: 48
      });

      if (res.data.success) {
        const { escrow } = res.data;
        const paymentUrl = `${window.location.origin}/payment-success?escrow_id=${escrow.id}&demo=1`;
        localStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify({ primaryEscrowId: escrow.id, userId, cart, createdAt: Date.now() }));
        setDemoPaymentUrl(paymentUrl);
        setShowDemoPayment(true);
      }
    } catch (error) {
      setDemoCheckoutError('Checkout failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black text-[#191c1e] tracking-tight leading-none mb-2">Zelcor Shop</h1>
          <p className="text-slate-500 font-medium text-lg">Buy from anywhere with blockchain escrow protection.</p>
        </div>
        <button 
          onClick={() => setShowCart(true)}
          className="relative px-6 py-4 bg-white border border-slate-100 rounded-[24px] shadow-sm hover:shadow-md transition-all flex items-center gap-4 group"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined">shopping_bag</span>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cart</p>
            <p className="text-sm font-black text-slate-900">{cart.length} Items</p>
          </div>
          {cart.length > 0 && <span className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-white text-[10px] flex items-center justify-center rounded-full font-black animate-bounce">{cart.length}</span>}
        </button>
      </div>

      {/* Main Import Tool */}
      <div className="bg-slate-900 rounded-[48px] p-12 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/20 text-primary rounded-full mb-6 border border-primary/20">
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            <span className="text-[10px] font-black uppercase tracking-widest">AI Import Engine</span>
          </div>
          <h2 className="text-4xl font-black mb-4 leading-tight">Paste any Amazon link to enable protection.</h2>
          <p className="text-slate-400 mb-8 text-lg font-medium leading-relaxed">
            Found something you like? Copy the link from Amazon and paste it here. We'll secure your payment in escrow until it arrives and you verify it.
          </p>
          
          <div className="flex gap-3 bg-white/10 p-3 rounded-3xl backdrop-blur-xl border border-white/10 focus-within:border-primary/50 transition-all shadow-2xl">
            <input 
              type="text" 
              value={amazonLink}
              onChange={(e) => { setAmazonLink(e.target.value); setImportError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAmazonImport()}
              placeholder="https://www.amazon.in/dp/..." 
              className="bg-transparent flex-1 px-4 outline-none text-white font-medium placeholder:text-slate-500"
            />
            <button
              onClick={handleAmazonImport}
              disabled={loading}
              className="px-8 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-lg">bolt</span>}
              {loading ? 'Analyzing' : 'Protect Link'}
            </button>
          </div>
          {importError && <p className="mt-4 text-rose-400 text-sm font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
            <span className="material-symbols-outlined text-sm">error</span> {importError}
          </p>}
        </div>
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none"></div>
      </div>

      {/* Results / Empty State */}
      <div className="min-h-[400px]">
        {scannedProduct ? (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="bg-white rounded-[48px] border border-slate-100 p-12 shadow-xl flex flex-col md:flex-row gap-12 items-center">
              <div className="w-full md:w-80 aspect-square rounded-[40px] overflow-hidden shadow-2xl bg-slate-50 border border-slate-100 group relative">
                <img src={scannedProduct.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={scannedProduct.name} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
              
              <div className="flex-1 space-y-8">
                <div className="space-y-4">
                  <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">AI Verified Details</span>
                  <h3 className="text-4xl font-black text-slate-900 leading-tight">{scannedProduct.name}</h3>
                  <div className="flex items-center gap-4">
                    <p className="text-5xl font-black text-primary">₹{scannedProduct.price.toLocaleString()}</p>
                    <div className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-400">MARKET PRICE</div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-3xl space-y-4 border border-slate-100">
                  <div className="flex items-center gap-3 text-slate-600 font-bold text-sm">
                    <span className="material-symbols-outlined text-emerald-500">verified_user</span>
                    Funds held in decentralized escrow for 48h after delivery.
                  </div>
                  <div className="flex items-center gap-3 text-slate-600 font-bold text-sm">
                    <span className="material-symbols-outlined text-primary">security</span>
                    Automatic refund if product doesn't match description.
                  </div>
                </div>

                <button 
                  onClick={() => addToCart(scannedProduct)}
                  className="w-full md:w-auto px-12 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-black hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <span className="material-symbols-outlined">shopping_cart_checkout</span>
                  Add to Protected Cart
                </button>
              </div>
            </div>
          </div>
        ) : cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 opacity-30">
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-5xl">shopping_basket</span>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Your bag is empty</h3>
              <p className="font-bold">Import a link above to start shopping securely.</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Cart Drawer */}
      {showCart && (
        <>
          <div onClick={() => setShowCart(false)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] animate-in fade-in duration-500"></div>
          <div className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-white z-[110] shadow-2xl animate-in slide-in-from-right duration-500 flex flex-col">
            <div className="p-10 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-3xl font-black tracking-tight">Your Cart</h3>
              <button onClick={() => setShowCart(false)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 space-y-8">
              {cart.map((item) => (
                <div key={item.cartId} className="flex gap-6 group">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-50 flex-shrink-0">
                    <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-slate-900 line-clamp-1">{item.name}</h4>
                    <p className="text-primary font-black mt-1">₹{item.price.toLocaleString()}</p>
                    <button onClick={() => removeFromCart(item.cartId)} className="text-[10px] font-black text-rose-500 uppercase tracking-widest mt-2 hover:underline">Remove</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-10 bg-slate-50 border-t border-slate-100 space-y-8">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Protected Amount</p>
                  <p className="text-4xl font-black text-slate-900">₹{totalAmount.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Escrow Active</p>
                </div>
              </div>
              <button 
                onClick={handleCheckout}
                disabled={loading || cart.length === 0}
                className="w-full py-6 bg-primary text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                <span className="material-symbols-outlined">lock_open</span>
                {loading ? 'Processing...' : 'Secure Checkout'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Demo Payment Modal */}
      {showDemoPayment && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-xl">
          <div className="bg-white rounded-[48px] w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="grid md:grid-cols-[350px_1fr]">
              <div className="bg-primary p-12 text-white flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="text-4xl font-black tracking-tighter">Razorpay</div>
                  <div className="h-px bg-white/20"></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">Order Total</p>
                    <p className="text-5xl font-black">₹{totalAmount.toLocaleString()}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm font-bold">
                    <span className="material-symbols-outlined">security</span>
                    Bank-grade Encryption
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed italic">Demo Mode: No real money will be charged. Clicking "Complete Payment" will simulate a successful transaction.</p>
                </div>
              </div>

              <div className="p-12 space-y-10">
                <div className="flex justify-between items-center">
                  <h3 className="text-3xl font-black text-slate-900">Payment Options</h3>
                  <button onClick={() => setShowDemoPayment(false)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-400">close</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {['UPI / QR', 'Cards', 'Netbanking', 'Wallets'].map(method => (
                    <div key={method} className="p-6 rounded-[24px] border border-slate-100 bg-slate-50 hover:border-primary/30 hover:bg-white transition-all cursor-pointer group">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors mb-4 shadow-sm">
                        <span className="material-symbols-outlined">{method === 'UPI / QR' ? 'qr_code' : method === 'Cards' ? 'credit_card' : 'account_balance'}</span>
                      </div>
                      <p className="font-black text-slate-800">{method}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => window.location.href = demoPaymentUrl}
                    className="flex-1 py-5 bg-primary text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/30 hover:scale-[1.02] transition-all"
                  >
                    Complete Payment
                  </button>
                  <button 
                    onClick={() => setShowDemoPayment(false)}
                    className="px-10 py-5 bg-slate-100 text-slate-600 rounded-[24px] font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZelcorShop;
