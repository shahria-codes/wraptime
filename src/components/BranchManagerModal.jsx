import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useBranches } from '../context/BranchContext';
import { useToast } from '../context/ToastContext';
import {
  Settings,
  Plus,
  Trash2,
  Clock,
  Check,
  X,
  ChevronDown
} from 'lucide-react';

// Sub-component for editing 7-day schedule for a branch
const BranchScheduleEditor = ({ branch, DAYS, onSave, onDelete }) => {
  const [schedule, setSchedule] = useState(() => {
    const initial = branch.schedule || {};
    const filled = {};
    DAYS.forEach(d => {
      filled[d] = initial[d] || { open: '09:00', close: '22:00', closed: false };
    });
    return filled;
  });

  const [bulkOpen, setBulkOpen] = useState('09:00');
  const [bulkClose, setBulkClose] = useState('22:00');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (branch.schedule) {
      const filled = {};
      DAYS.forEach(d => {
        filled[d] = branch.schedule[d] || { open: '09:00', close: '22:00', closed: false };
      });
      setSchedule(filled);
    }
  }, [branch.schedule, DAYS]);

  const handleDayChange = (day, field, value) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || { open: '09:00', close: '22:00', closed: false }),
        [field]: value
      }
    }));
  };

  const handleApplyBulk = () => {
    const updated = {};
    DAYS.forEach(d => {
      updated[d] = {
        open: bulkOpen,
        close: bulkClose,
        closed: false
      };
    });
    setSchedule(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(branch.id, schedule);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2200);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.75)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '0.85rem',
      marginTop: '0.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem'
    }}>
      {/* Bulk Fill Helper */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
        padding: '0.45rem 0.65rem',
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        borderRadius: '6px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: 600 }}>
          <span>⚡ Quick Fill:</span>
          <input
            type="time"
            value={bulkOpen}
            onChange={e => setBulkOpen(e.target.value)}
            style={{ width: '85px', padding: '2px 4px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', color: '#FFF', borderRadius: '4px' }}
          />
          <span>to</span>
          <input
            type="time"
            value={bulkClose}
            onChange={e => setBulkClose(e.target.value)}
            style={{ width: '85px', padding: '2px 4px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', color: '#FFF', borderRadius: '4px' }}
          />
        </div>
        <button
          type="button"
          onClick={handleApplyBulk}
          className="btn btn-sm btn-secondary"
          style={{ fontSize: '0.7rem', padding: '3px 8px' }}
        >
          Apply to All 7 Days
        </button>
      </div>

      {/* 7 Day Rows */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '0.45rem' }}>
        {DAYS.map(day => {
          const cfg = schedule[day] || { open: '09:00', close: '22:00', closed: false };
          return (
            <div
              key={day}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.45rem',
                padding: '0.45rem 0.65rem',
                borderRadius: '8px',
                background: cfg.closed ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                border: cfg.closed ? '1px dashed rgba(239, 68, 68, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                boxSizing: 'border-box'
              }}
            >
              {/* Day Badge & Closed Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 800, fontSize: '0.8rem', color: cfg.closed ? '#F87171' : 'var(--accent-gold)', minWidth: '34px' }}>
                  {day}
                </span>

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: cfg.closed ? '#FCA5A5' : 'var(--text-muted)', cursor: 'pointer', margin: 0, userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={!!cfg.closed}
                    onChange={e => handleDayChange(day, 'closed', e.target.checked)}
                    style={{ accentColor: '#EF4444', width: '13px', height: '13px', cursor: 'pointer' }}
                  />
                  <span>Closed</span>
                </label>
              </div>

              {/* Time Inputs or Closed Badge */}
              {!cfg.closed ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto' }}>
                  <input
                    type="time"
                    value={cfg.open || '09:00'}
                    onChange={e => handleDayChange(day, 'open', e.target.value)}
                    style={{ width: '78px', padding: '2px 4px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.45)', border: '1px solid var(--border-color)', color: '#FFF', borderRadius: '4px', textAlign: 'center', boxSizing: 'border-box' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>-</span>
                  <input
                    type="time"
                    value={cfg.close || '22:00'}
                    onChange={e => handleDayChange(day, 'close', e.target.value)}
                    style={{ width: '78px', padding: '2px 4px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.45)', border: '1px solid var(--border-color)', color: '#FFF', borderRadius: '4px', textAlign: 'center', boxSizing: 'border-box' }}
                  />
                </div>
              ) : (
                <span style={{ fontSize: '0.72rem', color: '#F87171', fontWeight: 600, marginLeft: 'auto', background: 'rgba(239,68,68,0.12)', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.25)' }}>
                  Closed All Day
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: Save & Delete */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          type="button"
          onClick={() => onDelete(branch.id, branch.name)}
          className="btn btn-sm btn-danger"
          style={{ fontSize: '0.72rem', padding: '3px 8px' }}
        >
          <Trash2 size={12} /> Delete Branch
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="btn btn-sm btn-primary"
          style={{ fontSize: '0.76rem', padding: '4px 14px' }}
        >
          {savedSuccess ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <Check size={13} /> Hours Saved!
            </span>
          ) : isSaving ? (
            'Saving...'
          ) : (
            `Save Hours for ${branch.name}`
          )}
        </button>
      </div>
    </div>
  );
};

export const BranchManagerModal = ({ isOpen, onClose }) => {
  const { branches, branchNames, createBranch, deleteBranch, saveBranchSchedule, DAYS } = useBranches();
  const { userProfile, user } = useAuth();
  const { showAlert, showConfirm } = useToast();
  const [newBranchName, setNewBranchName] = useState('');
  const [expandedBranchId, setExpandedBranchId] = useState(null);

  if (!isOpen) return null;

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    const name = newBranchName.trim();
    if (!name) return;
    if (branchNames.some(b => b.toLowerCase() === name.toLowerCase())) {
      showAlert(`A branch named "${name}" already exists!`, 'error');
      return;
    }
    try {
      const newId = await createBranch(name, null, {
        createdBy: user?.uid || userProfile?.uid,
        createdByName: userProfile?.displayName || user?.displayName
      });
      setNewBranchName('');
      setExpandedBranchId(newId);
      showAlert(`Branch "${name}" created! Configure its operating hours below.`, 'success');
    } catch (err) {
      console.error(err);
      showAlert('Failed to create branch: ' + err.message, 'error');
    }
  };

  const handleDeleteBranch = async (branchId, branchName) => {
    const confirmed = await showConfirm(
      `Delete branch "${branchName}"? Existing shifts will keep this location label, but it will be removed from future scheduling.`,
      'Delete Branch',
      'danger'
    );
    if (!confirmed) return;
    try {
      await deleteBranch(branchId);
      if (expandedBranchId === branchId) {
        setExpandedBranchId(null);
      }
      showAlert(`Branch "${branchName}" deleted.`, 'info');
    } catch (err) {
      console.error(err);
      showAlert('Failed to delete branch: ' + err.message, 'error');
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content animate-fade-in"
        style={{ maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Branches &amp; Operating Hours
            </h3>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 7px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-gold)' }}>
              {branches.length} total
            </span>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={onClose} style={{ padding: '4px 8px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Add Branch Form */}
        <form onSubmit={handleCreateBranch} style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'rgba(245, 158, 11, 0.06)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '10px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem'
        }}>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Enter new branch name (e.g. Ozas, Kaunas Mall)..."
              value={newBranchName}
              onChange={e => setNewBranchName(e.target.value)}
              style={{ fontSize: '0.88rem', padding: '0.55rem 0.85rem' }}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
          >
            <Plus size={15} /> Add Branch
          </button>
        </form>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: 0 }}>
          Manage all branches and set their opening/closing times for each day of the week. Shifts scheduled at a branch will automatically inherit these hours.
        </p>

        {/* List of Branches */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {branches.map(branch => {
            const isEditingThis = expandedBranchId === branch.id;
            const schedule = branch.schedule || {};
            const openDaysCount = DAYS.filter(d => !schedule[d]?.closed).length;

            return (
              <div
                key={branch.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border-color)',
                  borderLeft: `3px solid ${isEditingThis ? 'var(--primary)' : 'var(--accent-gold)'}`,
                  borderRadius: '10px',
                  padding: '0.65rem 0.9rem',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Branch Title Row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--accent-gold)' }}>
                      📍 {branch.name}
                    </span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: openDaysCount === 7 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: openDaysCount === 7 ? '#34D399' : 'var(--accent-gold)',
                      border: openDaysCount === 7 ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
                    }}>
                      {openDaysCount === 7 ? 'Open 7 days' : `Open ${openDaysCount}/7 days`}
                    </span>
                    {branch.createdByName && (
                      <span style={{
                        fontSize: '0.66rem',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-muted)',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                      }}>
                        Manager: {branch.createdByName}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => setExpandedBranchId(isEditingThis ? null : branch.id)}
                      className={`btn btn-sm ${isEditingThis ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Clock size={12} />
                      {isEditingThis ? 'Hide Hours' : 'Daily Hours'}
                      <ChevronDown size={12} style={{ transform: isEditingThis ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                    </button>
                  </div>
                </div>

                {/* Inline Daily Schedule Timetable */}
                {isEditingThis && (
                  <BranchScheduleEditor
                    branch={branch}
                    DAYS={DAYS}
                    onSave={saveBranchSchedule}
                    onDelete={handleDeleteBranch}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
};
