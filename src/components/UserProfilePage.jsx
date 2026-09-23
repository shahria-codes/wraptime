import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar';
import { db, collection, onSnapshot, doc, updateDoc } from '../firebase';
import {
  Phone,
  Calendar,
  Quote,
  Award,
  Clock,
  ShieldCheck,
  UserCheck,
  Store,
  Mail,
  ArrowLeft,
  Edit3,
  Check,
  X,
  Loader2,
  ExternalLink,
  GraduationCap,
  BookOpen,
  Sparkles,
  Plus,
  Trash2,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

/* ── Brand SVG Icons ─────────────────────────────────────── */
const WhatsAppIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 2C8.268 2 2 8.268 2 16c0 2.478.651 4.797 1.785 6.8L2 30l7.4-1.757A13.93 13.93 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2Z" fill="currentColor" fillOpacity="0.15"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M16 4C9.373 4 4 9.373 4 16c0 2.25.612 4.36 1.68 6.17L4.5 27.5l5.48-1.165A11.94 11.94 0 0 0 16 28c6.627 0 12-5.373 12-12S22.627 4 16 4Zm-3.01 6.5c-.28-.63-.57-.645-.835-.655-.215-.009-.46-.008-.706-.008-.245 0-.643.092-.98.46-.337.368-1.286 1.257-1.286 3.065 0 1.808 1.317 3.556 1.5 3.802.184.245 2.552 4.07 6.29 5.54 3.113 1.224 3.737.981 4.41.92.674-.061 2.174-.888 2.48-1.747.306-.858.306-1.594.214-1.748-.092-.153-.337-.245-.705-.43-.368-.184-2.175-1.072-2.512-1.194-.337-.122-.582-.184-.827.184-.245.367-.949 1.193-1.163 1.439-.214.245-.429.276-.797.092-.368-.184-1.553-.572-2.958-1.826-1.093-.976-1.83-2.18-2.046-2.548-.214-.367-.022-.566.162-.749.165-.164.368-.429.552-.643.184-.214.245-.368.368-.612.122-.245.061-.46-.031-.643-.092-.184-.804-1.997-1.12-2.74Z" fill="currentColor"/>
  </svg>
);

const MessengerIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 2C8.268 2 2 7.925 2 15.231c0 4.077 1.922 7.715 4.942 10.18V30l4.534-2.49A14.56 14.56 0 0 0 16 28.462c7.732 0 14-6.21 14-13.231C30 7.925 23.732 2 16 2Z" fill="currentColor" fillOpacity="0.15"/>
    <path d="M16 4C9.373 4 4 9.16 4 15.231c0 3.572 1.754 6.755 4.5 8.867V28l4.2-2.31c1.06.294 2.175.772 3.3.772 6.627 0 12-5.16 12-11.231C28 9.16 22.627 4 16 4Zm1.193 15.103-3.057-3.256-5.966 3.256 6.563-6.974 3.131 3.256 5.892-3.256-6.563 6.974Z" fill="currentColor"/>
  </svg>
);

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 60 }, (_, i) => String(CURRENT_YEAR - i));

