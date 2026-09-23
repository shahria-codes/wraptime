import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { UserAvatar } from './UserAvatar';

/**
 * GlassSelect — Apple visionOS style custom glass dropdown menu.
 * Replaces ugly browser native <select> elements with smooth glass popovers.
 */
export const GlassSelect = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select option...',
  icon: Icon,
  className = '',
  style = {},
  fullWidth = true,
  disabled = false,
  size = 'md' // 'sm' | 'md' | 'lg'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Normalize options array
  const formattedOptions = options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOption = formattedOptions.find(opt => opt.value === value) || formattedOptions[0];

  const handleSelect = (optionValue) => {
    if (disabled) return;
    onChange(optionValue);
    setIsOpen(false);
  };

  const py = size === 'sm' ? '0.45rem' : size === 'lg' ? '0.85rem' : '0.65rem';
  const px = size === 'sm' ? '0.75rem' : size === 'lg' ? '1.15rem' : '0.95rem';
  const fontSize = size === 'sm' ? '0.8rem' : size === 'lg' ? '1rem' : '0.9rem';

  return (
    <div 
      ref={containerRef}
      className={`glass-select-wrapper ${className}`}
      style={{
        position: 'relative',
        display: fullWidth ? 'block' : 'inline-block',
        width: fullWidth ? '100%' : 'auto',
        ...style
      }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="glass-select-trigger"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          gap: '0.6rem',
          padding: `${py} ${px}`,
          fontSize: fontSize,
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          color: selectedOption ? 'var(--text-main)' : 'var(--text-muted)',
          background: isOpen ? 'rgba(255, 255, 255, 0.12)' : 'var(--glass-regular)',
          backdropFilter: 'var(--blur-thin)',
          WebkitBackdropFilter: 'var(--blur-thin)',
          border: isOpen ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
          borderRadius: 'var(--radius-md)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxShadow: isOpen 
            ? '0 0 0 3px rgba(245, 158, 11, 0.2), var(--inset-shine)' 
            : 'var(--shadow-sm), var(--inset-shine-sm)',
          transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: disabled ? 0.6 : 1
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption?.photoURL ? (
            <UserAvatar photoURL={selectedOption.photoURL} displayName={selectedOption.label} size={size === 'sm' ? 20 : 24} />
          ) : selectedOption?.icon ? (
            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--primary)' }}>{selectedOption.icon}</span>
          ) : Icon ? (
            <Icon size={size === 'sm' ? 14 : 17} color="var(--primary)" />
          ) : null}

          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown 
          size={16} 
          color="var(--text-muted)" 
          style={{ 
            transition: 'transform 0.22s ease', 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0
          }} 
        />
      </button>

      {/* Floating Glass Dropdown Popup */}
      {isOpen && (
        <div
          className="glass-select-popup animate-fade-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 10000,
            background: 'rgba(12, 18, 38, 0.94)',
            backdropFilter: 'var(--blur-thick)',
            WebkitBackdropFilter: 'var(--blur-thick)',
            border: '1px solid var(--border-bright)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg), 0 0 30px rgba(0, 0, 0, 0.6), var(--inset-shine)',
            padding: '0.4rem',
            maxHeight: '260px',
            overflowY: 'auto',
            minWidth: '180px'
          }}
        >
          {formattedOptions.length === 0 ? (
            <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              No options available
            </div>
          ) : (
            formattedOptions.map((opt) => {
              const isSelected = selectedOption && selectedOption.value === opt.value;

              return (
                <div
                  key={String(opt.value)}
                  onClick={() => handleSelect(opt.value)}
                  className={`glass-select-option ${isSelected ? 'selected' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    gap: '0.65rem',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.88rem',
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                    background: isSelected ? 'rgba(245, 158, 11, 0.14)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                    marginBottom: '2px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                    {opt.photoURL ? (
                      <UserAvatar photoURL={opt.photoURL} displayName={opt.label} size={24} />
                    ) : opt.icon ? (
                      <span style={{ display: 'flex', alignItems: 'center' }}>{opt.icon}</span>
                    ) : null}

                    <div>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {opt.label}
                      </div>
                      {opt.sublabel && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                          {opt.sublabel}
                        </div>
                      )}
                    </div>
                  </div>

                  {isSelected && <Check size={16} color="var(--primary)" style={{ flexShrink: 0 }} />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
