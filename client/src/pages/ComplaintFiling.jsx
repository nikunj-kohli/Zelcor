import React, { useRef, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';

const API_URL = 'http://localhost:3000/api';

const ComplaintFiling = () => {
  const [step, setStep] = useState(1);
  const [selectedTx, setSelectedTx] = useState(null);
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [complaintType, setComplaintType] = useState('damaged');
  const [reason, setReason] = useState('');
  const [damageDetails, setDamageDetails] = useState('');
  const [photos, setPhotos] = useState([]);
  const [videos, setVideos] = useState([]);
  const [searchParams] = useSearchParams();
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const navigate = useNavigate();
  const MAX_PHOTOS = 6;
  const MAX_VIDEOS = 2;

  useEffect(() => {
    const fetchEscrows = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await axios.get(`${API_URL}/user/escrows?user_id=${session.user.id}`);
        const activeEscrows = res.data.escrows.filter(e => e.status === 'active');
        setEscrows(activeEscrows);
        const escrowFromQuery = searchParams.get('escrow_id');
        if (escrowFromQuery && activeEscrows.some((e) => e.id === escrowFromQuery)) {
          setSelectedTx(escrowFromQuery);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchEscrows();
  }, [searchParams]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const evidence = [
        ...photos.map((item) => ({ url: item.dataUrl, type: 'image', captured_in_app: true })),
        ...videos.map((item) => ({ url: item.dataUrl, type: 'video', captured_in_app: true })),
      ];

      const res = await axios.post(`${API_URL}/disputes/file`, {
        escrow_id: selectedTx,
        filed_by: session.user.id,
        complaint_type: complaintType,
        reason: `${reason}\n\nDamage Details: ${damageDetails || 'N/A'}`,
        evidence,
      });
      navigate(`/complaint/${res.data.dispute.id}`);
    } catch (e) {
      alert('Error filing complaint: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen font-black text-primary animate-pulse">LOADING ESCROWS</div>;

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read media file'));
    reader.readAsDataURL(file);
  });

  const handlePhotoCapture = async (event) => {
    const files = Array.from(event.target.files || []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    const availableSlots = Math.max(0, MAX_PHOTOS - photos.length);
    const filesToAdd = files.slice(0, availableSlots);
    const processed = await Promise.all(filesToAdd.map(async (file) => ({
      id: `${Date.now()}-${file.name}`,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      dataUrl: await fileToDataUrl(file),
    })));
    setPhotos((prev) => [...prev, ...processed]);
    event.target.value = '';
  };

  const handleVideoCapture = async (event) => {
    const files = Array.from(event.target.files || []).filter((f) => f.type.startsWith('video/'));
    if (!files.length) return;
    const availableSlots = Math.max(0, MAX_VIDEOS - videos.length);
    const filesToAdd = files.slice(0, availableSlots);
    const processed = await Promise.all(filesToAdd.map(async (file) => ({
      id: `${Date.now()}-${file.name}`,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      dataUrl: await fileToDataUrl(file),
    })));
    setVideos((prev) => [...prev, ...processed]);
    event.target.value = '';
  };

  const removePhoto = (id) => setPhotos((prev) => prev.filter((item) => item.id !== id));
  const removeVideo = (id) => setVideos((prev) => prev.filter((item) => item.id !== id));

  return (
    <div className="bg-[#f8f9fc] min-h-screen font-body-lg text-on-surface">
      <header className="bg-white border-b border-slate-100 h-16 flex items-center px-8 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="material-symbols-outlined text-slate-400 hover:text-primary transition-colors">arrow_back</button>
          <h1 className="font-h2 text-lg font-bold">File a Complaint</h1>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto p-8 pt-12">
        {/* Step Progress */}
        <div className="mb-12 flex justify-between items-center relative">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -translate-y-1/2 z-0"></div>
          {[1, 2, 3].map((s) => (
            <div key={s} className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${step >= s ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                {s}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white p-12 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 min-h-[500px]">
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="font-h2 text-3xl tracking-tight text-primary">Select Transaction</h2>
              <div className="space-y-4">
                {escrows.map((tx) => (
                  <label key={tx.id} className={`flex items-center justify-between p-6 rounded-3xl border-2 transition-all cursor-pointer ${selectedTx === tx.id ? 'border-primary bg-primary/5' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-6">
                      <input type="radio" className="w-6 h-6 text-primary" checked={selectedTx === tx.id} onChange={() => setSelectedTx(tx.id)} />
                      <div>
                        <p className="font-h3 text-lg">{tx.item_name}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">₹{tx.amount.toLocaleString()}</p>
                      </div>
                    </div>
                  </label>
                ))}
                {escrows.length === 0 && <p className="text-center text-slate-400">No active transactions eligible for complaint.</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="font-h2 text-3xl tracking-tight text-primary">Capture Evidence</h2>
              <p className="text-slate-500">Use app camera only: up to {MAX_PHOTOS} photos and {MAX_VIDEOS} videos.</p>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handlePhotoCapture}
                className="hidden"
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                capture="environment"
                multiple
                onChange={handleVideoCapture}
                className="hidden"
              />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photos.length >= MAX_PHOTOS}
                    className="p-5 rounded-2xl bg-slate-900 text-white font-bold disabled:opacity-50"
                  >
                    Take Photo ({photos.length}/{MAX_PHOTOS})
                  </button>
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={videos.length >= MAX_VIDEOS}
                    className="p-5 rounded-2xl bg-primary text-white font-bold disabled:opacity-50"
                  >
                    Record Video ({videos.length}/{MAX_VIDEOS})
                  </button>
                </div>
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {photos.map((item) => (
                      <div key={item.id} className="relative rounded-2xl overflow-hidden border border-slate-100">
                        <img src={item.previewUrl} alt={item.name} className="w-full h-24 object-cover" />
                        <button onClick={() => removePhoto(item.id)} className="absolute top-1 right-1 text-xs bg-black/60 text-white rounded-full px-2">x</button>
                      </div>
                    ))}
                  </div>
                )}
                {videos.length > 0 && (
                  <div className="space-y-2">
                    {videos.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <span className="text-sm font-semibold line-clamp-1">{item.name}</span>
                        <button onClick={() => removeVideo(item.id)} className="text-xs text-rose-500 font-bold">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="font-h2 text-3xl tracking-tight text-primary">Details</h2>
              <select
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl"
                value={complaintType}
                onChange={(e) => setComplaintType(e.target.value)}
              >
                <option value="damaged">Damaged Product</option>
                <option value="wrong_product">Wrong Product</option>
                <option value="missing">Missing Items</option>
                <option value="not_as_described">Not As Described</option>
                <option value="other">Other</option>
              </select>
              <textarea 
                className="w-full p-6 bg-slate-50 border-none rounded-[32px] font-body-lg focus:ring-2 focus:ring-primary min-h-[200px]" 
                placeholder="Explain the issue..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              ></textarea>
              <textarea
                className="w-full p-6 bg-slate-50 border-none rounded-[32px] font-body-lg focus:ring-2 focus:ring-primary min-h-[120px]"
                placeholder="What is damaged exactly? (crack location, leakage, parts broken, etc.)"
                value={damageDetails}
                onChange={(e) => setDamageDetails(e.target.value)}
              ></textarea>
            </div>
          )}

          <div className="mt-12 flex justify-between">
            {step > 1 && <button onClick={() => setStep(step - 1)} className="px-8 py-4 text-primary font-bold">Back</button>}
            <button 
              onClick={() => step < 3 ? setStep(step + 1) : handleSubmit()}
              disabled={
                submitting ||
                (step === 1 && !selectedTx) ||
                (step === 2 && (photos.length + videos.length === 0)) ||
                (step === 3 && !reason.trim())
              }
              className="ml-auto px-12 py-4 bg-primary text-white font-h3 rounded-2xl shadow-xl transition-all"
            >
              {submitting ? 'Submitting...' : (step < 3 ? 'Continue' : 'Submit Claim')}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ComplaintFiling;
