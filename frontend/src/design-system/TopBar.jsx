import React, { useState, useRef, useEffect } from 'react';

function getDS() {
  return (typeof window !== 'undefined' && window.MyGlobalHubDesignSystem_2a603d) || {};
}

function MenuItem({ icon, title, description, onClick, danger = false, rightBadge = null }) {
  const [hovered, setHovered] = useState(false);
  const DS = getDS();
  const Icon = DS.Icon;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 8,
        cursor: 'pointer',
        background: hovered
          ? danger
            ? 'rgba(186, 26, 26, 0.08)'
            : 'var(--mgh-surface-1)'
          : 'transparent',
        transition: 'background 120ms ease, color 120ms ease',
        outline: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: danger
            ? 'rgba(186, 26, 26, 0.12)'
            : hovered
            ? 'var(--mgh-primary-50)'
            : 'var(--mgh-surface-2)',
          color: danger ? 'var(--mgh-danger)' : 'var(--mgh-primary)',
          transition: 'all 120ms ease',
        }}
      >
        {Icon ? (
          <Icon
            name={icon}
            size={18}
            color={danger ? 'var(--mgh-danger)' : hovered ? 'var(--mgh-primary)' : 'var(--mgh-primary)'}
          />
        ) : (
          <span style={{ fontSize: 16 }}>•</span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              font: '600 13px/18px var(--font-sans)',
              color: danger ? 'var(--mgh-danger)' : 'var(--mgh-ink)',
            }}
          >
            {title}
          </span>
          {rightBadge && (
            <span
              style={{
                font: '700 9px/12px var(--font-sans)',
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
                padding: '1px 5px',
                borderRadius: 4,
                background: 'var(--mgh-primary-50)',
                color: 'var(--mgh-primary)',
              }}
            >
              {rightBadge}
            </span>
          )}
        </div>
        {description && (
          <span
            style={{
              font: '400 11px/15px var(--font-sans)',
              color: 'var(--mgh-ink-3)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {description}
          </span>
        )}
      </div>

      {Icon && (
        <Icon
          name="chevron_right"
          size={16}
          color={hovered ? (danger ? 'var(--mgh-danger)' : 'var(--mgh-ink)') : 'var(--mgh-ink-4)'}
          style={{
            transform: hovered ? 'translateX(2px)' : 'none',
            transition: 'transform 120ms ease, color 120ms ease',
          }}
        />
      )}
    </div>
  );
}

