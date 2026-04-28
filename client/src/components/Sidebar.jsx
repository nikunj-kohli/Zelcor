import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => location.pathname === path;

  return (
    <aside className="w-64 bg-white border-r border-slate-100 hidden lg:flex flex-col h-screen sticky top-0">
      <div className="p-8">
        <div className="text-3xl font-black tracking-tighter text-primary cursor-pointer" onClick={() => navigate('/dashboard')}>zelcor</div>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        <div className="space-y-1">
          <NavItem 
            icon="home" 
            label="Home" 
            onClick={() => navigate('/dashboard')} 
            active={isActive('/dashboard')} 
          />
          <NavItem 
            icon="shopping_bag" 
            label="My Orders" 
            onClick={() => navigate('/orders')} 
            active={isActive('/orders')} 
          />
          <NavItem 
            icon="account_balance_wallet" 
            label="Zelcor Wallet" 
            onClick={() => navigate('/wallet')} 
            active={isActive('/wallet')} 
          />
          <NavItem 
            icon="gavel" 
            label="Complaints" 
            onClick={() => navigate('/complaints')} 
            active={isActive('/complaints') || location.pathname.startsWith('/complaint/')} 
          />
        </div>

        <div className="pt-6 mt-6 border-t border-slate-100">
          <p className="px-6 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Industries</p>
          <div className="space-y-1">
            <NavItem 
              icon="shopping_cart" 
              label="E Commerce" 
              onClick={() => navigate('/shop')} 
              active={isActive('/shop')} 
            />
            <NavItem 
              icon="shield" 
              label="Insurance" 
              onClick={() => navigate('/insurance')} 
              active={isActive('/insurance')} 
            />
            <NavItem 
              icon="key" 
              label="Rental" 
              onClick={() => navigate('/rental')} 
              active={isActive('/rental')} 
            />
          </div>
        </div>

        <div className="pt-6 mt-6 border-t border-slate-100 mb-8">
          <p className="px-6 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Account</p>
          <NavItem 
            icon="person" 
            label="Profile" 
            onClick={() => navigate('/profile')} 
            active={isActive('/profile')} 
          />
        </div>
      </nav>
    </aside>
  );
};

const NavItem = ({ icon, label, onClick, active = false }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-6 py-4 rounded-[20px] transition-all ${
      active 
        ? 'bg-primary text-white shadow-lg shadow-primary/20' 
        : 'text-slate-400 hover:text-primary hover:bg-slate-50'
    }`}
  >
    <span className="material-symbols-outlined text-xl">{icon}</span>
    <span className={`text-sm font-bold ${active ? 'text-white' : 'text-slate-500'}`}>{label}</span>
  </button>
);

export default Sidebar;
