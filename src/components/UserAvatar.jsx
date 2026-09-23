import React, { useState } from 'react';

/**
 * UserAvatar — shows a Google photo with graceful fallback to initials.
 * Uses onError to silently fall back if the CDN returns 429 or any error.
 */
export const UserAvatar = ({ photoURL, displayName, size = 36, borderColor = 'var(--primary)', fontSize }) => {
  const [imgError, setImgError] = useState(false);

  const initial = (displayName || 'U').charAt(0).toUpperCase();
  const computedFontSize = fontSize || Math.max(10, Math.round(size * 0.42)) + 'px';

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  if (photoURL && !imgError) {
    return (
      <img
        src={photoURL}
        alt={displayName || 'User'}
        width={size}
        height={size}
        style={{
          ...baseStyle,
          objectFit: 'cover',
          border: `2px solid ${borderColor}`,
        }}
        onError={() => setImgError(true)}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      style={{
        ...baseStyle,
        background: 'var(--primary)',
        color: '#0F172A',
        fontWeight: 700,
        fontSize: computedFontSize,
        border: `2px solid ${borderColor}`,
        fontFamily: 'var(--font-heading)',
      }}
    >
      {initial}
    </div>
  );
};
