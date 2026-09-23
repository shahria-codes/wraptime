import React, { createContext, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, XCircle, Info, ShieldAlert } from 'lucide-react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [alertConfig, setAlertConfig] = useState(null);

  const showAlert = (message, title = 'Notice', type = 'warning') => {
    return new Promise((resolve) => {
      setAlertConfig({
        title,
        message,
        type,
        isConfirm: false,
        onConfirm: () => {
          setAlertConfig(null);
          resolve(true);
        }
      });
    });
  };

  const showConfirm = (message, title = 'Confirmation Required', type = 'warning') => {
    return new Promise((resolve) => {
      setAlertConfig({
        title,
        message,
        type,
        isConfirm: true,
        onConfirm: () => {
          setAlertConfig(null);
          resolve(true);
        },
        onCancel: () => {
          setAlertConfig(null);
          resolve(false);
        }
      });
    });
  };

  return (
    <ToastContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {alertConfig && createPortal(
        <div 
          className="modal-overlay" 
          style={{ zIndex: 9999999 }} 
          onClick={() => !alertConfig.isConfirm && alertConfig.onConfirm()}
        >
          <div 
            className="modal-content animate-fade-in" 
            style={{ maxWidth: 440, padding: '1.75rem', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon Badge */}
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: alertConfig.type === 'danger' || alertConfig.type === 'error'
                ? 'rgba(239, 68, 68, 0.15)'
                : alertConfig.type === 'success'
                ? 'rgba(16, 185, 129, 0.15)'
                : alertConfig.type === 'info'
                ? 'rgba(56, 189, 248, 0.15)'
                : 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              margin: '0 auto 1.1rem auto',
              border: `1px solid ${
                alertConfig.type === 'danger' || alertConfig.type === 'error'
                  ? 'rgba(239, 68, 68, 0.35)'
                  : alertConfig.type === 'success'
                  ? 'rgba(16, 185, 129, 0.35)'
                  : alertConfig.type === 'info'
                  ? 'rgba(56, 189, 248, 0.35)'
                  : 'rgba(245, 158, 11, 0.35)'
              }`
            }}>
              {alertConfig.type === 'danger' || alertConfig.type === 'error' ? (
                <XCircle size={30} color="var(--danger)" />
              ) : alertConfig.type === 'success' ? (
                <CheckCircle2 size={30} color="var(--success)" />
              ) : alertConfig.type === 'info' ? (
                <Info size={30} color="#38BDF8" />
              ) : (
                <AlertTriangle size={30} color="var(--primary)" />
              )}
            </div>

            {/* Title & Message */}
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
              {alertConfig.title}
            </h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', lineHeight: 1.65, margin: '0 0 1.5rem 0', whiteSpace: 'pre-line' }}>
              {alertConfig.message}
            </p>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              {alertConfig.isConfirm && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={alertConfig.onCancel}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                className={`btn ${alertConfig.type === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={alertConfig.onConfirm}
              >
                {alertConfig.isConfirm ? 'Confirm' : 'OK'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if component is used outside provider
    return {
      showAlert: (msg, title, type) => { alert(`${title}\n\n${msg}`); return Promise.resolve(true); },
      showConfirm: (msg, title) => Promise.resolve(window.confirm(`${title}\n\n${msg}`))
    };
  }
  return context;
};
