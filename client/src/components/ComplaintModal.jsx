import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabase';

const API_URL = 'http://localhost:3000/api';

const ComplaintModal = ({ isOpen, onClose, escrowId, onSubmitted }) => {
  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [complaintReason, setComplaintReason] = useState('');
  const [photos, setPhotos] = useState([]);
  const [videos, setVideos] = useState([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [reviewResult, setReviewResult] = useState(null);
  const liveVideoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const MAX_PHOTOS = 6;
  const MAX_VIDEOS = 2;
  const MAX_VIDEO_SECONDS = 10;

  const startCamera = async () => {
    setCameraError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      });
      streamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
      }
      setCameraReady(true);
    } catch (error) {
      setCameraReady(false);
      setCameraError(error.message || 'Unable to access camera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
    setCameraReady(false);
  };

  const resetState = () => {
    setStep(1);
    setSelectedCategory('');
    setComplaintReason('');
    setPhotos([]);
    setVideos([]);
    setCameraError('');
    setIsRecording(false);
    setSubmitting(false);
    setSubmitError('');
    setReviewResult(null);
  };

  useEffect(() => {
    if (step === 2) {
      startCamera();
    } else if (cameraReady) {
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]);

  useEffect(() => () => stopCamera(), []);

  const capturePhoto = () => {
    if (!liveVideoRef.current || photos.length >= MAX_PHOTOS) return;
    const video = liveVideoRef.current;
    const canvas = document.createElement('canvas');
    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const maxWidth = 960;
    const scale = Math.min(1, maxWidth / sourceWidth);
    canvas.width = Math.round(sourceWidth * scale);
    canvas.height = Math.round(sourceHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    setPhotos((prev) => [...prev, { id: `${Date.now()}`, dataUrl }].slice(0, MAX_PHOTOS));
  };

  const startVideoRecording = () => {
    if (!streamRef.current || videos.length >= MAX_VIDEOS || isRecording) return;
    try {
      videoChunksRef.current = [];
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm',
        videoBitsPerSecond: 600_000,
      });
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        const dataUrlPromise = new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        dataUrlPromise.then((dataUrl) => {
          setVideos((prev) => [...prev, { id: `${Date.now()}`, dataUrl }].slice(0, MAX_VIDEOS));
        });
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setTimeout(() => {
        if (mediaRecorderRef.current === recorder && recorder.state === 'recording') {
          recorder.stop();
          setIsRecording(false);
        }
      }, MAX_VIDEO_SECONDS * 1000);
    } catch (error) {
      setCameraError('Video recording could not start on this browser.');
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const removePhoto = (id) => setPhotos((prev) => prev.filter((item) => item.id !== id));
  const removeVideo = (id) => setVideos((prev) => prev.filter((item) => item.id !== id));

  const isDamageCategory = selectedCategory === 'Damaged';
  const canContinueFromEvidence = isDamageCategory
    ? photos.length >= 2 && videos.length >= 1 && complaintReason.trim().length > 0
    : photos.length + videos.length > 0 && complaintReason.trim().length > 0;

  const handleSubmitComplaint = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      if (!userId) {
        throw new Error('Please login first');
      }

      const evidence = [
        ...photos.map((p) => ({ url: p.dataUrl, type: 'image', captured_in_app: true })),
        ...videos.map((v) => ({ url: v.dataUrl, type: 'video', captured_in_app: true })),
      ];

      const res = await axios.post(`${API_URL}/disputes/file`, {
        escrow_id: escrowId,
        filed_by: userId,
        complaint_type: selectedCategory.toLowerCase().replace(/\s+/g, '_'),
        reason: complaintReason,
        evidence,
      });

      setReviewResult(res.data);
      if (onSubmitted) onSubmitted();
    } catch (error) {
      setSubmitError(error?.response?.data?.error || error.message || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="bg-white w-full max-w-[500px] rounded-[40px] shadow-2xl relative z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="p-10 pb-0 flex justify-between items-center">
          <h2 className="font-h2 text-2xl tracking-tighter">Report Issue</h2>
          <button
            onClick={() => {
              stopCamera();
              resetState();
              onClose();
            }}
            className="material-symbols-outlined text-slate-400 hover:text-primary transition-colors"
          >
            close
          </button>
        </div>

        <div className="p-10 space-y-8">
          {/* Progress Mini */}
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? 'bg-primary' : 'bg-slate-100'}`}></div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <h3 className="font-h3 text-xl">What's wrong?</h3>
                <p className="text-sm text-on-surface-variant">Select a category for your complaint.</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {['Wrong product', 'Damaged', 'Never arrived', 'Partial refund'].map((cat) => (
                  <button 
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setStep(2);
                    }}
                    className="w-full p-4 rounded-2xl border border-slate-100 hover:border-primary hover:bg-primary/5 text-left font-bold text-sm transition-all flex justify-between items-center group"
                  >
                    {cat}
                    <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-all">arrow_forward</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <h3 className="font-h3 text-xl">Capture Evidence</h3>
                <p className="text-sm text-on-surface-variant">
                  Add up to {MAX_PHOTOS} photos and {MAX_VIDEOS} videos.
                  {isDamageCategory ? ' For Damaged claims: minimum 2 photos + 1 video.' : ''}
                </p>
              </div>
              <div className="w-full aspect-video rounded-2xl overflow-hidden border border-slate-100 bg-slate-950 relative">
                <video
                  ref={liveVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm px-4 text-center">
                    {cameraError || 'Starting camera...'}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={photos.length >= MAX_PHOTOS}
                  className="w-full py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm disabled:opacity-40"
                >
                  Take Photo ({photos.length}/{MAX_PHOTOS})
                </button>
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startVideoRecording}
                    disabled={videos.length >= MAX_VIDEOS}
                    className="w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm disabled:opacity-40"
                  >
                    Record Video ({videos.length}/{MAX_VIDEOS})
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopVideoRecording}
                    className="w-full py-3 rounded-2xl bg-rose-600 text-white font-bold text-sm"
                  >
                    Stop Recording
                  </button>
                )}
              </div>
              {photos.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {photos.map((item) => (
                    <div key={item.id} className="relative">
                      <img src={item.dataUrl} alt="Captured" className="w-full h-16 object-cover rounded-lg border border-slate-200" />
                      <button onClick={() => removePhoto(item.id)} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black text-white text-[10px]">x</button>
                    </div>
                  ))}
                </div>
              )}
              {videos.length > 0 && (
                <div className="space-y-2">
                  {videos.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span>Video {idx + 1} captured</span>
                      <button onClick={() => removeVideo(item.id)} className="text-rose-500 font-bold">Remove</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                Selected: {photos.length} photos, {videos.length} videos
              </div>
              <textarea
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm"
                placeholder="Why are you raising this complaint? (required)"
                value={complaintReason}
                onChange={(e) => setComplaintReason(e.target.value)}
              />
              <button 
                onClick={() => setStep(3)}
                disabled={!canContinueFromEvidence}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >Continue</button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 text-center">
              {!reviewResult ? (
                <>
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
                    <span className="material-symbols-outlined text-4xl">smart_toy</span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-h3 text-xl">Submit to AI Review</h3>
                    <p className="text-sm text-on-surface-variant leading-relaxed">AI will verify product match, condition, and evidence confidence before contract action.</p>
                  </div>
                  {submitError && (
                    <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl p-3 text-left">
                      {submitError}
                    </div>
                  )}
                  <button
                    onClick={handleSubmitComplaint}
                    disabled={submitting}
                    className="w-full py-4 bg-secondary text-white rounded-2xl font-bold text-sm shadow-lg shadow-secondary/20 disabled:opacity-50"
                  >
                    {submitting ? 'Running Model Review...' : 'Submit Complaint'}
                  </button>
                  <button onClick={() => setStep(2)} className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-primary transition-all">Go Back</button>
                </>
              ) : (
                <>
                  <div className="space-y-3 text-left bg-slate-50 border border-slate-100 rounded-2xl p-4">
                    <h3 className="font-h3 text-lg text-slate-900">Model Review Result</h3>
                    <p className="text-sm text-slate-700">
                      <b>Product Match:</b> {String(reviewResult.aiResult?.same_product_match ?? 'manual_check')}
                    </p>
                    <p className="text-sm text-slate-700">
                      <b>Condition:</b> {reviewResult.aiResult?.condition_summary || reviewResult.mediaAnalysis?.modelRuns?.damage?.topPrediction?.class || 'Under analysis'}
                    </p>
                    <p className="text-sm text-slate-700">
                      <b>Confidence:</b> {reviewResult.aiResult?.confidence_score ?? 'N/A'}%
                    </p>
                    <p className="text-sm text-slate-700">
                      <b>Recommended Contract Path:</b> {reviewResult.smartContract?.auto_resolution || 'under_review'}
                    </p>
                    <p className="text-sm text-slate-700">
                      {reviewResult.smartContract?.customer_message || 'Smart contract action will be triggered after this review stage.'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      stopCamera();
                      resetState();
                      onClose();
                    }}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComplaintModal;
