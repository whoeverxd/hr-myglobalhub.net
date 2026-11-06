import React, { useState, useEffect } from 'react';

// Same look as the bundle's Sidebar (components/navigation/Sidebar.jsx in _ds_bundle.js, which must not be
// edited), plus collapsible sections: each section label is a toggle. By default the first section and the
// section holding the active screen are open; the user's choices are remembered per browser.

const STORE_KEY = 'mgh.sidebar.sections';

function getDS() {
  return (typeof window !== 'undefined' && window.MyGlobalHubDesignSystem_2a603d) || {};
}

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function writeStored(value) {
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
}

const itemHasKey = (it, key) => it.key === key || Boolean(it.children && it.children.some(c => c.key === key));
const itemHasBadge = it => Boolean(it.badge) || Boolean(it.children && it.children.some(c => c.badge));

function navButtonStyle({ active, hover, height = 40, radius = 8, padding = '8px', gap = 8 }) {
  return {
    width: '100%',
    height,
    borderRadius: radius,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap,
    padding,
    background: active ? 'var(--surface-nav-active)' : hover ? 'var(--surface-nav-hover)' : 'transparent',
    color: active ? 'var(--mgh-nav-active-text)' : 'var(--mgh-nav-text)',
    textAlign: 'left',
    transition: 'background 120ms',
  };
}

const ellipsis = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

function ChildNavItem({ it, active, onNavigate }) {
  const { Icon, Badge } = getDS();
  const [h, setH] = useState(false);
  return (
    <button
      onClick={() => onNavigate && onNavigate(it.key)}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      aria-current={active ? 'page' : undefined}
      style={navButtonStyle({ active, hover: h, height: 34, radius: 6, padding: '6px 8px', gap: 6 })}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <Icon name={it.icon || 'arrow_right'} size={14} />
        <span style={{ font: `${active ? 600 : 400} 13px/18px var(--font-sans)`, ...ellipsis }}>{it.label}</span>
      </span>
      {it.badge && <Badge tone={it.badgeTone || 'onDarkWarning'} size="sm">{it.badge}</Badge>}
    </button>
  );
}

