// Payroll domain constants & helpers (ported from the Claude Design prototype).
// Pay periods are bi-weekly, PP-{YYYY}-{NN}; PP-2025-01 starts Dec 24 2024.

const DAY=864e5,MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const U=(y,m,d)=>new Date(Date.UTC(y,m,d));
const add=(t,n)=>new Date(t.getTime()+n*DAY);
const f=t=>MON[t.getUTCMonth()]+' '+String(t.getUTCDate()).padStart(2,'0');
const fy=t=>f(t)+', '+t.getUTCFullYear();
const ANCHOR=U(2024,11,24),TODAY=U(2025,3,15);
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
const STAGE_INFO={
 employee:{title:'Employee Submission',icon:'assignment_ind',desc:'Employee submits the bi-weekly timesheet. Hours, notes, worklogs and punches lock on submit.',tag:'Auto-Trigger',tagTone:'success',sla:'Day 15 • 10:00',rule:'Editable only in Draft or Returned',notify:'Timesheet submitted'},
 supervisor:{title:'Supervisor Review',icon:'supervisor_account',desc:'Direct supervisor validates attendance, punches, PTO and overtime.',tag:'Sequential',tagTone:'neutral',sla:'Day 15 • 18:00',rule:'Missing punches or unapproved OT block approval',notify:'Supervisor approved / Returned for corrections'},
 manager:{title:'Manager Review',icon:'account_tree',desc:'Manager validates project hours, worklog distribution and billable tags.',tag:'Sequential',tagTone:'neutral',sla:'Day 16 • 12:00',rule:'Jira variance > 1.0h blocks approval until resynced',notify:'Manager approved / Returned for corrections'},
 hr:{title:'HR Review',icon:'badge',desc:'Optional gate for exceptions (leave, salary or data changes).',tag:'Optional',tagTone:'neutral',sla:'Day 16 • 17:00',rule:'Only when the organization requires it',notify:'HR approved'},
 cfo:{title:'CFO Review',icon:'verified_user',desc:'Optional executive sign-off for large disbursements.',tag:'Optional',tagTone:'warning',sla:'Day 18 • 12:00',rule:'Batches over $50,000',notify:'CFO approved'},
 payroll:{title:'Payroll Review',icon:'account_balance_wallet',desc:'Payroll reviews the register, approves and generates pay stubs.',tag:'Dual-Keys Req',tagTone:'warning',sla:'Day 19 • 12:00',rule:'Payout splits must total 100%',notify:'Payroll approved'},
 paid:{title:'Paid',icon:'paid',desc:'Pay stub generated and payment completed. Read-only for every role.',tag:'Locked',tagTone:'onDarkSuccess',sla:'Pay date',rule:'Corrections only via Payroll Adjustments',notify:'Payment completed',final:true}};
