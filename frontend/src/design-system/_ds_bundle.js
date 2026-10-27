/* @ds-bundle: {"format":4,"namespace":"MyGlobalHubDesignSystem_2a603d","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"ActivityFeed","sourcePath":"components/data/ActivityFeed.jsx"},{"name":"DataTable","sourcePath":"components/data/DataTable.jsx"},{"name":"KeyValue","sourcePath":"components/data/KeyValue.jsx"},{"name":"MetricTile","sourcePath":"components/data/MetricTile.jsx"},{"name":"Pagination","sourcePath":"components/data/Pagination.jsx"},{"name":"ProgressBar","sourcePath":"components/data/ProgressBar.jsx"},{"name":"StatCard","sourcePath":"components/data/StatCard.jsx"},{"name":"Stepper","sourcePath":"components/data/Stepper.jsx"},{"name":"TableToolbar","sourcePath":"components/data/TableToolbar.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"FilterChips","sourcePath":"components/forms/FilterChips.jsx"},{"name":"SearchField","sourcePath":"components/forms/SearchField.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"TextField","sourcePath":"components/forms/TextField.jsx"},{"name":"Toggle","sourcePath":"components/forms/Toggle.jsx"},{"name":"PageHeader","sourcePath":"components/navigation/PageHeader.jsx"},{"name":"Sidebar","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"TopBar","sourcePath":"components/navigation/TopBar.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"8f3bf256eba5","components/core/Badge.jsx":"cbc9d8f43ca2","components/core/Button.jsx":"6f548ffaa2c5","components/core/Card.jsx":"03bd983f1cf2","components/core/Icon.jsx":"1c26df8ba4e5","components/core/IconButton.jsx":"c7e09a0eaa25","components/data/ActivityFeed.jsx":"0c6e18938f53","components/data/DataTable.jsx":"161bb746e19e","components/data/KeyValue.jsx":"fb5515fe18d8","components/data/MetricTile.jsx":"f964c5ba6680","components/data/Pagination.jsx":"4169518468c6","components/data/ProgressBar.jsx":"d67249da0a9a","components/data/StatCard.jsx":"335f15fd5147","components/data/Stepper.jsx":"2d5e8597fbd6","components/data/TableToolbar.jsx":"b74806e1d4d3","components/forms/Checkbox.jsx":"597a082a6d98","components/forms/FilterChips.jsx":"804edf01510f","components/forms/SearchField.jsx":"3df0ea759803","components/forms/Select.jsx":"341fda700632","components/forms/TextField.jsx":"40521a61e152","components/forms/Toggle.jsx":"6af66bb77fde","components/navigation/PageHeader.jsx":"77741c946c3f","components/navigation/Sidebar.jsx":"24f22a0ec3a9","components/navigation/Tabs.jsx":"48c88b3b26de","components/navigation/TopBar.jsx":"e7b7d11a9ed7","ui_kits/enterprise/ScreensApprovals.jsx":"14047a717f04","ui_kits/enterprise/ScreensOps.jsx":"5669372f4bc1","ui_kits/enterprise/ScreensPayroll.jsx":"bb387fec5616","ui_kits/enterprise/ScreensPeople.jsx":"6cf0c840218d","ui_kits/enterprise/Shell.jsx":"31c59ceb9808","ui_kits/enterprise/data.jsx":"549a1baa5d77"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.MyGlobalHubDesignSystem_2a603d = window.MyGlobalHubDesignSystem_2a603d || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
const P = [['#1A73E8', '#fff'], ['#D93025', '#fff'], ['#188038', '#fff'], ['#E37400', '#fff'], ['#9334E6', '#fff'], ['#12A4AF', '#fff'], ['#C2185B', '#fff'], ['#5F6368', '#fff'], ['#E8710A', '#fff'], ['#3F51B5', '#fff']];
function Avatar({
  src,
  name = '',
  size = 40,
  status,
  ring,
  style
}) {
  const clean = String(name || '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  const initials = (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || '?')[0]).toUpperCase();
  let h = 0;
  for (let i = 0; i < clean.length; i++) h = (h * 31 + clean.charCodeAt(i)) >>> 0;
  const [bg, fg] = P[h % P.length];
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => { setBroken(false); }, [src]);
  const isDummy = typeof src === 'string' && (src.includes('assets/avatars/person-') || src.includes('carlos-mendez'));
  const showImg = !!src && !broken && !isDummy;
  const sc = {
    online: 'var(--mgh-success)',
    away: 'var(--mgh-warning-400)',
    offline: 'var(--mgh-ink-4)'
  }[status];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      width: size,
      height: size,
      flexShrink: 0,
      display: 'inline-block',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      borderRadius: 9999,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: showImg ? 'transparent' : bg,
      color: fg,
      fontFamily: 'var(--font-sans)',
      fontWeight: 500,
      fontSize: Math.round(size * 0.42),
      lineHeight: 1,
      userSelect: 'none',
      boxShadow: ring ? '0 0 0 2px #fff' : 'none'
    }
  }, showImg ? /*#__PURE__*/React.createElement("img", {
    src,
    alt: clean,
    onError: () => setBroken(true),
    style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }
  }) : initials), sc && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: Math.max(8, size * 0.26),
      height: Math.max(8, size * 0.26),
      borderRadius: 9999,
      background: sc,
      boxShadow: '0 0 0 2px #fff'
    }
  }));
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Icon({
  name,
  size = 16,
  color,
  weight = 600,
  fill = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    "aria-hidden": "true"
  }, rest, {
    style: {
      fontFamily: 'var(--font-icon)',
      fontWeight: weight,
      fontSize: size,
      lineHeight: 1,
      width: size,
      height: size,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      overflow: 'hidden',
      fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}`,
      color: color || 'currentColor',
      letterSpacing: 'normal',
      userSelect: 'none',
      ...style
    }
  }), name);
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
const T = {
  success: ['var(--mgh-success-bg)', 'var(--mgh-success)'],
  warning: ['var(--mgh-warning-bg)', 'var(--mgh-warning)'],
  danger: ['var(--mgh-danger-bg)', 'var(--mgh-danger)'],
  info: ['var(--mgh-accent-50)', 'var(--mgh-accent-hover)'],
  primary: ['var(--mgh-primary-50)', 'var(--mgh-primary)'],
  neutral: ['var(--mgh-surface-2)', 'var(--mgh-ink-2)'],
  dark: ['var(--mgh-navy)', '#fff'],
  onDarkSuccess: ['rgba(113,219,166,.2)', 'var(--mgh-success-200)'],
  onDarkWarning: ['rgba(255,185,81,.25)', 'var(--mgh-warning-200)']
};
function Badge({
  tone = 'neutral',
  dot,
  icon,
  mono,
  uppercase,
  size = 'md',
  children,
  style
}) {
  const [bg, fg] = T[tone] || T.neutral;
  const sm = size === 'sm';
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      height: sm ? 18 : 22,
      padding: sm ? '2px 6px' : '2px 8px',
      borderRadius: mono ? 4 : 9999,
      background: bg,
      color: fg,
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      fontWeight: 700,
      fontSize: sm ? 10 : 11,
      lineHeight: '14px',
      letterSpacing: mono ? '0.2px' : '0.44px',
      textTransform: uppercase ? 'uppercase' : 'none',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 9999,
      background: 'currentColor'
    }
  }), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 12
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
const V = {
  primary: {
    bg: 'var(--mgh-primary)',
    fg: '#fff',
    hover: 'var(--mgh-primary-hover)'
  },
  dark: {
    bg: 'var(--mgh-navy)',
    fg: '#fff',
    hover: 'var(--mgh-navy-900)'
  },
  secondary: {
    bg: 'var(--mgh-surface-2)',
    fg: 'var(--mgh-ink)',
    hover: 'var(--mgh-surface-3)'
  },
  outline: {
    bg: '#fff',
    fg: 'var(--mgh-ink)',
    hover: 'var(--mgh-surface-1)',
    border: 'inset 0 0 0 1px var(--mgh-surface-3)'
  },
  ghost: {
    bg: 'transparent',
    fg: 'var(--mgh-primary)',
    hover: 'var(--mgh-primary-50)'
  },
  success: {
    bg: 'var(--mgh-success)',
    fg: '#fff',
    hover: 'var(--mgh-success-700)'
  },
  danger: {
    bg: 'var(--mgh-danger-bg)',
    fg: 'var(--mgh-danger)',
    hover: '#FFC9C2'
  }
};
const S = {
  sm: {
    h: 32,
    px: 12,
    fs: 13,
    ic: 16,
    r: 8
  },
  md: {
    h: 40,
    px: 14,
    fs: 14,
    ic: 16,
    r: 8
  },
  lg: {
    h: 48,
    px: 20,
    fs: 16,
    ic: 18,
    r: 12
  }
};
function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  children,
  disabled,
  fullWidth,
  onClick,
  type = 'button',
  style,
  title
}) {
  const v = V[variant] || V.primary,
    s = S[size] || S.md;
  const [h, setH] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    type: type,
    title: title,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      height: s.h,
      padding: `0 ${s.px}px`,
      borderRadius: s.r,
      border: 'none',
      background: h && !disabled ? v.hover : v.bg,
      color: v.fg,
      boxShadow: [v.border, variant === 'ghost' ? null : 'var(--shadow-xs)'].filter(Boolean).join(',') || 'none',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      fontFamily: 'var(--font-sans)',
      fontWeight: 600,
      fontSize: s.fs,
      letterSpacing: '-0.08px',
      whiteSpace: 'nowrap',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .45 : 1,
      width: fullWidth ? '100%' : undefined,
      transition: 'background 120ms var(--ease-standard)',
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: s.ic
  }), children, iconRight && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: s.ic
  }));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function Card({
  title,
  subtitle,
  icon,
  actions,
  padding = 20,
  tone = 'default',
  children,
  style,
  bodyStyle
}) {
  const bg = tone === 'muted' ? 'var(--mgh-surface-1)' : tone === 'dark' ? 'var(--mgh-navy)' : '#fff';
  const dark = tone === 'dark';
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: bg,
      borderRadius: 12,
      boxShadow: tone === 'muted' ? 'none' : 'var(--shadow-xs)',
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      ...style
    }
  }, (title || actions) && /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 14,
      padding: `${padding}px ${padding}px 0`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'flex-start',
      minWidth: 0
    }
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 18,
    color: dark ? 'var(--mgh-nav-text)' : 'var(--mgh-primary)',
    style: {
      marginTop: 3
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      font: '600 18px/24px var(--font-sans)',
      letterSpacing: '-0.18px',
      color: dark ? '#fff' : 'var(--mgh-ink)'
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '2px 0 0',
      font: '400 13px/18px var(--font-sans)',
      color: dark ? 'var(--mgh-nav-text)' : 'var(--mgh-ink-3)',
      textWrap: 'pretty'
    }
  }, subtitle))), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      flexShrink: 0
    }
  }, actions)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding,
      flex: 1,
      minWidth: 0,
      ...bodyStyle
    }
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function IconButton({
  icon,
  size = 36,
  tone = 'default',
  badge,
  title,
  onClick,
  active,
  style
}) {
  const [h, setH] = React.useState(false);
  const bg = tone === 'tinted' ? 'var(--mgh-surface-2)' : tone === 'danger' ? 'var(--mgh-danger-bg)' : h || active ? 'var(--mgh-surface-1)' : 'transparent';
  const fg = tone === 'danger' ? 'var(--mgh-danger)' : active ? 'var(--mgh-primary)' : 'var(--mgh-ink-2)';
  return /*#__PURE__*/React.createElement("button", {
    title: title,
    "aria-label": title,
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      position: 'relative',
      width: size,
      height: size,
      borderRadius: 8,
      border: 'none',
      background: bg,
      color: fg,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0,
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size >= 40 ? 18 : 16
  }), badge != null && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 2,
      right: 2,
      minWidth: 16,
      height: 16,
      padding: '0 4px',
      borderRadius: 9999,
      background: 'var(--mgh-danger)',
      color: '#fff',
      font: '700 10px/16px var(--font-sans)',
      textAlign: 'center',
      boxShadow: '0 0 0 2px #fff'
    }
  }, badge));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/data/ActivityFeed.jsx
try { (() => {
const T = {
  success: ['var(--mgh-success-bg)', 'var(--mgh-success)'],
  primary: ['var(--mgh-primary-50)', 'var(--mgh-primary)'],
  accent: ['var(--mgh-accent-50)', 'var(--mgh-accent)'],
  warning: ['var(--mgh-warning-bg)', 'var(--mgh-warning)'],
  danger: ['var(--mgh-danger-bg)', 'var(--mgh-danger)'],
  neutral: ['var(--mgh-surface-2)', 'var(--mgh-ink-2)']
};
function ActivityFeed({
  items = [],
  connector = true,
  style
}) {
  return /*#__PURE__*/React.createElement("ol", {
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      ...style
    }
  }, items.map((it, i) => {
    const [bg, fg] = T[it.tone] || T.neutral;
    return /*#__PURE__*/React.createElement("li", {
      key: i,
      style: {
        display: 'flex',
        gap: 12,
        position: 'relative',
        paddingBottom: i === items.length - 1 ? 0 : 16
      }
    }, connector && i < items.length - 1 && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        left: 15,
        top: 34,
        bottom: 2,
        width: 2,
        background: 'var(--mgh-surface-2)'
      }
    }), it.avatar || it.person ? /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
      src: it.avatar,
      name: it.person,
      size: 32
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        width: 32,
        height: 32,
        borderRadius: 9999,
        background: bg,
        color: fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: it.icon || 'history',
      size: 16
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1,
        paddingTop: 2
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: '600 13px/18px var(--font-sans)',
        color: 'var(--mgh-ink)'
      }
    }, it.title), it.time && /*#__PURE__*/React.createElement("span", {
      style: {
        font: '500 11px/18px var(--font-sans)',
        color: 'var(--mgh-ink-3)',
        whiteSpace: 'nowrap'
      }
    }, it.time)), it.meta && /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 13px/18px var(--font-sans)',
        color: 'var(--mgh-ink-3)'
      }
    }, it.meta), it.body && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 6,
        padding: '10px 12px',
        borderRadius: 8,
        background: 'var(--mgh-surface-1)',
        font: '400 13px/20px var(--font-sans)',
        color: 'var(--mgh-ink-2)',
        textWrap: 'pretty'
      }
    }, it.body)));
  }));
}
Object.assign(__ds_scope, { ActivityFeed });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ActivityFeed.jsx", error: String((e && e.message) || e) }); }

// components/data/KeyValue.jsx
try { (() => {
function KeyValue({
  label,
  value,
  aside,
  mono,
  tone = 'muted',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '10px 12px',
      borderRadius: 8,
      background: tone === 'muted' ? 'var(--mgh-surface-1)' : '#fff',
      minWidth: 0,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 11px/14px var(--font-sans)',
      letterSpacing: '0.55px',
      textTransform: 'uppercase',
      color: 'var(--mgh-ink-2)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2,
      font: `600 ${mono ? '13px/20px var(--font-mono)' : '16px/22px var(--font-sans)'}`,
      letterSpacing: mono ? 0 : '-0.08px',
      color: 'var(--mgh-ink)',
      overflowWrap: 'anywhere'
    }
  }, value)), aside && /*#__PURE__*/React.createElement("div", {
    style: {
      flexShrink: 0
    }
  }, aside));
}
Object.assign(__ds_scope, { KeyValue });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/KeyValue.jsx", error: String((e && e.message) || e) }); }

// components/data/MetricTile.jsx
try { (() => {
const T = {
  default: ['var(--mgh-surface-1)', 'var(--mgh-ink)', 'var(--mgh-ink-2)'],
  success: ['var(--mgh-success-bg)', 'var(--mgh-success)', 'var(--mgh-success)'],
  warning: ['var(--mgh-warning-bg)', 'var(--mgh-warning)', 'var(--mgh-warning)'],
  danger: ['var(--mgh-danger-bg)', 'var(--mgh-danger)', 'var(--mgh-danger)'],
  dark: ['var(--mgh-navy)', '#fff', 'var(--mgh-nav-text)'],
  white: ['#fff', 'var(--mgh-ink)', 'var(--mgh-ink-2)']
};
function MetricTile({
  label,
  value,
  sub,
  tone = 'default',
  align = 'left',
  style
}) {
  const [bg, fg, lc] = T[tone] || T.default;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: bg,
      borderRadius: 8,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      textAlign: align,
      minWidth: 0,
      boxShadow: tone === 'white' ? 'var(--shadow-xs)' : 'none',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 11px/14px var(--font-sans)',
      letterSpacing: '0.55px',
      textTransform: 'uppercase',
      color: lc
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 22px/28px var(--font-sans)',
      letterSpacing: '-0.44px',
      color: fg,
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, value), sub && /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 11px/14px var(--font-sans)',
      color: lc
    }
  }, sub));
}
Object.assign(__ds_scope, { MetricTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/MetricTile.jsx", error: String((e && e.message) || e) }); }

// components/data/Pagination.jsx
try { (() => {
function Pagination({
  page = 1,
  pageSize = 10,
  total = 0,
  onPage,
  noun = 'records',
  style
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0,
    to = Math.min(total, page * pageSize);
  const nums = [];
  for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);else if (nums[nums.length - 1] !== '…') nums.push('…');
  const btn = (on, dis) => ({
    minWidth: 32,
    height: 32,
    padding: '0 8px',
    borderRadius: 8,
    border: 'none',
    cursor: dis ? 'default' : 'pointer',
    background: on ? 'var(--mgh-navy)' : 'transparent',
    color: on ? '#fff' : dis ? 'var(--mgh-ink-4)' : 'var(--mgh-ink)',
    font: '600 13px var(--font-sans)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
      flexWrap: 'wrap',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 13px/18px var(--font-sans)',
      color: 'var(--mgh-ink-2)'
    }
  }, "Showing ", from, "\u2013", to, " of ", total.toLocaleString(), " ", noun), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: btn(false, page <= 1),
    disabled: page <= 1,
    onClick: () => onPage && onPage(page - 1),
    "aria-label": "Previous"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron_left",
    size: 18
  })), nums.map((n, i) => n === '…' ? /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      ...btn(false, true),
      cursor: 'default'
    }
  }, "\u2026") : /*#__PURE__*/React.createElement("button", {
    key: i,
    style: btn(n === page),
    onClick: () => onPage && onPage(n)
  }, n)), /*#__PURE__*/React.createElement("button", {
    style: btn(false, page >= pages),
    disabled: page >= pages,
    onClick: () => onPage && onPage(page + 1),
    "aria-label": "Next"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron_right",
    size: 18
  }))));
}
Object.assign(__ds_scope, { Pagination });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Pagination.jsx", error: String((e && e.message) || e) }); }

// components/data/ProgressBar.jsx
try { (() => {
function ProgressBar({
  value = 0,
  segments,
  tone = 'primary',
  height = 6,
  label,
  valueLabel,
  style
}) {
  const c = {
    primary: 'var(--mgh-primary)',
    accent: 'var(--mgh-accent)',
    success: 'var(--mgh-success)',
    warning: 'var(--mgh-warning-400)',
    danger: 'var(--mgh-danger)'
  }[tone];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...style
    }
  }, (label || valueLabel) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      font: '700 11px/14px var(--font-sans)',
      letterSpacing: '0.44px',
      color: 'var(--mgh-ink-2)'
    }
  }, /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement("span", {
    style: {
      color: c
    }
  }, valueLabel)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height,
      borderRadius: 9999,
      background: 'var(--mgh-surface-2)',
      overflow: 'hidden',
      gap: segments ? 2 : 0
    }
  }, segments ? segments.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    title: s.label,
    style: {
      width: s.value + '%',
      background: s.color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      font: '700 10px/1 var(--font-sans)',
      whiteSpace: 'nowrap',
      overflow: 'hidden'
    }
  }, height >= 14 ? s.label : null)) : /*#__PURE__*/React.createElement("div", {
    style: {
      width: Math.min(100, value) + '%',
      background: c,
      borderRadius: 9999,
      transition: 'width 300ms var(--ease-standard)'
    }
  })));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/data/StatCard.jsx
try { (() => {
const IC = {
  primary: ['var(--mgh-primary-50)', 'var(--mgh-primary)'],
  accent: ['var(--mgh-accent-50)', 'var(--mgh-accent)'],
  success: ['var(--mgh-success-bg)', 'var(--mgh-success)'],
  danger: ['var(--mgh-danger-bg)', 'var(--mgh-danger)'],
  warning: ['var(--mgh-warning-bg)', 'var(--mgh-warning)']
};
function StatCard({
  label,
  value,
  unit,
  icon,
  tone = 'primary',
  footer,
  progress,
  delta,
  deltaTone = 'success',
  style
}) {
  const [ib, ic] = IC[tone] || IC.primary;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 12,
      boxShadow: 'var(--shadow-xs)',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: 14,
      minWidth: 0,
      minHeight: 155,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 8,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 11px/14px var(--font-sans)',
      letterSpacing: '0.55px',
      textTransform: 'uppercase',
      color: tone === 'danger' ? 'var(--mgh-danger)' : 'var(--mgh-ink-2)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 4,
      marginTop: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '800 36px/36px var(--font-sans)',
      letterSpacing: '-1.08px',
      color: tone === 'danger' ? 'var(--mgh-danger)' : 'var(--mgh-ink)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, value), unit && /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 16px/22px var(--font-sans)',
      color: 'var(--mgh-ink-2)'
    }
  }, unit)), delta && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2,
      font: '700 11px/14px var(--font-sans)',
      color: deltaTone === 'danger' ? 'var(--mgh-danger)' : 'var(--mgh-success)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: deltaTone === 'danger' ? 'trending_down' : 'trending_up',
    size: 14
  }), delta)), icon && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 8,
      background: ib,
      color: ic,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 18
  }))), progress != null && /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      borderRadius: 9999,
      background: 'var(--mgh-surface-2)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: progress + '%',
      height: '100%',
      background: 'var(--mgh-primary)',
      borderRadius: 9999
    }
  })), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px/18px var(--font-sans)',
      color: 'var(--mgh-ink-2)',
      display: 'flex',
      justifyContent: 'space-between',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, footer));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/data/Stepper.jsx
try { (() => {
function Stepper({
  steps = [],
  style
}) {
  return /*#__PURE__*/React.createElement("ol", {
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'grid',
      gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))`,
      ...style
    }
  }, steps.map((s, i) => {
    const done = s.state === 'done',
      cur = s.state === 'current';
    const next = steps[i + 1];
    return /*#__PURE__*/React.createElement("li", {
      key: i,
      style: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 6
      }
    }, next && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: 15,
        left: '50%',
        width: '100%',
        height: 2,
        background: done ? 'var(--mgh-success)' : 'var(--mgh-surface-3)'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'relative',
        width: 32,
        height: 32,
        borderRadius: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: done ? 'var(--mgh-success)' : cur ? 'var(--mgh-primary)' : 'var(--mgh-surface-1)',
        color: done || cur ? '#fff' : 'var(--mgh-ink-4)',
        boxShadow: cur ? '0 0 0 4px var(--mgh-primary-100)' : 'none'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: done ? 'check' : s.icon || 'radio_button_unchecked',
      size: 16,
      weight: 700
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        font: `${done || cur ? 700 : 500} 13px/16px var(--font-sans)`,
        color: done || cur ? 'var(--mgh-ink)' : 'var(--mgh-ink-3)'
      }
    }, s.label), s.status && /*#__PURE__*/React.createElement("span", {
      style: {
        font: '600 11px/14px var(--font-sans)',
        padding: cur ? '1px 6px' : 0,
        borderRadius: 4,
        background: cur ? 'var(--mgh-warning-400)' : 'none',
        color: done ? 'var(--mgh-success)' : cur ? 'var(--mgh-ink)' : 'var(--mgh-ink-3)'
      }
    }, s.status), s.meta && /*#__PURE__*/React.createElement("span", {
      style: {
        font: '400 11px/14px var(--font-sans)',
        color: 'var(--mgh-ink-3)'
      }
    }, s.meta));
  }));
}
Object.assign(__ds_scope, { Stepper });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Stepper.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
  disabled,
  style
}) {
  const on = checked || indeterminate;
  return /*#__PURE__*/React.createElement("label", {
    onClick: e => e.stopPropagation(),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? .5 : 1,
      font: '600 13px/18px var(--font-sans)',
      color: 'var(--mgh-ink)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!checked,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.checked),
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 16,
      height: 16,
      borderRadius: 4,
      flexShrink: 0,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: on ? 'var(--mgh-primary)' : '#fff',
      boxShadow: on ? 'none' : 'inset 0 0 0 1px rgb(118,118,118)',
      color: '#fff',
      transition: 'background 120ms'
    }
  }, on && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: indeterminate ? 'remove' : 'check',
    size: 14,
    weight: 700
  })), label);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/data/DataTable.jsx