function NavItem({ it, active, onNavigate }) {
  const { Icon, Badge } = getDS();
  const [h, setH] = useState(false);
  const hasChildren = Boolean(it.children && it.children.length);
  const isChildActive = Boolean(hasChildren && it.children.some(c => c.key === active));
  const isSelfActive = active === it.key;
  const [open, setOpen] = useState(isChildActive);

  useEffect(() => { if (isChildActive) setOpen(true); }, [isChildActive]);

  if (hasChildren) {
    const anyActive = isSelfActive || isChildActive;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
        <button
          onClick={e => { e.preventDefault(); setOpen(o => !o); }}
          onMouseEnter={() => setH(true)}
          onMouseLeave={() => setH(false)}
          aria-expanded={open}
          style={{
            ...navButtonStyle({ active: false, hover: h }),
            background: anyActive ? 'rgba(255,255,255,0.06)' : h ? 'var(--surface-nav-hover)' : 'transparent',
            color: anyActive ? '#FAF8FF' : 'var(--mgh-nav-text)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Icon name={it.icon} size={16} />
            <span style={{ font: `${anyActive ? 600 : 400} 14px/20px var(--font-sans)`, ...ellipsis }}>{it.label}</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {it.badge && <Badge tone={it.badgeTone || 'onDarkWarning'} size="sm">{it.badge}</Badge>}
            <Icon name={open ? 'expand_less' : 'expand_more'} size={16} color="var(--mgh-nav-section)" />
          </span>
        </button>
        {open && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 10,
            borderLeft: '1px solid rgba(255,255,255,0.12)', marginLeft: 16, marginTop: 2, marginBottom: 2,
          }}>
            {it.children.map(child => (
              <ChildNavItem key={child.key} it={child} active={active === child.key} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onNavigate && onNavigate(it.key)}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      aria-current={isSelfActive ? 'page' : undefined}
      style={navButtonStyle({ active: isSelfActive, hover: h })}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <Icon name={it.icon} size={16} />
        <span style={{ font: `${isSelfActive ? 600 : 400} 14px/20px var(--font-sans)`, ...ellipsis }}>{it.label}</span>
      </span>
      {it.badge && <Badge tone={it.badgeTone || 'onDarkWarning'} size="sm">{it.badge}</Badge>}
    </button>
  );
}

function NavSection({ section, open, onToggle, active, onNavigate }) {
  const { Icon } = getDS();
  const [h, setH] = useState(false);
  const hasBadge = section.items.some(itemHasBadge);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <button
        onClick={onToggle}
        onMouseEnter={() => setH(true)}
        onMouseLeave={() => setH(false)}
        aria-expanded={open}
        title={open ? 'Contraer sección' : 'Expandir sección'}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          width: '100%', padding: '4px 8px', border: 'none', borderRadius: 6, cursor: 'pointer',
          background: h ? 'var(--surface-nav-hover)' : 'transparent', textAlign: 'left',
          font: '700 11px/14px var(--font-sans)', letterSpacing: '0.55px', textTransform: 'uppercase',
          color: 'var(--mgh-nav-section)', transition: 'background 120ms',
        }}
      >
        <span style={ellipsis}>{section.label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {!open && hasBadge && (
            <span aria-label="Pendientes" style={{ width: 6, height: 6, borderRadius: 9, background: 'var(--mgh-warning-400)' }} />
          )}
          <Icon name={open ? 'expand_less' : 'expand_more'} size={16} color="var(--mgh-nav-section)" />
        </span>
      </button>
      {open && section.items.map(it => (
        <NavItem key={it.key} it={it} active={active} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

export default function Sidebar({
  brand = 'My Global Hub',
  product = 'Enterprise Payroll',
  logoSrc,
  entity,
  sections = [],
  active,
  onNavigate,
  status,
  user,
  onLogout,
  style,
}) {
  const { Icon, Badge, Avatar } = getDS();
  const [stored, setStored] = useState(readStored);

  const activeLabel = (sections.find(s => s.items.some(it => itemHasKey(it, active))) || {}).label;
  const isOpen = (s, idx) => {
    if (s.label === activeLabel) return true; // never hide the screen you are on
    if (Object.prototype.hasOwnProperty.call(stored, s.label)) return Boolean(stored[s.label]);
    return idx === 0;
  };
  const toggle = (s, idx) => {
    const next = { ...stored, [s.label]: !isOpen(s, idx) };
    setStored(next);
    writeStored(next);
  };

  return (
    <aside style={{
      width: 288, flexShrink: 0, height: '100%', background: 'var(--surface-nav)', boxShadow: 'var(--shadow-nav)',
      display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)', ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 20px 14px' }}>
        {logoSrc && (
          <span style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: `rgba(255,255,255,.1) url(${logoSrc}) center/100% no-repeat`,
          }} />
        )}
        <div>
          <div style={{ font: '600 16px/16px var(--font-sans)', letterSpacing: '-0.4px', color: '#FAF8FF' }}>{brand}</div>
          <div style={{
            marginTop: 4, font: '700 11px/14px var(--font-sans)', letterSpacing: '0.55px',
            textTransform: 'uppercase', color: 'var(--mgh-nav-section)',
          }}>{product}</div>
        </div>
      </div>

      {entity && (
        <div style={{
          margin: '0 14px 14px', padding: 8, borderRadius: 12, background: 'var(--surface-nav-panel)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              font: '700 11px/14px var(--font-sans)', letterSpacing: '0.55px',
              textTransform: 'uppercase', color: 'var(--mgh-nav-section)',
            }}>{entity.label || 'Región de Operación'}</div>
            <div style={{ font: '600 13px/18px var(--font-sans)', color: '#FAF8FF', ...ellipsis }}>{entity.name}</div>
            <div style={{ font: '400 13px/16px var(--font-sans)', color: 'var(--mgh-nav-text)' }}>{entity.sub}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            {entity.tag && <Badge tone="onDarkSuccess" size="sm">{entity.tag}</Badge>}
            <Icon name="unfold_more" size={16} color="var(--mgh-nav-section)" />
          </div>
        </div>
      )}

      <nav className="mgh-scroll-dark" style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,.2) transparent', padding: '0 14px 14px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {sections.map((s, idx) => (
          <NavSection
            key={s.label}
            section={s}
            open={isOpen(s, idx)}
            onToggle={() => toggle(s, idx)}
            active={active}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {status && (
        <div style={{
          margin: '0 14px', padding: '6px 8px', borderRadius: 8, background: 'var(--surface-nav-panel)',
          display: 'flex', justifyContent: 'space-between', font: '600 11px/14px var(--font-sans)', color: '#FAF8FF',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 9, background: 'var(--mgh-success-300)' }} />
            {status.label}
          </span>
          <span style={{ color: 'var(--mgh-nav-text)' }}>{status.value}</span>
        </div>
      )}

      {user && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px',
          borderTop: '1px solid rgba(255,255,255,.08)', marginTop: 10,
        }}>
          <Avatar src={user.avatar} name={user.name} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '600 14px/18px var(--font-sans)', color: '#FAF8FF' }}>{user.name}</div>
            <div style={{ font: '400 12px/16px var(--font-sans)', color: 'var(--mgh-nav-section)' }}>{user.role}</div>
          </div>
          <Icon name="tune" size={16} color="var(--mgh-nav-text)" style={{ cursor: 'pointer' }}
            title="Configuración" onClick={() => onNavigate && onNavigate('settings')} />
          <Icon name="logout" size={16} color="var(--mgh-nav-text)" style={{ cursor: 'pointer' }}
            title="Cerrar sesión" onClick={() => onLogout && onLogout()} />
        </div>
      )}
    </aside>
  );
}
