import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar';
import { db, doc, updateDoc } from '../firebase';
import { 
  X, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  UserCheck, 
  LogOut,
  Phone,
  MessageSquare,
  Send,
  Calendar,
  Quote,
  Award,
  User
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const ProfileModal = ({ isOpen, onClose }) => {
  const { user, userProfile, logout } = useAuth();
  const { showAlert } = useToast();

  const [phone, setPhone]               = useState('');
  const [whatsapp, setWhatsapp]         = useState('');
  const [messenger, setMessenger]       = useState('');
  const [dobMonth, setDobMonth]         = useState('');
  const [dobDay, setDobDay]             = useState('');
  const [quote, setQuote]               = useState('');
  const [qualifications, setQualifications] = useState('');

  const [saving, setSaving]             = useState(false);
  const [success, setSuccess]           = useState(false);

  useEffect(() => {
    if (userProfile) {
      setPhone(userProfile.phone || '');
      setWhatsapp(userProfile.whatsapp || '');
      setMessenger(userProfile.messenger || '');
      setDobMonth(userProfile.dobMonth || '');
      setDobDay(userProfile.dobDay || '');
      setQuote(userProfile.quote || '');
      setQualifications(userProfile.qualifications || '');
    }
  }, [userProfile, isOpen]);

  if (!isOpen || !userProfile) return null;

  const isManager = userProfile.role === 'manager';

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSuccess(false);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        phone,
        whatsapp,
        messenger,
        dobMonth,
        dobDay,
        quote,
        qualifications,
        updatedAt: new Date().toISOString()
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Error updating user profile:', err);
      showAlert('Failed to save profile details. Please try again.', 'Update Failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content animate-fade-in"
        style={{ maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User color="var(--primary)" size={22} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              My Staff Profile
            </h3>
          </div>
          <button
            className="btn btn-sm btn-secondary"
            onClick={onClose}
            disabled={saving}
            style={{ padding: '4px 8px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Profile Card Header */}
        <div style={{
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem',
          padding: '1rem',
          background: 'rgba(15,23,42,0.6)',
          borderRadius: 12,
          border: '1px solid var(--border-color)',
          marginBottom: '1.25rem'
        }}>
          <UserAvatar
            photoURL={userProfile.photoURL}
            displayName={userProfile.displayName}
            size={64}
          />

          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)' }}>
              {userProfile.displayName}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              {userProfile.email}
            </div>
            {isManager ? (
              <span className="badge badge-amber" style={{ fontSize: '0.65rem' }}>
                <ShieldCheck size={11} /> Manager
              </span>
            ) : (
              <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>
                <UserCheck size={11} /> Staff Employee
              </span>
            )}
            <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginTop: '0.35rem' }}>
              📷 Profile photo synced from Google Account
            </div>
          </div>
        </div>

        {/* Success Alert */}
        {success && (
          <div style={{
            background: 'var(--success-light)', 
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 8, 
            padding: '0.65rem 1rem',
            color: 'var(--success)', 
            fontSize: '0.85rem', 
            marginBottom: '1rem',
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem'
          }}>
            <CheckCircle2 size={16} /> Profile information updated successfully!
          </div>
        )}

        {/* Profile Form */}
        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Phone & WhatsApp */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                <Phone size={14} color="var(--primary)" /> Phone Number
              </label>
              <input 
                type="tel"
                className="form-control"
                placeholder="+358 40 1234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                <MessageSquare size={14} color="var(--success)" /> WhatsApp
              </label>
              <input 
                type="tel"
                className="form-control"
                placeholder="+358 40 1234567"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Messenger & Birthday */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                <Send size={14} color="#0084FF" /> Messenger / Social
              </label>
              <input 
                type="text"
                className="form-control"
                placeholder="username or link"
                value={messenger}
                onChange={(e) => setMessenger(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                <Calendar size={14} color="var(--accent-gold)" /> Birthday (Month / Day)
              </label>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <select 
                  className="form-select"
                  value={dobMonth}
                  onChange={(e) => setDobMonth(e.target.value)}
                  style={{ padding: '0.5rem 0.4rem', fontSize: '0.8rem', flex: 1.2 }}
                >
                  <option value="">Month</option>
                  {MONTHS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                <select 
                  className="form-select"
                  value={dobDay}
                  onChange={(e) => setDobDay(e.target.value)}
                  style={{ padding: '0.5rem 0.4rem', fontSize: '0.8rem', flex: 0.8 }}
                >
                  <option value="">Day</option>
                  {Array.from({ length: 31 }, (_, i) => String(i + 1)).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Quote */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              <Quote size={14} color="var(--primary)" /> Personal Motto / Quote
            </label>
            <textarea 
              className="form-control"
              placeholder="e.g. Work hard, stay humble & deliver great food!"
              rows={2}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', resize: 'vertical' }}
            />
          </div>

          {/* Qualifications & Skills */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              <Award size={14} color="var(--accent-gold)" /> Qualifications & Skills
            </label>
            <textarea 
              className="form-control"
              placeholder="e.g. Hygiene Passport, First Aid Card, Kebab Grill Specialist, Customer Service Pro"
              rows={2}
              value={qualifications}
              onChange={(e) => setQualifications(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', resize: 'vertical' }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.95rem' }}
              disabled={saving}
            >
              {saving ? (
                <><Loader2 size={17} className="animate-spin" /> Saving...</>
              ) : (
                <><CheckCircle2 size={17} /> Save Profile Information</>
              )}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            {/* Sign Out */}
            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.25rem', paddingTop: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-danger"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={async () => { onClose(); await logout(); }}
                disabled={saving}
              >
                <LogOut size={16} /> Sign Out Account
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>,
    document.body
  );
};

