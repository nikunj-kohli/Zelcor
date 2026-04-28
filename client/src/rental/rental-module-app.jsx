import React, { useEffect, useMemo, useState } from "react";

const API = "http://localhost:3000/api";

const STATUS_STYLES = {
  PRE_EXISTING: "bg-emerald-100 text-emerald-700",
  WEAR_TEAR: "bg-amber-100 text-amber-700",
  DAMAGE: "bg-rose-100 text-rose-700",
};

const INITIAL_FORM = {
  property_address: "",
  tenant_name: "",
  landlord_name: "",
  total_deposit: "",
  escrow_amount: "",
  move_in_date: new Date().toISOString().split('T')[0],
};

function money(amount) {
  return `₹${Number(amount || 0).toLocaleString()}`;
}

export default function RentalModuleApp() {
  const [tab, setTab] = useState("list");
  const [rentals, setRentals] = useState([]);
  const [currentRental, setCurrentRental] = useState(null);
  const [images, setImages] = useState([]);
  const [timeLeft, setTimeLeft] = useState("48:00:00");
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [moveInUpload, setMoveInUpload] = useState({ label: "Wall", files: [] });
  const [moveOutUpload, setMoveOutUpload] = useState({ label: "Wall", files: [] });

  const loadRentalList = async () => {
    const res = await fetch(`${API}/rental/list`);
    const json = await res.json();
    if (json.success) setRentals(json.rentals || []);
  };

  const loadRentalDetail = async (id) => {
    const res = await fetch(`${API}/inspection/${id}`);
    const json = await res.json();
    if (json.success) {
      setCurrentRental(json.agreement);
      setImages(json.images || []);
    }
  };

  useEffect(() => {
    loadRentalList();
  }, []);

  useEffect(() => {
    if (tab === "resolution" && currentRental?.ai_assessment?.resolutionDeadline) {
      const timer = setInterval(() => {
        const deadline = new Date(currentRental.ai_assessment.resolutionDeadline).getTime();
        const now = new Date().getTime();
        const diff = deadline - now;

        if (diff <= 0) {
          setTimeLeft("00:00:00");
          clearInterval(timer);
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeLeft(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [tab, currentRental]);

  const stats = useMemo(() => {
    const totalDeposit = rentals.reduce((sum, r) => sum + (r.total_deposit || 0), 0);
    const totalBond = rentals.reduce((sum, r) => sum + (r.escrow_amount || 0), 0);
    const totalDeductions = rentals.reduce((sum, r) => sum + (r.ai_assessment?.totalDeductions || 0), 0);
    const totalRefunds = rentals.reduce((sum, r) => sum + (r.refund_amount || 0), 0);
    return { totalDeposit, totalBond, totalDeductions, totalRefunds };
  }, [rentals]);

  const fileToBase64 = async (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleCreateRental = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      escrow_amount: Number(form.total_deposit) / 2
    };
    const res = await fetch(`${API}/rental/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.success) {
      setForm(INITIAL_FORM);
      await loadRentalList();
      setCurrentRental(json.agreement);
      setTab("move_in");
    }
  };

  const handleUpload = async (type) => {
    const currentUpload = type === "move-in" ? moveInUpload : moveOutUpload;
    if (!currentUpload.files.length || !currentRental) return;
    
    const prepared = await Promise.all(
      Array.from(currentUpload.files).map(async (file) => ({
        label: currentUpload.label,
        filename: file.name,
        timestamp: new Date().toISOString(),
        content: await fileToBase64(file),
      }))
    );
    const res = await fetch(`${API}/inspection/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agreementId: currentRental.id,
        type,
        images: prepared,
      }),
    });
    const json = await res.json();
    if (json.success) {
      if (type === "move-in") setMoveInUpload({ ...moveInUpload, files: [] });
      else setMoveOutUpload({ ...moveOutUpload, files: [] });
      await loadRentalDetail(currentRental.id);
    }
  };

  const runAnalysis = async () => {
    setLoadingAnalysis(true);
    const res = await fetch(`${API}/analysis/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agreementId: currentRental.id }),
    });
    const json = await res.json();
    console.log("Analysis Result:", json);
    
    if (json.success) {
      await loadRentalDetail(currentRental.id);
      setTab("resolution");
    } else {
      alert(`AI Engine Error: ${json.error || "Unknown Failure"}`);
      await loadRentalDetail(currentRental.id);
    }
    setLoadingAnalysis(false);
  };

  const markPaid = async () => {
    if (!currentRental) return;
    const res = await fetch(`${API}/rental/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agreementId: currentRental.id }),
    });
    const json = await res.json();
    if (json.success) {
      await loadRentalDetail(currentRental.id);
      alert("Escrow Settled Successfully!");
      setTimeout(() => setTab("list"), 1500);
    }
  };

  const deleteImage = async (type, filename) => {
    if (!currentRental) return;
    const res = await fetch(`${API}/inspection/image`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agreementId: currentRental.id, type, filename }),
    });
    const json = await res.json();
    if (json.success) {
      await loadRentalDetail(currentRental.id);
    }
  };

  return (
    <div className="bg-[#f8f9fc] min-h-screen p-6 md:p-10 font-body">
      {/* Header (Matching Insurance Theme) */}
      <header className="flex flex-col md:flex-row justify-between items-start mb-10">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Rental</h1>
              <div className="h-6 w-[1px] bg-slate-200 mx-2"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Trust, Encoded.</p>
           </div>
           <p className="text-sm font-medium text-slate-500">Manage deposits, inspections, and automated escrow settlements.</p>
        </div>
        <button onClick={() => setTab("create")} className="mt-6 md:mt-0 px-8 py-3 bg-[#1a3a5f] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-[#1a3a5f]/20">
          Add Rental Apartment
        </button>
      </header>

      {/* Stats Grid (Screenshot 1 - Light Theme) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-8 rounded-[48px] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Customer Total Deposit</p>
          <p className="text-3xl font-black text-[#1a3a5f]">{money(stats.totalDeposit)}</p>
        </div>
        <div className="bg-white p-8 rounded-[48px] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Owner Bond Held</p>
          <p className="text-3xl font-black text-[#1a3a5f]">{money(stats.totalBond)}</p>
        </div>
        <div className="bg-rose-50 p-8 rounded-[48px] border border-rose-100">
          <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2">Total Deduction Till Now</p>
          <p className="text-3xl font-black text-rose-600">{money(stats.totalDeductions)}</p>
        </div>
        <div className="bg-emerald-50 p-8 rounded-[48px] border border-emerald-100">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Customer Refund Till Now</p>
          <p className="text-3xl font-black text-emerald-600">{money(stats.totalRefunds)}</p>
        </div>
      </div>


      {/* Main Content Area */}
      <div className="bg-white rounded-[48px] border border-slate-100 p-10 shadow-sm min-h-[500px]">
        {tab === "list" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-900">Rental Listings</h2>
            </div>
            <p className="text-sm text-slate-400 mb-8 font-medium">All rental apartments and their current inspection status.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {rentals.length > 0 ? rentals.map((r) => (
                <div key={r.id} className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 relative group hover:border-[#1a3a5f]/20 transition-all">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{r.property_address}</h3>
                    <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[9px] font-black uppercase tracking-widest">{r.status}</span>
                  </div>
                  <div className="mb-6 space-y-1">
                    <p className="text-sm text-slate-400 font-medium">Tenant: <span className="text-slate-700 font-bold">{r.tenant_name || "N/A"}</span></p>
                    <p className="text-sm text-slate-400 font-medium">Landlord: <span className="text-slate-700 font-bold">{r.landlord_name || "N/A"}</span></p>
                    <p className="text-sm text-slate-400 font-medium">Move-in: <span className="text-slate-700 font-bold">{r.move_in_date || "N/A"}</span></p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setCurrentRental(r); setTab("create"); }} className="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-[9px] font-black uppercase tracking-widest text-slate-600 hover:border-[#1a3a5f] transition-all">Edit</button>
                    {r.status === 'active' ? (
                      <button onClick={() => { setCurrentRental(r); setTab("checkout"); }} className="px-5 py-3 bg-[#1a3a5f] text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all">Checkout</button>
                    ) : (
                      <button onClick={() => { setCurrentRental(r); setTab("resolution"); }} className="px-5 py-3 bg-emerald-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-emerald-500/20">View Resolution</button>
                    )}
                    <button 
                      onClick={async () => {
                        if (window.confirm("Delete this agreement?")) {
                          await fetch(`${API}/rental/${r.id}`, { method: "DELETE" });
                          await loadRentalList();
                        }
                      }}
                      className="px-4 py-3 bg-rose-50 text-rose-500 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )) : (
                <div className="col-span-2 py-20 text-center">
                   <p className="text-slate-300 font-black uppercase tracking-widest text-xs">No active agreements found.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "create" && (
          <div className="max-w-4xl">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Create Rental</h2>
            <p className="text-sm text-slate-400 mb-10 font-medium">Step 1: Initialize the rental escrow agreement.</p>
            <form onSubmit={handleCreateRental} className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Property Address</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl outline-none font-bold text-[#1a3a5f] focus:bg-white focus:border-[#1a3a5f]/20 transition-all" 
                  placeholder="e.g. Noida"
                  value={form.property_address}
                  onChange={(e) => setForm({...form, property_address: e.target.value})}
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tenant</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl outline-none font-bold text-[#1a3a5f] focus:bg-white focus:border-[#1a3a5f]/20 transition-all" 
                  placeholder="e.g. Raj"
                  value={form.tenant_name}
                  onChange={(e) => setForm({...form, tenant_name: e.target.value})}
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Landlord</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl outline-none font-bold text-[#1a3a5f] focus:bg-white focus:border-[#1a3a5f]/20 transition-all" 
                  placeholder="e.g. Raman"
                  value={form.landlord_name}
                  onChange={(e) => setForm({...form, landlord_name: e.target.value})}
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deposit Amount</label>
                <input 
                  type="number"
                  className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl outline-none font-bold text-[#1a3a5f] focus:bg-white focus:border-[#1a3a5f]/20 transition-all" 
                  placeholder="40000"
                  value={form.total_deposit}
                  onChange={(e) => setForm({...form, total_deposit: e.target.value})}
                />
              </div>
              <div className="md:col-span-2 space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Move-in Date</label>
                <input 
                  type="date"
                  className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl outline-none font-bold text-[#1a3a5f] focus:bg-white focus:border-[#1a3a5f]/20 transition-all" 
                  value={form.move_in_date}
                  onChange={(e) => setForm({...form, move_in_date: e.target.value})}
                />
              </div>
              <div className="md:col-span-2 pt-6">
                <button type="submit" className="px-10 py-5 bg-[#1a3a5f] text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:scale-[1.02] transition-all shadow-lg shadow-[#1a3a5f]/20">
                  Save Rental & Go to Move-in Upload
                </button>
              </div>
            </form>
          </div>
        )}

        {tab === "move_in" && (
          <div>
            <div className="flex justify-between items-center mb-10">
              <div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Move-in Upload</h2>
                <p className="text-sm text-slate-400 font-medium">Step 2: Upload walls, floors, and other condition evidence.</p>
              </div>
              <button onClick={() => setTab("list")} className="px-6 py-2 bg-[#1a3a5f] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#1a3a5f]/20">
                Register & List Rental
              </button>
            </div>
            
            <div className="max-w-xl space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Default Label</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl outline-none font-bold text-[#1a3a5f] appearance-none"
                  value={moveInUpload.label}
                  onChange={(e) => setMoveInUpload({...moveInUpload, label: e.target.value})}
                >
                  <option>Wall</option>
                  <option>Floor</option>
                  <option>Appliance</option>
                </select>
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Images</label>
                  <div className="w-full bg-white border border-slate-100 p-4 rounded-xl flex items-center gap-4">
                    <input 
                      type="file" 
                      className="hidden" 
                      id="move-in-files" 
                      onChange={(e) => setMoveInUpload({...moveInUpload, files: Array.from(e.target.files)})}
                    />
                    <label htmlFor="move-in-files" className="px-6 py-2 bg-slate-100 text-[#1a3a5f] rounded-lg text-[9px] font-black uppercase cursor-pointer hover:bg-slate-200 transition-all">Choose File</label>
                    <span className="text-[10px] font-bold text-slate-400">{moveInUpload.files?.length || 0} file selected</span>
                  </div>
              </div>

              <button 
                onClick={() => handleUpload("move-in")}
                className="flex items-center gap-3 px-10 py-4 bg-[#1a3a5f] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-[#1a3a5f]/20"
              >
                <span className="material-symbols-outlined text-lg">cloud_upload</span>
                Upload Evidence
              </button>
            </div>

            <div className="mt-16">
              <h3 className="text-[10px] font-black text-[#1a3a5f] uppercase tracking-widest mb-6">Saved Move-in Images</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {(currentRental?.move_in_photos || []).map((img, i) => (
                   <div key={i} className="bg-white border border-slate-50 rounded-[32px] overflow-hidden shadow-sm p-4 space-y-4 relative group">
                    <button 
                      onClick={() => deleteImage("move-in", img.filename)}
                      className="absolute top-4 right-4 w-8 h-8 bg-rose-500 text-white rounded-full transition-all flex items-center justify-center z-10 shadow-lg hover:scale-110 active:scale-95"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                    <img 
                      src={img.content || img.url || "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=400"} 
                      className="w-full aspect-video object-cover rounded-2xl" 
                      onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=400" }}
                    />
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[10px] font-black text-[#1a3a5f] uppercase tracking-wider">{img.label}</p>
                        <span className="px-2 py-0.5 bg-slate-50 text-slate-400 rounded-full text-[7px] font-black uppercase">move-in</span>
                      </div>
                      <p className="text-[9px] font-mono text-slate-300 truncate mb-1">{img.hash || "fc9853481e5e76..."}</p>
                      <p className="text-[9px] text-slate-400 font-bold">{new Date(img.timestamp || Date.now()).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "checkout" && (
          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Checkout (Move-out Upload)</h2>
            <p className="text-sm text-slate-400 mb-10 font-medium">Step 3: Upload move-out evidence using the same labeled structure.</p>
            
            <div className="max-w-xl space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Default Label</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl outline-none font-bold text-[#1a3a5f] appearance-none"
                  value={moveOutUpload.label}
                  onChange={(e) => setMoveOutUpload({...moveOutUpload, label: e.target.value})}
                >
                  <option>Wall</option>
                  <option>Floor</option>
                  <option>Appliance</option>
                </select>
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Images</label>
                  <div className="w-full bg-white border border-slate-100 p-4 rounded-xl flex items-center gap-4">
                    <input 
                      type="file" 
                      className="hidden" 
                      id="move-out-files" 
                      onChange={(e) => setMoveOutUpload({...moveOutUpload, files: Array.from(e.target.files)})}
                    />
                    <label htmlFor="move-out-files" className="px-6 py-2 bg-slate-100 text-[#1a3a5f] rounded-lg text-[9px] font-black uppercase cursor-pointer hover:bg-slate-200 transition-all">Choose File</label>
                    <span className="text-[10px] font-bold text-slate-400">{moveOutUpload.files?.length || 0} file selected</span>
                  </div>
              </div>

              <button 
                onClick={() => handleUpload("move-out")}
                className="flex items-center gap-3 px-10 py-4 bg-[#1a3a5f] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-[#1a3a5f]/20"
              >
                <span className="material-symbols-outlined text-lg">save</span>
                Save Move-out
              </button>
            </div>

            <div className="mt-16">
              <h3 className="text-[10px] font-black text-[#1a3a5f] uppercase tracking-widest mb-6">Saved Move-out Images</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {(currentRental?.move_out_photos || []).map((img, i) => (
                   <div key={i} className="bg-white border border-slate-50 rounded-[32px] overflow-hidden shadow-sm p-4 space-y-4 relative group">
                    <button 
                      onClick={() => deleteImage("move-out", img.filename)}
                      className="absolute top-4 right-4 w-8 h-8 bg-rose-500 text-white rounded-full transition-all flex items-center justify-center z-10 shadow-lg hover:scale-110 active:scale-95"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                    <img 
                      src={img.content || img.url || "https://images.unsplash.com/photo-1533202157393-27e7d692882c?auto=format&fit=crop&q=80&w=400"} 
                      className="w-full aspect-video object-cover rounded-2xl" 
                      onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1533202157393-27e7d692882c?auto=format&fit=crop&q=80&w=400" }}
                    />
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[10px] font-black text-[#1a3a5f] uppercase tracking-wider">{img.label}</p>
                        <span className="px-2 py-0.5 bg-slate-50 text-slate-400 rounded-full text-[7px] font-black uppercase">move-out</span>
                      </div>
                      <p className="text-[9px] font-mono text-slate-300 truncate mb-1">{img.hash || "9305836b34a417..."}</p>
                      <p className="text-[9px] text-slate-400 font-bold">{new Date(img.timestamp || Date.now()).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-20 border-t border-slate-50 pt-10">
               <h2 className="text-2xl font-black text-slate-900 mb-2">Step 4: AI Analysis</h2>
               <p className="text-sm text-slate-400 mb-10 font-medium">Compare inspections and calculate automated refund.</p>
               <button 
                 onClick={runAnalysis}
                 disabled={loadingAnalysis}
                 className="px-10 py-5 bg-[#0a5b73] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-[#0a5b73]/20 hover:scale-105 transition-all flex items-center gap-3"
               >
                 {loadingAnalysis ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <span className="material-symbols-outlined">analytics</span>}
                 Analyze & Generate Resolution
               </button>
            </div>
          </div>
        )}

        {tab === "resolution" && currentRental?.ai_assessment && (
          <div>
            <div className="flex justify-between items-center mb-10">
              <div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Forensic Resolution</h2>
                <p className="text-sm text-slate-400 font-medium">Owner review window and escrow settlement logic.</p>
              </div>
              <button onClick={() => setTab("list")} className="px-6 py-2 bg-slate-100 text-[#1a3a5f] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                Back to Listing
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
               <div className="p-8 bg-white border border-slate-100 rounded-[40px] shadow-sm">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Deposit</p>
                  <p className="text-2xl font-black text-[#1a3a5f]">{money(currentRental.total_deposit)}</p>
               </div>
               <div className="p-8 bg-white border border-slate-100 rounded-[40px] shadow-sm">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Bond Held</p>
                  <p className="text-2xl font-black text-[#1a3a5f]">{money(currentRental.escrow_amount)}</p>
               </div>
               <div className="p-8 bg-rose-50 border border-rose-100 rounded-[40px]">
                  <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-2">Deduction</p>
                  <p className="text-2xl font-black text-rose-600">{money(currentRental.ai_assessment.totalDeductions)}</p>
               </div>
               <div className="p-8 bg-emerald-50 border border-emerald-100 rounded-[40px]">
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2">Refund</p>
                  <p className="text-2xl font-black text-emerald-600">{money(currentRental.ai_assessment.finalRefund)}</p>
               </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[48px] p-10 mb-10">
               <div className="flex justify-between items-start mb-10">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">AI Forensic Breakdown</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Generated: {new Date(currentRental.ai_assessment.generatedAt).toLocaleString()}</p>
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                    currentRental.status === "RESOLVED" || currentRental.status === "SETTLEMENT_PENDING" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                  }`}>
                    {currentRental.status}
                  </span>
               </div>

               <div className="space-y-4 mb-10">
                  {currentRental.ai_assessment.reports.map((report, i) => (
                    <div key={i} className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${STATUS_STYLES[report.status]}`}>
                          <span className="material-symbols-outlined text-lg">
                            {report.status === "DAMAGE" ? "report" : report.status === "WEAR_TEAR" ? "history" : "check_circle"}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900">{report.item}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{report.reason}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-rose-500">{money(report.deduction)}</p>
                        <p className="text-[9px] text-slate-300 font-black uppercase tracking-widest">{report.forensic}</p>
                      </div>
                    </div>
                  ))}
               </div>

               {currentRental.status !== "RESOLVED" && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center border-t border-slate-100 pt-10">
                    <div className="flex items-center gap-6">
                       <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-50">
                          <span className="material-symbols-outlined text-3xl text-slate-300">timer</span>
                       </div>
                       <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Owner Review Window</p>
                          <p className="text-5xl font-black text-[#1a3a5f] tracking-tighter">{timeLeft}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Deadline: {new Date(currentRental.ai_assessment.resolutionDeadline).toLocaleString()}</p>
                       <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest">Automated release enabled</p>
                    </div>
                 </div>
               )}

               {currentRental.status === "RESOLVED" && (
                 <div className="border-t border-slate-100 pt-10 flex items-center gap-6">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                       <span className="material-symbols-outlined text-3xl text-emerald-500">check_circle</span>
                    </div>
                    <div>
                       <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Escrow Fully Settled</p>
                       <p className="text-2xl font-black text-[#1a3a5f] tracking-tight">Funds Released to Tenant Wallet</p>
                    </div>
                 </div>
               )}
            </div>

            <div className="flex gap-4">
               <button 
                onClick={markPaid}
                className="px-10 py-4 bg-[#1a3a5f] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-[#1a3a5f]/20 hover:scale-105 transition-all"
               >
                 Mark Owner Paid
               </button>
               <button className="px-10 py-4 bg-white border-2 border-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest">Auto Dispute Enabled</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
