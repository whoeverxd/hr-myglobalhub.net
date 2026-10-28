// Payroll domain constants & helpers (ported from the Claude Design prototype).
// Pay periods are quincenas, PP-{YYYY}-{NN}: 1–15 and 16–end of month, 24 per year (see periodService.js).

const DAY=864e5,MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const U=(y,m,d)=>new Date(Date.UTC(y,m,d));
const add=(t,n)=>new Date(t.getTime()+n*DAY);
const f=t=>MON[t.getUTCMonth()]+' '+String(t.getUTCDate()).padStart(2,'0');
const fy=t=>f(t)+', '+t.getUTCFullYear();
const LOCKED=['Approved','Paid','Closed','Archived'];
const STATUSES=['Draft','Open','Awaiting Employee Submission','Awaiting Supervisor Approval','Awaiting Project Manager Approval','Awaiting HR Approval','Awaiting Finance Approval','Processing Payroll','Approved','Paid','Closed','Archived'];
const SHORT={'Awaiting Employee Submission':'Awaiting Employee','Awaiting Supervisor Approval':'Awaiting Supervisor','Awaiting Project Manager Approval':'Awaiting PM','Awaiting HR Approval':'Awaiting HR','Awaiting Finance Approval':'Awaiting Finance','Processing Payroll':'Processing'};
const TONE=s=>s==='Draft'?'neutral':s==='Archived'||s==='Closed'?'dark':s==='Paid'||s==='Approved'?'success':s==='Open'?'info':'warning';
const KIT=['ops','permissions','attendance','attDaily','actDaily','attCalendar','attExceptions','attLeave','attHolidays','attReports','attRules','languages','dashboard','approvals','queue','timesheets','employees','profile','payroll','processing','paystub','banking','jira','projects','reports','admin','settings','audit','contractors','contractorPayments'];
const NAV=[
 {label:'Overview',items:[{key:'ops',label:'Operations Center',icon:'monitor_heart'},{key:'dashboard',label:'Executive Dashboard',icon:'space_dashboard'},{key:'payroll',label:'Payroll Dashboard',icon:'monitoring'}]},
 {label:'Workforce',items:[{key:'mytime',label:'My Work',icon:'schedule'},{key:'addEmployee',label:'Add Employee',icon:'person_add'},{key:'approvals',label:'Approval Workspace',icon:'assignment_turned_in'},{key:'queue',label:'Team Approval Queue',icon:'fact_check'},{key:'timesheets',label:'Team Timesheets',icon:'more_time'},{key:'employees',label:'Employee Directory',icon:'badge'}]},
 {label:'Attendance',items:[
   {key:'attendance',label:'Attendance Dashboard',icon:'how_to_reg'},
   {key:'attWorkday',label:'Registro de jornada',icon:'today',children:[
     {key:'attDaily',label:'Registro por horas',icon:'schedule'},
     {key:'actDaily',label:'Registro por actividades',icon:'task_alt'}
   ]},
   {key:'attCalendar',label:'Attendance Calendar',icon:'calendar_month'},
   {key:'attExceptions',label:'Exceptions',icon:'report'},
   {key:'attLeave',label:'Leave Requests',icon:'beach_access'},
   {key:'attHolidays',label:'Holidays',icon:'celebration'},
   {key:'attReports',label:'Attendance Reports',icon:'summarize'},
   {key:'attRules',label:'Attendance Rules',icon:'rule'}
 ]},
 {label:'Payroll & Finance',items:[{key:'periods',label:'Pay Periods',icon:'event_repeat'},{key:'adjustments',label:'Adjustments',icon:'tune'},{key:'processing',label:'Payroll Processing',icon:'payments'},{key:'paystub',label:'Pay Stubs',icon:'receipt_long'},{key:'banking',label:'Banking & Allocations',icon:'account_balance'},{key:'reports',label:'Reports & Register',icon:'bar_chart'}]},
 {label:'Contractors',items:[{key:'contractors',label:'Contractors',icon:'handshake'}]},
 {label:'Integrations',items:[{key:'jira',label:'Jira Cloud Sync',icon:'sync_alt',badgeTone:'onDarkSuccess'},{key:'projects',label:'Projects',icon:'folder_open'}]},
 {label:'System / Administration',items:[{key:'admin',label:'Organization & Multi-HQ',icon:'hub'},{key:'workflows',label:'Approval Workflows',icon:'account_tree'},{key:'audit',label:'Audit Logs',icon:'shield_lock'},{key:'permissions',label:'Roles & Permissions',icon:'admin_panel_settings'},{key:'languages',label:'Languages',icon:'translate'},{key:'settings',label:'Settings',icon:'settings'}]}];