const STAGES=[
 {title:'Worker Submission',icon:'assignment_ind',desc:'Contractor and salaried timesheet commit. Real-time Jira synchronization lock.',kv:[['Cutoff','Day 14 @ 23:59'],['Sync hook','Jira worklogs locked']],tag:'Auto-Trigger',tagTone:'success',owner:'Employee',sla:'Day 15 • 10:00',rule:'Cannot submit with missing entries; OT > 5h needs justification',notify:'Timesheet due • 24h and 2h before'},
 {title:'Supervisor / PM Review',icon:'supervisor_account',desc:'Lead PM validates sprint deliverables, worklog distribution and billable tags.',kv:[['Approvers','Supervisor / PM'],['SLA window','24 hours']],tag:'Sequential',tagTone:'neutral',owner:'Supervisor • Project Manager',sla:'Day 15 • 18:00 / Day 16 • 10:00',rule:'Jira variance > 1.0h blocks approval until resynced',notify:'Approvals pending • every 4h'},
 {title:'HR & Statutory',icon:'gavel',desc:'Regulatory compliance checks for Punta Cana operations and overseas contractors.',kv:[['Jurisdiction','TSS • DGII'],['Audits','Art. 155 Ley 16-92']],tag:'Policy Gate',tagTone:'neutral',owner:'HR Compliance',sla:'Day 16 • 12:00',rule:'44h weekly OT threshold, 36h weekly rest',notify:'Approvals pending'},
 {title:'Finance Approval',icon:'account_balance_wallet',desc:'Payroll register review, budget vs actual and batch totals.',kv:[['Signers','Finance'],['Threshold','> $25,000 dual-sign']],tag:'Dual-Keys Req',tagTone:'warning',owner:'Finance VP',sla:'Day 19 • 12:00',rule:'Batches over $25,000 need dual signature (WebAuthn)',notify:'Payroll approved'},
 {title:'Treasury Disbursement',icon:'send_money',desc:'ACH and FedWire release across multi-bank allocations.',kv:[['Rails','ACH • FedWire'],['Split','Must total 100%']],tag:'Bank Confirm',tagTone:'info',owner:'Payroll • Treasury',sla:'Day 20 • 09:00',rule:'Bank change cooling period 72h + 2FA',notify:'Payroll paid'},
 {title:'Ledger Seal & Lock',icon:'lock',desc:'Immutable SHA-256 seal burned into the audit journal. Edits strictly blocked.',kv:[['Ledger state','Immutable'],['Hash root','—']],tag:'Tamper-Proof',tagTone:'onDarkSuccess',owner:'System',sla:'Day 21 • value date',rule:'Corrections only via Payroll Adjustments in next open period',notify:'New period begins',final:true}];
const RULES=[
 {cond:'Overtime > 5 Hours',scope:'Engineering & Operations',icon:'more_time',tone:'warning',action:'Requires written justification + Lead PM sign-off',meta:'Escalates to the PM'},
 {cond:'Jira Worklog Variance > 1.0h',scope:'Jira Cloud sync hook',icon:'sync_problem',tone:'primary',action:'Block approval until re-synced',meta:'Webhook auto-flags task tickets'},
 {cond:'Bank Split Modification',scope:'Banking & multi-currency split',icon:'account_balance',tone:'primary',action:'Mandatory 2FA + HR auditor notification',meta:'Enforces 72h holding buffer on change'},
 {cond:'Disbursement > $50,000 USD',scope:'Single batch or total net payroll run',icon:'payments',tone:'warning',action:'Executive board approval required',meta:'Generates cryptographic multi-sig payload'},
 {cond:'Approver Misses SLA',scope:'Any approval stage',icon:'alarm',tone:'danger',action:'Auto-escalate to next level + Slack alert',meta:'48h before payroll freeze'}];