/* ─────────────────────────────────────────────────────────────
   Scoped styles injected once
───────────────────────────────────────────────────────────── */
const PROFILE_CSS = `
.prof-hero {
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  margin-bottom: 1.25rem;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
}
.prof-hero-banner {
  height: 96px;
  background: linear-gradient(135deg, hsl(38,95%,22%) 0%, hsl(270,60%,18%) 50%, hsl(210,80%,14%) 100%);
  position: relative;
}
.prof-hero-banner::after {
  content:'';
  position:absolute;inset:0;
  background: repeating-linear-gradient(
    45deg,
    transparent,transparent 20px,
    rgba(255,255,255,0.02) 20px,rgba(255,255,255,0.02) 40px
  );
}
.prof-hero-body {
  padding: 0 1.75rem 1.5rem;
  display: flex;
  align-items: flex-end;
  gap: 1.25rem;
  flex-wrap: wrap;
}
.prof-avatar-wrap {
  margin-top: -42px;
  flex-shrink: 0;
  position: relative;
  z-index: 2;
}
.prof-avatar-ring {
  border-radius: 50%;
  box-shadow: 0 0 0 4px var(--bg-card), 0 0 0 7px var(--primary), 0 4px 20px rgba(245,158,11,0.35);
}
.prof-name-block {
  flex: 1;
  min-width: 200px;
  padding-top: 0.75rem;
}
.prof-stats-box {
  background: linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.05));
  border: 1.5px solid rgba(245,158,11,0.35);
  border-radius: 14px;
  padding: 0.9rem 1.4rem;
  text-align: center;
  min-width: 150px;
  flex-shrink: 0;
  margin-bottom: 0.25rem;
}

/* Quote Card */
.prof-quote-card {
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(245,158,11,0.07), rgba(99,102,241,0.06));
  border: 1px solid rgba(245,158,11,0.2);
  padding: 1.1rem 1.5rem;
  margin-bottom: 1.25rem;
  position: relative;
  overflow: hidden;
}
.prof-quote-card::before {
  content: '"';
  position: absolute;
  top: -10px; left: 10px;
  font-size: 6rem;
  color: rgba(245,158,11,0.1);
  font-family: Georgia, serif;
  line-height: 1;
  pointer-events: none;
}

/* Detail Grid */
.prof-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.25rem;
}
.prof-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 1.35rem;
  box-shadow: 0 2px 12px rgba(0,0,0,0.12);
}
.prof-panel-head {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding-bottom: 0.7rem;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 1rem;
}

/* Field rows */
.prof-field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 36px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  padding: 0.35rem 0;
}
.prof-field-row:last-child { border-bottom: none; }
.prof-field-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
  flex-shrink: 0;
  min-width: 108px;
}
.prof-field-val {
  font-size: 0.88rem;
  color: var(--text-main);
  text-align: right;
  word-break: break-word;
}
.prof-field-empty {
  font-size: 0.82rem;
  color: var(--text-subtle);
  font-style: italic;
  text-align: right;
}

/* Edit inputs in edit mode */
.prof-edit-input {
  font-size: 0.85rem !important;
  padding: 5px 10px !important;
  border-radius: 8px !important;
  width: 100%;
}
.prof-edit-select {
  font-size: 0.85rem !important;
  padding: 5px 8px !important;
  border-radius: 8px !important;
}

/* Edit-mode field row layout */
.prof-field-row.edit-mode {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
  padding: 0.5rem 0;
}
.prof-field-row.edit-mode .prof-field-label {
  margin-bottom: 0;
}
`;

