function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function IconWarning({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2L18 17H2L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="10" y1="7" x2="10" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10" cy="14" r="0.75" fill="currentColor"/>
    </svg>
  );
}

function IconError({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
      <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="12" cy="16" r="0.75" fill="currentColor"/>
    </svg>
  );
}

function IconSearch({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconBox({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 5L8 8.5L14 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 8.5V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function IconGrid({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function IconDevice({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="2" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="9" y1="15" x2="11" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconAccessory({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 4C11.5 4 13 5 13 7C13 9 10 11 10 13C10 11 7 9 7 7C7 5 8.5 4 10 4Z" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="10" y1="13" x2="10" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconRepair({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M14.5 3.5L16.5 5.5L12 10L10 8L14.5 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M10 8L7 5H3L5 7.5L8 10L10 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M12 10L16.5 14.5L14.5 16.5L10 12L12 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 10L5.5 12.5L7 16L10 12L8 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

function IconCustomer({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 18C4 14.5 6.5 12 10 12C13.5 12 16 14.5 16 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconReport({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="6" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="6" y1="10" x2="12" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="6" y1="13" x2="10" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  );
}

function IconMenu({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="3" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function IconClose({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <line x1="5" y1="5" x2="15" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="15" y1="5" x2="5" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function IconLogout({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M7 17H4C3.44772 17 3 16.5523 3 16V4C3 3.44772 3.44772 3 4 3H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M13 14L17 10L13 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="17" y1="10" x2="7" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconFinance({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="2" y1="9" x2="18" y2="9" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="10" cy="12.5" r="1.5" fill="currentColor"/>
    </svg>
  );
}

function IconEdit({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M11.5 2.5L13.5 4.5L6 12L3 13L4 10L11.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

function IconDelete({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6 4V2.5C6 2.22386 6.22386 2 6.5 2H9.5C9.77614 2 10 2.22386 10 2.5V4" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 4L6 14H10L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

function IconSpinner({ size = 20, className }: { size?: number, className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconEye({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.52 13.52 0 0 0 2 12c0 0 3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20" />
    </svg>
  );
}

function IconSettings({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

function IconFilter({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  );
}

function IconList({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  );
}

export { IconPlus, IconWarning, IconError, IconSearch, IconBox, IconGrid, IconDevice, IconAccessory, IconRepair, IconCustomer, IconReport, IconFinance, IconLogo, IconMenu, IconClose, IconLogout, IconSpinner, IconEdit, IconDelete, IconEye, IconEyeOff, IconSettings, IconFilter, IconList };