// Real approval steps (workflow.js): employee submits → PM reviews each activity → Owner / Admin approves → paid.
// No SLA or amount threshold is enforced by the backend, so none is shown.
const STAGE_INFO={
 employee:{title:'Envío del empleado',icon:'assignment_ind',desc:'El empleado registra sus actividades de la quincena y somete la hoja. Las horas se calculan de las actividades y se congelan al someter.',tag:'Empleado',tagTone:'success',sla:'—',rule:'Editable solo en Borrador o Devuelta; no se puede someter con 0 horas',notify:'Hoja sometida'},
 pm:{title:'Supervisión PM',icon:'supervisor_account',desc:'El PM o supervisor revisa cada actividad (aprobar toda, parcial con motivo obligatorio, o ninguna) y puede dejar comentarios. Al aprobar, las horas se recalculan según sus decisiones.',tag:'Secuencial',tagTone:'neutral',sla:'—',rule:'Nadie aprueba su propia hoja (salvo admin)',notify:'Aprobada por PM / Devuelta para corrección'},
 owner:{title:'Aprobación Dueño',icon:'verified_user',desc:'El dueño / administrador da la aprobación final. Solo las hojas aprobadas entran en la corrida de nómina.',tag:'Final',tagTone:'warning',sla:'—',rule:'Solo administrador',notify:'Hoja aprobada'},
 paid:{title:'Pagado',icon:'paid',desc:'La corrida aprobada se marca como pagada; la corrida, sus hojas y el período quedan en Pagado. Solo lectura para todos los roles.',tag:'Bloqueado',tagTone:'onDarkSuccess',sla:'Fecha de pago',rule:'Correcciones solo vía Ajustes de Nómina',notify:'Pago completado',final:true}};
const RULES=[
 {cond:'Overtime > 5 Hours',scope:'Engineering & Operations',icon:'more_time',tone:'warning',action:'Requires written justification + Lead PM sign-off',meta:'Escalates to the PM'},
 {cond:'Jira Worklog Variance > 1.0h',scope:'Jira Cloud sync hook',icon:'sync_problem',tone:'primary',action:'Block approval until re-synced',meta:'Webhook auto-flags task tickets'},
 {cond:'Bank Split Modification',scope:'Banking & multi-currency split',icon:'account_balance',tone:'primary',action:'Mandatory 2FA + HR auditor notification',meta:'Enforces 72h holding buffer on change'},
 {cond:'Disbursement > $50,000 USD',scope:'Single batch or total net payroll run',icon:'payments',tone:'warning',action:'Executive board approval required',meta:'Generates cryptographic multi-sig payload'},
 {cond:'Approver Misses SLA',scope:'Any approval stage',icon:'alarm',tone:'danger',action:'Auto-escalate to next level + Slack alert',meta:'48h before payroll freeze'}];
const RTONE={warning:['var(--mgh-warning-bg)','var(--mgh-warning)'],primary:['var(--mgh-primary-50)','var(--mgh-primary)'],danger:['var(--mgh-danger-bg)','var(--mgh-danger)']};
const ADJ=[]; // adjustments come from the backend (api.adjustments)
const ATONE=s=>/Approved/.test(s)?'success':/Pending/.test(s)?'warning':'info';
// Estimate for ONE quincena (24 per year). Hours per quincena follow the DR 44h week: 44 × 52 / 24 ≈ 95.33h.
const QUINCENA_HOURS=+(44*52/24).toFixed(2);
const PAYCALC=(rate,freq,profile,cur)=>{const H={'Semi-Monthly':QUINCENA_HOURS,'Monthly':+(QUINCENA_HOURS*2).toFixed(2)}[freq]||QUINCENA_HOURS,N={'Semi-Monthly':24,'Monthly':12}[freq]||24;
  const g=(Number(rate)||0)*H,A=g*N,lines=[];
  const br=(a,b)=>{let tax=0,prev=0;for(const [cap,r] of b){if(a<=prev)break;tax+=(Math.min(a,cap)-prev)*r;prev=cap}return tax};
  if(/^Exempt/.test(profile)){lines.push(['Tax deductions','Exempt',0])}
  // DGII ISR brackets are in DOP; amounts in another currency are only estimated when the rate is in DOP
  else if(/DGII/.test(profile)){const afp=g*0.0287,sfs=g*0.0304;lines.push(['AFP 2.87%','',afp],['SFS 3.04%','',sfs]);if(cur==='DOP'){const ad=A-(afp+sfs)*N;const isr=br(ad,[[416220,0],[624329,.15],[867123,.20],[Infinity,.25]]);lines.push(['ISR (DGII)','',isr/N])}}
  const ded=lines.reduce((s,l)=>s+l[2],0);return {hours:H,gross:g,ded,net:g-ded,lines,exempt:/^Exempt/.test(profile)}};
const fmtC=(v,c)=>(c==='DOP'?'RD$':'$')+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const money=n=>(n<0?'-':'+')+'$'+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2});

const CATS=['Jira Issue','Meeting','Training','Internal Admin','Client Support','Interview / Hiring','Other'];
const CAT_PH={'Meeting':'e.g. Weekly payroll sync','Training':'e.g. AML compliance course','Internal Admin':'e.g. Expense reports','Client Support':'e.g. Arawaki merchant onboarding call','Interview / Hiring':'e.g. Backend candidate interview','Other':'Short task title'};
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const tm=s=>{if(!s||!/^\d{1,2}:\d{2}$/.test(s))return null;const [h,m]=s.split(':').map(Number);return h*60+m};
const hm=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const h1=n=>{if(n==null||typeof n==='boolean')return '0.0h';const num=typeof n==='number'?n:Number(n);return(isNaN(num)?0:num).toFixed(1)+'h'};

export { DAY, MON, U, add, f, fy, LOCKED, STATUSES, SHORT, TONE, KIT, NAV, STAGE_INFO, RULES, RTONE, ADJ, ATONE, PAYCALC, fmtC, money, CATS, CAT_PH, DOW, tm, hm, h1 };