const RTONE={warning:['var(--mgh-warning-bg)','var(--mgh-warning)'],primary:['var(--mgh-primary-50)','var(--mgh-primary)'],danger:['var(--mgh-danger-bg)','var(--mgh-danger)']};
const ADJ=[]; // adjustments come from the backend (api.adjustments)
const ATONE=s=>/Approved/.test(s)?'success':/Pending/.test(s)?'warning':'info';
const PAYCALC=(rate,freq,profile,cur)=>{const H={'Bi-Weekly':80,'Weekly':40,'Semi-Monthly':86.67,'Monthly':173.33}[freq]||80,N={'Bi-Weekly':26,'Weekly':52,'Semi-Monthly':24,'Monthly':12}[freq]||26;
  const g=(Number(rate)||0)*H,A=g*N,lines=[];const fx=cur==='DOP'?1:cur==='GBP'?75:60.5;
  const br=(a,b)=>{let tax=0,prev=0;for(const [cap,r] of b){if(a<=prev)break;tax+=(Math.min(a,cap)-prev)*r;prev=cap}return tax};
  if(/^Exempt/.test(profile)){lines.push(['Tax deductions','Exempt',0])}
  else if(/DGII/.test(profile)){const afp=g*0.0287,sfs=g*0.0304,ad=(A-(afp+sfs)*N)*fx;const isr=br(ad,[[416220,0],[624329,.15],[867123,.20],[Infinity,.25]])+(ad>867123?0:0);lines.push(['AFP 2.87%','',afp],['SFS 3.04%','',sfs],['ISR (DGII)','',isr/fx/N])}
  else if(/W-4/.test(profile)){const fica=g*0.0765,fed=br(A-14600,[[11600,.10],[47150,.12],[100525,.22],[191950,.24],[Infinity,.32]].map(x=>x))/N;lines.push(['Federal income tax','',Math.max(0,fed)],['FICA 7.65%','',fica],['State tax (est. 5%)','',g*0.05])}
  else if(/PAYE/.test(profile)){const t=Math.max(0,A-12570);lines.push(['PAYE income tax','',br(t,[[37700,.20],[112570,.40],[Infinity,.45]])/N],['National Insurance','',br(t,[[37700,.08],[Infinity,.02]])/N])}
  const ded=lines.reduce((s,l)=>s+l[2],0);return {hours:H,gross:g,ded,net:g-ded,lines,exempt:/^Exempt/.test(profile)}};
const fmtC=(v,c)=>(c==='GBP'?'£':c==='DOP'?'RD$':'$')+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const money=n=>(n<0?'-':'+')+'$'+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2});

const ISSUES={'ATLAS-412':'GraphQL API Optimization','ATLAS-420':'Hotfix: Redis Cluster Failover','ATLAS-415':'Auth Microservice Integration','CORE-108':'Database Sharding Pipeline','ATLAS-104':'Standup & Sprint Planning'};
const CATS=['Jira Issue','Meeting','Training','Internal Admin','Client Support','Interview / Hiring','Other'];
const CAT_PH={'Meeting':'e.g. Weekly payroll sync','Training':'e.g. AML compliance course','Internal Admin':'e.g. Expense reports','Client Support':'e.g. Arawaki merchant onboarding call','Interview / Hiring':'e.g. Backend candidate interview','Other':'Short task title'};
const OLDNOTES={1:'Sprint planning • 1.0h',4:'Client call with Arawaki • 0.5h',8:'AML training • 0.5h'};
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function MYDAYS(){const o=[];for(let i=0;i<14;i++){const d=add(U(2025,3,15),i),wd=d.getUTCDay();const we=wd===0||wd===6;o.push({d,type:we?'Weekend':i===3?'Holiday':i===10?'PTO':'Regular',in:i===0?'08:30':'',lo:'',li:'',out:''})}return o}
function OLDDAYS(){const o=[];const ot={2:'19:00',8:'19:30',10:'20:30'};for(let i=0;i<14;i++){const d=add(U(2025,3,1),i),wd=d.getUTCDay();const we=wd===0||wd===6;o.push({d,type:we?'Weekend':'Regular',in:we?'':'08:30',lo:we?'':'12:30',li:we?'':'13:30',out:we?'':(ot[i]||'17:30')})}return o}
const tm=s=>{if(!s||!/^\d{1,2}:\d{2}$/.test(s))return null;const [h,m]=s.split(':').map(Number);return h*60+m};
const hm=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const h1=n=>{if(n==null||typeof n==='boolean')return '0.0h';const num=typeof n==='number'?n:Number(n);return(isNaN(num)?0:num).toFixed(1)+'h'};

export { DAY, MON, U, add, f, fy, ANCHOR, TODAY, LOCKED, STATUSES, SHORT, TONE, KIT, NAV, STAGES, STAGE_INFO, RULES, RTONE, ADJ, ATONE, PAYCALC, fmtC, money, ISSUES, CATS, CAT_PH, OLDNOTES, DOW, MYDAYS, OLDDAYS, tm, hm, h1 };
