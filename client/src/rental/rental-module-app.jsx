import React, { useEffect, useMemo, useState } from "react";

const API = "http://localhost:3001";

const STATUS_STYLES = {
  PRE_EXISTING: "bg-emerald-100 text-emerald-700",
  WEAR_TEAR: "bg-amber-100 text-amber-700",
  DAMAGE: "bg-rose-100 text-rose-700",
};

const INITIAL_AGREEMENT = {
  id: "RA-2026-0428",
  property: "301, Sunrise Apartments, Andheri East",
  tenant: "Rajesh Sharma",
  landlord: "Prakash Patel",
  deposit: 80000,
  landlordPaid: 40000,
  escrowAmount: 40000,
  moveInDate: "2024-04-28",
};

function money(amount) {
  return `₹${Number(amount || 0).toLocaleString()}`;
}

function Card({ title, subtitle, children, actions }) {
  return (
    <section className="bg-white border border-slate-100 rounded-[32px] shadow-sm p-6 md:p-8">
      <div className="flex flex-wrap gap-3 items-start justify-between mb-6">
        <div>
          <h2 className="font-h2 text-2xl tracking-tight">{title}</h2>
          {subtitle ? <p className="text-sm text-slate-500 mt-1">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export default function RentalModuleApp() {
  const [tab, setTab] = useState("list");
  const [rentals, setRentals] = useState([]);
  const [agreement, setAgreement] = useState(INITIAL_AGREEMENT);
  const [images, setImages] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [settlement, setSettlement] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [currentRentalId, setCurrentRentalId] = useState(null);
  const [form, setForm] = useState(INITIAL_AGREEMENT);
  const [upload, setUpload] = useState({ type: "move-in", files: [] });

  const loadRentalList = async () => {
    const res = await fetch(`${API}/rental/list`);
    const json = await res.json();
    if (json.success) setRentals(json.rentals || []);
  };

  const loadInspection = async (agreementId) => {
    const res = await fetch(`${API}/inspection/${agreementId}`);
    const json = await res.json();
    if (json.success) {
      if (json.agreement) setAgreement(json.agreement);
      setImages(json.images || []);
      setCurrentRentalId(agreementId);
    }
  };

  useEffect(() => {
    loadRentalList();
    loadInspection(INITIAL_AGREEMENT.id);
  }, []);

  const moveInImages = useMemo(() => images.filter((item) => item.type === "move-in"), [images]);
  const moveOutImages = useMemo(() => images.filter((item) => item.type === "move-out"), [images]);

  const comparisonRows = useMemo(() => {
    const byLabel = new Map();
    for (const item of moveInImages) byLabel.set(item.label, { moveIn: item });
    for (const item of moveOutImages) {
      const existing = byLabel.get(item.label) || {};
      byLabel.set(item.label, { ...existing, moveOut: item });
    }
    const rows = Array.from(byLabel.entries()).map(([label, value]) => ({
      label,
      ...value,
      report: analysis?.reports?.find((r) => r.item === label),
    }));
    return rows;
  }, [moveInImages, moveOutImages, analysis]);

  const createRental = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      deposit: Number(form.deposit),
      landlordPaid: Number(form.deposit) / 2,
      escrowAmount: Number(form.deposit) / 2,
    };
    const res = await fetch(`${API}/rental/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.success) {
      setAgreement(json.agreement);
      setAnalysis(null);
      setSettlement(null);
      setUpload({ type: "move-in", files: [] });
      await loadRentalList();
      await loadInspection(json.agreement.id);
      setTab("inspection");
    }
  };

  const fileToBase64 = async (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const uploadInspection = async (event, phaseOverride) => {
    event.preventDefault();
    if (!upload.files.length || !currentRentalId) return;
    const prepared = await Promise.all(
      upload.files.map(async (file) => ({
        label: file.label || "General",
        filename: file.file.name,
        timestamp: file.timestamp,
        content: await fileToBase64(file.file),
      }))
    );
    const res = await fetch(`${API}/inspection/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agreementId: currentRentalId,
        type: phaseOverride || upload.type,
        images: prepared,
      }),
    });
    const json = await res.json();
    if (json.success) {
      setUpload((prev) => ({ ...prev, files: [] }));
      await loadRentalList();
      await loadInspection(currentRentalId);
    }
  };

  const runAnalysis = async () => {
    setLoadingAnalysis(true);
    const res = await fetch(`${API}/analysis/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agreementId: currentRentalId }),
    });
    const json = await res.json();
    if (json.success) {
      setAnalysis(json.analysis);
      setTab("settlement");
    }
    setLoadingAnalysis(false);
  };

  const resolveSettlement = async (action) => {
    const res = await fetch(`${API}/settlement/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agreementId: currentRentalId, action }),
    });
    const json = await res.json();
    if (json.success) {
      setSettlement(json.settlement);
      await loadRentalList();
      await loadInspection(currentRentalId);
    }
  };

  const addFilesToUpload = (files) => {
    const mapped = Array.from(files || []).map((file) => ({
      id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 6)}`,
      file,
      label: "Wall",
      timestamp: new Date().toISOString(),
    }));
    setUpload((prev) => ({ ...prev, files: [...prev.files, ...mapped] }));
  };

  const updateFileLabel = (id, label) => {
    setUpload((prev) => ({
      ...prev,
      files: prev.files.map((item) => (item.id === id ? { ...item, label } : item)),
    }));
  };

  const removeUploadFile = (id) => {
    setUpload((prev) => ({ ...prev, files: prev.files.filter((item) => item.id !== id) }));
  };

  const statusChip = (status) => {
    if (status === "ACTIVE") return "bg-blue-100 text-blue-700";
    if (status === "READY") return "bg-amber-100 text-amber-700";
    if (status === "COMPLETED") return "bg-emerald-100 text-emerald-700";
    return "bg-slate-100 text-slate-700";
  };

  return (
    <div className="bg-[#f8f9fc] min-h-screen font-body-lg">
      <header className="h-24 border-b border-slate-100 flex items-center justify-between px-8 md:px-10 bg-white">
        <div>
          <h1 className="text-5xl md:text-4xl font-black tracking-tight text-[#191c1e]">Rental Deposits</h1>
          <p className="text-slate-500 mt-1">Protect your security deposit with blockchain proof</p>
        </div>
        <button
          onClick={() => setTab("create")}
          className="px-6 py-3 bg-[#0a5b73] text-white rounded-2xl font-black text-xs uppercase tracking-[0.12em] hover:opacity-90"
        >
          + New Agreement
        </button>
      </header>

      <main className="max-w-[1200px] mx-auto p-6 md:p-10 space-y-6">
        <section className="bg-gradient-to-r from-slate-100 to-slate-200 border border-slate-200 rounded-3xl p-6">
          <h3 className="font-bold text-3xl md:text-2xl text-[#191c1e] mb-4">How Zelcor Rental Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            {[
              ["1", "Create Agreement", "50% deposit to escrow"],
              ["2", "Move-In Photos", "Hash on blockchain"],
              ["3", "Move-Out Photos", "AI compares damage"],
              ["4", "Auto Refund", "No dispute = full refund"],
            ].map(([id, title, subtitle]) => (
              <div key={id} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#0a5b73] text-white text-xs font-black flex items-center justify-center">{id}</div>
                <div>
                  <p className="font-bold text-slate-800">{title}</p>
                  <p className="text-slate-500">{subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Deposit</p>
            <p className="text-3xl font-black text-slate-900 mt-2">{money(agreement.deposit)}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Landlord Paid</p>
            <p className="text-3xl font-black text-slate-900 mt-2">{money(agreement.landlordPaid)}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Escrow Amount</p>
            <p className="text-3xl font-black text-slate-900 mt-2">{money(agreement.escrowAmount)}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Deductions</p>
            <p className="text-3xl font-black text-rose-600 mt-2">{money(analysis?.totalDeductions || 0)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[["list", "Rental Listings"], ["create", "Create Rental"], ["inspection", "Move-in Upload"], ["checkout", "Checkout"], ["comparison", "AI Comparison"], ["settlement", "Settlement"]].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`px-4 py-2 rounded-xl text-xs uppercase tracking-[0.14em] font-black transition ${
                tab === value ? "bg-[#0a5b73] text-white" : "bg-white border border-slate-200 text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "list" && (
          <Card title="Rental Apartments" subtitle="Manage multiple rentals and lifecycle status.">
            <div className="grid md:grid-cols-2 gap-4">
              {rentals.map((rental) => (
                <div key={rental.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-slate-800">{rental.property}</p>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black ${statusChip(rental.status)}`}>{rental.status}</span>
                  </div>
                  <p className="text-sm text-slate-600">Tenant: {rental.tenant}</p>
                  <p className="text-sm text-slate-600">Landlord: {rental.landlord}</p>
                  <p className="text-xs text-slate-500">Move-in: {rental.moveInDate}</p>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={async () => {
                        await loadInspection(rental.id);
                        setAnalysis(null);
                        setSettlement(null);
                        setTab("inspection");
                      }}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wide"
                    >
                      View Details
                    </button>
                    <button
                      disabled={!["ACTIVE", "READY", "COMPLETED"].includes(rental.status)}
                      onClick={async () => {
                        await loadInspection(rental.id);
                        setTab("checkout");
                      }}
                      className="px-3 py-2 bg-[#0a5b73] text-white rounded-xl text-xs font-black uppercase tracking-wide disabled:opacity-40"
                    >
                      Checkout
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === "create" && (
          <Card title="Rental Agreement Dashboard" subtitle="Card structure aligned to Zelcor commerce summary patterns.">
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center mb-6">
              <div className="text-6xl mb-4">🏠</div>
              <p className="text-3xl md:text-2xl font-black text-slate-700">No agreements yet</p>
              <p className="text-slate-500 mt-2">Create your first rental agreement to protect your deposit</p>
            </div>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-[10px] uppercase tracking-[0.16em] font-black text-slate-400 mb-2">Property Info</p>
                <p className="font-bold text-slate-800">{agreement.property}</p>
                <p className="text-xs text-slate-500 mt-2">Move-in: {agreement.moveInDate}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-[10px] uppercase tracking-[0.16em] font-black text-slate-400 mb-2">Tenant & Landlord</p>
                <p className="text-sm"><span className="font-bold">Tenant:</span> {agreement.tenant}</p>
                <p className="text-sm"><span className="font-bold">Landlord:</span> {agreement.landlord}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-[10px] uppercase tracking-[0.16em] font-black text-slate-400 mb-2">Deposit Breakdown</p>
                <p className="text-sm font-bold">50% Landlord + 50% Escrow</p>
                <div className="mt-3 h-2 rounded-full overflow-hidden bg-slate-200">
                  <div className="h-full bg-primary w-1/2"></div>
                </div>
              </div>
            </div>

            <form onSubmit={createRental} className="grid md:grid-cols-2 gap-4">
              {[
                ["property", "Property"],
                ["tenant", "Tenant"],
                ["landlord", "Landlord"],
                ["deposit", "Deposit"],
                ["moveInDate", "Move-in Date"],
              ].map(([field, label]) => (
                <label key={field} className="space-y-1">
                  <span className="text-[10px] uppercase tracking-[0.14em] font-black text-slate-400">{label}</span>
                  <input
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                    value={form[field]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                  />
                </label>
              ))}
              <div className="md:col-span-2">
                <button className="px-6 py-3 bg-[#0a5b73] text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em]">
                  Save Rental & Go to Move-in Upload
                </button>
              </div>
            </form>
          </Card>
        )}

        {tab === "inspection" && (
          <Card title="Move-in Inspection" subtitle="Upload multiple check-in images with labels and timestamps.">
            <form onSubmit={uploadInspection} className="space-y-4 mb-6">
              <div className="grid md:grid-cols-[1fr_auto] gap-3">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  onChange={(e) => addFilesToUpload(e.target.files)}
                />
                <button className="bg-primary text-white rounded-xl font-black text-xs uppercase tracking-[0.16em] flex items-center justify-center gap-2 px-4">
                  <span className="material-symbols-outlined text-sm">save</span>
                  Submit Inspection
                </button>
              </div>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {upload.files.map((item) => (
                  <div key={item.id} className="border border-slate-100 rounded-2xl p-3 bg-white">
                    <div className="h-24 rounded-lg bg-slate-100 mb-2 text-xs text-slate-400 flex items-center justify-center">
                      {item.file.name}
                    </div>
                    <input
                      className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs"
                      value={item.label}
                      onChange={(e) => updateFileLabel(item.id, e.target.value)}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">{new Date(item.timestamp).toLocaleString()}</p>
                    <button type="button" onClick={() => removeUploadFile(item.id)} className="text-rose-600 text-xs mt-1">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </form>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] font-black text-slate-400 mb-3">Saved Move-in</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {moveInImages.map((img) => (
                    <div key={img.id} className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
                      <div className="h-32 bg-slate-100 flex items-center justify-center text-slate-400 text-xs">Preview</div>
                      <div className="p-3 text-xs space-y-1">
                        <p className="font-bold text-slate-700">{img.label}</p>
                        <p className="text-slate-500">{img.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 p-4 bg-slate-50">
                <p className="font-bold text-slate-700">Next Step</p>
                <p className="text-sm text-slate-500 mt-1">After move-in inspection is saved, proceed to checkout for move-out upload.</p>
                <button
                  onClick={() => {
                    setUpload({ type: "move-out", files: [] });
                    setTab("checkout");
                  }}
                  disabled={moveInImages.length === 0}
                  className="mt-3 px-4 py-2 rounded-xl bg-[#0a5b73] text-white text-xs font-black uppercase tracking-wide disabled:opacity-40"
                >
                  Go to Checkout
                </button>
              </div>
            </div>
          </Card>
        )}

        {tab === "checkout" && (
          <Card title="Checkout (Move-out Upload)" subtitle="Upload move-out evidence and run security deposit analysis.">
            <form onSubmit={(e) => uploadInspection(e, "move-out")} className="space-y-4 mb-6">
              <div className="grid md:grid-cols-[1fr_auto] gap-3">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  onChange={(e) => addFilesToUpload(e.target.files)}
                />
                <button className="bg-primary text-white rounded-xl font-black text-xs uppercase tracking-[0.16em] flex items-center justify-center gap-2 px-4">
                  <span className="material-symbols-outlined text-sm">save</span>
                  Save Move-out
                </button>
              </div>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {upload.files.map((item) => (
                  <div key={item.id} className="border border-slate-100 rounded-2xl p-3 bg-white">
                    <div className="h-24 rounded-lg bg-slate-100 mb-2 text-xs text-slate-400 flex items-center justify-center">
                      {item.file.name}
                    </div>
                    <input
                      className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs"
                      value={item.label}
                      onChange={(e) => updateFileLabel(item.id, e.target.value)}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">{new Date(item.timestamp).toLocaleString()}</p>
                    <button type="button" onClick={() => removeUploadFile(item.id)} className="text-rose-600 text-xs mt-1">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </form>
            <div className="flex gap-3">
              <button
                onClick={() => setComparisonOpen(true)}
                disabled={moveInImages.length === 0 || moveOutImages.length === 0}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-wide disabled:opacity-40"
              >
                Compare Images
              </button>
              <button
                onClick={() => {
                  setTab("comparison");
                  runAnalysis();
                }}
                disabled={moveOutImages.length === 0}
                className="px-4 py-2 rounded-xl bg-[#0a5b73] text-white text-xs font-black uppercase tracking-wide disabled:opacity-40"
              >
                Analyze Security Deposit
              </button>
            </div>
          </Card>
        )}

        {tab === "comparison" && (
          <Card
            title="AI Comparison"
            subtitle="Mock AI logic based on filename and label matching."
            actions={
              <button
                onClick={runAnalysis}
                className="px-5 py-3 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.16em] disabled:opacity-60"
                disabled={loadingAnalysis}
              >
                {loadingAnalysis ? "Analyzing..." : "Run Analysis"}
              </button>
            }
          >
            {loadingAnalysis && (
              <div className="mb-5 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm text-slate-600 animate-pulse">
                Running AI image comparison...
              </div>
            )}
            <div className="space-y-3">
              {comparisonRows.map((row) => (
                <div key={row.label} className="grid md:grid-cols-[1fr_1fr_auto] gap-3 border border-slate-100 rounded-2xl p-4">
                  <div className="bg-slate-50 rounded-xl p-3 text-xs">
                    <p className="font-black text-slate-500 uppercase tracking-wider">Move-in</p>
                    <p className="text-slate-700 mt-1">{row.moveIn?.filename || "N/A"}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-xs">
                    <p className="font-black text-slate-500 uppercase tracking-wider">Move-out</p>
                    <p className="text-slate-700 mt-1">{row.moveOut?.filename || "N/A"}</p>
                  </div>
                  <div className="flex flex-col items-end justify-center gap-2">
                    {row.report ? (
                      <>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black ${STATUS_STYLES[row.report.status] || "bg-slate-100 text-slate-700"}`}>
                          {row.report.status}
                        </span>
                        <p className="text-sm font-bold text-slate-700">{money(row.report.deduction)}</p>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">Run analysis</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === "settlement" && (
          <Card title="Settlement Resolution" subtitle="Finalize refund or trigger dispute flow.">
            <div className="grid md:grid-cols-3 gap-3 mb-5">
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-[10px] uppercase tracking-[0.16em] font-black text-slate-400">Total Deposit</p>
                <p className="text-2xl font-black mt-1">{money(agreement.deposit)}</p>
              </div>
              <div className="rounded-2xl bg-rose-50 p-4 border border-rose-100">
                <p className="text-[10px] uppercase tracking-[0.16em] font-black text-rose-500">Total Deductions</p>
                <p className="text-2xl font-black mt-1 text-rose-600">{money(analysis?.totalDeductions || 0)}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100">
                <p className="text-[10px] uppercase tracking-[0.16em] font-black text-emerald-500">Final Refund</p>
                <p className="text-2xl font-black mt-1 text-emerald-700">{money(analysis?.finalRefund || agreement.escrowAmount)}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => resolveSettlement("accept")}
                className="px-6 py-3 bg-[#0a5b73] text-white rounded-2xl font-black text-xs uppercase tracking-[0.16em]"
              >
                Accept
              </button>
              <button
                onClick={() => resolveSettlement("dispute")}
                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-[0.16em]"
              >
                Dispute
              </button>
            </div>

            {settlement && (
              <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm">
                <p className="font-bold text-slate-700">Status: {settlement.status}</p>
                <p className="text-slate-500 mt-1">Refund: {money(settlement.finalRefund)}</p>
              </div>
            )}
          </Card>
        )}
      </main>

      {comparisonOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="w-full max-w-5xl bg-white rounded-[32px] border border-slate-100 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-h3 text-2xl">Move-in vs Move-out</h3>
              <button onClick={() => setComparisonOpen(false)} className="text-slate-500 text-sm font-bold">Close</button>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {comparisonRows.map((row) => (
                <div key={row.label} className="grid md:grid-cols-[1fr_1fr_auto] gap-3 border border-slate-100 rounded-2xl p-4">
                  <div className="bg-slate-50 rounded-xl p-3 text-xs">
                    <p className="font-black text-slate-500 uppercase tracking-wider">Move-in</p>
                    <p className="text-slate-700 mt-1">{row.moveIn?.filename || "N/A"}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-xs">
                    <p className="font-black text-slate-500 uppercase tracking-wider">Move-out</p>
                    <p className="text-slate-700 mt-1">{row.moveOut?.filename || "N/A"}</p>
                  </div>
                  <div className="flex items-center justify-end">
                    {row.report ? (
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black ${STATUS_STYLES[row.report.status] || "bg-slate-100 text-slate-700"}`}>
                        {row.report.status}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Pending analysis</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