try { (() => {
function DataTable({
  columns = [],
  rows = [],
  rowKey = 'id',
  selectable,
  selected = [],
  onSelectedChange,
  sort,
  onSort,
  maxHeight,
  density = 'comfortable',
  onRowClick,
  activeRow,
  bulkBar,
  emptyText = 'No records match these filters.',
  style
}) {
  const pad = density === 'compact' ? '8px 14px' : '14px 14px';
  const ids = rows.map(r => r[rowKey]);
  const all = ids.length > 0 && ids.every(i => selected.includes(i)),
    some = !all && ids.some(i => selected.includes(i));
  const toggle = id => onSelectedChange && onSelectedChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  const th = {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    background: 'var(--mgh-surface-1)',
    padding: '10px 14px',
    font: '700 11px/14px var(--font-sans)',
    letterSpacing: '0.55px',
    textTransform: 'uppercase',
    color: 'var(--mgh-ink-2)',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--mgh-surface-3)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      borderRadius: 12,
      background: '#fff',
      minWidth: 0,
      ...style
    }
  }, bulkBar && selected.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 4,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '8px 14px',
      background: 'var(--mgh-navy)',
      color: '#fff',
      borderRadius: '12px 12px 0 0',
      font: '600 13px var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("span", null, selected.length, " selected"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), bulkBar, /*#__PURE__*/React.createElement("button", {
    onClick: () => onSelectedChange([]),
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--mgh-nav-text)',
      cursor: 'pointer',
      font: '600 13px var(--font-sans)'
    }
  }, "Clear")), /*#__PURE__*/React.createElement("div", {
    className: "mgh-scroll",
    style: {
      overflow: 'auto',
      maxHeight,
      borderRadius: 12
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'separate',
      borderSpacing: 0,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, selectable && /*#__PURE__*/React.createElement("th", {
    style: {
      ...th,
      width: 44,
      paddingRight: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Checkbox, {
    checked: all,
    indeterminate: some,
    onChange: () => onSelectedChange && onSelectedChange(all ? [] : ids)
  })), columns.map(c => {
    const s = sort && sort.key === c.key ? sort.dir : null;
    return /*#__PURE__*/React.createElement("th", {
      key: c.key,
      style: {
        ...th,
        textAlign: c.align || 'left',
        width: c.width,
        cursor: c.sortable ? 'pointer' : 'default',
        color: s ? 'var(--mgh-primary)' : th.color
      },
      onClick: () => c.sortable && onSort && onSort({
        key: c.key,
        dir: s === 'asc' ? 'desc' : 'asc'
      })
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        flexDirection: c.align === 'right' ? 'row-reverse' : 'row'
      }
    }, c.label, c.sortable && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: s === 'asc' ? 'arrow_upward' : s === 'desc' ? 'arrow_downward' : 'unfold_more',
      size: 14,
      color: s ? 'var(--mgh-primary)' : 'var(--mgh-ink-4)'
    })));
  }))), /*#__PURE__*/React.createElement("tbody", null, rows.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: columns.length + (selectable ? 1 : 0),
    style: {
      padding: 48,
      textAlign: 'center',
      font: '500 13px var(--font-sans)',
      color: 'var(--mgh-ink-3)'
    }
  }, emptyText)), rows.map((r, ri) => {
    const id = r[rowKey],
      sel = selected.includes(id),
      act = activeRow === id;
    return /*#__PURE__*/React.createElement("tr", {
      key: id,
      onClick: () => onRowClick && onRowClick(r),
      style: {
        cursor: onRowClick ? 'pointer' : 'default',
        background: sel || act ? 'var(--mgh-primary-50)' : '#fff'
      },
      onMouseEnter: e => {
        if (!sel && !act) e.currentTarget.style.background = 'var(--mgh-surface-page)';
      },
      onMouseLeave: e => {
        e.currentTarget.style.background = sel || act ? 'var(--mgh-primary-50)' : '#fff';
      }
    }, selectable && /*#__PURE__*/React.createElement("td", {
      style: {
        padding: pad,
        paddingRight: 0,
        borderBottom: '1px solid var(--mgh-surface-2)'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Checkbox, {
      checked: sel,
      onChange: () => toggle(id)
    })), columns.map(c => /*#__PURE__*/React.createElement("td", {
      key: c.key,
      style: {
        padding: pad,
        textAlign: c.align || 'left',
        borderBottom: ri === rows.length - 1 ? 'none' : '1px solid var(--mgh-surface-2)',
        font: `${c.weight || 400} 13px/18px ${c.mono ? 'var(--font-mono)' : 'var(--font-sans)'}`,
        color: c.strong ? 'var(--mgh-ink)' : 'var(--mgh-ink-2)',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: c.wrap ? 'normal' : 'nowrap',
        verticalAlign: 'middle'
      }
    }, c.render ? c.render(r) : r[c.key])));
  })))));
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/forms/FilterChips.jsx
try { (() => {
function FilterChips({
  options = [],
  value,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      ...style
    }
  }, options.map(o => {
    const on = o.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o.value,
      role: "tab",
      "aria-selected": on,
      onClick: () => onChange && onChange(o.value),
      style: {
        height: 26,
        padding: '0 10px',
        borderRadius: 9999,
        border: 'none',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: on ? 'var(--mgh-navy)' : 'var(--mgh-surface-1)',
        color: on ? '#fff' : 'var(--mgh-ink)',
        font: '600 13px/18px var(--font-sans)',
        whiteSpace: 'nowrap',
        transition: 'background 120ms'
      }
    }, o.label, o.count != null && /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        borderRadius: 9999,
        font: '700 11px/18px var(--font-sans)',
        background: on ? 'rgba(255,255,255,.2)' : o.tone === 'danger' ? 'var(--mgh-danger-bg)' : o.tone === 'warning' ? 'var(--mgh-warning-400)' : 'var(--mgh-surface-3)',
        color: on ? '#fff' : o.tone === 'danger' ? 'var(--mgh-danger)' : 'var(--mgh-ink)'
      }
    }, o.count));
  }));
}
Object.assign(__ds_scope, { FilterChips });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/FilterChips.jsx", error: String((e && e.message) || e) }); }

// components/forms/SearchField.jsx
try { (() => {
function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  shortcut,
  width,
  height = 34,
  style
}) {
  const [f, setF] = React.useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      height,
      width,
      minWidth: 0,
      borderRadius: 8,
      background: f ? '#fff' : 'rgba(242,243,255,.7)',
      boxShadow: f ? 'inset 0 0 0 1px var(--mgh-primary), var(--ring-focus)' : 'none',
      transition: 'box-shadow 120ms',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "search",
    size: 16,
    color: "var(--mgh-ink-3)",
    style: {
      position: 'absolute',
      left: 14
    }
  }), /*#__PURE__*/React.createElement("input", {
    value: value,
    onChange: e => onChange && onChange(e.target.value),
    placeholder: placeholder,
    onFocus: () => setF(true),
    onBlur: () => setF(false),
    style: {
      flex: 1,
      minWidth: 0,
      height: '100%',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      padding: `0 ${shortcut ? 48 : 14}px 0 40px`,
      font: '400 13px/16px var(--font-sans)',
      letterSpacing: '0.065px',
      color: 'var(--mgh-ink)'
    }
  }), shortcut && /*#__PURE__*/React.createElement("kbd", {
    style: {
      position: 'absolute',
      right: 8,
      padding: '2px 4px',
      borderRadius: 4,
      background: 'var(--mgh-surface-2)',
      font: '700 11px/14px var(--font-sans)',
      letterSpacing: '0.44px',
      color: 'var(--mgh-ink-4)'
    }
  }, shortcut));
}
Object.assign(__ds_scope, { SearchField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SearchField.jsx", error: String((e && e.message) || e) }); }

// components/data/TableToolbar.jsx
try { (() => {
function TableToolbar({
  search,
  onSearch,
  placeholder = 'Search…',
  filters,
  actions,
  chips,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.SearchField, {
    value: search,
    onChange: onSearch,
    placeholder: placeholder,
    style: {
      flex: '1 1 240px',
      maxWidth: 360
    }
  }), filters && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      alignItems: 'flex-end'
    }
  }, filters), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, actions)), chips);
}
Object.assign(__ds_scope, { TableToolbar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/TableToolbar.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function Select({
  label,
  value,
  options = [],
  onChange,
  icon,
  size = 'md',
  style
}) {
  const h = size === 'sm' ? 32 : 40;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 0,
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 11px/14px var(--font-sans)',
      letterSpacing: '0.55px',
      textTransform: 'uppercase',
      color: 'var(--mgh-ink-2)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      height: h,
      borderRadius: 8,
      background: '#fff',
      boxShadow: 'inset 0 0 0 1px var(--mgh-surface-3)'
    }
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16,
    color: "var(--mgh-ink-3)",
    style: {
      position: 'absolute',
      left: 10,
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: e => onChange && onChange(e.target.value),
    style: {
      appearance: 'none',
      flex: 1,
      height: '100%',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      padding: `0 32px 0 ${icon ? 32 : 12}px`,
      font: '600 13px var(--font-sans)',
      color: 'var(--mgh-ink)',
      cursor: 'pointer'
    }
  }, options.map(o => typeof o === 'string' ? /*#__PURE__*/React.createElement("option", {
    key: o
  }, o) : /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "expand_more",
    size: 16,
    color: "var(--mgh-ink-3)",
    style: {
      position: 'absolute',
      right: 10,
      pointerEvents: 'none'
    }
  })));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/TextField.jsx
try { (() => {
function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  prefix,
  suffix,
  mono,
  type = 'text',
  readOnly,
  style
}) {
  const [f, setF] = React.useState(false);
  const ring = error ? 'inset 0 0 0 1px var(--mgh-danger)' : f ? 'inset 0 0 0 1px var(--mgh-primary), var(--ring-focus)' : 'inset 0 0 0 1px var(--mgh-surface-3)';
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 0,
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 11px/14px var(--font-sans)',
      letterSpacing: '0.55px',
      textTransform: 'uppercase',
      color: 'var(--mgh-ink-2)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 40,
      padding: '0 12px',
      borderRadius: 8,
      background: readOnly ? 'var(--mgh-surface-1)' : '#fff',
      boxShadow: ring,
      transition: 'box-shadow 120ms'
    }
  }, prefix && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--mgh-ink-3)',
      font: '500 13px var(--font-sans)'
    }
  }, prefix), /*#__PURE__*/React.createElement("input", {
    type: type,
    value: value,
    readOnly: readOnly,
    placeholder: placeholder,
    onChange: e => onChange && onChange(e.target.value),
    onFocus: () => setF(true),
    onBlur: () => setF(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      font: `500 13px/18px ${mono ? 'var(--font-mono)' : 'var(--font-sans)'}`,
      color: 'var(--mgh-ink)'
    }
  }), suffix && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--mgh-ink-3)',
      font: '500 13px var(--font-sans)'
    }
  }, suffix)), (hint || error) && /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 11px/14px var(--font-sans)',
      color: error ? 'var(--mgh-danger)' : 'var(--mgh-ink-3)'
    }
  }, error || hint));
}
Object.assign(__ds_scope, { TextField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TextField.jsx", error: String((e && e.message) || e) }); }

// components/forms/Toggle.jsx
try { (() => {
function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  style
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? .5 : 1,
      ...style
    }
  }, (label || description) && /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: '600 14px/20px var(--font-sans)',
      color: 'var(--mgh-ink)'
    }
  }, label), description && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: '400 13px/18px var(--font-sans)',
      color: 'var(--mgh-ink-3)'
    }
  }, description)), /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!checked,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.checked),
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 44,
      height: 24,
      borderRadius: 9999,
      flexShrink: 0,
      background: checked ? 'var(--mgh-primary)' : 'var(--mgh-ink-4)',
      position: 'relative',
      transition: 'background 200ms var(--ease-standard)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 3,
      left: checked ? 23 : 3,
      width: 18,
      height: 18,
      borderRadius: 9999,
      background: '#fff',
      boxShadow: 'var(--shadow-xs)',
      transition: 'left 200ms var(--ease-standard)'
    }
  })));
}
Object.assign(__ds_scope, { Toggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Toggle.jsx", error: String((e && e.message) || e) }); }

// components/navigation/PageHeader.jsx
try { (() => {
function PageHeader({
  breadcrumbs = [],
  title,
  description,
  status,
  actions,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 20,
      flexWrap: 'wrap',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, breadcrumbs.length > 0 && /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: 6,
      font: '700 11px/14px var(--font-sans)',
      letterSpacing: '0.55px',
      textTransform: 'uppercase',
      color: 'var(--mgh-ink-3)'
    }
  }, breadcrumbs.map((b, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("span", null, "/"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: i === breadcrumbs.length - 1 ? 'var(--mgh-ink)' : undefined
    }
  }, b)))), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      font: '700 28px/36px var(--font-sans)',
      letterSpacing: '-0.7px',
      color: 'var(--mgh-ink)'
    }
  }, title), description && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: '400 14px/20px var(--font-sans)',
      color: 'var(--mgh-ink-2)',
      maxWidth: 720,
      textWrap: 'pretty'
    }
  }, description), status && /*#__PURE__*/React.createElement("div", null, status)), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, actions));
}
Object.assign(__ds_scope, { PageHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/PageHeader.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Sidebar.jsx
try { (() => {
function ChildNavItem({
  it,
  active,
  onNavigate
}) {
  const [h, setH] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: () => onNavigate && onNavigate(it.key),
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      width: '100%',
      height: 34,
      borderRadius: 6,
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      padding: '6px 8px',
      background: active ? 'var(--surface-nav-active)' : h ? 'var(--surface-nav-hover)' : 'transparent',
      color: active ? 'var(--mgh-nav-active-text)' : 'var(--mgh-nav-text)',
      textAlign: 'left',
      transition: 'background 120ms'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: it.icon || 'arrow_right',
    size: 14
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: `${active ? 600 : 400} 13px/18px var(--font-sans)`,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, it.label)), it.badge && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: it.badgeTone || 'onDarkWarning',
    size: "sm"
  }, it.badge));
}