const StyleTag = () => {
  useEffect(() => {
    const id = 'profile-page-styles';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = PROFILE_CSS;
      document.head.appendChild(el);
    }
    return () => {};
  }, []);
  return null;
};

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export const UserProfilePage = () => {
  const { userId: paramUserId } = useParams();
  const { userProfile: currentUserProfile, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const { showAlert } = useToast();

  const targetUid = paramUserId || currentUserProfile?.uid;
  const isOwnProfile = targetUid === currentUserProfile?.uid;

  const [profileUser, setProfileUser] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  /* Global edit mode */
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  /* Draft state — mirrors all editable fields */
  const [draft, setDraft] = useState({});
  const [eduList, setEduList] = useState([]);

  const blankEdu = () => ({ degree: '', institution: '', year: '' });

  /* Sync draft when profileUser loads / changes */
  useEffect(() => {
    if (profileUser) {
      setDraft({
        phone:          profileUser.phone || '',
        whatsapp:       profileUser.whatsapp || '',
        messenger:      profileUser.messenger || '',
        dobMonth:       profileUser.dobMonth || '',
        dobDay:         profileUser.dobDay || '',
        quote:          profileUser.quote || '',
        qualifications: profileUser.qualifications || '',
      });
      setEduList(
        Array.isArray(profileUser.educationList) && profileUser.educationList.length > 0
          ? profileUser.educationList
          : []
      );
    }
  }, [profileUser]);

  useEffect(() => {
    if (!targetUid) return;
    const unsubUser = onSnapshot(doc(db, 'users', targetUid), snap => {
      setProfileUser(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    }, err => { console.error(err); setLoading(false); });

    const unsubShifts = onSnapshot(collection(db, 'shifts'), snap => {
      setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubUser(); unsubShifts(); };
  }, [targetUid]);

  const set = (key) => (e) => setDraft(prev => ({ ...prev, [key]: e.target.value }));

  const handleSaveAll = async () => {
    if (!currentUser || !isOwnProfile) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', targetUid), {
        ...draft,
        educationList: eduList.filter(e => e.degree || e.institution || e.year),
        updatedAt: new Date().toISOString(),
      });
      setEditMode(false);
    } catch (err) {
      console.error(err);
      showAlert('Failed to save. Please try again.', 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (profileUser) {
      setDraft({
        phone:          profileUser.phone || '',
        whatsapp:       profileUser.whatsapp || '',
        messenger:      profileUser.messenger || '',
        dobMonth:       profileUser.dobMonth || '',
        dobDay:         profileUser.dobDay || '',
        quote:          profileUser.quote || '',
        qualifications: profileUser.qualifications || '',
      });
      setEduList(
        Array.isArray(profileUser.educationList) && profileUser.educationList.length > 0
          ? profileUser.educationList
          : []
      );
    }
    setEditMode(false);
  };

  /* Education list helpers */
  const updateEdu = (idx, field, val) =>
    setEduList(prev => prev.map((e, i) => i === idx ? { ...e, [field]: val } : e));
  const addEdu = () => setEduList(prev => [...prev, blankEdu()]);
  const removeEdu = (idx) => setEduList(prev => prev.filter((_, i) => i !== idx));

  /* Shift stats */
  const getWorkedHours = (s) => {
    if (s.actualHours != null && s.actualHours !== '') return parseFloat(s.actualHours) || 0;
    const [sH, sM] = (s.startTime || '09:00').split(':').map(Number);
    const [eH, eM] = (s.endTime || '22:00').split(':').map(Number);
    let gross = (eH * 60 + eM) - (sH * 60 + sM);
    if (gross < 0) gross += 1440;
    const hrs = gross / 60;
    let brk = hrs >= 8 ? 60 : 30;
    if (s.breakMinutes != null && s.breakMinutes !== '') {
      const b = Number(s.breakMinutes);
      if (!isNaN(b) && b >= 0) brk = b;
    }
    return Math.max(0, (gross - brk) / 60);
  };

  const userShifts = shifts.filter(s =>
    s.userId === targetUid ||
    (profileUser?.displayName && s.userDisplayName === profileUser.displayName)
  );
  const daysWorked = new Set(userShifts.map(s => s.date)).size;
  const totalHours = userShifts.reduce((a, s) => a + getWorkedHours(s), 0);

  /* ── Loading ── */
  if (loading) return (
    <div style={{ textAlign: 'center', padding: '5rem 1rem', color: 'var(--text-muted)' }}>
      <Loader2 className="animate-spin" size={34} style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} />
      Loading profile…
    </div>
  );

  if (!profileUser) return (
    <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', maxWidth: 560, margin: '2rem auto' }}>
      <h3 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>Profile Not Found</h3>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>This staff profile does not exist or has been removed.</p>
      <button className="btn btn-secondary" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Go Back</button>
    </div>
  );

  const isManager = profileUser.role === 'manager';
  const empty = <span className="prof-field-empty">{isOwnProfile ? '—' : 'Not provided'}</span>;

  /* ── Render ── */
  return (
    <>
      <StyleTag />
      <div className="animate-fade-in" style={{ maxWidth: 860, margin: '0 auto', paddingBottom: '3rem' }}>

        {/* ── Top bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <button className="btn btn-sm btn-secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={15} /> Back
          </button>
          <div style={{ flex: 1 }} />

          {isOwnProfile && !editMode && (
            <button
              className="btn btn-sm btn-primary"
              style={{ gap: '0.4rem' }}
              onClick={() => setEditMode(true)}
            >
              <Edit3 size={14} /> Edit Profile
            </button>
          )}
          {isOwnProfile && editMode && (
            <>
              <button
                className="btn btn-sm btn-success"
                style={{ gap: '0.4rem' }}
                onClick={handleSaveAll}
                disabled={saving}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Save All
              </button>
              <button className="btn btn-sm btn-secondary" onClick={handleCancelEdit} disabled={saving}>
                <X size={14} /> Cancel
              </button>
            </>
          )}
        </div>

        {/* ── Hero Card ── */}
        <div className="prof-hero animate-fade-in">
          <div className="prof-hero-banner" />
          <div className="prof-hero-body">
            <div className="prof-avatar-wrap">
              <div className="prof-avatar-ring" style={{ display: 'inline-block' }}>
                <UserAvatar
                  photoURL={profileUser.photoURL}
                  displayName={profileUser.displayName}
                  size={88}
                />
              </div>
            </div>

            <div className="prof-name-block">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.55rem', fontWeight: 900, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
                  {profileUser.displayName || 'Unnamed User'}
                </h2>
                {isOwnProfile && (
                  <span className="badge badge-amber" style={{ fontSize: '0.65rem', padding: '2px 7px' }}>You</span>
                )}
              </div>

              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.3rem' }}>
                <Mail size={13} color="var(--primary)" /> {profileUser.email}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.7rem' }}>
                {isManager ? (
                  <span className="badge badge-amber" style={{ fontSize: '0.75rem', padding: '4px 10px', gap: '0.3rem' }}>
                    <ShieldCheck size={13} /> Manager
                  </span>
                ) : (
                  <span className="badge badge-blue" style={{ fontSize: '0.75rem', padding: '4px 10px', gap: '0.3rem' }}>
                    <UserCheck size={13} /> Staff Employee
                  </span>
                )}
                <span className="badge" style={{ fontSize: '0.75rem', padding: '4px 10px', gap: '0.3rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <Store size={13} /> {profileUser.defaultBranch || 'Panorama'}
                </span>
                {(profileUser.dobMonth || profileUser.dobDay) && (
                  <span className="badge badge-amber" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                    🎂 {profileUser.dobMonth} {profileUser.dobDay}
                  </span>
                )}
              </div>
            </div>

            {/* Stats — staff only */}
            {!isManager && (
              <div className="prof-stats-box">
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', marginBottom: '0.35rem' }}>
                  <Clock size={12} color="var(--accent-gold)" /> Total Working
                </div>
                <div style={{ fontSize: '1.55rem', fontWeight: 900, color: 'var(--accent-gold)', lineHeight: 1 }}>
                  {daysWorked}
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, marginLeft: 3 }}>Days</span>
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.2rem' }}>
                  {totalHours.toFixed(1)} net hrs
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Personal Quote — full width after hero ── */}
        <div className="prof-quote-card">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <Quote size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--primary)', marginBottom: '0.4rem' }}>
                Personal Motto &amp; Quote
              </div>
              {editMode ? (
                <textarea
                  className="form-control prof-edit-input"
                  rows={2}
                  placeholder="Work hard, stay humble & deliver top quality food!"
                  value={draft.quote}
                  onChange={set('quote')}
                  style={{ resize: 'vertical' }}
                />
              ) : profileUser.quote ? (
                <div style={{ fontStyle: 'italic', color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  "{profileUser.quote}"
                </div>
              ) : (
                <div style={{ color: 'var(--text-subtle)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                  {isOwnProfile ? 'No quote yet — click Edit Profile to add one.' : 'No quote added yet.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Detail Grid ── */}
        <div className="prof-grid">

          {/* Contact & Social */}
          <div className="prof-panel">
            <div className="prof-panel-head">
              <Phone size={13} color="var(--primary)" /> Contact &amp; Social
            </div>

            {/* Phone */}
            <div className={`prof-field-row${editMode ? ' edit-mode' : ''}`}>
              <div className="prof-field-label"><Phone size={13} color="var(--primary)" /> Phone</div>
              {editMode ? (
                <input type="tel" className="form-control prof-edit-input" placeholder="+358 40 123 4567" value={draft.phone} onChange={set('phone')} />
              ) : profileUser.phone ? (
                <a href={`tel:${profileUser.phone}`} className="prof-field-val" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                  {profileUser.phone}
                </a>
              ) : empty}
            </div>

            {/* WhatsApp */}
            <div className={`prof-field-row${editMode ? ' edit-mode' : ''}`}>
              <div className="prof-field-label"><WhatsAppIcon size={14} color="#25D366" /> WhatsApp</div>
              {editMode ? (
                <input type="tel" className="form-control prof-edit-input" placeholder="+358 40 123 4567" value={draft.whatsapp} onChange={set('whatsapp')} />
              ) : profileUser.whatsapp ? (
                <a
                  href={`https://wa.me/${profileUser.whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366', textDecoration: 'none' }}
                  title={`WhatsApp: ${profileUser.whatsapp}`}
                >
                  <WhatsAppIcon size={15} />
                </a>
              ) : empty}
            </div>

            {/* Messenger */}
            <div className={`prof-field-row${editMode ? ' edit-mode' : ''}`}>
              <div className="prof-field-label"><MessengerIcon size={14} color="#0084FF" /> Messenger</div>
              {editMode ? (
                <input type="text" className="form-control prof-edit-input" placeholder="username or link" value={draft.messenger} onChange={set('messenger')} />
              ) : profileUser.messenger ? (
                <a
                  href={profileUser.messenger.startsWith('http') ? profileUser.messenger : `https://m.me/${profileUser.messenger}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'rgba(0,132,255,0.12)', border: '1px solid rgba(0,132,255,0.3)', color: '#0084FF', textDecoration: 'none' }}
                  title={`Messenger: ${profileUser.messenger}`}
                >
                  <MessengerIcon size={15} />
                </a>
              ) : empty}
            </div>

            {/* Birthday */}
            <div className={`prof-field-row${editMode ? ' edit-mode' : ''}`}>
              <div className="prof-field-label"><Calendar size={13} color="var(--accent-gold)" /> Birthday</div>
              {editMode ? (
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                  <select className="form-select prof-edit-select" style={{ flex: 1.4 }} value={draft.dobMonth} onChange={set('dobMonth')}>
                    <option value="">Month</option>
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select className="form-select prof-edit-select" style={{ flex: 0.8 }} value={draft.dobDay} onChange={set('dobDay')}>
                    <option value="">Day</option>
                    {Array.from({ length: 31 }, (_, i) => String(i + 1)).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              ) : (profileUser.dobMonth || profileUser.dobDay) ? (
                <span className="badge badge-amber" style={{ fontSize: '0.82rem' }}>🎂 {profileUser.dobMonth} {profileUser.dobDay}</span>
              ) : empty}
            </div>
          </div>

          {/* Education & Qualifications */}
          <div className="prof-panel">

            {/* Education */}
            <div className="prof-panel-head" style={{ marginBottom: '0.85rem' }}>
              <GraduationCap size={13} color="var(--primary)" /> Educational Background
            </div>

            {editMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {eduList.map((entry, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(15,23,42,0.5)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 10,
                    padding: '0.75rem 0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Entry {idx + 1}</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                        onClick={() => removeEdu(idx)}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <input
                      type="text"
                      className="form-control prof-edit-input"
                      placeholder="Degree / Qualification"
                      value={entry.degree}
                      onChange={e => updateEdu(idx, 'degree', e.target.value)}
                    />
                    <input
                      type="text"
                      className="form-control prof-edit-input"
                      placeholder="Institution / School"
                      value={entry.institution}
                      onChange={e => updateEdu(idx, 'institution', e.target.value)}
                    />
                    <select
                      className="form-select prof-edit-select"
                      value={entry.year}
                      onChange={e => updateEdu(idx, 'year', e.target.value)}
                    >
                      <option value="">Completion year…</option>
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
                  onClick={addEdu}
                >
                  <Plus size={13} /> Add Education Entry
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem' }}>
                {(Array.isArray(profileUser.educationList) && profileUser.educationList.length > 0) ? (
                  profileUser.educationList.map((entry, idx) => (
                    <div key={idx} style={{
                      background: 'rgba(15,23,42,0.55)',
                      borderRadius: 10,
                      padding: '0.75rem 1rem',
                      border: '1px solid var(--border-color)',
                      display: 'flex', flexDirection: 'column', gap: '0.3rem'
                    }}>
                      {entry.degree && (
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>🎓 {entry.degree}</div>
                      )}
                      {entry.institution && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                          <BookOpen size={12} color="var(--primary)" /> {entry.institution}
                        </div>
                      )}
                      {entry.year && (
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-subtle)' }}>Completed: {entry.year}</div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-subtle)', fontStyle: 'italic', fontSize: '0.84rem' }}>
                    {isOwnProfile ? 'No education added — click Edit Profile to add.' : 'No educational background listed.'}
                  </div>
                )}
              </div>
            )}

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.1rem' }}>
              <div className="prof-panel-head" style={{ marginBottom: '0.85rem' }}>
                <Award size={13} color="var(--accent-gold)" /> Qualifications &amp; Skills
              </div>

              {editMode ? (
                <textarea
                  className="form-control prof-edit-input"
                  rows={3}
                  placeholder="Food Hygiene Passport, First Aid Level 1, Kebab Grill Specialist…"
                  value={draft.qualifications}
                  onChange={set('qualifications')}
                  style={{ resize: 'vertical' }}
                />
              ) : profileUser.qualifications ? (
                <div style={{
                  background: 'rgba(15,23,42,0.55)',
                  borderRadius: 10,
                  padding: '0.85rem 1rem',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.88rem',
                  color: 'var(--text-main)',
                  lineHeight: 1.6
                }}>
                  <Sparkles size={13} color="var(--accent-gold)" style={{ marginRight: 6 }} />
                  {profileUser.qualifications}
                </div>
              ) : (
                <div style={{ color: 'var(--text-subtle)', fontStyle: 'italic', fontSize: '0.84rem' }}>
                  {isOwnProfile ? 'No qualifications added — click Edit Profile to add.' : 'No qualifications listed.'}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </>
  );
};
