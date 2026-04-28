import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const EdTech = () => {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEnroll, setShowEnroll] = useState(false);
  const [formData, setFormData] = useState({
    course_name: '',
    total_fee: '',
    milestone_count: '4'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchEnrollments();
  }, []);

  const fetchEnrollments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      
      if (userId) {
        const res = await axios.get(`${API_URL}/edtech/enrollments`);
        const allEnrollments = res.data.enrollments || [];
        const filtered = allEnrollments.filter(e => e.student_id === userId || e.platform_id === userId);
        setEnrollments(filtered);
      }
    } catch (error) {
      console.error('Error fetching enrollments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || localStorage.getItem('zelcor_demo_id');
      
      // For demo, use a mock platform
      const platformId = '00000000-0000-0000-0000-000000000002';
      
      await axios.post(`${API_URL}/edtech/enroll`, {
        student_id: userId,
        platform_id: platformId,
        course_name: formData.course_name,
        total_fee: parseFloat(formData.total_fee),
        milestone_count: parseInt(formData.milestone_count)
      });
      
      setShowEnroll(false);
      setFormData({ course_name: '', total_fee: '', milestone_count: '4' });
      fetchEnrollments();
      alert('Course enrolled! Payment held in milestone escrow.');
    } catch (error) {
      console.error('Error enrolling:', error);
      alert('Error enrolling in course');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReleaseMilestone = async (enrollmentId) => {
    try {
      await axios.post(`${API_URL}/edtech/milestone`, {
        enrollment_id: enrollmentId,
        milestone_number: 1
      });
      fetchEnrollments();
      alert('Milestone released to platform!');
    } catch (error) {
      console.error('Error releasing milestone:', error);
    }
  };

  const handleFileComplaint = async (enrollmentId) => {
    const complaint = prompt('Enter your complaint:');
    if (!complaint) return;
    
    try {
      await axios.post(`${API_URL}/edtech/complaint`, {
        enrollment_id: enrollmentId,
        complaint_text: complaint,
        screenshots: []
      });
      fetchEnrollments();
      alert('Complaint filed! AI is analyzing...');
    } catch (error) {
      console.error('Error filing complaint:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'milestone_based': return 'bg-blue-100 text-blue-700';
      case 'complaint_filed': return 'bg-red-100 text-red-700';
      case 'refund_processed': return 'bg-purple-100 text-purple-700';
      case 'escalated': return 'bg-orange-100 text-orange-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getProgress = (enrollment) => {
    if (!enrollment.total_fee) return 0;
    return Math.round((enrollment.released_amount / enrollment.total_fee) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8f9fc]">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f9fc] min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-[#191c1e]">EdTech Courses</h1>
              <p className="text-slate-500 mt-1">Milestone-based payments with refund protection</p>
            </div>
            <button
              onClick={() => setShowEnroll(true)}
              className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition"
            >
              + Enroll in Course
            </button>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-2xl p-6 border border-purple-200">
          <h3 className="font-bold text-lg mb-4">How Zelcor EdTech Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">1</div>
              <div>
                <div className="font-medium">Enroll with Escrow</div>
                <div className="text-slate-500">Full payment held</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">2</div>
              <div>
                <div className="font-medium">Learn & Complete</div>
                <div className="text-slate-500">Milestones auto-release</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">3</div>
              <div>
                <div className="font-medium">File Complaint</div>
                <div className="text-slate-500">AI validates quality</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">4</div>
              <div>
                <div className="font-medium">Get Refund</div>
                <div className="text-slate-500">Remaining escrow released</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enrollments List */}
      <div className="max-w-6xl mx-auto px-6 pb-8">
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-lg">Your Course Enrollments</h2>
          </div>
          
          {enrollments.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-xl font-bold text-slate-700">No enrollments yet</h3>
              <p className="text-slate-500 mt-2">Enroll in a course to protect your payment</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {enrollments.map((enrollment) => (
                <div key={enrollment.id} className="p-6 hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono text-slate-400">#{enrollment.id.slice(0, 8)}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(enrollment.status)}`}>
                          {enrollment.status?.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold mt-2">{enrollment.course_name}</h3>
                      <div className="flex gap-6 mt-2 text-sm text-slate-500">
                        <span>💰 Fee: ₹{enrollment.total_fee?.toLocaleString()}</span>
                        <span>📦 Released: ₹{enrollment.released_amount?.toLocaleString()}</span>
                        <span>🎯 Milestones: {enrollment.milestone_count}</span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mt-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-500">Payment Progress</span>
                          <span className="font-medium">{getProgress(enrollment)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div 
                            className="bg-purple-600 h-2 rounded-full transition-all"
                            style={{ width: `${getProgress(enrollment)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* AI Assessment */}
                      {enrollment.ai_findings && (
                        <div className="mt-3 p-3 bg-red-50 rounded-lg">
                          <div className="text-sm font-medium text-red-700">AI Complaint Analysis</div>
                          <div className="text-sm text-red-600 mt-1">
                            Validity Score: {enrollment.ai_validity_score}%<br/>
                            {enrollment.ai_findings.money_back_guarantee_found && (
                              <span className="font-bold">💰 Money-back guarantee found!</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {enrollment.status === 'enrolled' && (
                        <button
                          onClick={() => handleReleaseMilestone(enrollment.id)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                        >
                          ▶️ Release Milestone
                        </button>
                      )}
                      {(enrollment.status === 'enrolled' || enrollment.status === 'milestone_based') && (
                        <button
                          onClick={() => handleFileComplaint(enrollment.id)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                        >
                          ⚠️ File Complaint
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Enroll Modal */}
      {showEnroll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">Enroll in Course</h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Course Name</label>
                  <input
                    type="text"
                    value={formData.course_name}
                    onChange={(e) => setFormData({ ...formData, course_name: e.target.value })}
                    placeholder="e.g., UPSC 2026 Foundation Course"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Course Fee (₹)</label>
                  <input
                    type="number"
                    value={formData.total_fee}
                    onChange={(e) => setFormData({ ...formData, total_fee: e.target.value })}
                    placeholder="e.g., 25000"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Number of Milestones</label>
                  <select
                    value={formData.milestone_count}
                    onChange={(e) => setFormData({ ...formData, milestone_count: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                  >
                    <option value="2">2 Milestones</option>
                    <option value="4">4 Milestones</option>
                    <option value="6">6 Milestones</option>
                    <option value="8">8 Milestones</option>
                  </select>
                </div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg mt-4 text-sm text-purple-700">
                💡 Payment will be held in escrow and released milestone-by-milestone as you complete the course.
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEnroll(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50"
                >
                  {submitting ? 'Enrolling...' : 'Enroll Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EdTech;