function NavItem({
  it,
  active,
  onNavigate
}) {
  const [h, setH] = React.useState(false);
  const hasChildren = Boolean(it.children && it.children.length);
  const isChildActive = Boolean(hasChildren && it.children.some(c => c.key === active));
  const isSelfActive = active === it.key;
  const isAnyActive = isSelfActive || isChildActive;
  const [open, setOpen] = React.useState(isChildActive);

  React.useEffect(() => {
    if (isChildActive) setOpen(true);
  }, [isChildActive]);

  if (hasChildren) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        width: '100%'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: e => {
        e.preventDefault();
        setOpen(o => !o);
      },
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: {
        width: '100%',
        height: 40,
        borderRadius: 8,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '8px',
        background: isAnyActive ? 'rgba(255,255,255,0.06)' : h ? 'var(--surface-nav-hover)' : 'transparent',
        color: isAnyActive ? '#FAF8FF' : 'var(--mgh-nav-text)',
        textAlign: 'left',
        transition: 'background 120ms'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: it.icon,
      size: 16
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: `${isAnyActive ? 600 : 400} 14px/20px var(--font-sans)`,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, it.label)), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }
    }, it.badge && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
      tone: it.badgeTone || 'onDarkWarning',
      size: "sm"
    }, it.badge), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: open ? "expand_less" : "expand_more",
      size: 16,
      color: "var(--mgh-nav-section)"
    }))), open && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        paddingLeft: 10,
        borderLeft: '1px solid rgba(255,255,255,0.12)',
        marginLeft: 16,
        marginTop: 2,
        marginBottom: 2
      }
    }, it.children.map(child => /*#__PURE__*/React.createElement(ChildNavItem, {
      key: child.key,
      it: child,
      active: active === child.key,
      onNavigate: onNavigate
    }))));
  }

  return /*#__PURE__*/React.createElement("button", {
    onClick: () => onNavigate && onNavigate(it.key),
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      width: '100%',
      height: 40,
      borderRadius: 8,
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: '8px',
      background: active ? 'var(--surface-nav-active)' : h ? 'var(--surface-nav-hover)' : 'transparent',
      color: active ? 'var(--mgh-nav-active-text)' : 'var(--mgh-nav-text)',
      textAlign: 'left',
      transition: 'background 120ms'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: it.icon,
    size: 16
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: `${active ? 600 : 400} 14px/20px var(--font-sans)`,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, it.label)), it.badge && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: it.badgeTone || 'onDarkWarning',
    size: "sm"
  }, it.badge));
}
function Sidebar({
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
  style
}) {
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 288,
      flexShrink: 0,
      height: '100%',
      background: 'var(--surface-nav)',
      boxShadow: 'var(--shadow-nav)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '20px 20px 14px'
    }
  }, logoSrc && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 8,
      background: `rgba(255,255,255,.1) url(${logoSrc}) center/100% no-repeat`,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 16px/16px var(--font-sans)',
      letterSpacing: '-0.4px',
      color: '#FAF8FF'
    }
  }, brand), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      font: '700 11px/14px var(--font-sans)',
      letterSpacing: '0.55px',
      textTransform: 'uppercase',
      color: 'var(--mgh-nav-section)'
    }
  }, product))), entity && /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '0 14px 14px',
      padding: 8,
      borderRadius: 12,
      background: 'var(--surface-nav-panel)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 11px/14px var(--font-sans)',
      letterSpacing: '0.55px',
      textTransform: 'uppercase',
      color: 'var(--mgh-nav-section)'
    }
  }, (entity && entity.label) || "Región de Operación"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px/18px var(--font-sans)',
      color: '#FAF8FF',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, entity.name), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px/16px var(--font-sans)',
      color: 'var(--mgh-nav-text)'
    }
  }, entity.sub)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 2
    }
  }, entity.tag && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "onDarkSuccess",
    size: "sm"
  }, entity.tag), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "unfold_more",
    size: 16,
    color: "var(--mgh-nav-section)"
  }))), /*#__PURE__*/React.createElement("nav", {
    className: "mgh-scroll-dark",
    style: {
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(255,255,255,.2) transparent',
      padding: '0 14px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, sections.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.label,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 8px 4px',
      font: '700 11px/14px var(--font-sans)',
      letterSpacing: '0.55px',
      textTransform: 'uppercase',
      color: 'var(--mgh-nav-section)'
    }
  }, s.label), s.items.map(it => /*#__PURE__*/React.createElement(NavItem, {
    key: it.key,
    it: it,
    active: active === it.key,
    onNavigate: onNavigate
  }))))), status && /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '0 14px',
      padding: '6px 8px',
      borderRadius: 8,
      background: 'var(--surface-nav-panel)',
      display: 'flex',
      justifyContent: 'space-between',
      font: '600 11px/14px var(--font-sans)',
      color: '#FAF8FF'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 9,
      background: 'var(--mgh-success-300)'
    }
  }), status.label), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--mgh-nav-text)'
    }
  }, status.value)), user && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '14px 20px',
      borderTop: '1px solid rgba(255,255,255,.08)',
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    src: user.avatar,
    name: user.name,
    size: 36
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px/18px var(--font-sans)',
      color: '#FAF8FF'
    }
  }, user.name), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px/16px var(--font-sans)',
      color: 'var(--mgh-nav-section)'
    }
  }, user.role)), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "tune",
    size: 16,
    color: "var(--mgh-nav-text)",
    style: { cursor: 'pointer' },
    title: "Configuración",
    onClick: () => onNavigate && onNavigate('settings')
  }), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "logout",
    size: 16,
    color: "var(--mgh-nav-text)",
    style: { cursor: 'pointer' },
    title: "Cerrar sesión",
    onClick: () => onLogout && onLogout()
  })));
}
Object.assign(__ds_scope, { Sidebar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Sidebar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  tabs = [],
  value,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    className: "mgh-scroll",
    style: {
      display: 'flex',
      gap: 4,
      padding: 4,
      borderRadius: 12,
      background: 'var(--mgh-surface-1)',
      overflowX: 'auto',
      ...style
    }
  }, tabs.map(t => {
    const on = t.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: t.value,
      role: "tab",
      "aria-selected": on,
      onClick: () => onChange && onChange(t.value),
      style: {
        height: 36,
        padding: '0 16px',
        borderRadius: 8,
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: on ? '#fff' : 'transparent',
        boxShadow: on ? 'var(--shadow-xs)' : 'none',
        font: `${on ? 700 : 500} 14px/20px var(--font-sans)`,
        color: on ? 'var(--mgh-ink)' : 'var(--mgh-ink-2)',
        transition: 'background 120ms'
      }
    }, t.label, t.dot && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: 9,
        background: 'var(--mgh-success)'
      }
    }), t.tag && /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 10px/14px var(--font-sans)',
        letterSpacing: '0.44px',
        padding: '1px 5px',
        borderRadius: 4,
        background: 'var(--mgh-surface-3)',
        color: 'var(--mgh-ink)'
      }
    }, t.tag));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TopBar.jsx
