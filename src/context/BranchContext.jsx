import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, collection, onSnapshot, doc, setDoc, deleteDoc } from '../firebase';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const defaultDayHours = () =>
  Object.fromEntries(DAYS.map(d => [d, { open: '09:00', close: '22:00', closed: false }]));

// Branches created by first manager (Jakaria)
export const isJakariaBranch = (branchName = '', branchId = '') => {
  const s = `${branchName} ${branchId}`.toLowerCase().trim();
  return (
    s.includes('antakalnis') ||
    s.includes('paupys') ||
    s.includes('paupio') ||
    s.includes('vilnius outlet') ||
    s.includes('outlet')
  );
};

export const JAKARIA_BRANCH_NAMES = ['antakalnis', 'paupys', 'paupys turgus', 'paupio turgus', 'vilnius outlet'];

/**
 * Filter branches to only those created by the specified manager.
 * - Jakaria created Antakalnis, Paupys Turgus, Vilnius Outlet
 * - Nur created the remaining branches
 * - Any newly created branch matches via createdBy (UID) or createdByName
 */
export const getManagerBranches = (user, branches = []) => {
  if (!user || user.role !== 'manager') return [];
  const uid = user.uid || user.id;
  const name = (user.displayName || '').toLowerCase();
  const email = (user.email || '').toLowerCase();
  const isJakaria = name.includes('jakaria') || email.includes('jakaria');
  const isNur = name.includes('nur') || email.includes('nur');

  return branches.filter(branch => {
    const isJakBranch = isJakariaBranch(branch.name, branch.id);

    // If it's a known Jakaria branch (Antakalnis, Paupys Turgus, Vilnius Outlet)
    if (isJakBranch) {
      return isJakaria;
    }

    // Direct match by createdBy (UID) if explicitly stored and not a Jakaria branch
    if (branch.createdBy && uid && branch.createdBy === uid) return true;

    // Direct match by createdByName
    if (branch.createdByName && user.displayName) {
      const bCreator = branch.createdByName.toLowerCase();
      if (bCreator.includes('jakaria') && isJakaria) return true;
      if (bCreator.includes('nur') && isNur) return true;
      if (bCreator === name) return true;
    }

    // If it's Nur and not a Jakaria branch, it belongs to Nur
    if (isNur) {
      return !isJakBranch;
    }

    return false;
  });
};

const BranchContext = createContext(null);

export const useBranches = () => {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranches must be used inside BranchProvider');
  return ctx;
};

export const BranchProvider = ({ children }) => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'branches'),
      (snap) => {
        const list = [];
        snap.forEach(d => {
          const data = d.data();
          const isJak = isJakariaBranch(data.name, d.id);
          let createdByName = isJak ? 'Jakaria' : (data.createdByName || 'Nur');
          list.push({ id: d.id, ...data, createdByName });

          // Ensure Firestore is updated so Jakaria branches always store 'Jakaria'
          if (data.createdByName !== createdByName) {
            setDoc(doc(db, 'branches', d.id), { createdByName }, { merge: true }).catch(() => {});
          }
        });
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setBranches(list);
        setLoading(false);
      },
      (err) => {
        console.error('BranchContext error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  /** Create a new branch with optional creator metadata. docId derived from name. */
  const createBranch = async (name, initialSchedule = null, metadata = {}) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Branch name cannot be empty');
    const id = trimmed.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const data = {
      name: trimmed,
      schedule: initialSchedule || defaultDayHours(),
      createdAt: new Date().toISOString(),
      ...(metadata?.createdBy ? { createdBy: metadata.createdBy } : {}),
      ...(metadata?.createdByName ? { createdByName: metadata.createdByName } : {})
    };
    await setDoc(doc(db, 'branches', id), data, { merge: true });
    return id;
  };

  /** Delete a branch by Firestore doc id. */
  const deleteBranch = async (id) => {
    await deleteDoc(doc(db, 'branches', id));
  };

  /** Save per-day schedule for a branch. schedule = { Mon: {open,close,closed}, … } */
  const saveBranchSchedule = async (id, schedule) => {
    await setDoc(doc(db, 'branches', id), { 
      schedule, 
      updatedAt: new Date().toISOString() 
    }, { merge: true });
  };

  /** Update branch details (e.g. name) */
  const updateBranch = async (id, data) => {
    await setDoc(doc(db, 'branches', id), { 
      ...data, 
      updatedAt: new Date().toISOString() 
    }, { merge: true });
  };

  /**
   * Get open/close hours for a branch on a specific JS Date or ISO date string 'YYYY-MM-DD'
   * Returns { open, close, closed } or fallback { open: '09:00', close: '22:00', closed: false }.
   */
  const getBranchHoursForDate = (branchName, dateInput) => {
    const branch = branches.find(b => b.name === branchName);
    if (!branch?.schedule) {
      return { open: '09:00', close: '22:00', closed: false };
    }

    let dayKey = 'Mon';
    if (typeof dateInput === 'string') {
      const parts = dateInput.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const dayIdx = d.getDay(); // 0 is Sun
        const map = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayKey = map[dayIdx];
      } else {
        dayKey = dateInput;
      }
    } else if (dateInput instanceof Date) {
      const map = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      dayKey = map[dateInput.getDay()];
    }

    const daySchedule = branch.schedule[dayKey];
    if (!daySchedule) {
      return { open: '09:00', close: '22:00', closed: false };
    }
    return daySchedule;
  };

  /** Array of branch names strictly from Firestore */
  const branchNames = branches.map(b => b.name);

  return (
    <BranchContext.Provider value={{
      branches,
      branchNames,
      loading,
      createBranch,
      deleteBranch,
      saveBranchSchedule,
      updateBranch,
      getBranchHoursForDate,
      getManagerBranches,
      DAYS,
      defaultDayHours
    }}>
      {children}
    </BranchContext.Provider>
  );
};
