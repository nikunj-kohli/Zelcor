import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = 'http://localhost:3000/rental-api';
const EMPTY_FORM = {
  propertyAddress: '',
  tenantName: '',
  landlordName: '',
  depositAmount: '',
  moveInDate: '',
};
const LABELS = ['Wall', 'Floor', 'Appliance', 'Bathroom', 'Door', 'Window', 'General'];

function money(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

function statusClass(status) {
  if (status === 'ACTIVE') return 'bg-emerald-100 text-emerald-700';
  if (status === 'READY') return 'bg-amber-100 text-amber-700';
  if (status === 'COMPLETED') return 'bg-slate-200 text-slate-700';
  return 'bg-slate-100 text-slate-600';
}

function resultClass(status) {
  if (status === 'PRE_EXISTING') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'WEAR_TEAR') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-rose-100 text-rose-700 border-rose-200';
}

function settlementClass(status) {
  if (status === 'OWNER_REVIEW') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (status === 'OWNER_PAID') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'AUTO_DEDUCTED') return 'bg-blue-100 text-blue-700 border-blue-200';
  return 'bg-rose-100 text-rose-700 border-rose-200';
}

function formatCountdown(ms) {
  const safeMs = Math.max(0, ms || 0);
  const totalSeconds = Math.floor(safeMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    days,
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
    label: days > 0 ? `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
  };
}

function normalizeLabel(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/\b(broken|cracked|crack|damaged|damage|stained|stain|burnt|burn|new|old|move|out|in)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function SectionCard({ title, subtitle, children, right }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function StatCard({ title, value, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-900',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-rose-200 bg-rose-50 text-rose-700',
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-75">{title}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

async function imageToDataUrl(file) {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = bitmapUrl;
    });
    const maxSize = 720;
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.62);
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

export default function RentalDemo() {
  const [view, setView] = useState('list');
  const [rentals, setRentals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [bundle, setBundle] = useState({ rental: null, photos: [], analysis: null, settlement: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [draftMoveIn, setDraftMoveIn] = useState([]);
  const [draftMoveOut, setDraftMoveOut] = useState([]);
  const [defaultLabel, setDefaultLabel] = useState('Wall');
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());
  const [autoRefreshing, setAutoRefreshing] = useState(false);

  async function loadRentals(nextSelectedId) {
    const response = await fetch(`${API_BASE}/rentals`);
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Failed to load rentals.');
    setRentals(payload.rentals || []);
    setSummary(payload.summary || null);
    const id = nextSelectedId || selectedId || payload.rentals?.[0]?.id || '';
    if (id) await loadRental(id);
  }

  async function loadRental(id) {
    const response = await fetch(`${API_BASE}/rentals/${id}`);
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Failed to load rental.');
    setSelectedId(id);
    setBundle({
      rental: payload.rental,
      photos: payload.photos || [],
      analysis: payload.analysis || null,
      settlement: payload.settlement || null,
    });
  }

  useEffect(() => {
    loadRentals().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const moveInPhotos = useMemo(() => bundle.photos.filter((photo) => photo.phase === 'move-in'), [bundle.photos]);
  const moveOutPhotos = useMemo(() => bundle.photos.filter((photo) => photo.phase === 'move-out'), [bundle.photos]);
  const reportByMoveOutId = useMemo(
    () => new Map((bundle.analysis?.reports || []).map((report) => [report.moveOutPhotoId, report])),
    [bundle.analysis]
  );

  const comparisons = useMemo(() => {
    const rows = [];
    const usedMoveInIds = new Set();

    moveOutPhotos.forEach((moveOut, index) => {
      const normalizedMoveOut = normalizeLabel(moveOut.label);
      const moveIn =
        moveInPhotos.find((photo) => !usedMoveInIds.has(photo.id) && normalizeLabel(photo.label) === normalizedMoveOut) ||
        moveInPhotos.find((photo) => !usedMoveInIds.has(photo.id) && normalizeLabel(photo.label) && normalizedMoveOut.includes(normalizeLabel(photo.label))) ||
        moveInPhotos.find((photo) => !usedMoveInIds.has(photo.id));
      if (moveIn) usedMoveInIds.add(moveIn.id);
      rows.push({
        id: `${moveOut.id}-${index}`,
        label: moveOut.label,
        moveIn,
        moveOut,
        report: reportByMoveOutId.get(moveOut.id),
      });
    });

    moveInPhotos.forEach((moveIn, index) => {
      if (usedMoveInIds.has(moveIn.id)) return;
      rows.push({
        id: `${moveIn.id}-${index}`,
        label: moveIn.label,
        moveIn,
        moveOut: null,
        report: null,
      });
    });
    return rows;
  }, [moveInPhotos, moveOutPhotos, reportByMoveOutId]);

  async function createRental(event) {
    event.preventDefault();
    setBusy('create');
    setError('');
    try {
      const response = await fetch(`${API_BASE}/rentals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, depositAmount: Number(form.depositAmount) }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Could not create rental.');
      setForm(EMPTY_FORM);
      setDraftMoveIn([]);
      setDraftMoveOut([]);
      await loadRentals(payload.rental.id);
      setView('move-in');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  function addDraftFiles(phase, files) {
    const entries = Array.from(files || []).map((file) => ({
      id: `${phase}-${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 6)}`,
      file,
      label: defaultLabel,
      timestamp: new Date().toISOString(),
      preview: URL.createObjectURL(file),
    }));
    if (phase === 'move-in') setDraftMoveIn((prev) => [...prev, ...entries]);
    else setDraftMoveOut((prev) => [...prev, ...entries]);
  }

  function updateDraft(phase, id, label) {
    const updater = (items) => items.map((item) => (item.id === id ? { ...item, label } : item));
    if (phase === 'move-in') setDraftMoveIn(updater);
    else setDraftMoveOut(updater);
  }

  function removeDraft(phase, id) {
    const remove = (items) => items.filter((item) => item.id !== id);
    if (phase === 'move-in') setDraftMoveIn(remove);
    else setDraftMoveOut(remove);
  }

  async function saveInspection(phase) {
    const draft = phase === 'move-in' ? draftMoveIn : draftMoveOut;
    if (!selectedId || !draft.length) return;
    setBusy(phase);
    setError('');
    try {
      const photos = await Promise.all(
        draft.map(async (item) => ({
          label: item.label,
          timestamp: item.timestamp,
          filename: item.file.name,
          image: await imageToDataUrl(item.file),
        }))
      );
      const response = await fetch(`${API_BASE}/rentals/${selectedId}/inspection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase, photos }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Could not save inspection.');
      if (phase === 'move-in') setDraftMoveIn([]);
      else setDraftMoveOut([]);
      await loadRentals(selectedId);
      setView(phase === 'move-in' ? 'details' : 'checkout');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function runAnalysis() {
    if (!selectedId) return;
    setBusy('analysis');
    setError('');
    try {
      const response = await fetch(`${API_BASE}/rentals/${selectedId}/analyze`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Analysis failed.');
      await loadRental(selectedId);
      setComparisonOpen(true);
      setView('resolution');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function resolveSettlement(action) {
    setBusy(action);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/rentals/${selectedId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Could not resolve settlement.');
      await loadRentals(selectedId);
      setView('list');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function markOwnerPaid() {
    setBusy('owner-paid');
    setError('');
    try {
      const response = await fetch(`${API_BASE}/rentals/${selectedId}/owner-payment`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Could not mark owner payment.');
      await loadRentals(selectedId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  const rental = bundle.rental;
  const settlement = bundle.settlement;
  const totalDeduction = bundle.analysis?.totalDeduction || 0;
  const refund = bundle.analysis?.refund ?? rental?.depositAmount ?? 0;
  const totals = summary || {
    totalDeposit: rental?.depositAmount || 0,
    ownerBondHeld: rental?.ownerBondAmount || 0,
    totalDeduction,
    totalRefund: refund,
    tenantWalletBalance: rental?.tenantWalletBalance || 0,
  };
  const reviewDeadline = settlement?.reviewDeadline || rental?.reviewDeadline ? new Date(settlement?.reviewDeadline || rental?.reviewDeadline) : null;
  const remainingMs = reviewDeadline ? reviewDeadline.getTime() - nowMs : 0;
  const reviewOverdue = reviewDeadline ? remainingMs <= 0 : false;
  const countdown = formatCountdown(remainingMs);

  useEffect(() => {
    if (!selectedId || !settlement || settlement.status !== 'OWNER_REVIEW' || remainingMs > 0 || autoRefreshing) return;
    setAutoRefreshing(true);
    loadRental(selectedId)
      .catch((err) => setError(err.message))
      .finally(() => setAutoRefreshing(false));
  }, [selectedId, settlement?.id, settlement?.status, remainingMs, autoRefreshing]);

  return (
    <div className="min-h-screen bg-[#f8f9fc] p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 rounded-3xl bg-[#191c1e] p-6 text-white shadow-xl shadow-slate-900/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black">Rental Deposit Manager</h1>
              <p className="mt-2 text-sm text-slate-200">Create apartments, record inspections, analyze checkout, and settle refunds.</p>
            </div>
            <button
              type="button"
              onClick={() => setView('create')}
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
            >
              Add Rental Apartment
            </button>
          </div>
        </header>

        {rental ? (
          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4">
            <StatCard title="Customer Total Deposit" value={money(totals.totalDeposit)} />
            <StatCard title="Total Owner Bond Held" value={money(totals.ownerBondHeld)} />
            <StatCard title="Total Deduction Till Now" value={money(totals.totalDeduction)} tone="red" />
            <StatCard title="Customer Refund Till Now" value={money(totals.totalRefund)} tone="green" />
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ['list', 'Rental Listings'],
            ['create', 'Create Rental'],
            ['move-in', 'Move-in Upload'],
            ['checkout', 'Checkout'],
            ['resolution', 'Final Resolution'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                view === key
                  ? 'border-[#191c1e] bg-[#191c1e] text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        {view === 'list' ? (
          <SectionCard title="Rental Listings" subtitle="All rental apartments and their current inspection status.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {rentals.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-slate-900">{item.propertyAddress}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(item.status)}`}>{item.status}</span>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600">
                    <p>Tenant: <span className="font-semibold text-slate-800">{item.tenantName}</span></p>
                    <p>Landlord: <span className="font-semibold text-slate-800">{item.landlordName}</span></p>
                    <p>Move-in: <span className="font-semibold text-slate-800">{item.moveInDate}</span></p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await loadRental(item.id);
                        setView('details');
                      }}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700"
                    >
                      View Details
                    </button>
                    <button
                      type="button"
                      disabled={item.status === 'READY' || item.status === 'COMPLETED'}
                      onClick={async () => {
                        await loadRental(item.id);
                        setView('checkout');
                      }}
                      className="rounded-xl bg-[#191c1e] px-3 py-2 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
                    >
                      Checkout
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>
        ) : null}

        {view === 'create' ? (
          <SectionCard title="Create Rental" subtitle="Only the required rental agreement fields.">
            <form onSubmit={createRental} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                ['propertyAddress', 'Property Address', 'text'],
                ['tenantName', 'Tenant', 'text'],
                ['landlordName', 'Landlord', 'text'],
                ['depositAmount', 'Deposit', 'number'],
                ['moveInDate', 'Move-in Date', 'date'],
              ].map(([field, label, type]) => (
                <label key={field} className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                  <input
                    type={type}
                    required
                    value={form[field]}
                    onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
              ))}
              <div className="md:col-span-2">
                <button disabled={busy === 'create'} className="rounded-xl bg-[#191c1e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {busy === 'create' ? 'Saving...' : 'Save Rental & Go to Move-in Upload'}
                </button>
              </div>
            </form>
          </SectionCard>
        ) : null}

        {view === 'details' && rental ? (
          <div className="space-y-6">
            <SectionCard
              title="Rental Details"
              subtitle={rental.propertyAddress}
              right={<span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(rental.status)}`}>{rental.status}</span>}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tenant</p>
                  <p className="mt-1 font-bold text-slate-900">{rental.tenantName}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Landlord</p>
                  <p className="mt-1 font-bold text-slate-900">{rental.landlordName}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Move-in Date</p>
                  <p className="mt-1 font-bold text-slate-900">{rental.moveInDate}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner Bond</p>
                  <p className="mt-1 font-bold text-slate-900">{money(rental.ownerBondAmount)} held</p>
                </div>
              </div>
            </SectionCard>
            <Gallery title="Saved Move-in Images" photos={moveInPhotos} onPreview={setPreviewImage} />
            <Gallery title="Saved Move-out Images" photos={moveOutPhotos} onPreview={setPreviewImage} />
          </div>
        ) : null}

        {view === 'move-in' && rental ? (
          <UploadPanel
            title="Move-in Upload"
            subtitle="Upload walls, floors, appliances, and other condition evidence."
            phase="move-in"
            draft={draftMoveIn}
            saved={moveInPhotos}
            defaultLabel={defaultLabel}
            busy={busy}
            onLabelDefault={setDefaultLabel}
            onFiles={addDraftFiles}
            onUpdate={updateDraft}
            onRemove={removeDraft}
            onSave={saveInspection}
            onPreview={setPreviewImage}
          />
        ) : null}

        {view === 'checkout' && rental ? (
          <div className="space-y-6">
            <UploadPanel
              title="Checkout (Move-out Upload)"
              subtitle="Upload move-out evidence using the same labeled image structure."
              phase="move-out"
              draft={draftMoveOut}
              saved={moveOutPhotos}
              defaultLabel={defaultLabel}
              busy={busy}
              onLabelDefault={setDefaultLabel}
              onFiles={addDraftFiles}
              onUpdate={updateDraft}
              onRemove={removeDraft}
              onSave={saveInspection}
              onPreview={setPreviewImage}
            />
            <SectionCard title="Security Deposit Analysis" subtitle="Compare inspections and calculate refund.">
              {reviewDeadline ? (
                <div className="mb-4">
                  <CountdownCard
                    countdown={countdown}
                    overdue={reviewOverdue}
                    settlement={settlement || { status: 'OWNER_REVIEW', tenantWalletCredited: false }}
                    deadline={reviewDeadline}
                    autoRefreshing={autoRefreshing}
                  />
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setComparisonOpen(true)}
                  disabled={!moveInPhotos.length || !moveOutPhotos.length}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
                >
                  Compare Images
                </button>
                <button
                  type="button"
                  onClick={runAnalysis}
                  disabled={busy === 'analysis' || !moveInPhotos.length || !moveOutPhotos.length}
                  className="rounded-xl bg-[#191c1e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {busy === 'analysis' ? 'Analyzing...' : 'Analyze Security Deposit'}
                </button>
              </div>
            </SectionCard>
          </div>
        ) : null}

        {view === 'resolution' && rental ? (
          <SectionCard title="Final Resolution" subtitle="Owner gets 2 days to pay the tenant before bond deduction starts.">
            {!bundle.analysis ? (
              <p className="text-sm text-slate-500">Run AI analysis after checkout uploads to calculate the final refund.</p>
            ) : (
              <>
                <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <StatCard title="Deposit" value={money(rental.depositAmount)} />
                  <StatCard title="Owner Bond Held" value={money(settlement?.ownerBondAmount ?? rental.ownerBondAmount)} />
                  <StatCard title="Deduction" value={money(bundle.analysis.totalDeduction)} tone="red" />
                  <StatCard title="Refund" value={money(bundle.analysis.refund)} tone="green" />
                </div>

                {settlement ? (
                  <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Owner Review Window</p>
                        <p className="text-xs text-slate-500">
                          Started: {settlement.reviewStartedAt ? new Date(settlement.reviewStartedAt).toLocaleString() : 'Pending'}
                        </p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${settlementClass(settlement.status)}`}>{settlement.status}</span>
                    </div>
                    <CountdownCard
                      countdown={countdown}
                      overdue={reviewOverdue}
                      settlement={settlement}
                      deadline={reviewDeadline}
                      autoRefreshing={autoRefreshing}
                    />
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                      <MiniMetric label="Owner payment" value={settlement.ownerPaymentStatus || 'PENDING'} />
                      <MiniMetric label="Due to tenant" value={money(settlement.ownerDueAmount ?? bundle.analysis.refund)} />
                      <MiniMetric label="Bond deduction" value={money(settlement.bondDeductionAmount || 0)} />
                      <MiniMetric label="Tenant wallet" value={money(rental.tenantWalletBalance || 0)} />
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <MiniMetric label="Transfer" value={settlement.transferStatus || 'AWAITING_OWNER_PAYMENT'} />
                      <MiniMetric label="Wallet credit" value={settlement.tenantWalletCredited ? money(settlement.tenantWalletCreditAmount) : 'Pending'} />
                      <MiniMetric label="Owner action" value={settlement.ownerPaymentStatus === 'PAID' ? 'Completed in time' : 'Awaiting payment'} />
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  {bundle.analysis.reports.map((report) => (
                    <div key={report.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{report.label}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${resultClass(report.status)}`}>{report.status}</span>
                      </div>
                      <span className="font-bold">{money(report.deduction)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={busy === 'owner-paid' || settlement?.status !== 'OWNER_REVIEW'}
                    onClick={markOwnerPaid}
                    className="rounded-xl bg-[#191c1e] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Mark Owner Paid
                  </button>
                  <button
                    type="button"
                    disabled
                    className="rounded-xl border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  >
                    Auto Dispute Enabled
                  </button>
                </div>
              </>
            )}
          </SectionCard>
        ) : null}
      </div>

      {comparisonOpen ? (
        <ComparisonModal rows={comparisons} analysis={bundle.analysis} onClose={() => setComparisonOpen(false)} onAnalyze={runAnalysis} busy={busy} />
      ) : null}

      {previewImage ? (
        <button type="button" onClick={() => setPreviewImage(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <img src={previewImage} alt="Inspection preview" className="max-h-[85vh] w-full max-w-4xl rounded-2xl object-contain" />
        </button>
      ) : null}
    </div>
  );
}

function CountdownCard({ countdown, overdue, settlement, deadline, autoRefreshing }) {
  const isRunning = settlement.status === 'OWNER_REVIEW' && !overdue;
  const isCredited = settlement.tenantWalletCredited || settlement.status === 'AUTO_DEDUCTED';
  return (
    <div className={`rounded-2xl border p-4 ${isRunning ? 'border-[#0a5b73] bg-[#0a5b73] text-white' : isCredited ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-800'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-full ${isRunning ? 'bg-white/15' : 'bg-slate-100'}`}>
            <span className="material-symbols-outlined text-xl">timer</span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-75">Resolution Countdown</p>
            <p className="mt-1 text-3xl font-black tabular-nums tracking-normal">{isRunning ? countdown.label : isCredited ? 'Credited' : '00:00:00'}</p>
          </div>
        </div>
        <div className="text-right text-xs opacity-80">
          <p>{deadline ? `Deadline: ${deadline.toLocaleString()}` : 'Deadline pending'}</p>
          <p>{autoRefreshing ? 'Finalizing wallet credit...' : isRunning ? 'Owner review active' : isCredited ? 'Tenant wallet updated' : 'Awaiting settlement'}</p>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function UploadPanel({ title, subtitle, phase, draft, saved, defaultLabel, busy, onLabelDefault, onFiles, onUpdate, onRemove, onSave, onPreview }) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Default Label</span>
            <select value={defaultLabel} onChange={(event) => onLabelDefault(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {LABELS.map((label) => <option key={label} value={label}>{label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Select Images</span>
            <input type="file" accept="image/*" multiple onChange={(event) => onFiles(phase, event.target.files)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <button
            type="button"
            disabled={busy === phase || !draft.length}
            onClick={() => onSave(phase)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#191c1e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">save</span>
            {busy === phase ? 'Saving...' : phase === 'move-in' ? 'Submit Inspection' : 'Save Move-out'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {draft.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-3">
              <img src={item.preview} alt={item.label} className="h-28 w-full rounded-lg object-cover" />
              <select value={item.label} onChange={(event) => onUpdate(phase, item.id, event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs">
                {LABELS.map((label) => <option key={label} value={label}>{label}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">{new Date(item.timestamp).toLocaleString()}</p>
              <button type="button" onClick={() => onRemove(phase, item.id)} className="mt-2 text-xs text-rose-600">Remove</button>
            </div>
          ))}
        </div>
      </div>
      <Gallery title={`Saved ${phase === 'move-in' ? 'Move-in' : 'Move-out'} Images`} photos={saved} onPreview={onPreview} compact />
    </SectionCard>
  );
}

function Gallery({ title, photos, onPreview, compact = false }) {
  return (
    <div className={compact ? 'mt-6' : ''}>
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      {photos.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => (
            <button key={photo.id} type="button" onClick={() => onPreview(photo.image)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:shadow-md">
              <img src={photo.image} alt={photo.label} className="h-36 w-full object-cover" />
              <div className="space-y-1 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{photo.label}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">{photo.phase}</span>
                </div>
                <p className="font-mono text-[11px] text-slate-500">{photo.hash.slice(0, 14)}...</p>
                <p className="text-[11px] text-slate-500">{new Date(photo.timestamp).toLocaleString()}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">No images saved yet.</div>
      )}
    </div>
  );
}

function ComparisonModal({ rows, analysis, onClose, onAnalyze, busy }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-6xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Move-in vs Move-out Comparison</h3>
            <p className="text-sm text-slate-500">Side-by-side evidence with AI status and deduction.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm">Close</button>
        </div>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold uppercase tracking-wide text-slate-500">{row.label}</p>
                {row.report ? (
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${resultClass(row.report.status)}`}>{row.report.status}</span>
                    <span className="text-sm font-bold text-slate-900">{money(row.report.deduction)}</span>
                  </div>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <ImageSlot title="Move-in" photo={row.moveIn} />
                <ImageSlot title="Move-out" photo={row.moveOut} />
              </div>
              {row.report?.notes ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{row.report.notes}</p> : null}
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onAnalyze}
            disabled={busy === 'analysis' || !rows.length}
            className="rounded-xl bg-[#191c1e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy === 'analysis' ? 'Analyzing...' : analysis ? 'Run Analysis Again' : 'Analyze Security Deposit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImageSlot({ title, photo }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-slate-500">{title}</p>
      {photo?.image ? (
        <img src={photo.image} alt={title} className="h-48 w-full rounded-lg object-cover" />
      ) : (
        <div className="flex h-48 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">No image</div>
      )}
    </div>
  );
}