try { (() => {
function TopBar({
  search,
  onSearch,
  placeholder = 'Search employee ID, Jira issue, pay period, department...',
  period,
  actions,
  notifications,
  avatar,
  userName,
  style
}) {
  const ref = React.useRef(null);
  const [w, setW] = React.useState(1200);
  React.useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const compact = w < 1040,
    tight = w < 760;
  const renderActions = () => Array.isArray(actions) ? actions.map((a, i) => compact ? /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    key: i,
    icon: a.icon,
    title: a.label,
    tone: a.variant === 'dark' ? 'default' : 'tinted',
    onClick: a.onClick,
    style: a.variant === 'dark' ? {
      background: 'var(--mgh-navy)',
      color: '#fff'
    } : undefined
  }) : /*#__PURE__*/React.createElement(__ds_scope.Button, {
    key: i,
    variant: a.variant || 'secondary',
    icon: a.icon,
    onClick: a.onClick
  }, a.label)) : actions;
  return /*#__PURE__*/React.createElement("header", {
    ref: ref,
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 20,
      height: 64,
      display: 'flex',
      alignItems: 'center',
      gap: compact ? 8 : 14,
      padding: '0 20px',
      background: 'rgba(255,255,255,.9)',
      backdropFilter: 'blur(24px)',
      boxShadow: 'var(--shadow-header)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.SearchField, {
    value: search,
    onChange: onSearch,
    placeholder: placeholder,
    shortcut: tight ? undefined : '⌘K',
    style: {
      flex: '1 1 220px',
      minWidth: 160,
      maxWidth: 576
    }
  }), period && /*#__PURE__*/React.createElement("div", {
    title: `${period.code} ${period.range} — ${period.phase}`,
    style: {
      height: 44,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 14px',
      borderRadius: 8,
      background: 'var(--mgh-surface-1)',
      flexShrink: 0,
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "event_available",
    size: 16,
    color: "var(--mgh-primary)"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 16px/22px var(--font-sans)',
      letterSpacing: '-0.08px',
      color: 'var(--mgh-ink)'
    }
  }, period.code), !compact && /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 13px var(--font-sans)',
      color: 'var(--mgh-ink-2)'
    }
  }, period.range)), !tight && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 11px/14px var(--font-sans)',
      letterSpacing: '0.44px',
      textTransform: 'uppercase',
      color: 'var(--mgh-accent)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: compact ? 120 : 260
    }
  }, period.phase))), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: '1 0 0'
    }
  }), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexShrink: 0
    }
  }, renderActions()), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 28,
      background: 'var(--mgh-surface-3)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "notifications",
    badge: notifications,
    title: "Notifications"
  }), !tight && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "help",
    title: "Help"
  }), /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    src: avatar,
    name: userName,
    size: 36
  }));
}
Object.assign(__ds_scope, { TopBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TopBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/enterprise/ScreensApprovals.jsx
try { (() => {
const {
  Button,
  IconButton,
  Badge,
  Avatar,
  Icon,
  Card,
  Checkbox,
  FilterChips,
  SearchField,
  StatCard,
  MetricTile,
  DataTable,
  TableToolbar,
  Pagination,
  Stepper,
  ActivityFeed,
  Tabs,
  PageHeader,
  Select,
  ProgressBar
} = window.MyGlobalHubDesignSystem_2a603d;
function QueueCard({
  e,
  active,
  checked,
  onCheck,
  onClick
}) {
  const tone = STATUS_TONE[e.status];
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      cursor: 'pointer',
      borderRadius: 12,
      padding: 14,
      background: active ? 'var(--mgh-primary-50)' : '#fff',
      boxShadow: active ? 'inset 3px 0 0 var(--mgh-primary), var(--shadow-md)' : 'var(--shadow-xs)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      transition: 'box-shadow 120ms'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(Checkbox, {
    checked: checked,
    onChange: onCheck,
    style: {
      marginTop: 12
    }
  }), /*#__PURE__*/React.createElement(Avatar, {
    src: e.avatar,
    name: e.name,
    size: 40,
    status: e.avatar ? 'online' : undefined
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 14px/20px var(--font-sans)',
      color: 'var(--mgh-ink)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, e.name), /*#__PURE__*/React.createElement(Badge, {
    mono: true,
    size: "sm",
    tone: "neutral"
  }, e.id)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px/16px var(--font-sans)',
      color: 'var(--mgh-ink-3)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, e.role, " \u2022 ", e.dept)), /*#__PURE__*/React.createElement(Badge, {
    size: "sm",
    dot: true,
    tone: e.match >= 98 ? 'success' : 'warning'
  }, e.match, "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      background: active ? '#fff' : 'var(--mgh-surface-1)',
      borderRadius: 8,
      padding: '6px 4px',
      textAlign: 'center'
    }
  }, [['Reg', e.reg], ['OT', e.ot, e.ot > 8 ? 'var(--mgh-danger)' : e.ot ? 'var(--mgh-warning)' : null], ['PTO', e.pto, e.pto ? 'var(--mgh-success)' : null], ['Total', e.total]].map(([l, v, c]) => /*#__PURE__*/React.createElement("div", {
    key: l
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 11px/14px var(--font-sans)',
      color: c || 'var(--mgh-ink-3)'
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 13px/18px var(--font-sans)',
      color: c || 'var(--mgh-ink)'
    }
  }, v.toFixed(1), "h")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    size: "sm",
    tone: tone,
    icon: tone === 'danger' ? 'warning' : tone === 'success' ? 'task_alt' : 'hourglass_top'
  }, e.status), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 12px var(--font-sans)',
      color: 'var(--mgh-ink)'
    }
  }, fmt$(e.gross), " Est.")));
}
function SectionHead({
  icon,
  title,
  sub,
  right
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, icon && /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 18,
    color: "var(--mgh-primary)",
    style: {
      marginTop: 3
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mgh-h3"
  }, title), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px/18px var(--font-sans)',
      color: 'var(--mgh-ink-3)'
    }
  }, sub))), right);
}
function ApprovalWorkspace({
  notify,
  empId
}) {
  const [list, setList] = React.useState(() => EMPLOYEES.filter(e => e.status !== 'Approved').map(e => ({
    ...e
  })));
  const [cur, setCur] = React.useState(list.find(e => e.id === empId) ? empId : list[0].id);
  const [filter, setFilter] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState([]);
  const [week, setWeek] = React.useState('all');
  const [sign, setSign] = React.useState(true);
  const [ret, setRet] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [comments, setComments] = React.useState([{
    person: 'Marcus Vance',
    title: 'Supervisor Note • Marcus Vance',
    time: 'Apr 15, 09:32 AM',
    body: '"Overtime (6.5 hrs total) pre-approved for Sprint 24 release deadline and Redis server failover patch. All logged Jira tickets checked out against git commit SHAs."'
  }]);
  const e = list.find(x => x.id === cur) || list[0];
  const days = React.useMemo(() => buildDays(e), [e.id]);
  const shown = days.filter(d => week === 'all' || d.week === +week);
  const filtered = list.filter(x => (filter === 'all' || filter === 'ot' && x.ot > 0 || filter === 'jira' && x.match < 95 || filter === 'ready' && ['Ready', 'Approved'].includes(x.status)) && (!q || (x.name + x.id + x.project).toLowerCase().includes(q.toLowerCase())));
  const jiraTotal = days.reduce((s, d) => s + d.jira, 0),
    clockTotal = days.reduce((s, d) => s + d.hrs, 0);
  const setStatus = (id, s) => setList(l => l.map(x => x.id === id ? {
    ...x,
    status: s
  } : x));
  const next = () => {
    const i = filtered.findIndex(x => x.id === e.id);
    const n = filtered[(i + 1) % filtered.length];
    if (n) setCur(n.id);
  };
  const approve = adv => {
    setStatus(e.id, 'Approved');
    notify(`${e.name} approved • routed to HR Review`);
    if (adv) next();
  };
  const steps = [{
    label: 'Employee',
    state: 'done',
    status: 'Submitted',
    meta: 'Apr 14, 17:00'
  }, {
    label: 'Supervisor',
    state: 'done',
    status: 'Approved',
    meta: 'M. Vance'
  }, {
    label: 'Project Mgr',
    state: e.status === 'Approved' ? 'done' : 'current',
    icon: 'approval',
    status: e.status === 'Approved' ? 'Approved' : 'Current Step',
    meta: 'E. Rostova'
  }, {
    label: 'HR Review',
    icon: 'badge',
    status: 'Pending',
    meta: 'Queue #3'
  }, {
    label: 'Finance Run',
    icon: 'receipt_long',
    status: 'Pending',
    meta: 'Auto-Audit'
  }, {
    label: 'Lock / Batch',
    icon: 'lock',
    status: 'Locked',
    meta: 'Disbursement'
  }];
  const otPay = e.ot * e.rate * 1.5,
    regPay = e.reg * e.rate,
    ptoPay = e.pto * e.rate;
  const ded = [['ISR withholding', e.gross * 0.15], ['TSS — SFS (3.04%)', e.gross * 0.0304], ['TSS — AFP (2.87%)', e.gross * 0.0287]];
  const net = e.gross - ded.reduce((s, d) => s + d[1], 0);
  const files = [['Overtime_Authorization_PP08.pdf', '218 KB', 'picture_as_pdf'], ['Redis_Failover_Incident_Report.pdf', '1.2 MB', 'picture_as_pdf'], ['Sprint24_Commit_Log.csv', '46 KB', 'table_view']];
  return /*#__PURE__*/React.createElement(Page, null, /*#__PURE__*/React.createElement(PageHeader, {
    breadcrumbs: ['Workforce', 'Approvals', 'Pay Period 2025-08'],
    title: "Bi-Weekly Approval Workspace",
    status: /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      dot: true
    }, "PP-2025-08 (Apr 01 - Apr 14, 2025) \u2022 Awaiting Supervisor Approval"),
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 12,
        background: '#fff',
        boxShadow: 'var(--shadow-xs)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "cloud_sync",
      size: 18,
      color: "var(--mgh-accent)"
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "mgh-label",
      style: {
        color: 'var(--mgh-ink-2)'
      }
    }, "Jira Cloud Sync"), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '600 13px/18px var(--font-sans)',
        color: 'var(--mgh-ink)'
      }
    }, "Active \u2022 Synced 2m ago"))), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: "tune"
    }, "Approval Policy"))
  }), /*#__PURE__*/React.createElement(Grid, {
    min: 220
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Pending Approvals",
    value: list.filter(x => x.status !== 'Approved').length,
    unit: "/ 86 Employees",
    icon: "how_to_reg",
    progress: 84,
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--mgh-primary)'
      }
    }, "84% On-Track"), /*#__PURE__*/React.createElement("span", null, "72 Processed"))
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Total Hours Under Review",
    value: "1,128.5",
    unit: "hrs",
    icon: "schedule",
    tone: "accent",
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", null, "Reg: 1,040h"), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--mgh-warning)'
      }
    }, "OT: 88.5h"))
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Estimated Payroll Obligation",
    value: "$48,920",
    unit: "USD",
    icon: "payments",
    tone: "success",
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--mgh-success)'
      }
    }, "Billable Jira: 91.4%"), /*#__PURE__*/React.createElement("span", null, "$44,712.80"))
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Jira Sync Discrepancies",
    value: list.filter(x => x.match < 95).length,
    unit: "Flagged",
    icon: "warning",
    tone: "danger",
    footer: /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--mgh-danger)'
      }
    }, "Needs supervisor review")
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 340,
      flexShrink: 0,
      position: 'sticky',
      top: 84,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      background: 'var(--mgh-surface-page)',
      borderRadius: 16,
      padding: 14,
      maxHeight: 'calc(100vh - 104px)'
    }
  }, /*#__PURE__*/React.createElement(SearchField, {
    value: q,
    onChange: setQ,
    placeholder: "Search team member, ID, or Jira task...",
    style: {
      background: '#fff'
    }
  }), /*#__PURE__*/React.createElement(FilterChips, {
    value: filter,
    onChange: setFilter,
    options: [{
      value: 'all',
      label: 'All',
      count: list.length
    }, {
      value: 'ot',
      label: 'Overtime',
      count: list.filter(x => x.ot).length,
      tone: 'warning'
    }, {
      value: 'jira',
      label: 'Jira Mismatch',
      count: list.filter(x => x.match < 95).length,
      tone: 'danger'
    }, {
      value: 'ready',
      label: 'Ready'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '6px 8px',
      background: '#fff',
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement(Checkbox, {
    checked: sel.length === filtered.length && sel.length > 0,
    indeterminate: sel.length > 0 && sel.length < filtered.length,
    onChange: () => setSel(sel.length === filtered.length ? [] : filtered.map(x => x.id)),
    label: `Select All (${filtered.length})`
  }), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    icon: "done_all",
    disabled: !sel.length,
    onClick: () => {
      sel.forEach(id => setStatus(id, 'Approved'));
      notify(`${sel.length} timesheets bulk-approved`);
      setSel([]);
    }
  }, "Bulk Approve")), /*#__PURE__*/React.createElement("div", {
    className: "mgh-scroll",
    style: {
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      padding: 2,
      margin: -2
    }
  }, filtered.map(x => /*#__PURE__*/React.createElement(QueueCard, {
    key: x.id,
    e: x,
    active: x.id === e.id,
    checked: sel.includes(x.id),
    onCheck: () => setSel(s => s.includes(x.id) ? s.filter(i => i !== x.id) : [...s, x.id]),
    onClick: () => setCur(x.id)
  })), !filtered.length && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 28,
      textAlign: 'center',
      font: '500 13px var(--font-sans)',
      color: 'var(--mgh-ink-3)'
    }
  }, "No employees match.")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 12px var(--font-sans)',
      color: 'var(--mgh-ink-2)',
      padding: '0 4px'
    }
  }, "Showing ", filtered.length, " of ", list.length, " employees")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      background: 'var(--mgh-surface-page)',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: 'var(--shadow-xs)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      padding: 24,
      display: 'flex',
      gap: 20,
      alignItems: 'flex-start',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    src: e.avatar,
    name: e.name,
    size: 72,
    status: "online"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 260
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mgh-h2"
  }, e.name), /*#__PURE__*/React.createElement(Badge, {
    tone: "dark",
    mono: true
  }, e.id), /*#__PURE__*/React.createElement(Badge, {
    tone: STATUS_TONE[e.status],
    dot: true
  }, e.status)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 16px/22px var(--font-sans)',
      color: 'var(--mgh-ink-2)',
      marginTop: 2
    }
  }, e.role, " \u2022 ", e.dept, " Department"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      marginTop: 8,
      flexWrap: 'wrap',
      font: '500 13px var(--font-sans)',
      color: 'var(--mgh-ink-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 4,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "location_on",
    size: 16
  }), e.loc), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 4,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "supervisor_account",
    size: 16
  }), "Manager: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--mgh-ink)'
    }
  }, e.mgr)), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 4,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "apartment",
    size: 16
  }), e.entity), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 4,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "work",
    size: 16
  }), e.type))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mgh-overline"
  }, "Hourly cost basis"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 28px/36px var(--font-sans)',
      letterSpacing: '-0.56px',
      color: 'var(--mgh-ink)'
    }
  }, fmt$(e.rate), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 14px var(--font-sans)',
      color: 'var(--mgh-ink-3)'
    }
  }, " / hr")), /*#__PURE__*/React.createElement(Badge, {
    tone: e.match >= 95 ? 'success' : 'danger',
    icon: e.match >= 95 ? 'verified' : 'sync_problem'
  }, e.match >= 95 ? 'Jira Sync Validated' : 'Jira Variance ' + (100 - e.match).toFixed(1) + '%'))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: 20,
    title: /*#__PURE__*/React.createElement("span", {
      className: "mgh-overline"
    }, "Timesheet lifecycle \u2022 Multi-tier multi-role clearance")
  }, /*#__PURE__*/React.createElement(Stepper, {
    steps: steps
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(MetricTile, {
    tone: "white",
    label: "Regular",
    value: fmtH(e.reg)
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: e.ot ? 'warning' : 'white',
    label: "Overtime",
    value: fmtH(e.ot)
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: "white",
    label: "PTO / Leave",
    value: fmtH(e.pto)
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: "white",
    label: "Holiday",
    value: "0.0h"
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: "success",
    label: "Billable Jira",
    value: fmtH(jiraTotal)
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: "white",
    label: "Non-billable",
    value: fmtH(Math.max(0, clockTotal - jiraTotal))
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: "white",
    label: "Total time",
    value: fmtH(e.total)
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: "dark",
    label: "Est. Gross",
    value: fmt$(e.gross)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      flexWrap: 'wrap',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '999 1 560px',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: 20,
    title: "Daily Breakdown & Jira Worklogs Cross-Reference",
    icon: "calendar_month",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Tabs, {
      value: week,
      onChange: setWeek,
      tabs: [{
        value: 'all',
        label: '14 days'
      }, {
        value: '1',
        label: 'Week 1'
      }, {
        value: '2',
        label: 'Week 2'
      }],
      style: {
        padding: 3
      }
    })),
    bodyStyle: {
      paddingTop: 14
    }
  }, /*#__PURE__*/React.createElement(DataTable, {
    maxHeight: 460,
    density: "compact",
    rowKey: "id",
    rows: shown,
    columns: [{
      key: 'date',
      label: 'Date & Day',
      strong: true,
      weight: 600,
      render: d => /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        style: {
          color: d.weekend ? 'var(--mgh-ink-4)' : 'var(--mgh-ink)'
        }
      }, d.date), /*#__PURE__*/React.createElement("div", {
        style: {
          font: '500 11px/14px var(--font-sans)',
          color: d.ot ? 'var(--mgh-warning)' : 'var(--mgh-ink-3)'
        }
      }, d.note))
    }, {
      key: 'inn',
      label: 'Clock In / Out',
      render: d => d.weekend ? /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--mgh-ink-4)'
        }
      }, "\u2014") : /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: 'var(--font-mono)'
        }
      }, d.inn, " \u2013 ", d.out)
    }, {
      key: 'hrs',
      label: 'Logged',
      align: 'right',
      render: d => d.weekend ? '—' : /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", {
        style: {
          color: 'var(--mgh-ink)'
        }
      }, d.hrs.toFixed(1), "h"), d.ot > 0 && /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--mgh-warning)'
        }
      }, " (", d.ot.toFixed(1), " OT)"))
    }, {
      key: 'key',
      label: 'Jira Issue & Task',
      render: d => d.key ? /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          gap: 8,
          alignItems: 'center'
        }
      }, /*#__PURE__*/React.createElement(Badge, {
        mono: true,
        size: "sm",
        tone: "primary"
      }, d.key), /*#__PURE__*/React.createElement("span", {
        style: {
          maxWidth: 220,
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }
      }, d.task)) : null
    }, {
      key: 'jira',
      label: 'Jira Worklog',
      align: 'right',
      render: d => d.weekend ? '—' : /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'inline-flex',
          gap: 6,
          alignItems: 'center',
          color: d.jira !== d.hrs ? 'var(--mgh-danger)' : 'var(--mgh-ink)'
        }
      }, d.jira.toFixed(1), "h", /*#__PURE__*/React.createElement(Icon, {
        name: d.jira !== d.hrs ? 'error' : 'check_circle',
        size: 14,
        color: d.jira !== d.hrs ? 'var(--mgh-danger)' : 'var(--mgh-success)'
      }))
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 20,
      padding: '12px 14px 0',
      font: '700 13px var(--font-sans)',
      color: 'var(--mgh-ink)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Clock total: ", fmtH(clockTotal)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--mgh-success)'
    }
  }, "Jira total: ", fmtH(jiraTotal)))), /*#__PURE__*/React.createElement(Card, {
    padding: 20,
    icon: "sync_alt",
    title: "Jira Worklogs by Issue",
    subtitle: "Realtime bi-directional map \u2022 Atlassian Cloud"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, Object.entries(days.filter(d => d.key).reduce((m, d) => {
    const k = d.key + ' ' + d.task;
    m[k] = (m[k] || 0) + d.jira;
    return m;
  }, {})).map(([k, h]) => {
    const [key, ...t] = k.split(' ');
    return /*#__PURE__*/React.createElement("div", {
      key: k,
      style: {
        display: 'grid',
        gridTemplateColumns: '96px 1fr 160px 56px',
        gap: 12,
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      mono: true,
      size: "sm",
      tone: "primary"
    }, key), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '500 13px var(--font-sans)',
        color: 'var(--mgh-ink)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, t.join(' ')), /*#__PURE__*/React.createElement(ProgressBar, {
      value: h / jiraTotal * 100 * 3,
      tone: "accent"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 13px var(--font-sans)',
        color: 'var(--mgh-ink)',
        textAlign: 'right'
      }
    }, h.toFixed(1), "h"));
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 300px',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: 20,
    icon: "payments",
    title: "Payroll Summary",
    subtitle: "Estimated for PP-2025-08"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      font: '500 13px/18px var(--font-sans)'
    }
  }, [['Regular  80.0h × ' + fmt$(e.rate), regPay], ['Overtime ' + e.ot.toFixed(1) + 'h × 1.5', otPay], ['PTO ' + e.pto.toFixed(1) + 'h', ptoPay]].map(([l, v]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", null, l), /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--mgh-ink)'
    }
  }, fmt$(v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderTop: '1px solid var(--mgh-surface-2)',
      font: '700 14px var(--font-sans)',
      color: 'var(--mgh-ink)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Gross pay"), /*#__PURE__*/React.createElement("span", null, fmt$(e.gross))), ded.map(([l, v]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      color: 'var(--mgh-ink-3)'
    }
  }, /*#__PURE__*/React.createElement("span", null, l), /*#__PURE__*/React.createElement("span", null, "\u2212", fmt$(v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      padding: 12,
      borderRadius: 8,
      background: 'var(--mgh-navy)',
      color: '#fff',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mgh-overline",
    style: {
      color: 'var(--mgh-nav-text)'
    }
  }, "Est. net pay"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '800 20px var(--font-sans)'
    }
  }, fmt$(net))))), /*#__PURE__*/React.createElement(Card, {
    padding: 20,
    icon: "attach_file",
    title: "Attachments",
    actions: /*#__PURE__*/React.createElement(IconButton, {
      icon: "upload",
      tone: "tinted",
      title: "Upload",
      onClick: () => notify('Upload dialog')
    })
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, files.map(([n, s, ic]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 10px',
      borderRadius: 8,
      background: 'var(--mgh-surface-1)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 18,
    color: "var(--mgh-primary)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px var(--font-sans)',
      color: 'var(--mgh-ink)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11px var(--font-sans)',
      color: 'var(--mgh-ink-3)'
    }
  }, s)), /*#__PURE__*/React.createElement(IconButton, {
    icon: "download",
    size: 28,
    title: "Download"
  }))))), /*#__PURE__*/React.createElement(Card, {
    padding: 20,
    icon: "forum",
    title: "Comments"
  }, /*#__PURE__*/React.createElement(ActivityFeed, {
    connector: false,
    items: comments
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: comment,
    onChange: x => setComment(x.target.value),
    placeholder: "Add a comment for the approval chain\u2026",
    style: {
      flex: 1,
      minWidth: 0,
      height: 36,
      border: 'none',
      outline: 'none',
      borderRadius: 8,
      padding: '0 12px',
      background: 'var(--mgh-surface-1)',
      font: '400 13px var(--font-sans)'
    }
  }), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    icon: "send",
    disabled: !comment,
    onClick: () => {
      setComments(c => [...c, {
        person: 'Elena Rostova',
        avatar: AVATARS + 'elena-rostova.jpg',
        title: 'Elena Rostova',
        time: 'Just now',
        body: comment
      }]);
      setComment('');
    }
  }, "Post"))), /*#__PURE__*/React.createElement(Card, {
    padding: 20,
    icon: "history",
    title: "Approval History"
  }, /*#__PURE__*/React.createElement(ActivityFeed, {
    items: [...(e.status === 'Approved' ? [{
      icon: 'task_alt',
      tone: 'success',
      title: 'Approved by Elena Rostova (PM)',
      meta: 'Just now • e-signature applied'
    }] : []), {
      icon: 'verified',
      tone: 'success',
      title: 'Supervisor approved',
      meta: 'Marcus Vance • Apr 15, 09:32'
    }, {
      icon: 'sync',
      tone: 'accent',
      title: 'Jira worklogs reconciled',
      meta: 'Auto-sync • Apr 14, 18:02'
    }, {
      icon: 'send',
      tone: 'primary',
      title: 'Timesheet submitted',
      meta: e.name + ' • Apr 14, 17:00'
    }]
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'sticky',
      bottom: 0,
      background: 'rgba(226,231,255,.92)',
      backdropFilter: 'blur(16px)',
      padding: '14px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Checkbox, {
    checked: sign,
    onChange: setSign,
    label: /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "signature",
      size: 16,
      color: "var(--mgh-primary)"
    }), "Apply Electronic Signature (Elena Rostova, PM)")
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    icon: "save",
    onClick: () => notify('Draft saved')
  }, "Save Draft"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    icon: "picture_as_pdf",
    onClick: () => notify('PDF exported')
  }, "Export PDF"), /*#__PURE__*/React.createElement(Button, {
    variant: "danger",
    icon: "undo",
    onClick: () => setRet(true)
  }, "Return for Corrections"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    icon: "check",
    disabled: !sign,
    onClick: () => approve(false)
  }, "Approve Only"), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    icon: "task_alt",
    iconRight: "arrow_forward",
    disabled: !sign,
    onClick: () => approve(true)
  }, "Approve & Next Employee")))), /*#__PURE__*/React.createElement(Modal, {
    open: ret,
    title: `Return ${e.name}'s timesheet`,
    onClose: () => setRet(false),
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      onClick: () => setRet(false)
    }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
      variant: "danger",
      icon: "undo",
      disabled: !reason,
      onClick: () => {
        setStatus(e.id, 'Returned');
        setRet(false);
        setReason('');
        notify('Returned to employee for corrections');
      }
    }, "Return Timesheet"))
  }, /*#__PURE__*/React.createElement("p", {
    className: "mgh-body",
    style: {
      margin: 0
    }
  }, "The employee and supervisor will be notified. The timesheet re-enters the lifecycle at ", /*#__PURE__*/React.createElement("b", null, "Employee"), "."), /*#__PURE__*/React.createElement("textarea", {
    value: reason,
    onChange: x => setReason(x.target.value),
    placeholder: "Reason (required) \u2014 e.g. Apr 08 worklog on ATLAS-420 is 0.5h short of clock time.",
    rows: 4,
    style: {
      border: 'none',
      outline: 'none',
      borderRadius: 8,
      padding: 12,
      background: 'var(--mgh-surface-1)',
      font: '400 13px/18px var(--font-sans)',
      resize: 'vertical'
    }
  })));
}
function TeamApprovalQueue({
  go,
  notify
}) {
  const [rows, setRows] = React.useState(EMPLOYEES.map(e => ({
    ...e
  })));
  const [chip, setChip] = React.useState('all');
  const [dept, setDept] = React.useState('All departments');
  const [ent, setEnt] = React.useState('All entities');
  const base = rows.filter(r => (chip === 'all' || chip === 'pending' && r.status.startsWith('Awaiting') || chip === 'flag' && ['Flagged OT', 'Jira Mismatch'].includes(r.status) || chip === 'done' && r.status === 'Approved') && (dept === 'All departments' || r.dept === dept) && (ent === 'All entities' || r.entity === ent));
  const t = useTable(base, {
    search: ['name', 'id', 'project', 'role'],
    pageSize: 8,
    initialSort: {
      key: 'ot',
      dir: 'desc'
    }
  });
  const bulk = s => {
    setRows(r => r.map(x => t.sel.includes(x.id) ? {
      ...x,
      status: s
    } : x));
    notify(`${t.sel.length} timesheets ${s.toLowerCase()}`);
    t.setSel([]);
  };
  return /*#__PURE__*/React.createElement(Page, null, /*#__PURE__*/React.createElement(PageHeader, {
    breadcrumbs: ['Workforce', 'Approvals', 'Team Queue'],
    title: "Team Approval Queue",
    description: "Every timesheet awaiting your sign-off across entities. Select rows to approve or return in bulk.",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: "filter_list"
    }, "Saved Views"), /*#__PURE__*/React.createElement(Button, {
      icon: "assignment_turned_in",
      onClick: () => go('approvals')
    }, "Open Workspace"))
  }), /*#__PURE__*/React.createElement(Grid, {
    min: 200
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Awaiting you",
    value: rows.filter(r => r.status.startsWith('Awaiting')).length,
    icon: "hourglass_top",
    tone: "warning",
    style: {
      minHeight: 0
    }
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Flagged",
    value: rows.filter(r => ['Flagged OT', 'Jira Mismatch'].includes(r.status)).length,
    icon: "flag",
    tone: "danger",
    style: {
      minHeight: 0
    }
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Approved this period",
    value: rows.filter(r => r.status === 'Approved').length,
    icon: "task_alt",
    tone: "success",
    style: {
      minHeight: 0
    }
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "SLA: due in",
    value: "1d 6h",
    icon: "timer",
    tone: "accent",
    style: {
      minHeight: 0
    }
  })), /*#__PURE__*/React.createElement(Card, {
    padding: 20
  }, /*#__PURE__*/React.createElement(TableToolbar, {
    search: t.q,
    onSearch: t.setQ,
    placeholder: "Search name, ID, project\u2026",
    filters: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      icon: "apartment",
      value: dept,
      onChange: setDept,
      options: ['All departments', ...new Set(EMPLOYEES.map(e => e.dept))]
    }), /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      icon: "domain",
      value: ent,
      onChange: setEnt,
      options: ['All entities', ...new Set(EMPLOYEES.map(e => e.entity))]
    })),
    actions: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary",
      icon: "download"
    }, "Export CSV"),
    chips: /*#__PURE__*/React.createElement(FilterChips, {
      value: chip,
      onChange: setChip,
      options: [{
        value: 'all',
        label: 'All',
        count: rows.length
      }, {
        value: 'pending',
        label: 'Awaiting',
        count: rows.filter(r => r.status.startsWith('Awaiting')).length,
        tone: 'warning'
      }, {
        value: 'flag',
        label: 'Flagged',
        count: rows.filter(r => ['Flagged OT', 'Jira Mismatch'].includes(r.status)).length,
        tone: 'danger'
      }, {
        value: 'done',
        label: 'Approved'
      }]
    })
  }), /*#__PURE__*/React.createElement(DataTable, {
    style: {
      marginTop: 14
    },
    maxHeight: 520,
    selectable: true,
    selected: t.sel,
    onSelectedChange: t.setSel,
    sort: t.sort,
    onSort: t.setSort,
    rows: t.rows,
    onRowClick: r => go('approvals', r.id),
    bulkBar: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "primary",
      icon: "done_all",
      onClick: () => bulk('Approved')
    }, "Approve"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "danger",
      icon: "undo",
      onClick: () => bulk('Returned')
    }, "Return")),
    columns: [{
      key: 'name',
      label: 'Employee',
      sortable: true,
      render: r => /*#__PURE__*/React.createElement(EmployeeCell, {
        e: r,
        sub: r.id + ' • ' + r.dept
      })
    }, {
      key: 'project',
      label: 'Project',
      sortable: true
    }, {
      key: 'reg',
      label: 'Regular',
      align: 'right',
      sortable: true,
      render: r => fmtH(r.reg)
    }, {
      key: 'ot',
      label: 'Overtime',
      align: 'right',
      sortable: true,
      render: r => /*#__PURE__*/React.createElement("span", {
        style: {
          color: r.ot > 8 ? 'var(--mgh-danger)' : r.ot ? 'var(--mgh-warning)' : undefined,
          fontWeight: r.ot ? 700 : 400
        }
      }, fmtH(r.ot))
    }, {
      key: 'total',
      label: 'Total',
      align: 'right',
      sortable: true,
      strong: true,
      weight: 700,
      render: r => fmtH(r.total)
    }, {
      key: 'match',
      label: 'Jira match',
      align: 'right',
      sortable: true,
      render: r => /*#__PURE__*/React.createElement(Badge, {
        size: "sm",
        dot: true,
        tone: r.match >= 98 ? 'success' : r.match >= 93 ? 'warning' : 'danger'
      }, r.match, "%")
    }, {
      key: 'gross',
      label: 'Est. gross',
      align: 'right',
      sortable: true,
      strong: true,
      render: r => fmt$(r.gross)
    }, {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: r => /*#__PURE__*/React.createElement(Badge, {
        size: "sm",
        tone: STATUS_TONE[r.status]
      }, r.status)
    }, {
      key: 'x',
      label: '',
      align: 'right',
      render: r => /*#__PURE__*/React.createElement(IconButton, {
        icon: "chevron_right",
        size: 28,
        title: "Review"
      })
    }]
  }), /*#__PURE__*/React.createElement(Pagination, {
    style: {
      marginTop: 14
    },
    page: t.page,
    pageSize: t.pageSize,
    total: t.total,
    onPage: t.setPage,
    noun: "timesheets"
  })));
}
function BiWeeklyTimesheets({
  notify
}) {
  const me = EMPLOYEES[0];
  const [days, setDays] = React.useState(() => buildDays(me));
  const [submitted, setSubmitted] = React.useState(false);
  const total = days.reduce((s, d) => s + d.hrs, 0),
    ot = days.reduce((s, d) => s + d.ot, 0);
  const edit = (id, v) => setDays(ds => ds.map(d => d.id === id ? {
    ...d,
    hrs: Math.max(0, +v || 0),
    ot: Math.max(0, (+v || 0) - 8)
  } : d));
  return /*#__PURE__*/React.createElement(Page, null, /*#__PURE__*/React.createElement(PageHeader, {
    breadcrumbs: ['Workforce', 'Timesheets', 'PP-2025-08'],
    title: "Bi-Weekly Timesheet",
    status: /*#__PURE__*/React.createElement(Badge, {
      tone: submitted ? 'success' : 'warning',
      dot: true
    }, submitted ? 'Submitted • Awaiting Supervisor' : 'Draft • Due Apr 14, 17:00'),
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: "sync",
      onClick: () => notify('Pulled 14 worklogs from Jira Cloud')
    }, "Import Jira Worklogs"), /*#__PURE__*/React.createElement(Button, {
      icon: "send",
      disabled: submitted,
      onClick: () => {
        setSubmitted(true);
        notify('Timesheet submitted for approval');
      }
    }, "Submit for Approval"))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: 14,
      borderRadius: 12,
      background: 'var(--mgh-surface-1)'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    src: me.avatar,
    name: me.name,
    size: 44
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mgh-lg"
  }, me.name), /*#__PURE__*/React.createElement("div", {
    className: "mgh-body"
  }, me.role, " \u2022 ", me.project)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 110px)',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(MetricTile, {
    tone: "white",
    label: "Total",
    value: fmtH(total)
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: "white",
    label: "Regular",
    value: fmtH(total - ot)
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: ot ? 'warning' : 'white',
    label: "Overtime",
    value: fmtH(ot)
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: "success",
    label: "Target",
    value: "80.0h"
  }))), [1, 2].map(w => /*#__PURE__*/React.createElement(Card, {
    key: w,
    padding: 20,
    title: `Week ${w}`,
    subtitle: w === 1 ? 'Mon Mar 31 – Sun Apr 06' : 'Mon Apr 07 – Sun Apr 13',
    icon: "date_range",
    actions: /*#__PURE__*/React.createElement(Badge, {
      tone: "primary"
    }, fmtH(days.filter(d => d.week === w).reduce((s, d) => s + d.hrs, 0)))
  }, /*#__PURE__*/React.createElement(DataTable, {
    density: "compact",
    rows: days.filter(d => d.week === w),
    columns: [{
      key: 'date',
      label: 'Day',
      strong: true,
      weight: 600,
      render: d => /*#__PURE__*/React.createElement("span", {
        style: {
          color: d.weekend ? 'var(--mgh-ink-4)' : undefined
        }
      }, d.date)
    }, {
      key: 'inn',
      label: 'In',
      mono: true
    }, {
      key: 'out',
      label: 'Out',
      mono: true
    }, {
      key: 'key',
      label: 'Jira Issue',
      render: d => d.key ? /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          gap: 8,
          alignItems: 'center'
        }
      }, /*#__PURE__*/React.createElement(Badge, {
        mono: true,
        size: "sm",
        tone: "primary"
      }, d.key), d.task) : /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--mgh-ink-4)'
        }
      }, "\u2014")
    }, {
      key: 'type',
      label: 'Type',
      render: d => d.weekend ? /*#__PURE__*/React.createElement(Badge, {
        size: "sm"
      }, "Weekend") : d.ot ? /*#__PURE__*/React.createElement(Badge, {
        size: "sm",
        tone: "warning"
      }, "Overtime") : /*#__PURE__*/React.createElement(Badge, {
        size: "sm",
        tone: "success"
      }, "Regular")
    }, {
      key: 'hrs',
      label: 'Hours',
      align: 'right',
      render: d => /*#__PURE__*/React.createElement("input", {
        disabled: submitted,
        value: d.hrs,
        onChange: x => edit(d.id, x.target.value),
        style: {
          width: 64,
          height: 30,
          textAlign: 'right',
          border: 'none',
          borderRadius: 6,
          padding: '0 8px',
          background: submitted ? 'transparent' : 'var(--mgh-surface-1)',
          font: '700 13px var(--font-sans)',
          color: 'var(--mgh-ink)'
        }
      })
    }]
  }))));
}
window.SCREENS = Object.assign(window.SCREENS || {}, {
  approvals: ApprovalWorkspace,
  queue: TeamApprovalQueue,
  timesheets: BiWeeklyTimesheets
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/enterprise/ScreensApprovals.jsx", error: String((e && e.message) || e) }); }

// ui_kits/enterprise/ScreensOps.jsx
try { (() => {
const {
  Button,
  IconButton,
  Badge,
  Avatar,
  Icon,
  Card,
  FilterChips,
  StatCard,
  MetricTile,
  DataTable,
  TableToolbar,
  Pagination,
  ActivityFeed,
  Tabs,
  PageHeader,
  Select,
  ProgressBar,
  KeyValue,
  Toggle,
  TextField,
  Checkbox
} = window.MyGlobalHubDesignSystem_2a603d;
const PROJECTS = [{
  id: 'ATLAS',
  name: 'Atlas Core Platform',
  lead: 'Elena Rostova',
  people: 14,
  budget: 120000,
  spent: 84200,
  hrs: 1610,
  bill: 94.2,
  st: 'On track'
}, {
  id: 'PERF',
  name: 'Perf Infrastructure',
  lead: 'David Wu',
  people: 6,
  budget: 60000,
  spent: 51800,
  hrs: 940,
  bill: 88.1,
  st: 'At risk'
}, {
  id: 'GHV3',
  name: 'Global Hub v3',
  lead: 'Grace Okafor',
  people: 11,
  budget: 95000,
  spent: 40100,
  hrs: 780,
  bill: 97.0,
  st: 'On track'
}, {
  id: 'LAKE',
  name: 'Insights Lake',
  lead: 'Priya Natarajan',
  people: 5,
  budget: 48000,
  spent: 22600,
  hrs: 410,
  bill: 91.6,
  st: 'On track'
}, {
  id: 'CORE',
  name: 'Core Billing Services',
  lead: 'Javier Peña',
  people: 8,
  budget: 70000,
  spent: 71900,
  hrs: 1205,
  bill: 85.4,
  st: 'Over budget'
}, {
  id: 'OPS',
  name: 'Internal Ops',
  lead: 'Ana Gómez',
  people: 9,
  budget: 30000,
  spent: 14200,
  hrs: 520,
  bill: 0,
  st: 'Non-billable'
}];
const PT = {
  'On track': 'success',
  'At risk': 'warning',
  'Over budget': 'danger',
  'Non-billable': 'neutral'
};
function JiraIntegration({
  notify
}) {
  const [auto, setAuto] = React.useState(true);
  const [map, setMap] = React.useState(true);
  const sprint = [{
    label: 'S19',
    a: 31.2
  }, {
    label: 'S20',
    a: 33.8
  }, {
    label: 'S21',
    a: 30.4
  }, {
    label: 'S22',
    a: 36.1
  }, {
    label: 'S23',
    a: 38.7
  }, {
    label: 'S24',
    a: 44.9,
    hi: true
  }];
  return /*#__PURE__*/React.createElement(Page, null, /*#__PURE__*/React.createElement(PageHeader, {
    breadcrumbs: ['Integrations', 'Jira Cloud Sync'],
    title: "Jira Integration",
    status: /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      dot: true
    }, "Connected \u2022 globalhub.atlassian.net \u2022 Synced 2m ago"),
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: "settings"
    }, "Field Mapping"), /*#__PURE__*/React.createElement(Button, {
      icon: "sync",
      onClick: () => notify('Full re-sync started — 1,284 worklogs')
    }, "Sync Now"))
  }), /*#__PURE__*/React.createElement(Grid, {
    min: 220
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Worklogs this period",
    value: "1,284",
    icon: "list_alt",
    tone: "accent"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Hours reconciled",
    value: "98.6%",
    icon: "rule",
    tone: "success",
    progress: 98.6
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Discrepancies",
    value: "2",
    icon: "sync_problem",
    tone: "danger"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Sprint 24 labor cost",
    value: "$44.9k",
    icon: "savings",
    delta: "+16% vs S23",
    deltaTone: "danger"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.6fr) minmax(300px,1fr)',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    icon: "bar_chart",
    title: "Sprint cost analytics",
    subtitle: "Labor cost per sprint (thousands USD)"
  }, /*#__PURE__*/React.createElement(BarChart, {
    data: sprint,
    height: 200,
    format: v => '$' + v + 'k'
  })), /*#__PURE__*/React.createElement(Card, {
    icon: "settings_ethernet",
    title: "Connection"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(KeyValue, {
    label: "Site",
    value: "globalhub.atlassian.net",
    mono: true,
    aside: /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      size: "sm"
    }, "OAuth 2.0")
  }), /*#__PURE__*/React.createElement(KeyValue, {
    label: "Webhook",
    value: "/hooks/jira/worklog",
    mono: true,
    aside: /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      size: "sm",
      dot: true
    }, "Live")
  }), /*#__PURE__*/React.createElement(Toggle, {
    checked: auto,
    onChange: setAuto,
    label: "Real-time worklog sync",
    description: "Every 5m + webhook push"
  }), /*#__PURE__*/React.createElement(Toggle, {
    checked: map,
    onChange: setMap,
    label: "Bi-directional mapping",
    description: "Write approvals back to Jira as labels"
  })))), /*#__PURE__*/React.createElement(Card, {
    icon: "sync_problem",
    title: "Reconciliation exceptions",
    bodyStyle: {
      paddingTop: 14
    }
  }, /*#__PURE__*/React.createElement(DataTable, {
    density: "compact",
    rows: [{
      id: 1,
      e: EMPLOYEES[4],
      key: 'CORE-111',
      clock: 8,
      jira: 4,
      d: 'Apr 08'
    }, {
      id: 2,
      e: EMPLOYEES[11],
      key: 'LAKE-27',
      clock: 9,
      jira: 7.5,
      d: 'Apr 10'
    }],
    columns: [{
      key: 'e',
      label: 'Employee',
      render: r => /*#__PURE__*/React.createElement(EmployeeCell, {
        e: r.e
      })
    }, {
      key: 'd',
      label: 'Date'
    }, {
      key: 'key',
      label: 'Issue',
      render: r => /*#__PURE__*/React.createElement(Badge, {
        mono: true,
        size: "sm",
        tone: "primary"
      }, r.key)
    }, {
      key: 'clock',
      label: 'Clock',
      align: 'right',
      render: r => fmtH(r.clock)
    }, {
      key: 'jira',
      label: 'Jira',
      align: 'right',
      render: r => fmtH(r.jira)
    }, {
      key: 'v',
      label: 'Variance',
      align: 'right',
      render: r => /*#__PURE__*/React.createElement("b", {
        style: {
          color: 'var(--mgh-danger)'
        }
      }, "\u2212", fmtH(r.clock - r.jira))
    }, {
      key: 'a',
      label: '',
      align: 'right',
      render: () => /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        variant: "ghost"
      }, "Resolve")
    }]
  })));
}
function Projects({
  notify
}) {
  const [chip, setChip] = React.useState('all');
  const t = useTable(PROJECTS.filter(p => chip === 'all' || p.st === chip), {
    search: ['name', 'id', 'lead'],
    pageSize: 10,
    initialSort: {
      key: 'spent',
      dir: 'desc'
    }
  });
  return /*#__PURE__*/React.createElement(Page, null, /*#__PURE__*/React.createElement(PageHeader, {
    breadcrumbs: ['Integrations', 'Projects'],
    title: "Projects",
    description: "Labor budgets and billable utilization by Jira project.",
    actions: /*#__PURE__*/React.createElement(Button, {
      icon: "add",
      onClick: () => notify('New project linked')
    }, "Link Jira Project")
  }), /*#__PURE__*/React.createElement(Card, {
    padding: 20
  }, /*#__PURE__*/React.createElement(TableToolbar, {
    search: t.q,
    onSearch: t.setQ,
    placeholder: "Search project, key, lead\u2026",
    actions: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary",
      icon: "download"
    }, "Export"),
    chips: /*#__PURE__*/React.createElement(FilterChips, {
      value: chip,
      onChange: setChip,
      options: [{
        value: 'all',
        label: 'All',
        count: PROJECTS.length
      }, {
        value: 'On track',
        label: 'On track'
      }, {
        value: 'At risk',
        label: 'At risk',
        count: 1,
        tone: 'warning'
      }, {
        value: 'Over budget',
        label: 'Over budget',
        count: 1,
        tone: 'danger'
      }]
    })
  }), /*#__PURE__*/React.createElement(DataTable, {
    style: {
      marginTop: 14
    },
    sort: t.sort,
    onSort: t.setSort,
    rows: t.rows,
    columns: [{
      key: 'name',
      label: 'Project',
      sortable: true,
      render: r => /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          gap: 10,
          alignItems: 'center'
        }
      }, /*#__PURE__*/React.createElement(Badge, {
        mono: true,
        tone: "dark"
      }, r.id), /*#__PURE__*/React.createElement("span", {
        style: {
          font: '600 13px var(--font-sans)',
          color: 'var(--mgh-ink)'
        }
      }, r.name))
    }, {
      key: 'lead',
      label: 'Lead',
      sortable: true
    }, {
      key: 'people',
      label: 'People',
      align: 'right',
      sortable: true
    }, {
      key: 'hrs',
      label: 'Hours',
      align: 'right',
      sortable: true,
      render: r => r.hrs.toLocaleString() + 'h'
    }, {
      key: 'spent',
      label: 'Budget used',
      sortable: true,
      width: 220,
      render: r => /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }
      }, /*#__PURE__*/React.createElement(ProgressBar, {
        style: {
          flex: 1
        },
        value: r.spent / r.budget * 100,
        tone: r.spent > r.budget ? 'danger' : r.spent / r.budget > .85 ? 'warning' : 'primary'
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          font: '600 12px var(--font-sans)',
          width: 40,
          textAlign: 'right'
        }
      }, Math.round(r.spent / r.budget * 100), "%"))
    }, {
      key: 'bill',
      label: 'Billable',
      align: 'right',
      sortable: true,
      render: r => r.bill ? r.bill + '%' : '—'
    }, {
      key: 'st',
      label: 'Health',
      render: r => /*#__PURE__*/React.createElement(Badge, {
        size: "sm",
        dot: true,
        tone: PT[r.st]
      }, r.st)
    }]
  })));
}
function Reports({
  notify
}) {
  const [rep, setRep] = React.useState('register');
  const t = useTable(EMPLOYEES, {
    search: ['name', 'id', 'dept'],
    pageSize: 8,
    initialSort: {
      key: 'gross',
      dir: 'desc'
    }
  });
  const tot = EMPLOYEES.reduce((s, e) => s + e.gross, 0);
  return /*#__PURE__*/React.createElement(Page, null, /*#__PURE__*/React.createElement(PageHeader, {
    breadcrumbs: ['Insights', 'Reports & Register'],
    title: "Executive Payroll Register",
    status: /*#__PURE__*/React.createElement(Badge, {
      tone: "primary"
    }, "PP-2025-08 \u2022 All entities \u2022 USD"),
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: "schedule_send"
    }, "Schedule"), /*#__PURE__*/React.createElement(Button, {
      variant: "dark",
      icon: "download",
      onClick: () => notify('Register exported (XLSX)')
    }, "Export Register"))
  }), /*#__PURE__*/React.createElement(Tabs, {
    value: rep,
    onChange: setRep,
    tabs: [{
      value: 'register',
      label: 'Payroll Register'
    }, {
      value: 'labor',
      label: 'Labor Distribution'
    }, {
      value: 'tax',
      label: 'Tax Liability'
    }, {
      value: 'ot',
      label: 'Overtime Analysis'
    }, {
      value: 'jira',
      label: 'Billable vs Non-billable'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(MetricTile, {
    tone: "white",
    label: "Headcount",
    value: EMPLOYEES.length
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: "white",
    label: "Total hours",
    value: fmtH(EMPLOYEES.reduce((s, e) => s + e.total, 0))
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: "white",
    label: "Overtime",
    value: fmtH(EMPLOYEES.reduce((s, e) => s + e.ot, 0))
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: "dark",
    label: "Gross",
    value: fmt$(tot)
  })), /*#__PURE__*/React.createElement(Card, {
    padding: 20
  }, /*#__PURE__*/React.createElement(TableToolbar, {
    search: t.q,
    onSearch: t.setQ,
    placeholder: "Filter register\u2026",
    filters: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      icon: "domain",
      options: ['All entities', 'Dominicana SRL', 'USA Inc.', 'UK Ltd.']
    }), /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      icon: "payments",
      options: ['USD', 'DOP', 'GBP']
    })),
    actions: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary",
      icon: "print"
    }, "Print")
  }), /*#__PURE__*/React.createElement(DataTable, {
    style: {
      marginTop: 14
    },
    maxHeight: 520,
    density: "compact",
    sort: t.sort,
    onSort: t.setSort,
    rows: t.rows,
    columns: [{
      key: 'id',
      label: 'ID',
      mono: true,
      sortable: true
    }, {
      key: 'name',
      label: 'Employee',
      sortable: true,
      strong: true,
      weight: 600
    }, {
      key: 'dept',
      label: 'Dept',
      sortable: true
    }, {
      key: 'reg',
      label: 'Reg h',
      align: 'right',
      sortable: true,
      render: r => r.reg.toFixed(1)
    }, {
      key: 'ot',
      label: 'OT h',
      align: 'right',
      sortable: true,
      render: r => r.ot.toFixed(1)
    }, {
      key: 'rate',
      label: 'Rate',
      align: 'right',
      sortable: true,
      render: r => fmt$(r.rate)
    }, {
      key: 'gross',
      label: 'Gross',
      align: 'right',
      sortable: true,
      strong: true,
      render: r => fmt$(r.gross)
    }, {
      key: 'tax',
      label: 'Tax',
      align: 'right',
      render: r => fmt$(r.gross * .209)
    }, {
      key: 'net',
      label: 'Net',
      align: 'right',
      strong: true,
      weight: 700,
      render: r => fmt$(r.gross * .791)
    }]
  }), /*#__PURE__*/React.createElement(Pagination, {
    style: {
      marginTop: 14
    },
    page: t.page,
    pageSize: t.pageSize,
    total: t.total,
    onPage: t.setPage,
    noun: "rows"
  })));
}
function Administration({
  notify
}) {
  const users = [{
    id: 1,
    e: {
      name: 'Elena Rostova',
      avatar: AVATARS + 'elena-rostova.jpg',
      role: 'elena@globalhub.com'
    },
    r: 'Lead PM & Approver',
    ent: 'All',
    mfa: true,
    last: '2m ago'
  }, {
    id: 2,
    e: {
      name: 'Marcus Vance',
      role: 'marcus@globalhub.com'
    },
    r: 'Supervisor',
    ent: 'Dominicana SRL',
    mfa: true,
    last: '1h ago'
  }, {
    id: 3,
    e: {
      name: 'Ana Gómez',
      role: 'ana@globalhub.com'
    },
    r: 'HR Finance Admin',
    ent: 'All',
    mfa: true,
    last: 'Yesterday'
  }, {
    id: 4,
    e: {
      name: 'Luis Cabrera',
      avatar: AVATARS + 'person-4.jpg',
      role: 'luis@globalhub.com'
    },
    r: 'Payroll Specialist',
    ent: 'Dominicana SRL',
    mfa: false,
    last: '3d ago'
  }];
  const [sel, setSel] = React.useState([]);
  return /*#__PURE__*/React.createElement(Page, null, /*#__PURE__*/React.createElement(PageHeader, {
    breadcrumbs: ['System', 'Administration'],
    title: "Administration",
    description: "Operating entities, users, roles and approval governance.",
    actions: /*#__PURE__*/React.createElement(Button, {
      icon: "person_add",
      onClick: () => notify('Invite sent')
    }, "Invite User")
  }), /*#__PURE__*/React.createElement(Grid, {
    min: 260
  }, [['My Global Hub Dominicana SRL', 'Punta Cana HQ • DOP / USD', 54, 'HQ'], ['My Global Hub USA Inc.', 'Austin, TX • USD', 21, 'Branch'], ['My Global Hub UK Ltd.', 'London • GBP', 11, 'Branch']].map(([n, s, c, tag]) => /*#__PURE__*/React.createElement(Card, {
    key: n,
    padding: 20
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "domain",
    size: 18,
    color: "var(--mgh-primary)"
  }), /*#__PURE__*/React.createElement(Badge, {
    size: "sm",
    tone: tag === 'HQ' ? 'primary' : 'neutral'
  }, tag)), /*#__PURE__*/React.createElement("div", {
    className: "mgh-lg",
    style: {
      marginTop: 10
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    className: "mgh-body"
  }, s), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      font: '700 13px var(--font-sans)',
      color: 'var(--mgh-ink)'
    }
  }, c, " employees")))), /*#__PURE__*/React.createElement(Card, {
    icon: "group",
    title: "Users & roles",
    bodyStyle: {
      paddingTop: 14
    }
  }, /*#__PURE__*/React.createElement(DataTable, {
    selectable: true,
    selected: sel,
    onSelectedChange: setSel,
    bulkBar: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary",
      icon: "key"
    }, "Require MFA"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "danger",
      icon: "block"
    }, "Suspend")),
    rows: users,
    columns: [{
      key: 'e',
      label: 'User',
      render: r => /*#__PURE__*/React.createElement(EmployeeCell, {
        e: r.e
      })
    }, {
      key: 'r',
      label: 'Role',
      render: r => /*#__PURE__*/React.createElement(Badge, {
        size: "sm",
        tone: "primary"
      }, r.r)
    }, {
      key: 'ent',
      label: 'Entity scope'
    }, {
      key: 'mfa',
      label: 'MFA',
      render: r => /*#__PURE__*/React.createElement(Badge, {
        size: "sm",
        dot: true,
        tone: r.mfa ? 'success' : 'danger'
      }, r.mfa ? 'Enabled' : 'Missing')
    }, {
      key: 'last',
      label: 'Last active'
    }, {
      key: 'x',
      label: '',
      align: 'right',
      render: () => /*#__PURE__*/React.createElement(IconButton, {
        icon: "more_vert",
        size: 28,
        title: "More"
      })
    }]
  })), /*#__PURE__*/React.createElement(Card, {
    icon: "account_tree",
    title: "Approval workflow policy",
    subtitle: "Multi-tier, multi-role clearance applied to every bi-weekly timesheet"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(KeyValue, {
    label: "Tier 1",
    value: "Direct supervisor"
  }), /*#__PURE__*/React.createElement(KeyValue, {
    label: "Tier 2",
    value: "Project manager (Jira lead)"
  }), /*#__PURE__*/React.createElement(KeyValue, {
    label: "Tier 3",
    value: "HR review"
  }), /*#__PURE__*/React.createElement(KeyValue, {
    label: "Escalation",
    value: "OT > 10h \u2192 VP sign-off",
    aside: /*#__PURE__*/React.createElement(Badge, {
      size: "sm",
      tone: "warning"
    }, "Rule")
  }))));
}
function CompanySettings({
  notify
}) {
  const [tab, setTab] = React.useState('general');
  const [s, setS] = React.useState({
    ot: true,
    esig: true,
    lock: true,
    weekend: false
  });
  const tg = k => v => setS(x => ({
    ...x,
    [k]: v
  }));
  return /*#__PURE__*/React.createElement(Page, {
    style: {
      maxWidth: 1100
    }
  }, /*#__PURE__*/React.createElement(PageHeader, {
    breadcrumbs: ['System', 'Company Settings'],
    title: "Company Settings",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "outline"
    }, "Discard"), /*#__PURE__*/React.createElement(Button, {
      icon: "save",
      onClick: () => notify('Settings saved')
    }, "Save Changes"))
  }), /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    tabs: [{
      value: 'general',
      label: 'General'
    }, {
      value: 'pay',
      label: 'Pay Schedule'
    }, {
      value: 'time',
      label: 'Time & Overtime'
    }, {
      value: 'notif',
      label: 'Notifications'
    }, {
      value: 'sec',
      label: 'Security'
    }]
  }), /*#__PURE__*/React.createElement(Card, {
    icon: "apartment",
    title: "Company profile"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    label: "Legal name",
    value: "My Global Hub Dominicana SRL"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "RNC (Tax ID)",
    value: "1-31-88421-7",
    mono: true
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Headquarters",
    value: "Punta Cana, La Altagracia, DR"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Base currency",
    value: "USD",
    suffix: "Multi-currency"
  }))), /*#__PURE__*/React.createElement(Card, {
    icon: "event_repeat",
    title: "Pay schedule"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Select, {
    label: "Frequency",
    options: ['Bi-weekly (26 / yr)', 'Semi-monthly', 'Monthly']
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Period start",
    options: ['Monday', 'Sunday']
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Submission deadline",
    value: "Day 14, 17:00"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Pay date offset",
    value: "5",
    suffix: "days"
  }))), /*#__PURE__*/React.createElement(Card, {
    icon: "rule",
    title: "Time & approval rules"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Toggle, {
    checked: s.ot,
    onChange: tg('ot'),
    label: "Require pre-authorization for overtime",
    description: "Overtime over 44h/week must be approved before it is logged."
  }), /*#__PURE__*/React.createElement(Toggle, {
    checked: s.esig,
    onChange: tg('esig'),
    label: "Electronic signature on approval",
    description: "Approvers sign each decision; signatures are hashed into the audit log."
  }), /*#__PURE__*/React.createElement(Toggle, {
    checked: s.lock,
    onChange: tg('lock'),
    label: "Auto-lock period after Finance Run",
    description: "Prevents edits once disbursement is batched."
  }), /*#__PURE__*/React.createElement(Toggle, {
    checked: s.weekend,
    onChange: tg('weekend'),
    label: "Allow weekend time entry",
    description: "Sunday hours are paid at double rate."
  }))));
}
function AuditLog() {
  const ev = [['09:14:02', 'Compliance Engine', 'bank.route.verified', 'MGH-1042 • Banco BHD León', 'success'], ['09:12:47', 'Elena Rostova', 'timesheet.approved', 'MGH-0975 • PP-2025-08', 'success'], ['09:02:10', 'Jira Webhook', 'worklog.synced', 'ATLAS-3482 • 8.5h', 'info'], ['08:58:31', 'Ana Gómez', 'tariff.updated', 'OT threshold 40h → 44h', 'warning'], ['08:41:05', 'System', 'auth.mfa.failed', 'luis@globalhub.com • 186.6.x.x', 'danger'], ['08:30:00', 'Scheduler', 'period.opened', 'PP-2025-09', 'neutral'], ['08:12:44', 'Marcus Vance', 'timesheet.returned', 'MGH-1120 • Jira variance', 'warning'], ['07:55:19', 'API Key mgh_live_7f…', 'webhook.created', 'payroll.locked → erp.globalhub.com', 'info'], ['07:40:02', 'Elena Rostova', 'session.login', 'Chrome • Punta Cana, DR', 'neutral'], ['07:12:30', 'Compliance Engine', 'ledger.hash.verified', 'Block #88214 • SHA-256 OK', 'success']].map(([time, actor, action, target, tone], i) => ({
    id: i,
    time,
    actor,
    action,
    target,
    tone,
    hash: (0x9f3a2c + i * 7919).toString(16) + '…' + (0xb81d + i * 131).toString(16)
  }));
  const [chip, setChip] = React.useState('all');
  const t = useTable(ev.filter(e => chip === 'all' || e.tone === chip), {
    search: ['actor', 'action', 'target'],
    pageSize: 10
  });
  return /*#__PURE__*/React.createElement(Page, null, /*#__PURE__*/React.createElement(PageHeader, {
    breadcrumbs: ['System', 'Audit Log'],
    title: "Audit Log",
    status: /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      icon: "verified"
    }, "Tamper-evident \u2022 Hash chain intact"),
    actions: /*#__PURE__*/React.createElement(Button, {
      variant: "dark",
      icon: "download"
    }, "Export Evidence Pack")
  }), /*#__PURE__*/React.createElement(Card, {
    padding: 20
  }, /*#__PURE__*/React.createElement(TableToolbar, {
    search: t.q,
    onSearch: t.setQ,
    placeholder: "Search actor, event, target\u2026",
    filters: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      icon: "calendar_month",
      options: ['Today', 'Last 7 days', 'This period']
    }), /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      icon: "person",
      options: ['All actors', 'Users', 'System', 'API keys']
    })),
    chips: /*#__PURE__*/React.createElement(FilterChips, {
      value: chip,
      onChange: setChip,
      options: [{
        value: 'all',
        label: 'All events',
        count: ev.length
      }, {
        value: 'success',
        label: 'Verified'
      }, {
        value: 'warning',
        label: 'Changes'
      }, {
        value: 'danger',
        label: 'Security',
        count: 1,
        tone: 'danger'
      }]
    })
  }), /*#__PURE__*/React.createElement(DataTable, {
    style: {
      marginTop: 14
    },
    maxHeight: 560,
    density: "compact",
    rows: t.rows,
    columns: [{
      key: 'time',
      label: 'Timestamp (AST)',
      mono: true
    }, {
      key: 'actor',
      label: 'Actor',
      strong: true,
      weight: 600
    }, {
      key: 'action',
      label: 'Event',
      render: r => /*#__PURE__*/React.createElement(Badge, {
        mono: true,
        size: "sm",
        tone: r.tone === 'neutral' ? 'neutral' : r.tone
      }, r.action)
    }, {
      key: 'target',
      label: 'Target'
    }, {
      key: 'hash',
      label: 'Ledger hash',
      mono: true,
      render: r => /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--mgh-ink-3)'
        }
      }, r.hash)
    }]
  }), /*#__PURE__*/React.createElement(Pagination, {
    style: {
      marginTop: 14
    },
    page: t.page,
    pageSize: t.pageSize,
    total: t.total,
    onPage: t.setPage,
    noun: "events"
  })));
}
window.SCREENS = Object.assign(window.SCREENS || {}, {
  jira: JiraIntegration,
  projects: Projects,
  reports: Reports,
  admin: Administration,
  settings: CompanySettings,
  audit: AuditLog
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/enterprise/ScreensOps.jsx", error: String((e && e.message) || e) }); }

// ui_kits/enterprise/ScreensPayroll.jsx
try { (() => {
const {
  Button,
  IconButton,
  Badge,
  Avatar,
  Icon,
  Card,
  FilterChips,
  StatCard,
  MetricTile,
  DataTable,
  TableToolbar,
  Pagination,
  ActivityFeed,
  Tabs,
  PageHeader,
  Select,
  ProgressBar,
  KeyValue,
  Stepper,
  Checkbox,
  TextField
} = window.MyGlobalHubDesignSystem_2a603d;
function PayrollDashboard({
  go
}) {
  const byEntity = [['Dominicana SRL', 29840, 'DOP / USD'], ['USA Inc.', 13260, 'USD'], ['UK Ltd.', 5820, 'GBP']];
  const comp = [{
    label: 'PP-03',
    a: 39.2,
    b: 4.9
  }, {
    label: 'PP-04',
    a: 40.1,
    b: 5.2
  }, {
    label: 'PP-05',
    a: 40.8,
    b: 5.2
  }, {
    label: 'PP-06',
    a: 41.0,
    b: 5.8
  }, {
    label: 'PP-07',
    a: 41.6,
    b: 5.8
  }, {
    label: 'PP-08',
    a: 42.3,
    b: 6.6
  }];
  return /*#__PURE__*/React.createElement(Page, null, /*#__PURE__*/React.createElement(PageHeader, {
    breadcrumbs: ['Payroll & Finance', 'Overview'],
    title: "Payroll Dashboard",
    status: /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      dot: true
    }, "Payroll ready \u2022 Cycle PP-2025-08 \u2022 Auto-lock in 4d 18h"),
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: "calendar_month"
    }, "Pay calendar"), /*#__PURE__*/React.createElement(Button, {
      icon: "play_arrow",
      onClick: () => go('processing')
    }, "Start Payroll Run"))
  }), /*#__PURE__*/React.createElement(Grid, {
    min: 220
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Gross payroll",
    value: "$48,920",
    unit: "USD",
    icon: "payments",
    delta: "+3.2% vs PP-07"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Employer taxes",
    value: "$6,114",
    unit: "USD",
    icon: "account_balance_wallet",
    tone: "accent",
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", null, "TSS \u2022 FICA \u2022 NI"), /*#__PURE__*/React.createElement("span", null, "12.5%"))
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Net disbursement",
    value: "$38,402",
    unit: "USD",
    icon: "send_money",
    tone: "success",
    progress: 100,
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--mgh-success)'
      }
    }, "100% routed"), /*#__PURE__*/React.createElement("span", null, "5 banks"))
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Exceptions",
    value: "3",
    icon: "report",
    tone: "danger",
    footer: /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--mgh-danger)'
      }
    }, "Resolve before lock")
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,2fr) minmax(300px,1fr)',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    icon: "stacked_bar_chart",
    title: "Regular vs overtime cost",
    subtitle: "Thousands USD per period"
  }, /*#__PURE__*/React.createElement(BarChart, {
    data: comp,
    height: 200,
    color: "var(--mgh-primary)",
    color2: "var(--mgh-accent)",
    legend: [['var(--mgh-primary)', 'Regular'], ['var(--mgh-accent)', 'Overtime & premiums']]
  })), /*#__PURE__*/React.createElement(Card, {
    icon: "domain",
    title: "By operating entity"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, byEntity.map(([n, v, c]) => /*#__PURE__*/React.createElement("div", {
    key: n
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 13px var(--font-sans)',
      color: 'var(--mgh-ink)'
    }
  }, n, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--mgh-ink-3)',
      fontWeight: 400
    }
  }, c)), /*#__PURE__*/React.createElement("b", {
    style: {
      font: '700 13px var(--font-sans)',
      color: 'var(--mgh-ink)'
    }
  }, fmt$(v))), /*#__PURE__*/React.createElement(ProgressBar, {
    value: v / 489.2
  })))))), /*#__PURE__*/React.createElement(Card, {
    icon: "event_repeat",
    title: "Upcoming pay periods",
    bodyStyle: {
      paddingTop: 14
    }
  }, /*#__PURE__*/React.createElement(DataTable, {
    density: "compact",
    rows: [{
      id: 'PP-2025-08',
      range: 'Apr 01 – Apr 14',
      pay: 'Apr 19',
      st: 'In approval',
      g: 48920
    }, {
      id: 'PP-2025-09',
      range: 'Apr 15 – Apr 28',
      pay: 'May 03',
      st: 'Open',
      g: 49300
    }, {
      id: 'PP-2025-10',
      range: 'Apr 29 – May 12',
      pay: 'May 17',
      st: 'Scheduled',
      g: 49300
    }],
    columns: [{
      key: 'id',
      label: 'Cycle',
      mono: true,
      strong: true
    }, {
      key: 'range',
      label: 'Work period'
    }, {
      key: 'pay',
      label: 'Pay date'
    }, {
      key: 'st',
      label: 'Status',
      render: r => /*#__PURE__*/React.createElement(Badge, {
        size: "sm",
        tone: r.st === 'In approval' ? 'warning' : r.st === 'Open' ? 'info' : 'neutral'
      }, r.st)
    }, {
      key: 'g',
      label: 'Projected gross',
      align: 'right',
      strong: true,
      render: r => fmt$(r.g)
    }]
  })));
}
function PayrollProcessing({
  notify
}) {
  const [step, setStep] = React.useState(2);
  const [sel, setSel] = React.useState([]);
  const names = ['Pre-checks', 'Import Hours', 'Review Exceptions', 'Calculate', 'Approve & Lock', 'Disburse'];
  const steps = names.map((l, i) => ({
    label: l,
    state: i < step ? 'done' : i === step ? 'current' : 'pending',
    icon: ['rule', 'download', 'report', 'calculate', 'lock', 'send_money'][i],
    status: i < step ? 'Complete' : i === step ? 'Current Step' : 'Pending'
  }));
  const ex = [{
    id: 1,
    emp: EMPLOYEES[2],
    issue: 'Overtime exceeds 10h policy cap',
    sev: 'High',
    act: 'Needs VP sign-off'
  }, {
    id: 2,
    emp: EMPLOYEES[4],
    issue: 'Jira worklog 4.0h short of clock time',
    sev: 'Medium',
    act: 'Return to employee'
  }, {
    id: 3,
    emp: EMPLOYEES[11],
    issue: 'New bank account in 72h cooling period',
    sev: 'Medium',
    act: 'Hold allocation'
  }];
  return /*#__PURE__*/React.createElement(Page, null, /*#__PURE__*/React.createElement(PageHeader, {
    breadcrumbs: ['Payroll & Finance', 'Pay Periods & Processing', 'PP-2025-08'],
    title: "Payroll Processing",
    status: /*#__PURE__*/React.createElement(Badge, {
      tone: "warning",
      dot: true
    }, "Run #2025-08-A \u2022 Step ", step + 1, " of 6"),
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: "arrow_back",
      disabled: step === 0,
      onClick: () => setStep(s => s - 1)
    }, "Back"), /*#__PURE__*/React.createElement(Button, {
      icon: step === 5 ? 'send_money' : 'arrow_forward',
      onClick: () => {
        if (step < 5) setStep(s => s + 1);
        notify(step === 5 ? 'Disbursement released to banks' : `${names[step]} completed`);
      }
    }, step === 5 ? 'Release Funds' : 'Continue to ' + names[step + 1]))
  }), /*#__PURE__*/React.createElement(Card, {
    padding: 24
  }, /*#__PURE__*/React.createElement(Stepper, {
    steps: steps
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(MetricTile, {
    tone: "white",
    label: "Employees",
    value: "86"
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: "white",
    label: "Hours",
    value: "7,382.5h"
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: "white",
    label: "Gross",
    value: "$48,920"
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: "white",
    label: "Deductions",
    value: "$10,518"
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: "success",
    label: "Net",
    value: "$38,402"
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: "danger",
    label: "Exceptions",
    value: "3"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,2fr) minmax(300px,1fr)',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    icon: "report",
    title: "Exceptions to resolve",
    subtitle: "Payroll cannot lock while high-severity items are open.",
    bodyStyle: {
      paddingTop: 14
    }
  }, /*#__PURE__*/React.createElement(DataTable, {
    selectable: true,
    selected: sel,
    onSelectedChange: setSel,
    bulkBar: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      icon: "done",
      onClick: () => {
        notify(`${sel.length} exceptions resolved`);
        setSel([]);
      }
    }, "Mark resolved"),
    rows: ex,
    columns: [{
      key: 'emp',
      label: 'Employee',
      render: r => /*#__PURE__*/React.createElement(EmployeeCell, {
        e: r.emp,
        sub: r.emp.id
      })
    }, {
      key: 'issue',
      label: 'Issue',
      wrap: true
    }, {
      key: 'sev',
      label: 'Severity',
      render: r => /*#__PURE__*/React.createElement(Badge, {
        size: "sm",
        tone: r.sev === 'High' ? 'danger' : 'warning'
      }, r.sev)
    }, {
      key: 'act',
      label: 'Suggested action',
      render: r => /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        variant: "ghost"
      }, r.act)
    }]
  })), /*#__PURE__*/React.createElement(Card, {
    icon: "checklist",
    title: "Pre-run checklist"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, ['Exchange rates locked (DOP 59.12)', 'TSS & ISR tables — 2025 rev.', 'Jira Cloud sync < 5m old', 'Bank cut-off: FedWire 16:00 ET', 'Dual control approver assigned'].map((t, i) => /*#__PURE__*/React.createElement(Checkbox, {
    key: t,
    checked: i < 4,
    label: t
  }))))));
}
function PayStubPreview({
  notify
}) {
  const e = EMPLOYEES[0];
  const ded = [['ISR withholding', 667.32], ['TSS — SFS (3.04%)', 138.06], ['TSS — AFP (2.87%)', 130.34], ['Health plan (voluntary)', 42.00]];
  const net = e.gross - ded.reduce((s, d) => s + d[1], 0);
  const row = (l, a, b, c, bold) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 80px 90px 110px',
      gap: 8,
      padding: '8px 0',
      borderBottom: '1px solid var(--mgh-surface-2)',
      font: `${bold ? 700 : 500} 13px var(--font-sans)`,
      color: bold ? 'var(--mgh-ink)' : 'var(--mgh-ink-2)'
    }
  }, /*#__PURE__*/React.createElement("span", null, l), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right'
    }
  }, a), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right'
    }
  }, b), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right',
      color: 'var(--mgh-ink)'
    }
  }, c));
  return /*#__PURE__*/React.createElement(Page, null, /*#__PURE__*/React.createElement(PageHeader, {
    breadcrumbs: ['Payroll & Finance', 'Pay Stubs', e.id],
    title: "Pay Stub Preview",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      options: ['PP-2025-08', 'PP-2025-07', 'PP-2025-06']
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: "mail",
      onClick: () => notify('Pay stub emailed to employee')
    }, "Email"), /*#__PURE__*/React.createElement(Button, {
      variant: "dark",
      icon: "download",
      onClick: () => notify('PDF downloaded')
    }, "Download PDF"))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) 320px',
      gap: 20,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--mgh-surface-1)',
      borderRadius: 16,
      padding: 28,
      display: 'flex',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      maxWidth: 720,
      background: '#fff',
      borderRadius: 4,
      boxShadow: 'var(--shadow-lg)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      background: 'var(--mgh-navy)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 36,
      display: 'flex',
      flexDirection: 'column',
      gap: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-official.png",
    alt: "My Global Hub",
    style: {
      height: 52
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mgh-overline"
  }, "Earnings statement"), /*#__PURE__*/React.createElement("div", {
    className: "mgh-h3"
  }, "PP-2025-08"), /*#__PURE__*/React.createElement("div", {
    className: "mgh-body"
  }, "Pay date Apr 19, 2025"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14,
      padding: 14,
      borderRadius: 8,
      background: 'var(--mgh-surface-page)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mgh-overline"
  }, "Employee"), /*#__PURE__*/React.createElement("div", {
    className: "mgh-lg"
  }, e.name), /*#__PURE__*/React.createElement("div", {
    className: "mgh-body"
  }, e.id, " \u2022 ", e.role)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mgh-overline"
  }, "Employer"), /*#__PURE__*/React.createElement("div", {
    className: "mgh-lg"
  }, "My Global Hub Dominicana SRL"), /*#__PURE__*/React.createElement("div", {
    className: "mgh-body"
  }, "RNC 1-31-88421-7 \u2022 Punta Cana"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mgh-overline",
    style: {
      marginBottom: 4
    }
  }, "Earnings"), row('Description', 'Hours', 'Rate', 'Amount', true), row('Regular', '80.0', fmt$(e.rate), fmt$(e.reg * e.rate)), row('Overtime 1.5×', e.ot.toFixed(1), fmt$(e.rate * 1.5), fmt$(e.ot * e.rate * 1.5)), row('Gross pay', '', '', fmt$(e.gross), true)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mgh-overline",
    style: {
      marginBottom: 4
    }
  }, "Deductions"), ded.map(([l, v]) => row(l, '', '', '−' + fmt$(v)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mgh-overline",
    style: {
      marginBottom: 8
    }
  }, "Direct deposit allocation"), /*#__PURE__*/React.createElement(ProgressBar, {
    height: 16,
    segments: [{
      value: 80,
      color: 'var(--mgh-primary)',
      label: 'Banco BHD León 80%'
    }, {
      value: 20,
      color: 'var(--mgh-navy)',
      label: 'Chase 20%'
    }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderRadius: 8,
      background: 'var(--mgh-navy)',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mgh-overline",
    style: {
      color: 'var(--mgh-nav-text)'
    }
  }, "Net pay"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '800 28px var(--font-sans)',
      letterSpacing: '-0.56px'
    }
  }, fmt$(net))), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11px/16px var(--font-sans)',
      color: 'var(--mgh-ink-3)'
    }
  }, "Withholdings computed under Dominican Law 87-01 and the Dominican Tax Code. Document ID MGH-PS-2025-08-1042 \u2022 SHA-256 verified.")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Summary",
    padding: 20
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(KeyValue, {
    label: "Gross",
    value: fmt$(e.gross)
  }), /*#__PURE__*/React.createElement(KeyValue, {
    label: "Deductions",
    value: '−' + fmt$(ded.reduce((s, d) => s + d[1], 0))
  }), /*#__PURE__*/React.createElement(KeyValue, {
    label: "Net",
    value: fmt$(net),
    aside: /*#__PURE__*/React.createElement(Badge, {
      tone: "success"
    }, "Verified")
  }))), /*#__PURE__*/React.createElement(Card, {
    title: "Year to date",
    padding: 20
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(KeyValue, {
    label: "YTD gross",
    value: "$36,329.75"
  }), /*#__PURE__*/React.createElement(KeyValue, {
    label: "YTD ISR",
    value: "$5,449.46"
  }))))));
}
function Banking({
  notify
}) {
  const accounts = [{
    id: 1,
    bank: 'Banco BHD León',
    code: 'BHD',
    country: 'Dominican Republic',
    type: 'Primary ACH',
    acct: '•••• 8491',
    routing: 'BHDLDO22',
    cur: 'DOP / USD',
    st: 'Verified',
    vol: 29840
  }, {
    id: 2,
    bank: 'Chase Bank USA, N.A.',
    code: 'JPMC',
    country: 'United States',
    type: 'Offshore FedWire',
    acct: '•••• 2910',
    routing: '021000021',
    cur: 'USD',
    st: 'Verified',
    vol: 13260
  }, {
    id: 3,
    bank: 'Barclays',
    code: 'BARC',
    country: 'United Kingdom',
    type: 'BACS',
    acct: '•••• 7712',
    routing: '20-00-00',
    cur: 'GBP',
    st: 'Verified',
    vol: 5820
  }, {
    id: 4,
    bank: 'Revolut Business',
    code: 'REV',
    country: 'EU',
    type: 'SEPA',
    acct: '•••• 0045',
    routing: 'REVOLT21',
    cur: 'EUR',
    st: 'Cooling 72h',
    vol: 0
  }];
  const t = useTable(accounts, {
    search: ['bank', 'country', 'type'],
    pageSize: 10
  });
  return /*#__PURE__*/React.createElement(Page, null, /*#__PURE__*/React.createElement(PageHeader, {
    breadcrumbs: ['Payroll & Finance', 'Banking & Allocations'],
    title: "Central Banking & Treasury",
    description: "Funding accounts, payout rails and multi-bank splits for every operating entity.",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: "history"
    }, "Audit History"), /*#__PURE__*/React.createElement(Button, {
      icon: "add_circle",
      onClick: () => notify('2FA challenge sent to YubiKey')
    }, "Add Bank Account"))
  }), /*#__PURE__*/React.createElement(Grid, {
    min: 220
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Treasury balance",
    value: "$412.8k",
    icon: "account_balance",
    style: {
      minHeight: 0
    }
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "This cycle outflow",
    value: "$48.9k",
    icon: "send_money",
    tone: "accent",
    style: {
      minHeight: 0
    }
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Verified rails",
    value: "3 / 4",
    icon: "verified_user",
    tone: "success",
    style: {
      minHeight: 0
    }
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Pending verification",
    value: "1",
    icon: "lock_clock",
    tone: "warning",
    style: {
      minHeight: 0
    }
  })), /*#__PURE__*/React.createElement(Card, {
    padding: 20,
    icon: "account_balance",
    title: "Disbursement accounts"
  }, /*#__PURE__*/React.createElement(TableToolbar, {
    search: t.q,
    onSearch: t.setQ,
    placeholder: "Search bank, country, rail\u2026",
    actions: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary",
      icon: "download"
    }, "Export")
  }), /*#__PURE__*/React.createElement(DataTable, {
    style: {
      marginTop: 14
    },
    sort: t.sort,
    onSort: t.setSort,
    rows: t.rows,
    columns: [{
      key: 'bank',
      label: 'Institution',
      sortable: true,
      render: r => /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          width: 36,
          height: 36,
          borderRadius: 8,
          background: r.id === 2 ? 'var(--mgh-navy)' : 'var(--mgh-primary-50)',
          color: r.id === 2 ? '#fff' : 'var(--mgh-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: '800 11px var(--font-sans)'
        }
      }, r.code), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        style: {
          font: '600 13px var(--font-sans)',
          color: 'var(--mgh-ink)'
        }
      }, r.bank), /*#__PURE__*/React.createElement("div", {
        style: {
          font: '400 11px var(--font-sans)',
          color: 'var(--mgh-ink-3)'
        }
      }, r.country)))
    }, {
      key: 'type',
      label: 'Rail',
      sortable: true,
      render: r => /*#__PURE__*/React.createElement(Badge, {
        size: "sm",
        tone: "primary",
        uppercase: true
      }, r.type)
    }, {
      key: 'acct',
      label: 'Account',
      mono: true
    }, {
      key: 'routing',
      label: 'BIC / Routing',
      mono: true
    }, {
      key: 'cur',
      label: 'Currency'
    }, {
      key: 'st',
      label: 'Status',
      render: r => /*#__PURE__*/React.createElement(Badge, {
        size: "sm",
        dot: true,
        tone: r.st === 'Verified' ? 'success' : 'warning'
      }, r.st)
    }, {
      key: 'vol',
      label: 'Cycle volume',
      align: 'right',
      sortable: true,
      strong: true,
      render: r => fmt$(r.vol)
    }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    icon: "call_split",
    title: "Default split rule",
    subtitle: "Applied to contractors in MGH Dominicana SRL"
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    height: 16,
    label: "Allocation ratio summary",
    valueLabel: "100% Allocated (Balanced)",
    segments: [{
      value: 80,
      color: 'var(--mgh-primary)',
      label: '80% Primary (DOP/USD)'
    }, {
      value: 20,
      color: 'var(--mgh-navy)',
      label: '20% USD'
    }]
  })), /*#__PURE__*/React.createElement(Card, {
    icon: "gavel",
    title: "Compliance & 3-Day Verification Policy",
    tone: "muted"
  }, /*#__PURE__*/React.createElement("p", {
    className: "mgh-body",
    style: {
      margin: 0
    }
  }, "Bank account modifications require hardware-token 2FA and countersignature from HR Finance leadership. Allocation updates are subject to an auditable 72-hour cooling period to prevent payroll diversion fraud."))));
}
window.SCREENS = Object.assign(window.SCREENS || {}, {
  payroll: PayrollDashboard,
  processing: PayrollProcessing,
  paystub: PayStubPreview,
  banking: Banking
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/enterprise/ScreensPayroll.jsx", error: String((e && e.message) || e) }); }

// ui_kits/enterprise/ScreensPeople.jsx
try { (() => {
const {
  Button,
  IconButton,
  Badge,
  Avatar,
  Icon,
  Card,
  FilterChips,
  StatCard,
  MetricTile,
  DataTable,
  TableToolbar,
  Pagination,
  ActivityFeed,
  Tabs,
  PageHeader,
  Select,
  ProgressBar,
  KeyValue,
  Toggle
} = window.MyGlobalHubDesignSystem_2a603d;
function Dashboard({
  go
}) {
  const trend = [['PP-03', 44.1], ['PP-04', 45.3], ['PP-05', 46.0], ['PP-06', 46.8], ['PP-07', 47.4], ['PP-08', 48.9]].map(([l, a]) => ({
    label: l,
    a,
    hi: l === 'PP-08'
  }));
  const depts = [['Engineering', 38, 'var(--mgh-primary)'], ['Infrastructure', 18, 'var(--mgh-accent)'], ['Product', 14, 'var(--mgh-navy)'], ['Analytics', 12, 'var(--mgh-success)'], ['Other', 18, 'var(--mgh-ink-4)']];
  return /*#__PURE__*/React.createElement(Page, null, /*#__PURE__*/React.createElement(PageHeader, {
    breadcrumbs: ['Overview'],
    title: "Good morning, Elena",
    description: "PP-2025-08 closes in 4 days 18 hours. 14 timesheets still need your approval before Finance Run.",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: "calendar_month"
    }, "Apr 01 \u2013 Apr 14"), /*#__PURE__*/React.createElement(Button, {
      icon: "assignment_turned_in",
      onClick: () => go('approvals')
    }, "Review 14 Approvals"))
  }), /*#__PURE__*/React.createElement(Grid, {
    min: 220
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Active workforce",
    value: "86",
    unit: "employees",
    icon: "groups",
    delta: "+4 this quarter"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Period payroll",
    value: "$48.9k",
    unit: "USD",
    icon: "payments",
    tone: "accent",
    delta: "+3.2% vs PP-07"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Billable utilization",
    value: "91.4%",
    icon: "data_usage",
    tone: "success",
    progress: 91.4
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Compliance alerts",
    value: "3",
    icon: "gpp_maybe",
    tone: "danger",
    footer: /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--mgh-danger)'
      }
    }, "2 Jira \u2022 1 Banking")
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,2fr) minmax(300px,1fr)',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Gross payroll trend",
    subtitle: "Last 6 bi-weekly periods (thousands USD)",
    icon: "monitoring",
    actions: /*#__PURE__*/React.createElement(Tabs, {
      value: "pp",
      tabs: [{
        value: 'pp',
        label: 'Period'
      }, {
        value: 'q',
        label: 'Quarter'
      }],
      style: {
        padding: 3
      }
    })
  }, /*#__PURE__*/React.createElement(BarChart, {
    data: trend,
    height: 200,
    format: v => '$' + v + 'k'
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Cost by department",
    icon: "donut_small"
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    height: 14,
    segments: depts.map(([l, v, c]) => ({
      value: v,
      color: c,
      label: v + '%'
    }))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      marginTop: 16
    }
  }, depts.map(([l, v, c]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      font: '500 13px var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 2,
      background: c
    }
  }), l), /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--mgh-ink)'
    }
  }, fmt$(48920 * v / 100))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,2fr) minmax(300px,1fr)',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Needs your attention",
    icon: "priority_high",
    actions: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost",
      iconRight: "arrow_forward",
      onClick: () => go('queue')
    }, "View queue"),
    bodyStyle: {
      paddingTop: 14
    }
  }, /*#__PURE__*/React.createElement(DataTable, {
    density: "compact",
    onRowClick: r => go('approvals', r.id),
    rows: EMPLOYEES.filter(e => e.status !== 'Approved').slice(0, 5),
    columns: [{
      key: 'name',
      label: 'Employee',
      render: r => /*#__PURE__*/React.createElement(EmployeeCell, {
        e: r
      })
    }, {
      key: 'total',
      label: 'Hours',
      align: 'right',
      render: r => fmtH(r.total)
    }, {
      key: 'status',
      label: 'Status',
      render: r => /*#__PURE__*/React.createElement(Badge, {
        size: "sm",
        tone: STATUS_TONE[r.status]
      }, r.status)
    }, {
      key: 'gross',
      label: 'Est. gross',
      align: 'right',
      strong: true,
      render: r => fmt$(r.gross)
    }]
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Period timeline",
    icon: "event_upcoming"
  }, /*#__PURE__*/React.createElement(ActivityFeed, {
    items: [{
      icon: 'check',
      tone: 'success',
      title: 'Timesheet submission closed',
      meta: 'Apr 14, 17:00'
    }, {
      icon: 'how_to_reg',
      tone: 'primary',
      title: 'Supervisor & PM approval',
      meta: 'Now • due Apr 16'
    }, {
      icon: 'badge',
      tone: 'neutral',
      title: 'HR review',
      meta: 'Apr 17'
    }, {
      icon: 'account_balance',
      tone: 'neutral',
      title: 'Disbursement (ACH / FedWire)',
      meta: 'Apr 19'
    }]
  }))));
}
function Employees({
  go
}) {
  const [chip, setChip] = React.useState('all');
  const [dept, setDept] = React.useState('All departments');
  const [type, setType] = React.useState('All types');
  const base = EMPLOYEES.filter(e => (chip === 'all' || e.entity.includes(chip)) && (dept === 'All departments' || e.dept === dept) && (type === 'All types' || e.type === type));
  const t = useTable(base, {
    search: ['name', 'id', 'role', 'dept', 'loc'],
    pageSize: 10,
    initialSort: {
      key: 'name',
      dir: 'asc'
    }
  });
  return /*#__PURE__*/React.createElement(Page, null, /*#__PURE__*/React.createElement(PageHeader, {
    breadcrumbs: ['Workforce', 'Employee Directory'],
    title: "Employees",
    description: "86 people across 3 operating entities.",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: "upload"
    }, "Import CSV"), /*#__PURE__*/React.createElement(Button, {
      icon: "person_add"
    }, "Add Employee"))
  }), /*#__PURE__*/React.createElement(Card, {
    padding: 20
  }, /*#__PURE__*/React.createElement(TableToolbar, {
    search: t.q,
    onSearch: t.setQ,
    placeholder: "Search name, ID, role, location\u2026",
    filters: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      icon: "apartment",
      value: dept,
      onChange: setDept,
      options: ['All departments', ...new Set(EMPLOYEES.map(e => e.dept))]
    }), /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      icon: "work",
      value: type,
      onChange: setType,
      options: ['All types', ...new Set(EMPLOYEES.map(e => e.type))]
    })),
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary",
      icon: "view_column"
    }, "Columns"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary",
      icon: "download"
    }, "Export")),
    chips: /*#__PURE__*/React.createElement(FilterChips, {
      value: chip,
      onChange: setChip,
      options: [{
        value: 'all',
        label: 'All entities',
        count: EMPLOYEES.length
      }, {
        value: 'Dominicana',
        label: 'Dominicana SRL',
        count: EMPLOYEES.filter(e => e.entity.includes('Dominicana')).length
      }, {
        value: 'USA',
        label: 'USA Inc.',
        count: EMPLOYEES.filter(e => e.entity.includes('USA')).length
      }, {
        value: 'UK',
        label: 'UK Ltd.',
        count: EMPLOYEES.filter(e => e.entity.includes('UK')).length
      }]
    })
  }), /*#__PURE__*/React.createElement(DataTable, {
    style: {
      marginTop: 14
    },
    maxHeight: 560,
    selectable: true,
    selected: t.sel,
    onSelectedChange: t.setSel,
    sort: t.sort,
    onSort: t.setSort,
    rows: t.rows,
    onRowClick: r => go('profile', r.id),
    bulkBar: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary",
      icon: "mail"
    }, "Message"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary",
      icon: "download"
    }, "Export")),
    columns: [{
      key: 'name',
      label: 'Employee',
      sortable: true,
      render: r => /*#__PURE__*/React.createElement(EmployeeCell, {
        e: r
      })
    }, {
      key: 'id',
      label: 'ID',
      sortable: true,
      render: r => /*#__PURE__*/React.createElement(Badge, {
        mono: true,
        size: "sm"
      }, r.id)
    }, {
      key: 'dept',
      label: 'Department',
      sortable: true
    }, {
      key: 'entity',
      label: 'Entity',
      sortable: true
    }, {
      key: 'loc',
      label: 'Location',
      sortable: true
    }, {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: r => /*#__PURE__*/React.createElement(Badge, {
        size: "sm",
        tone: r.type.startsWith('Contractor') ? 'primary' : 'neutral'
      }, r.type)
    }, {
      key: 'rate',
      label: 'Rate',
      align: 'right',
      sortable: true,
      strong: true,
      render: r => fmt$(r.rate) + '/hr'
    }, {
      key: 'x',
      label: '',
      align: 'right',
      render: () => /*#__PURE__*/React.createElement(IconButton, {
        icon: "more_vert",
        size: 28,
        title: "More"
      })
    }]
  }), /*#__PURE__*/React.createElement(Pagination, {
    style: {
      marginTop: 14
    },
    page: t.page,
    pageSize: t.pageSize,
    total: t.total,
    onPage: t.setPage,
    noun: "employees"
  })));
}
function EmployeeProfile({
  empId,
  go,
  notify
}) {
  const e = EMPLOYEES.find(x => x.id === empId) || EMPLOYEES[0];
  const [tab, setTab] = React.useState('overview');
  const [sync, setSync] = React.useState(true);
  return /*#__PURE__*/React.createElement(Page, null, /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center',
      font: '500 13px var(--font-sans)',
      color: 'var(--mgh-ink-2)'
    }
  }, /*#__PURE__*/React.createElement("a", {
    onClick: () => go('employees'),
    style: {
      cursor: 'pointer',
      color: 'var(--mgh-ink-2)',
      fontWeight: 500
    }
  }, "Workforce"), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron_right",
    size: 14
  }), /*#__PURE__*/React.createElement("a", {
    onClick: () => go('employees'),
    style: {
      cursor: 'pointer',
      color: 'var(--mgh-ink-2)',
      fontWeight: 500
    }
  }, "Employee Directory"), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron_right",
    size: 14
  }), /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--mgh-ink)'
    }
  }, e.name, " (", e.id, ")")), /*#__PURE__*/React.createElement(Card, {
    padding: 24
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 24,
      flexWrap: 'wrap',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 120,
      height: 120,
      borderRadius: 12,
      background: e.avatar ? `url(${e.avatar}) center/cover` : 'var(--mgh-primary-100)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: '700 40px var(--font-sans)',
      color: 'var(--mgh-primary)',
      flexShrink: 0
    }
  }, !e.avatar && e.name.split(' ').map(s => s[0]).join('')), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 280
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mgh-title"
  }, e.name), /*#__PURE__*/React.createElement(Badge, {
    tone: "success"
  }, "Active / On-Roll")), /*#__PURE__*/React.createElement(Badge, {
    mono: true,
    size: "sm",
    style: {
      marginTop: 4
    }
  }, e.id), /*#__PURE__*/React.createElement("div", {
    className: "mgh-lg",
    style: {
      fontWeight: 500,
      marginTop: 6
    }
  }, e.role), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 14px/20px var(--font-sans)',
      color: 'var(--mgh-ink-2)'
    }
  }, e.dept, " \u2022 ", e.project), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      marginTop: 8,
      flexWrap: 'wrap',
      font: '500 13px var(--font-sans)',
      color: 'var(--mgh-ink-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "domain",
    size: 16
  }), e.entity), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "work",
    size: 16
  }), e.type), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "calendar_today",
    size: 16
  }), "Joined ", e.joined))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    icon: "edit"
  }, "Edit Employee"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    icon: "receipt_long",
    onClick: () => go('paystub')
  }, "Generate Pay Statement"), /*#__PURE__*/React.createElement(Button, {
    variant: "dark",
    icon: "sync_lock",
    onClick: () => notify('Jira API token reset')
  }, "Reset Jira API Token"))), /*#__PURE__*/React.createElement(Tabs, {
    style: {
      marginTop: 20
    },
    value: tab,
    onChange: setTab,
    tabs: [{
      value: 'overview',
      label: 'Overview & Profile'
    }, {
      value: 'bank',
      label: 'Multi-Bank Allocations',
      dot: true
    }, {
      value: 'comp',
      label: 'Compensation & Tax'
    }, {
      value: 'jira',
      label: 'Jira Integration',
      tag: 'LIVE'
    }, {
      value: 'pto',
      label: 'Time Off & PTO'
    }, {
      value: 'docs',
      label: 'Documents'
    }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.4fr) minmax(300px,1fr)',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    icon: "badge",
    title: "Employment details"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(KeyValue, {
    label: "Manager",
    value: e.mgr
  }), /*#__PURE__*/React.createElement(KeyValue, {
    label: "Work location",
    value: e.loc
  }), /*#__PURE__*/React.createElement(KeyValue, {
    label: "Pay frequency",
    value: "Bi-weekly"
  }), /*#__PURE__*/React.createElement(KeyValue, {
    label: "Primary bank",
    value: e.bank
  }), /*#__PURE__*/React.createElement(KeyValue, {
    label: "RNC / C\xE9dula Personal",
    value: "001-1829472-3",
    mono: true,
    aside: /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      size: "sm"
    }, "Active")
  }), /*#__PURE__*/React.createElement(KeyValue, {
    label: "TSS Registry",
    value: "ARS Primera, AFP Crecer",
    aside: /*#__PURE__*/React.createElement(Icon, {
      name: "verified_user",
      size: 18,
      color: "var(--mgh-success)"
    })
  }))), /*#__PURE__*/React.createElement(Card, {
    icon: "payments",
    title: "Compensation & Overtime Rules",
    actions: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost"
    }, "Edit Tariff")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(MetricTile, {
    label: "Base hourly",
    value: fmt$(e.rate),
    sub: "USD / hr",
    align: "center"
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: "success",
    label: "Overtime 1.5\xD7",
    value: fmt$(e.rate * 1.5),
    sub: "> 44h regular",
    align: "center"
  }), /*#__PURE__*/React.createElement(MetricTile, {
    tone: "warning",
    label: "Sunday / Holiday",
    value: fmt$(e.rate * 2),
    sub: "Double rate",
    align: "center"
  })), /*#__PURE__*/React.createElement(ProgressBar, {
    style: {
      marginTop: 14
    },
    value: 96.4,
    tone: "success",
    label: "Billable efficiency \u2014 target \u2265 95%",
    valueLabel: "96.4% Compliant"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    icon: "hub",
    title: "Jira Cloud Account Binding",
    actions: /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      dot: true
    }, "Connected")
  }, /*#__PURE__*/React.createElement(KeyValue, {
    label: "Atlassian Cloud ID",
    value: e.name.toLowerCase().replace(' ', '.') + '@globalhub.atlassian.net',
    aside: /*#__PURE__*/React.createElement(IconButton, {
      icon: "content_copy",
      size: 28,
      title: "Copy"
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "mgh-overline",
    style: {
      margin: '14px 0 8px'
    }
  }, "Bound worklog projects"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    dot: true,
    tone: "primary"
  }, "ATLAS (Core Platform)"), /*#__PURE__*/React.createElement(Badge, {
    dot: true,
    tone: "info"
  }, "PERF (Infrastructure)"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    icon: "add"
  }, "Bind Project")), /*#__PURE__*/React.createElement(Toggle, {
    style: {
      marginTop: 14,
      padding: 12,
      borderRadius: 8,
      background: 'var(--mgh-surface-1)'
    },
    checked: sync,
    onChange: setSync,
    label: "Real-Time Worklog Auto-Sync",
    description: "Sync interval: Every 5m \u2022 Webhook Active"
  })), /*#__PURE__*/React.createElement(Card, {
    icon: "history",
    title: "System audit log",
    actions: /*#__PURE__*/React.createElement(Badge, {
      tone: "success"
    }, "Live Feed")
  }, /*#__PURE__*/React.createElement(ActivityFeed, {
    items: [{
      icon: 'done_all',
      tone: 'success',
      title: 'Bank route verification confirmed',
      meta: 'Today 09:14 • Compliance Engine'
    }, {
      icon: 'sync',
      tone: 'accent',
      title: '8.5h logged under ATLAS-3482',
      meta: 'Yesterday 06:30 • Jira Webhook'
    }, {
      icon: 'edit',
      tone: 'neutral',
      title: 'Tariff updated: OT threshold 44h',
      meta: 'Mar 28 • Ana Gómez'
    }]
  })))));
}
window.SCREENS = Object.assign(window.SCREENS || {}, {
  dashboard: Dashboard,
  employees: Employees,
  profile: EmployeeProfile
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/enterprise/ScreensPeople.jsx", error: String((e && e.message) || e) }); }

// ui_kits/enterprise/Shell.jsx
try { (() => {
const DS = window.MyGlobalHubDesignSystem_2a603d;
function Page({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 28,
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      maxWidth: 1600,
      ...style
    }
  }, children);
}
function Grid({
  cols = 4,
  min = 220,
  gap = 14,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
      gap,
      ...style
    }
  }, children);
}

// Simple CSS column chart — kit helper (no chart component in source)
function BarChart({
  data,
  height = 180,
  color = 'var(--mgh-primary)',
  color2,
  format = v => v,
  legend
}) {
  const max = Math.max(...data.map(d => (d.a || 0) + (d.b || 0))) * 1.1;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 10,
      height,
      padding: '0 4px',
      borderBottom: '1px solid var(--mgh-surface-3)',
      backgroundImage: 'linear-gradient(var(--mgh-surface-2) 1px, transparent 1px)',
      backgroundSize: `100% ${height / 4}px`
    }
  }, data.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    title: `${d.label}: ${format(d.a + (d.b || 0))}`,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      height: '100%',
      gap: 2
    }
  }, d.b != null && /*#__PURE__*/React.createElement("div", {
    style: {
      height: `${d.b / max * 100}%`,
      background: color2 || 'var(--mgh-accent)',
      borderRadius: '4px 4px 0 0'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: `${d.a / max * 100}%`,
      background: d.hi ? 'var(--mgh-navy)' : color,
      borderRadius: d.b != null ? '0 0 0 0' : '4px 4px 0 0'
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      padding: '6px 4px 0'
    }
  }, data.map((d, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      flex: 1,
      textAlign: 'center',
      font: '600 11px/14px var(--font-sans)',
      color: 'var(--mgh-ink-3)'
    }
  }, d.label))), legend && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      marginTop: 10
    }
  }, legend.map(([c, l]) => /*#__PURE__*/React.createElement("span", {
    key: l,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      font: '600 11px var(--font-sans)',
      color: 'var(--mgh-ink-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 2,
      background: c
    }
  }), l))));
}
function Modal({
  open,
  title,
  onClose,
  children,
  actions,
  width = 480
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(19,27,46,.4)',
      backdropFilter: 'blur(2px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width,
      maxWidth: '100%',
      background: '#fff',
      borderRadius: 16,
      boxShadow: 'var(--shadow-lg)',
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    className: "mgh-h3",
    style: {
      margin: 0
    }
  }, title), /*#__PURE__*/React.createElement(DS.IconButton, {
    icon: "close",
    title: "Close",
    onClick: onClose
  })), children, actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 8
    }
  }, actions)));
}
function Toast({
  msg
}) {
  if (!msg) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 120,
      background: 'var(--mgh-navy)',
      color: '#fff',
      padding: '10px 16px',
      borderRadius: 12,
      boxShadow: 'var(--shadow-lg)',
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      font: '600 13px var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement(DS.Icon, {
    name: "check_circle",
    size: 16,
    color: "var(--mgh-success-300)"
  }), msg);
}
function EmployeeCell({
  e,
  sub
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(DS.Avatar, {
    src: e.avatar,
    name: e.name,
    size: 32
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px/18px var(--font-sans)',
      color: 'var(--mgh-ink)'
    }
  }, e.name), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11px/14px var(--font-sans)',
      color: 'var(--mgh-ink-3)'
    }
  }, sub || e.role)));
}
const PERIOD = {
  code: 'PP-2025-08',
  range: '(Apr 01 - Apr 14, 2025)',
  phase: 'Supervisor Approval Phase'
};
function App() {
  const init = (location.hash || '').slice(1) || localStorage.getItem('mgh-route') || 'approvals';
  const [route, setRoute] = React.useState(init);
  const [empId, setEmpId] = React.useState('MGH-1042');
  const [toast, setToast] = React.useState('');
  const scroller = React.useRef();
  const go = (r, id) => {
    if (id) setEmpId(id);
    setRoute(r);
    localStorage.setItem('mgh-route', r);
    history.replaceState(null, '', '#' + r);
    if (scroller.current) scroller.current.scrollTop = 0;
  };
  const notify = m => {
    setToast(m);
    clearTimeout(window.__t);
    window.__t = setTimeout(() => setToast(''), 2400);
  };
  const S = window.SCREENS;
  const Screen = S[route] || S.dashboard;
  const navKey = route === 'profile' ? 'employees' : route;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: '100vh',
      background: 'var(--surface-app)'
    }
  }, /*#__PURE__*/React.createElement(DS.Sidebar, {
    logoSrc: "../../assets/logo-mark.png",
    entity: {
      name: 'My Global Hub Dominicana',
      sub: '(Punta Cana Operations)',
      tag: 'Multi-HQ'
    },
    sections: NAV,
    active: navKey,
    onNavigate: k => go(k),
    status: {
      label: 'Jira Cloud: Active',
      value: '14 Syncing'
    },
    user: {
      name: 'Elena Rostova',
      role: 'Lead PM & Approver',
      avatar: AVATARS + 'elena-rostova.jpg'
    }
  }), /*#__PURE__*/React.createElement("main", {
    ref: scroller,
    className: "mgh-scroll",
    style: {
      flex: 1,
      minWidth: 0,
      overflowY: 'auto',
      background: '#fff'
    }
  }, /*#__PURE__*/React.createElement(DS.TopBar, {
    period: PERIOD,
    notifications: 4,
    avatar: AVATARS + 'elena-rostova.jpg',
    userName: "Elena Rostova",
    actions: [{
      label: 'Bulk Actions',
      icon: 'checklist',
      variant: 'secondary',
      onClick: () => go('queue')
    }, {
      label: 'Export Register',
      icon: 'download',
      variant: 'dark',
      onClick: () => notify('Payroll register export queued (XLSX)')
    }]
  }), /*#__PURE__*/React.createElement(Screen, {
    go: go,
    empId: empId,
    notify: notify
  })), /*#__PURE__*/React.createElement(Toast, {
    msg: toast
  }));
}
Object.assign(window, {
  DS,
  Page,
  Grid,
  BarChart,
  Modal,
  EmployeeCell,
  PERIOD,
  App,
  SCREENS: window.SCREENS || {}
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/enterprise/Shell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/enterprise/data.jsx
try { (() => {
// Sample data for the My Global Hub enterprise kit (names/values follow the Figma file's sample content)
const A = '../../assets/avatars/';
const EMPLOYEES = [{
  id: 'MGH-1042',
  name: 'Carlos Mendez',
  role: 'Sr. Full Stack Developer',
  dept: 'Engineering',
  type: 'Contractor / Exempt',
  entity: 'MGH Dominicana SRL',
  loc: 'Punta Cana, DR',
  mgr: 'Elena Rostova',
  project: 'Atlas Core',
  rate: 52.5,
  reg: 80,
  ot: 6.5,
  pto: 0,
  match: 98.2,
  status: 'Awaiting PM',
  avatar: A + 'carlos-mendez.jpg',
  bank: 'Banco BHD León',
  joined: 'Jan 15, 2023'
}, {
  id: 'MGH-1088',
  name: 'Sofia Almonte',
  role: 'UI/UX Architect',
  dept: 'Product',
  type: 'Full-time',
  entity: 'MGH Dominicana SRL',
  loc: 'Santo Domingo, DR',
  mgr: 'Marcus Vance',
  project: 'Global Hub v3',
  rate: 44.5,
  reg: 80,
  ot: 0,
  pto: 8,
  match: 100,
  status: 'Awaiting Supervisor',
  bank: 'Banco Popular',
  joined: 'Mar 02, 2022'
}, {
  id: 'MGH-1102',
  name: 'David Wu',
  role: 'DevOps Engineer',
  dept: 'Infrastructure',
  type: 'Full-time',
  entity: 'MGH USA Inc.',
  loc: 'Austin, TX',
  mgr: 'Elena Rostova',
  project: 'Perf Infra',
  rate: 55.5,
  reg: 80,
  ot: 12,
  pto: 0,
  match: 92,
  status: 'Flagged OT',
  bank: 'Chase Bank USA',
  joined: 'Aug 21, 2021'
}, {
  id: 'MGH-0975',
  name: 'Mariana Reyes',
  role: 'QA Automation Lead',
  dept: 'Quality',
  type: 'Full-time',
  entity: 'MGH Dominicana SRL',
  loc: 'Punta Cana, DR',
  mgr: 'Marcus Vance',
  project: 'Atlas Core',
  rate: 46,
  reg: 80,
  ot: 0,
  pto: 0,
  match: 100,
  status: 'Ready',
  avatar: A + 'person-1.jpg',
  bank: 'Banco BHD León',
  joined: 'Nov 08, 2020'
}, {
  id: 'MGH-1120',
  name: 'Javier Peña',
  role: 'Backend Engineer',
  dept: 'Engineering',
  type: 'Contractor / Exempt',
  entity: 'MGH Dominicana SRL',
  loc: 'Santiago, DR',
  mgr: 'Elena Rostova',
  project: 'Atlas Core',
  rate: 48,
  reg: 76,
  ot: 0,
  pto: 4,
  match: 88.4,
  status: 'Jira Mismatch',
  avatar: A + 'person-2.jpg',
  bank: 'Banreservas',
  joined: 'Feb 11, 2024'
}, {
  id: 'MGH-1131',
  name: 'Priya Natarajan',
  role: 'Data Engineer',
  dept: 'Analytics',
  type: 'Full-time',
  entity: 'MGH USA Inc.',
  loc: 'Remote, US',
  mgr: 'Marcus Vance',
  project: 'Insights Lake',
  rate: 58,
  reg: 80,
  ot: 2,
  pto: 0,
  match: 99.1,
  status: 'Awaiting Supervisor',
  avatar: A + 'person-3.jpg',
  bank: 'Chase Bank USA',
  joined: 'Jun 30, 2022'
}, {
  id: 'MGH-1007',
  name: 'Luis Cabrera',
  role: 'Payroll Specialist',
  dept: 'Finance',
  type: 'Full-time',
  entity: 'MGH Dominicana SRL',
  loc: 'Punta Cana, DR',
  mgr: 'Ana Gómez',
  project: 'Internal Ops',
  rate: 32,
  reg: 80,
  ot: 0,
  pto: 0,
  match: 100,
  status: 'Approved',
  avatar: A + 'person-4.jpg',
  bank: 'Banco Popular',
  joined: 'Apr 04, 2019'
}, {
  id: 'MGH-1144',
  name: 'Hannah Kim',
  role: 'Frontend Engineer',
  dept: 'Engineering',
  type: 'Part-time',
  entity: 'MGH USA Inc.',
  loc: 'Seattle, WA',
  mgr: 'Elena Rostova',
  project: 'Global Hub v3',
  rate: 50,
  reg: 40,
  ot: 0,
  pto: 0,
  match: 97.6,
  status: 'Approved',
  bank: 'Wells Fargo',
  joined: 'Sep 12, 2024'
}, {
  id: 'MGH-1059',
  name: 'Rafael Ortiz',
  role: 'Site Reliability Eng.',
  dept: 'Infrastructure',
  type: 'Full-time',
  entity: 'MGH Dominicana SRL',
  loc: 'Punta Cana, DR',
  mgr: 'Elena Rostova',
  project: 'Perf Infra',
  rate: 51,
  reg: 80,
  ot: 9.5,
  pto: 0,
  match: 94.3,
  status: 'Flagged OT',
  bank: 'Banco BHD León',
  joined: 'Jan 09, 2021'
}, {
  id: 'MGH-1150',
  name: 'Grace Okafor',
  role: 'Product Manager',
  dept: 'Product',
  type: 'Full-time',
  entity: 'MGH UK Ltd.',
  loc: 'London, UK',
  mgr: 'Marcus Vance',
  project: 'Global Hub v3',
  rate: 62,
  reg: 72,
  ot: 0,
  pto: 8,
  match: 100,
  status: 'Ready',
  bank: 'Barclays',
  joined: 'May 17, 2023'
}, {
  id: 'MGH-1013',
  name: 'Tomás Vidal',
  role: 'Security Analyst',
  dept: 'Security',
  type: 'Full-time',
  entity: 'MGH Dominicana SRL',
  loc: 'Santo Domingo, DR',
  mgr: 'Ana Gómez',
  project: 'Internal Ops',
  rate: 47,
  reg: 80,
  ot: 0,
  pto: 0,
  match: 100,
  status: 'Approved',
  bank: 'Banreservas',
  joined: 'Jul 23, 2020'
}, {
  id: 'MGH-1162',
  name: 'Elif Demir',
  role: 'ML Engineer',
  dept: 'Analytics',
  type: 'Contractor / Exempt',
  entity: 'MGH UK Ltd.',
  loc: 'Remote, EU',
  mgr: 'Marcus Vance',
  project: 'Insights Lake',
  rate: 64,
  reg: 80,
  ot: 4,
  pto: 0,
  match: 91.2,
  status: 'Jira Mismatch',
  bank: 'Revolut Business',
  joined: 'Oct 01, 2024'
}];
EMPLOYEES.forEach(e => {
  e.total = e.reg + e.ot + e.pto;
  e.gross = +(e.reg * e.rate + e.ot * e.rate * 1.5 + e.pto * e.rate).toFixed(2);
});
const STATUS_TONE = {
  'Awaiting PM': 'warning',
  'Awaiting Supervisor': 'warning',
  'Flagged OT': 'danger',
  'Jira Mismatch': 'danger',
  'Ready': 'success',
  'Approved': 'success',
  'Returned': 'danger',
  'Draft': 'neutral'
};
const NAV = [{
  label: 'Overview',
  items: [{
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'space_dashboard'
  }]
}, {
  label: 'Workforce',
  items: [{
    key: 'approvals',
    label: 'Approval Workspace',
    icon: 'assignment_turned_in'
  }, {
    key: 'queue',
    label: 'Team Approval Queue',
    icon: 'fact_check'
  }, {
    key: 'timesheets',
    label: 'Bi-Weekly Timesheets',
    icon: 'more_time'
  }, {
    key: 'employees',
    label: 'Employees',
    icon: 'badge'
  }]
}, {
  label: 'Payroll & Finance',
  items: [{
    key: 'payroll',
    label: 'Payroll Dashboard',
    icon: 'monitoring'
  }, {
    key: 'processing',
    label: 'Payroll Processing',
    icon: 'payments'
  }, {
    key: 'paystub',
    label: 'Pay Stubs',
    icon: 'receipt_long'
  }, {
    key: 'banking',
    label: 'Banking & Allocations',
    icon: 'account_balance'
  }]
}, {
  label: 'Integrations',
  items: [{
    key: 'jira',
    label: 'Jira Cloud Sync',
    icon: 'sync_alt'
  }, {
    key: 'projects',
    label: 'Projects',
    icon: 'folder_open'
  }]
}, {
  label: 'Insights',
  items: [{
    key: 'reports',
    label: 'Reports & Register',
    icon: 'bar_chart'
  }]
}, {
  label: 'System',
  items: [{
    key: 'admin',
    label: 'Administration',
    icon: 'admin_panel_settings'
  }, {
    key: 'settings',
    label: 'Company Settings',
    icon: 'tune'
  }, {
    key: 'audit',
    label: 'Audit Log',
    icon: 'shield_lock'
  }]
}];
const JIRA = ['ATLAS-412 GraphQL API Optimization', 'ATLAS-420 Hotfix: Redis Cluster Failover', 'CORE-108 Database Sharding Pipeline', 'ATLAS-412 Client Review & Profiling', 'ATLAS-415 Auth Microservice Integration', 'CORE-111 Billing Event Stream', 'ATLAS-398 Sprint 24 Release Prep'];
// 14-day period Mon Mar 31 – Sun Apr 13 (PP-2025-08 work days)
function buildDays(emp) {
  const out = [];
  const start = new Date(2025, 2, 31);
  const otDays = {
    3: 1.5,
    8: 2.0,
    11: 3.0
  };
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const wd = d.getDay();
    const weekend = wd === 0 || wd === 6;
    const ot = !weekend && emp.ot ? (otDays[i] || 0) * (emp.ot / 6.5) : 0;
    const hrs = weekend ? 0 : 8 + ot;
    const issue = JIRA[i % JIRA.length];
    const [key, ...t] = issue.split(' ');
    const jira = weekend ? 0 : i === 8 && emp.match < 99 ? hrs - 0.5 : hrs;
    out.push({
      id: i,
      week: i < 7 ? 1 : 2,
      date: d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: '2-digit'
      }),
      weekend,
      inn: weekend ? '—' : i % 3 === 2 ? '08:45' : '08:30',
      out: weekend ? '—' : ot ? `${String(16 + Math.ceil(ot) + 1).padStart(2, '0')}:${ot % 1 ? '00' : '30'}` : '17:30',
      hrs: +hrs.toFixed(1),
      ot: +ot.toFixed(1),
      key: weekend ? null : key,
      task: t.join(' '),
      jira: +jira.toFixed(1),
      note: ot ? 'Overtime Authorized' : weekend ? 'Weekend' : 'Standard Day'
    });
  }
  return out;
}
const fmt$ = n => '$' + n.toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const fmtH = n => n.toFixed(1) + 'h';
function useTable(rows, {
  search = [],
  pageSize = 8,
  initialSort
} = {}) {
  const [q, setQ] = React.useState('');
  const [sort, setSort] = React.useState(initialSort || null);
  const [page, setPage] = React.useState(1);
  const [sel, setSel] = React.useState([]);
  const filtered = React.useMemo(() => {
    let r = rows.filter(x => !q || search.some(k => String(x[k]).toLowerCase().includes(q.toLowerCase())));
    if (sort) r = [...r].sort((a, b) => (a[sort.key] > b[sort.key] ? 1 : a[sort.key] < b[sort.key] ? -1 : 0) * (sort.dir === 'asc' ? 1 : -1));
    return r;
  }, [rows, q, sort]);
  React.useEffect(() => setPage(1), [q]);
  return {
    q,
    setQ,
    sort,
    setSort,
    page,
    setPage,
    sel,
    setSel,
    total: filtered.length,
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    all: filtered,
    pageSize
  };
}
Object.assign(window, {
  EMPLOYEES,
  STATUS_TONE,
  NAV,
  buildDays,
  fmt$,
  fmtH,
  useTable,
  AVATARS: A
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/enterprise/data.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.ActivityFeed = __ds_scope.ActivityFeed;

__ds_ns.DataTable = __ds_scope.DataTable;

__ds_ns.KeyValue = __ds_scope.KeyValue;

__ds_ns.MetricTile = __ds_scope.MetricTile;

__ds_ns.Pagination = __ds_scope.Pagination;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Stepper = __ds_scope.Stepper;

__ds_ns.TableToolbar = __ds_scope.TableToolbar;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.FilterChips = __ds_scope.FilterChips;

__ds_ns.SearchField = __ds_scope.SearchField;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.TextField = __ds_scope.TextField;

__ds_ns.Toggle = __ds_scope.Toggle;

__ds_ns.PageHeader = __ds_scope.PageHeader;

__ds_ns.Sidebar = __ds_scope.Sidebar;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.TopBar = __ds_scope.TopBar;

})();
