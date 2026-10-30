import React, { useEffect, useState } from 'react';
import { WORK_TYPES, fmtDuration, isMeetingCopy } from './ActivityFormModal.jsx';

// Read-only view of one logged activity (#myentry: click on a task card). Editing still goes through
// ActivityFormModal; onEdit is only offered when the caller says the activity can be edited.

const REVIEW = {
  approved: { tone: 'success', label: 'Aprobada' },
  partial: { tone: 'warning', label: 'Aprobada en parte' },
  rejected: { tone: 'danger', label: 'Horas rechazadas' },
};
const fmtDate = (ymd) => {
  const d = new Date(String(ymd || '') + 'T12:00:00');
  return isNaN(d) ? ymd || '—' : d.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};
const isImage = (f) => f && (f.type === 'image' || /^image\//.test(f.mime || '') || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name || f.url || ''));
const isVideo = (f) => f && (f.type === 'video' || /^video\//.test(f.mime || '') || /\.(mp4|webm|mov)$/i.test(f.name || f.url || ''));

export default function ActivityViewModal({ activity: act, onClose, onEdit }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { Button, IconButton, Badge, Icon } = DS;
  const [media, setMedia] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { if (media) setMedia(null); else onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [media, onClose]);

  if (!act) return null;
  const wt = WORK_TYPES.find((w) => w.value === act.workType) || WORK_TYPES[0];
  const review = REVIEW[act.reviewStatus];
  const files = act.files || [];
  const links = act.links || [];
  const label = { font: '700 11px/14px var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--mgh-ink-3)', marginBottom: 6 };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div role="dialog" aria-modal="true" aria-label="Detalle de la actividad" onClick={(e) => e.stopPropagation()}
        style={{ width: 640, maxWidth: '100%', maxHeight: 'calc(100vh - 40px)', background: '#fff', borderRadius: 16, boxShadow: 'var(--shadow-xl)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--mgh-surface-2)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ padding: '2px 8px', borderRadius: 6, background: '#1F2937', color: '#F9FAFB', font: '700 11px/16px var(--font-mono)' }}>{act.jiraKey || 'GENERAL'}</span>
              <span style={{ padding: '2px 8px', borderRadius: 4, background: wt.bg, color: wt.color, font: '600 11px/16px var(--font-sans)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {Icon ? <Icon name={wt.icon} size={13} color={wt.color} /> : null}{wt.label}
              </span>
            </div>
            <span style={{ font: '700 17px/24px var(--font-sans)', color: 'var(--mgh-ink)' }}>{act.jiraSummary || act.description || 'Actividad registrada'}</span>
          </div>
          {IconButton ? <IconButton icon="close" title="Cerrar" onClick={onClose} /> : null}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14 }}>
            <div><div style={label}>Fecha</div><div style={{ font: '600 14px/20px var(--font-sans)', color: 'var(--mgh-ink)', textTransform: 'capitalize' }}>{fmtDate(act.date)}</div></div>
            <div><div style={label}>Tiempo dedicado</div><div style={{ font: '800 18px/22px var(--font-sans)', color: 'var(--mgh-primary)' }}>{fmtDuration(act.hours)}</div></div>
            {act.loggedBy ? <div><div style={label}>Registrada por</div><div style={{ font: '600 14px/20px var(--font-sans)', color: 'var(--mgh-ink)' }}>{act.loggedByName || act.loggedBy}{isMeetingCopy(act) ? ' (reunión)' : ''}</div></div> : null}
          </div>

          {review ? (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--mgh-surface-1)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {Badge ? <Badge size="sm" tone={review.tone} dot>{review.label}</Badge> : review.label}
                {act.reviewStatus !== 'approved' ? <span style={{ font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>{fmtDuration(act.approvedHours)} de {fmtDuration(act.hours)} aprobadas</span> : null}
              </div>
              {act.reviewComment ? <span style={{ font: '400 13px/18px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>“{act.reviewComment}”{act.reviewedBy ? ' — ' + act.reviewedBy : ''}</span> : null}
            </div>
          ) : null}

          <div>
            <div style={label}>Descripción</div>
            <div style={{ font: '400 14px/21px var(--font-sans)', color: 'var(--mgh-ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{act.description || '—'}</div>
          </div>

          {files.length ? (
            <div>
              <div style={label}>Evidencias ({files.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {files.map((f, i) => isImage(f) ? (
                  <button key={i} type="button" onClick={() => setMedia(f)} title={f.name}
                    style={{ width: 112, height: 84, padding: 0, border: '1px solid var(--mgh-surface-2)', borderRadius: 8, overflow: 'hidden', cursor: 'zoom-in', background: 'var(--mgh-surface-1)' }}>
                    <img src={f.url} alt={f.name || 'Evidencia'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </button>
                ) : (
                  <button key={i} type="button" onClick={() => (isVideo(f) ? setMedia(f) : window.open(f.url, '_blank', 'noopener'))}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--mgh-surface-2)', background: 'var(--mgh-surface-1)', cursor: 'pointer', font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                    {Icon ? <Icon name={isVideo(f) ? 'videocam' : 'description'} size={16} color="var(--mgh-primary)" /> : null}
                    <span>{f.name || 'Archivo'}</span>{f.size ? <span style={{ color: 'var(--mgh-ink-3)', fontSize: 11 }}>({f.size})</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {links.length ? (
            <div>
              <div style={label}>Enlaces</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {links.map((l, i) => (
                  <a key={i} href={l.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 13px/18px var(--font-sans)', color: 'var(--mgh-primary)', textDecoration: 'none', wordBreak: 'break-all' }}>
                    {Icon ? <Icon name="link" size={16} /> : null}{l.label || l.url}{Icon ? <Icon name="open_in_new" size={12} /> : null}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--mgh-surface-2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {Button ? <Button variant="secondary" onClick={onClose}>Cerrar</Button> : null}
          {onEdit && Button ? <Button icon="edit" onClick={() => onEdit(act)}>Editar</Button> : null}
        </div>
      </div>

      {media ? (
        <div onClick={(e) => { e.stopPropagation(); setMedia(null); }} style={{ position: 'fixed', inset: 0, zIndex: 1010, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {isVideo(media)
            ? <video src={media.url} controls autoPlay onClick={(e) => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '86vh', borderRadius: 8 }} />
            : <img src={media.url} alt={media.name || 'Evidencia'} style={{ maxWidth: '92vw', maxHeight: '86vh', borderRadius: 8, objectFit: 'contain' }} />}
        </div>
      ) : null}
    </div>
  );
}