export default function TopBar({
  search,
  onSearch,
  placeholder = 'Search employee ID, Jira issue, pay period, department...',
  period,
  actions,
  notifications,
  onNotificationsClick,
  avatar,
  userName,
  userEmail,
  userRole,
  userEntity,
  empId,
  currentUser,
  onLogout,
  onNavigate,
  onOpenRoleModal,
  onOpenLangMenu,
  style,
}) {
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [w, setW] = useState(1200);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect) {
        setW(entry.contentRect.width);
      }
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const compact = w < 1040;
  const tight = w < 760;

  const DS = getDS();
  const Icon = DS.Icon;
  const IconButton = DS.IconButton;
  const Button = DS.Button;
  const Avatar = DS.Avatar;
  const SearchField = DS.SearchField;

  // Resolve user identity details with fallbacks
  const rbacMe = (typeof window !== 'undefined' && window.MGH_RBAC && window.MGH_RBAC.me) ? window.MGH_RBAC.me() : null;
  const rbacOrg = (typeof window !== 'undefined' && window.MGH_RBAC && window.MGH_RBAC.orgSettings) ? window.MGH_RBAC.orgSettings() : null;

  const resolvedName = userName || (currentUser && currentUser.name) || (rbacMe && rbacMe.person) || 'Usuario';
  const resolvedEmail = userEmail || (currentUser && currentUser.email) || (rbacMe && rbacMe.email) || '';
  const resolvedRole = userRole || (currentUser && currentUser.role ? currentUser.role.toUpperCase() : '') || (rbacMe && rbacMe.title) || (typeof window !== 'undefined' && window.MGH_RBAC ? window.MGH_RBAC.role : 'Colaborador');
  const resolvedEntity = userEntity || (currentUser && currentUser.entity) || (rbacOrg && rbacOrg.short) || 'MGH Dominicana SRL';
  let resolvedAvatar = avatar || (currentUser && currentUser.avatar) || (rbacMe && rbacMe.avatar) || null;
  if (resolvedAvatar && typeof resolvedAvatar === 'string' && (resolvedAvatar.includes('assets/avatars/person-') || resolvedAvatar.includes('carlos-mendez'))) {
    resolvedAvatar = null;
  }
  const resolvedEmpId = empId || (rbacMe && rbacMe.emp) || (currentUser && (currentUser.employeeId || currentUser.employee_id)) || null;

  const handleNav = (targetRoute, param) => {
    setMenuOpen(false);
    if (onNavigate) {
      onNavigate(targetRoute, param);
    } else if (typeof window !== 'undefined' && window.__mghNavigate) {
      window.__mghNavigate(targetRoute, param);
    } else if (typeof window !== 'undefined') {
      window.location.hash = '#' + targetRoute + (param ? '/' + param : '');
    }
  };

  const handleLogoutAction = () => {
    setMenuOpen(false);
    if (onLogout) {
      onLogout();
    } else if (typeof window !== 'undefined' && window.__mghLogout) {
      window.__mghLogout();
    }
  };

  const handleRoleAction = () => {
    setMenuOpen(false);
    if (onOpenRoleModal) {
      onOpenRoleModal();
    } else if (typeof window !== 'undefined' && window.__mghOpenRoleModal) {
      window.__mghOpenRoleModal();
    }
  };

  const handleLangAction = () => {
    setMenuOpen(false);
    if (onOpenLangMenu) {
      onOpenLangMenu();
    } else if (typeof window !== 'undefined' && window.__mghOpenLangMenu) {
      window.__mghOpenLangMenu();
    }
  };

  const renderActions = () => {
    if (!actions) return null;
    if (Array.isArray(actions)) {
      return actions.map((a, i) =>
        compact ? (
          IconButton ? (
            <IconButton
              key={i}
              icon={a.icon}
              title={a.label}
              tone={a.variant === 'dark' ? 'default' : 'tinted'}
              onClick={a.onClick}
              style={
                a.variant === 'dark'
                  ? { background: 'var(--mgh-navy)', color: '#fff' }
                  : undefined
              }
            />
          ) : null
        ) : Button ? (
          <Button
            key={i}
            variant={a.variant || 'secondary'}
            icon={a.icon}
            onClick={a.onClick}
          >
            {a.label}
          </Button>
        ) : null
      );
    }
    return actions;
  };

  return (
    <header
      ref={ref}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 8 : 14,
        padding: '0 20px',
        background: 'rgba(255,255,255,.94)',
        backdropFilter: 'blur(24px)',
        boxShadow: 'var(--shadow-header)',
        borderBottom: '1px solid var(--mgh-surface-2)',
        ...style,
      }}
    >
      {/* Search field */}
      {SearchField ? (
        <SearchField
          value={search}
          onChange={onSearch}
          placeholder={placeholder}
          shortcut={tight ? undefined : '⌘K'}
          style={{
            flex: '1 1 220px',
            minWidth: 160,
            maxWidth: 576,
          }}
        />
      ) : (
        <div style={{ flex: '1 1 220px' }} />
      )}

      {/* Pay period status pill */}
      {period && (
        <div
          title={`${period.code} ${period.range} — ${period.phase}`}
          style={{
            height: 44,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 14px',
            borderRadius: 8,
            background: 'var(--mgh-surface-1)',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {Icon && <Icon name="event_available" size={16} color="var(--mgh-primary)" />}
          <div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
              <span
                style={{
                  font: '600 16px/22px var(--font-sans)',
                  letterSpacing: '-0.08px',
                  color: 'var(--mgh-ink)',
                }}
              >
                {period.code}
              </span>
              {!compact && (
                <span
                  style={{
                    font: '400 13px var(--font-sans)',
                    color: 'var(--mgh-ink-2)',
                  }}
                >
                  {period.range}
                </span>
              )}
            </div>
            {!tight && (
              <div
                style={{
                  font: '700 11px/14px var(--font-sans)',
                  letterSpacing: '0.44px',
                  textTransform: 'uppercase',
                  color: 'var(--mgh-accent)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: compact ? 120 : 260,
                }}
              >
                {period.phase}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spacer */}
      <span style={{ flex: '1 0 0' }} />

      {/* Top Bar Actions */}
      {actions && (
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
          {renderActions()}
        </div>
      )}

      {/* Vertical divider */}
      <span
        style={{
          width: 1,
          height: 28,
          background: 'var(--mgh-surface-3)',
          flexShrink: 0,
        }}
      />

      {/* Notifications bell button */}
      {IconButton && (
        <IconButton
          icon="notifications"
          badge={notifications}
          title="Notificaciones y alertas"
          onClick={onNotificationsClick}
        />
      )}

      {/* Help button */}
      {!tight && IconButton && (
        <IconButton
          icon="help"
          title="Ayuda y documentación"
          onClick={() => {
            if (typeof window !== 'undefined' && window.alert) {
              window.alert('My Global Hub Enterprise Payroll & Timekeeping v1.0.0\nSoporte corporativo: help@myglobalhub.com');
            }
          }}
        />
      )}

      {/* USER PROFILE & ACCOUNT TRIGGER (Interactive) */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="Perfil de usuario y opciones de cuenta"
          title={`${resolvedName} (${resolvedRole}) • Mi cuenta`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 8px 3px 3px',
            borderRadius: 24,
            border: menuOpen ? '1px solid var(--mgh-primary)' : '1px solid transparent',
            background: menuOpen ? 'var(--mgh-primary-50)' : 'transparent',
            cursor: 'pointer',
            outline: 'none',
            transition: 'all 140ms ease',
          }}
          onMouseEnter={(e) => {
            if (!menuOpen) {
              e.currentTarget.style.background = 'var(--mgh-surface-1)';
              e.currentTarget.style.borderColor = 'var(--mgh-surface-3)';
            }
          }}
          onMouseLeave={(e) => {
            if (!menuOpen) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
            }
          }}
        >
          <div style={{ position: 'relative', width: 36, height: 36 }}>
            {Avatar ? (
              <Avatar src={resolvedAvatar} name={resolvedName} size={36} />
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9999,
                  background: 'var(--mgh-navy)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {resolvedName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 9,
                height: 9,
                borderRadius: 9999,
                background: 'var(--mgh-success)',
                border: '1.5px solid #fff',
                boxShadow: '0 0 2px rgba(0,0,0,0.25)',
              }}
              title="Sesión activa"
            />
          </div>

          {Icon && (
            <Icon
              name="expand_more"
              size={18}
              color={menuOpen ? 'var(--mgh-primary)' : 'var(--mgh-ink-3)'}
              style={{
                transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 180ms cubic-bezier(0.2, 0, 0, 1)',
              }}
            />
          )}
        </button>

        {/* POPUP DROPDOWN MENU */}
        {menuOpen && (
          <>
            {/* Click-outside backdrop */}
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 998 }}
              onClick={() => setMenuOpen(false)}
            />

            {/* Menu Panel */}
            <div
              ref={menuRef}
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                zIndex: 999,
                width: 330,
                maxWidth: 'calc(100vw - 32px)',
                background: '#FFFFFF',
                borderRadius: 14,
                boxShadow:
                  '0 18px 40px -8px rgba(19,42,82,0.22), 0 4px 14px rgba(19,42,82,0.08), 0 0 0 1px rgba(19,42,82,0.08)',
                border: '1px solid var(--mgh-surface-2)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header: User Profile Info */}
              <div
                style={{
                  padding: '16px 16px 14px',
                  background: 'linear-gradient(180deg, var(--mgh-surface-1) 0%, #FFFFFF 100%)',
                  borderBottom: '1px solid var(--mgh-surface-2)',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {Avatar ? (
                    <Avatar src={resolvedAvatar} name={resolvedName} size={46} />
                  ) : (
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 9999,
                        background: 'var(--mgh-navy)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 16,
                      }}
                    >
                      {resolvedName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 1,
                      right: 1,
                      width: 10,
                      height: 10,
                      borderRadius: 9999,
                      background: 'var(--mgh-success)',
                      border: '2px solid #fff',
                    }}
                  />
                </div>

                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <div
                    style={{
                      font: '700 14px/18px var(--font-sans)',
                      color: 'var(--mgh-ink)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={resolvedName}
                  >
                    {resolvedName}
                  </div>
                  <div
                    style={{
                      font: '400 12px/16px var(--font-sans)',
                      color: 'var(--mgh-ink-3)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={resolvedEmail}
                  >
                    {resolvedEmail}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 4,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        font: '700 10px/14px var(--font-sans)',
                        letterSpacing: '0.4px',
                        textTransform: 'uppercase',
                        background: 'var(--mgh-primary-50)',
                        color: 'var(--mgh-primary)',
                        padding: '2px 8px',
                        borderRadius: 4,
                        border: '1px solid var(--mgh-primary-100)',
                      }}
                    >
                      {resolvedRole}
                    </span>
                    <span
                      style={{
                        font: '600 10px/14px var(--font-sans)',
                        color: 'var(--mgh-ink-2)',
                        background: 'var(--mgh-surface-2)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 120,
                      }}
                      title={resolvedEntity}
                    >
                      {resolvedEntity}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 1: Mi Perfil y Espacio */}
              <div
                style={{
                  padding: '8px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <div
                  style={{
                    padding: '4px 10px 2px',
                    font: '700 10px/14px var(--font-sans)',
                    letterSpacing: '0.6px',
                    textTransform: 'uppercase',
                    color: 'var(--mgh-ink-3)',
                  }}
                >
                  Mi Perfil y Nómina
                </div>

                <MenuItem
                  icon="badge"
                  title="Mi Perfil de Colaborador"
                  description="Datos laborales, contrato y cuentas"
                  rightBadge={resolvedEmpId}
                  onClick={() => handleNav('profile', resolvedEmpId)}
                />

                <MenuItem
                  icon="schedule"
                  title="Mis Horas y Actividades"
                  description="Marcajes diarios y sincronización Jira"
                  onClick={() => handleNav('mytime')}
                />

                <MenuItem
                  icon="receipt_long"
                  title="Mis Recibos de Nómina"
                  description="Comprobantes fiscales y pagos emitidos"
                  onClick={() => handleNav('paystub', resolvedEmpId)}
                />
              </div>

              {/* Section 2: Preferencias y Simulación */}
              <div
                style={{
                  padding: '8px 6px',
                  borderTop: '1px solid var(--mgh-surface-2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <div
                  style={{
                    padding: '4px 10px 2px',
                    font: '700 10px/14px var(--font-sans)',
                    letterSpacing: '0.6px',
                    textTransform: 'uppercase',
                    color: 'var(--mgh-ink-3)',
                  }}
                >
                  Configuración y Sistema
                </div>

                <MenuItem
                  icon="language"
                  title="Idioma de la Plataforma"
                  description={`Activo: ${(typeof window !== 'undefined' && window.MGH_I18N && window.MGH_I18N.lang ? window.MGH_I18N.lang : 'es').toUpperCase() === 'ES' ? 'Español (Dominicana)' : 'English (US)'}`}
                  onClick={handleLangAction}
                />
              </div>

              {/* Section 3: Logout */}
              <div
                style={{
                  padding: '8px 6px',
                  borderTop: '1px solid var(--mgh-surface-2)',
                  background: 'var(--mgh-surface-page)',
                }}
              >
                <MenuItem
                  icon="logout"
                  title="Cerrar Sesión"
                  description="Finalizar sesión segura en My Global Hub"
                  danger
                  onClick={handleLogoutAction}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
