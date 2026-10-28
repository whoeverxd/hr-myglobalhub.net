import React, { Fragment } from 'react';
import { DS } from './design-system';
import { KitScreen } from './kit/kit.jsx';
import MyTimeView from './kit/MyTimeView.jsx';
import { api } from './lib/api';
import { getCurrentPeriod, getQuincenaForDate, getPeriodsForYear } from './lib/periodService';
import { DAY, MON, U, add, f, fy, ANCHOR, TODAY, LOCKED, STATUSES, SHORT, TONE, KIT, NAV, STAGES, STAGE_INFO, RULES, RTONE, ADJ, ATONE, PAYCALC, fmtC, money, ISSUES, CATS, CAT_PH, OLDNOTES, DOW, MYDAYS, OLDDAYS, tm, hm, h1 } from './lib/payroll';

/**
 * My Global Hub Timekeeping — main app shell.
 * renderVals() builds the view-model; render() is the screen markup.
 * Kit screens (dashboard, approvals, employees, …) live in ./kit/kit.jsx.
 */
export default class App extends React.Component {
  state={
    route: (typeof window !== 'undefined' && window.MGH_RBAC ? window.MGH_RBAC.homeRoute() : 'periods'),
    empId:null,toast:'',dialog:null,ov:{},periodFilter:'all',pq:'',offset:6,autoGen:true,adjFilter:'all',adj:[],stage:1,ruleOn:[1,1,1,1,1],notifOn:[1,1,1,1,1,1],
    myPeriodKey:'09',myWeek:'1',myDays:[],wl:{cat:'Jira Issue',issue:'',title:'',hours:'',desc:'',date:(window.MGH_ATT&&window.MGH_ATT.TODAY)||new Date().toISOString().slice(0,10),project:'',type:'Regular',file:''},wlEdit:null,myTab:null,
    worklogs:[],
    ne:{first:'',last:'',email:'',phone:'',nid:'',dob:'',entity:'MGH Dominicana SRL',dept:'Engineering',title:'',mgr:'',etype:'Full-time',start:new Date().toISOString().slice(0,10),loc:'',freq:'Bi-Weekly',rate:'',cur:'USD',ot:true,tax:'DGII ISR + TSS (Dominican Republic)',bank:'Banco BHD León',acct:'',route:'',alloc:'100',bank2:'',jira:'',projects:'',flow:'Employee → Supervisor → PM → HR → Finance',pmethod:'Bank Deposit',cbEmail:'',cbId:'',cbNetwork:'Base',cbAsset:'USDC',cbWallet:'',cbAlloc:'20',cbW8:false,cbKyc:false,cbCountry:'Colombia',cStart:new Date().toISOString().slice(0,10),cEnd:'',cTax:'W-8BEN (non-US individual)',cInvoice:true,plang:'Español',wuName:'',wuDelivery:'Cash Pickup',wuCountry:'Mexico',wuCity:'',wuCur:'Local currency',wuIdType:'National ID',wuIdNum:'',wuBankName:'',wuAcct:'',wuPhone:''},
    pf:{transfer:'bhd',ref:'',date:'2025-04-20'},pfFile:null,drag:false,proofs:(()=>{try{return JSON.parse(localStorage.getItem('mgh-proofs')||'[]')}catch(e){return []}})(),
    orgMenu: false,
    langMenu: false,
    notifOpen: false,
    currentUser: null,
    authChecking: true,
    loginEmail: '',
    loginPassword: '',
    loginError: '',
    loginLoading: false,
    payrollRunModal: null,
    showAdjModal: false,
    newAdj: {
      employeeId: '',
      name: '',
      role: '',
      type: '',
      cat: 'Discretionary incentive pool',
      kind: 'bonus',
      amt: '',
      tax: 'DGII Taxable ISR',
      taxTone: 'info',
      target: 'Banco BHD León',
      status: 'Pending Approval'
    },
    apiOnline: null,
    sevEmpId: null,
    sevTenureYears: null,
    sevTenureMonths: null,
    sevCause: 'desahucio_employer',
    sevVacationDays: null
  };
  scroller=React.createRef();
  async componentDidMount(){
    window.api = api;
    window.__mghLogout = this.handleLogout;
    window.__mghNavigate = this.go;
    window.__mghOpenLangMenu = () => this.setState(s => ({ langMenu: !s.langMenu, orgMenu: false }));
    const hh = (location.hash || '').slice(1).split('/');
    const MTb = { myentry: 'entry', mysheets: 'sheets', myhistory: 'history' }[hh[0]];
    const h = MTb ? 'mytime' : hh[0];
    if (h && (KIT.includes(h) || ['periods', 'adjustments', 'workflows', 'mytime', 'addEmployee', 'languages', 'empCreated'].includes(h))) {
      this.setState(st => ({ route: h, empId: hh[1] || st.empId, ...(MTb ? { myTab: MTb } : {}) }));
    } else if (!h && window.MGH_RBAC) {
      this.setState({ route: window.MGH_RBAC.homeRoute() });
    }
    this._t0 = Date.now();
    this._rs = () => this.setState({ vw: window.innerWidth });
    window.addEventListener('resize', this._rs);
    this._wf = () => this.forceUpdate();
    this._rb = () => {
      if (!(location.hash || '').slice(1) && window.MGH_RBAC && !window.MGH_RBAC.canRoute(this.state.route)) {
        this.setState({ route: window.MGH_RBAC.homeRoute() });
      }
      this.forceUpdate();
    };
    window.addEventListener('mgh-wf', this._wf);
    window.addEventListener('mgh-rbac', this._rb);
    this._attLeave = () => this.applyLeave();
    window.addEventListener('mgh-att-leave', this._attLeave);
    this._attPunch = ev => {
      const d = ev.detail;
      if (!d || d.emp !== 'MGH-1042') return;
      this.setState(s => ({
        myDays: s.myDays.map(e => e.d.toISOString().slice(0, 10) === d.date ? { ...e, in: d.punches.in ?? e.in, lo: d.punches.lo ?? e.lo, li: d.punches.li ?? e.li, out: d.punches.out ?? e.out } : e)
      }));
    };
    window.addEventListener('mgh-att-punch', this._attPunch);
    setTimeout(() => { this.applyLeave(); this.syncAtt(); }, 0);
    this._lang = () => this.forceUpdate();
    this._miss = () => { if (this.state.route === 'languages') this.forceUpdate(); };
    window.addEventListener('mgh-lang', this._lang);
    window.addEventListener('mgh-stub', this._lang);
    window.addEventListener('mgh-open-password', this.openPassword);
    window.addEventListener('mgh-i18n-missing', this._miss);

    this._iv = setInterval(() => { if (this.state.route === 'mytime') this.forceUpdate(); }, 15000);
    window.addEventListener('hashchange', this.onHash);
    await this.checkInitialAuth();
  }
  async checkInitialAuth(){
    this.setState({ authChecking: true });
    const token = api.getToken();
    if (!token) {
      if (window.MGH_RBAC && window.MGH_RBAC.setUser) {
        window.MGH_RBAC.setUser(null);
      }
      this.setState({ currentUser: null, authChecking: false });
      return;
    }
    try {
      const res = await api.me();
      if (res && res.user) {
        if (window.MGH_RBAC && window.MGH_RBAC.setUser) {
          window.MGH_RBAC.setUser(res.user);
        }
        const empId = res.user.employeeId || res.user.employee_id || this.state.empId;
        const targetRoute = window.MGH_RBAC && !window.MGH_RBAC.canRoute(this.state.route) ? window.MGH_RBAC.homeRoute() : this.state.route;
        this.setState({ currentUser: res.user, empId, route: targetRoute, authChecking: false });
        await this.loadFromApi();
      } else {
        api.setToken(null);
        if (window.MGH_RBAC && window.MGH_RBAC.setUser) {
          window.MGH_RBAC.setUser(null);
        }
        this.setState({ currentUser: null, authChecking: false });
      }
    } catch {
      api.setToken(null);
      if (window.MGH_RBAC && window.MGH_RBAC.setUser) {
        window.MGH_RBAC.setUser(null);
      }
      this.setState({ currentUser: null, authChecking: false });
    }
  }
  // Load persisted data from the SQLite backend. If the API is down the app keeps working on the built-in demo data.
  async loadFromApi(){
    try{
      const [d, periods, emps] = await Promise.all([
        api.bootstrap(),
        api.periods(getCurrentPeriod().year).catch(() => null),
        api.employees().catch(() => null)
      ]);
      const ov = d.periodOverrides || {};
      if (periods && Array.isArray(periods)) {
        for (const p of periods) ov[p.id] = p.status;
      }
      if (Array.isArray(emps)) {
        const curUser = this.state.currentUser || (window.MGH_AUTH && window.MGH_AUTH.user);
        // Hours come only from the employee's timesheet for the current period; no timesheet → 0h, $0.
        const curCode = getCurrentPeriod().code;
        const tsByEmp = {};
        (d.timesheets || []).forEach(t => { if (t.period === curCode) tsByEmp[t.emp] = t; });
        window.EMPLOYEES = emps.map(e => {
          const ts = tsByEmp[e.id] || {};
          const rate = Number(e.rate) || 0;
          const reg = Number(ts.reg) || 0;
          const ot = Number(ts.ot) || 0;
          const pto = Number(ts.pto) || 0;
          const gross = +(reg * rate + ot * rate * 1.5 + pto * rate).toFixed(2);
          const isMe = curUser && (
            curUser.employeeId === e.id ||
            curUser.employee_id === e.id ||
            curUser.id === e.id ||
            (curUser.email && e.email && curUser.email.toLowerCase() === e.email.toLowerCase()) ||
            (e.name && curUser.name && curUser.name.toLowerCase() === e.name.toLowerCase())
          );
          let avatar = (isMe && curUser.avatar) ? curUser.avatar : e.avatar;
          if (avatar && typeof avatar === 'string' && (avatar.includes('assets/avatars/') || avatar.includes('person-') || avatar.includes('carlos-mendez'))) {
            avatar = null;
          }
          return {
            id: e.id,
            name: e.name || `${e.first || ''} ${e.last || ''}`.trim(),
            role: e.role || '',
            dept: e.dept || 'Unassigned',
            type: e.type || 'Full-time',
            entity: e.entity || 'MGH Dominicana SRL',
            loc: e.loc || '',
            phone: e.phone || '',
            mgr: e.mgr || '',
            project: e.project || '',
            rate,
            reg,
            ot,
            pto,
            total: reg + ot + pto,
            gross,
            hasTimesheet: Boolean(tsByEmp[e.id]),
            // No Jira reconciliation data exists per employee yet; null means "not measured".
            match: null,
            status: e.status || 'Active',
            avatar: avatar || null,
            bank: e.bank || '',
            tax: e.tax || (e.type === 'Contractor / Exempt' ? 'Exempt — not subject to tax deductions' : /USA/.test(e.entity) ? 'W-4 (US Federal)' : /UK/.test(e.entity) ? 'PAYE (HMRC)' : 'DGII (ISR + TSS)'),
            joined: e.start || e.start_date || '',
            // Stored fields shown on the profile (acct / nid are masked by the backend)
            email: e.email || '', nid: e.nid || '', acct: e.acct || '', freq: e.freq || '', pmethod: e.pmethod || '',
            alloc: e.alloc != null ? Number(e.alloc) : 100, cryptoAlloc: Number(e.cryptoAlloc || 0),
            cryptoAsset: e.cryptoAsset || '', cryptoNetwork: e.cryptoNetwork || '', cryptoWallet: e.cryptoWallet || '',
            jira: e.jira || ''
          };
        });
        if (window.__MGH_DATA) {
          window.__MGH_DATA.EMPLOYEES = window.EMPLOYEES;
          window.__MGH_DATA.ALL_EMP = window.EMPLOYEES.slice();
        }
      }
      // Backend holidays/leave replace the attendance engine's cached copies right away (not only after a reload)
      if (window.MGH_ATT && window.MGH_ATT.setHolidays) window.MGH_ATT.setHolidays(Array.isArray(d.holidays) ? d.holidays : []);
      if (window.MGH_ATT && window.MGH_ATT.setLeave) window.MGH_ATT.setLeave(Array.isArray(d.leaveRequests) ? d.leaveRequests : []);
      if (d.organizations && Array.isArray(d.organizations)) {
        try { localStorage.setItem('mgh-wf-tenants', JSON.stringify(d.organizations)); } catch(e){}
      }
      window.dispatchEvent(new Event('mgh-att'));
      window.dispatchEvent(new Event('mgh-wf'));

      if (Array.isArray(d.contractors)) {
        try {
          localStorage.setItem('mgh_contractors_v1', JSON.stringify(d.contractors));
        } catch (_) {}
        if (window.__MGH_CTR) {
          window.__MGH_CTR.CONTRACTORS = d.contractors;
          if (d.contractorPayments && Array.isArray(d.contractorPayments)) {
            window.__MGH_CTR.INIT_PAYMENTS = d.contractorPayments;
          }
        }
      }

      this.setState({
        adj: d.adjustments || [],
        worklogs: d.worklogs || [],
        proofs: d.proofs || [],
        ov,
        currentUser: d.currentUser || this.state.currentUser,
        apiOnline: true
      });
    }
    catch(e){
      this.setState({apiOnline:false});
      console.warn('[api] Backend not reachable - using local demo data.',e.message);
    }
  }

  handleGoogleLogin = async () => {
    this.setState({ loginLoading: true, loginError: '' });
    try {
      const { signInWithGoogle } = await import('./lib/firebase');
      const { idToken } = await signInWithGoogle();
      const res = await api.loginWithGoogle(idToken);
      if (window.MGH_RBAC && window.MGH_RBAC.setUser) {
        window.MGH_RBAC.setUser(res.user);
      }
      const empId = res.user.employeeId || res.user.employee_id || this.state.empId;
      const home = window.MGH_RBAC ? window.MGH_RBAC.homeRoute() : 'mytime';
      const targetRoute = window.MGH_RBAC && !window.MGH_RBAC.canRoute(this.state.route) ? home : this.state.route;
      location.hash = '#' + targetRoute;
      this.setState({
        currentUser: res.user,
        empId,
        route: targetRoute,
        loginLoading: false,
        loginError: '',
        authChecking: false,
      });
      this.flash(`Logged in with Google as ${res.user.name} (${(res.user.role || 'USER').toUpperCase()})`);
      await this.loadFromApi();
    } catch (err) {
      console.error('[Google Auth Error]', err);
      let errMsg = err.message || 'Google authentication failed';
      if (err.code === 'auth/popup-closed-by-user') {
        errMsg = 'La ventana de inicio de sesión de Google fue cerrada antes de completar.';
      } else if (err.code === 'auth/popup-blocked') {
        errMsg = 'El navegador bloqueó la ventana emergente. Por favor permite popups para este sitio.';
      } else if (err.code === 'auth/unauthorized-domain') {
        errMsg = 'Este dominio no está autorizado en Firebase Console (Authentication -> Settings -> Authorized domains).';
      } else if (err.code === 'auth/operation-not-allowed') {
        errMsg = 'El proveedor de Google no está habilitado en Firebase Console (Authentication -> Sign-in method -> Google).';
      }
      this.setState({
        loginLoading: false,
        loginError: errMsg,
      });
    }
  };

  handleLogin = async (email, password) => {
    const mail = (email || this.state.loginEmail || '').trim();
    const pass = password || this.state.loginPassword;
    if (!mail || !pass) {
      this.setState({ loginError: 'Email and password are required' });
      return;
    }
    this.setState({ loginLoading: true, loginError: '' });
    try {
      const res = await api.login(mail, pass);
      if (window.MGH_RBAC && window.MGH_RBAC.setUser) {
        window.MGH_RBAC.setUser(res.user);
      }
      const empId = res.user.employeeId || res.user.employee_id || this.state.empId;
      const home = window.MGH_RBAC ? window.MGH_RBAC.homeRoute() : 'mytime';
      const targetRoute = window.MGH_RBAC && !window.MGH_RBAC.canRoute(this.state.route) ? home : this.state.route;
      location.hash = '#' + targetRoute;
      this.setState({
        currentUser: res.user,
        empId,
        route: targetRoute,
        loginLoading: false,
        loginError: '',
        authChecking: false
      });
      this.flash(`Logged in as ${res.user.name} (${res.user.role.toUpperCase()})`);
      await this.loadFromApi();
    } catch(err) {
      let errMsg = err.message || 'Invalid email or password';
      if (err.status === 502 || (err.message && err.message.includes('502'))) {
        errMsg = 'Backend API unreachable (502 Bad Gateway). Make sure the backend is running on http://127.0.0.1:5050 (run "Iniciar-MGH-Timekeeping.bat" or "npm run dev").';
      } else if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        errMsg = 'Cannot reach backend API server. Verify both backend (:5050) and frontend (:5173) are running.';
      }
      this.setState({
        loginLoading: false,
        loginError: errMsg
      });
    }
  };

  handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    if (window.MGH_RBAC && window.MGH_RBAC.setUser) {
      window.MGH_RBAC.setUser(null);
    }
    this.setState({
      currentUser: null,
      authChecking: false,
      loginEmail: '',
      loginPassword: '',
      loginError: '',
      route: 'dashboard'
    });
    this.flash('Signed out of My Global Hub');
  };
  async executePayrollCalculation(periodId){
    try {
      this.flash(`Calculating payroll register for ${periodId} with backend tax engine…`);
      const run = await api.calculatePayroll({ periodId, saveAsRun: true });
      this.setState({ payrollRunModal: run });
      this.flash(`Run calculated: $${run.totalNet.toLocaleString()} net across ${run.totalEmployees} employees`);
      await this.loadFromApi();
    } catch(e) {
      this.flash('Calculation blocked: ' + e.message);
    }
  }
  async approveCurrentPayrollRun(runId){
    try {
      await api.approvePayrollRun(runId);
      this.flash(`Payroll run ${runId} approved and signed off by ${this.state.currentUser.name}`);
      this.setState(s => ({
        payrollRunModal: s.payrollRunModal ? { ...s.payrollRunModal, status: 'Approved' } : null
      }));
      await this.loadFromApi();
    } catch(e) {
      this.flash('Approval failed: ' + e.message);
    }
  }

  // ---- Password: change it (current password or Google re-verification) or set the first one (Google-only accounts)
  openPassword = () => this.setState({ pw: { current: '', next: '', confirm: '', googleToken: null, googleEmail: '', saving: false, error: '' } });
  verifyWithGoogle = async () => {
    try {
      const { signInWithGoogle } = await import('./lib/firebase');
      const { idToken, email } = await signInWithGoogle();
      this.setState(s => ({ pw: { ...s.pw, googleToken: idToken, googleEmail: email || '', error: '' } }));
    } catch (e) {
      this.setState(s => ({ pw: { ...s.pw, error: 'Google verification failed: ' + e.message } }));
    }
  };
  submitPassword = async () => {
    const { pw, currentUser } = this.state;
    const hasPw = !(currentUser && currentUser.hasPassword === false);
    const set = patch => this.setState(s => ({ pw: { ...s.pw, ...patch } }));
    if (pw.next !== pw.confirm) return set({ error: 'The new passwords do not match' });
    if (pw.next.length < 10 || !/[a-z]/.test(pw.next) || !/[A-Z]/.test(pw.next) || !/\d/.test(pw.next)) return set({ error: 'Use at least 10 characters with upper case, lower case and a number' });
    if (hasPw && !pw.current && !pw.googleToken) return set({ error: 'Enter your current password or verify with Google' });
    set({ saving: true, error: '' });
    try {
      await api.changePassword({ newPassword: pw.next, currentPassword: pw.current || undefined, googleIdToken: pw.googleToken || undefined });
      this.setState(s => ({ pw: null, currentUser: s.currentUser ? { ...s.currentUser, hasPassword: true } : s.currentUser }));
      this.flash(hasPw ? 'Password changed' : 'Password created • you can now also sign in with email and password');
    } catch (e) {
      set({ saving: false, error: e.message });
    }
  };
  renderPasswordModal() {
    const { pw, currentUser } = this.state;
    const hasPw = !(currentUser && currentUser.hasPassword === false);
    const set = k => e => { const v = e.target.value; this.setState(s => ({ pw: { ...s.pw, [k]: v, error: '' } })); };
    const close = () => this.setState({ pw: null });
    const input = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--mgh-surface-3)', font: '500 14px var(--font-sans)', boxSizing: 'border-box' };
    const label = { display: 'block', font: '600 12px/16px var(--font-sans)', color: 'var(--mgh-ink-2)', marginBottom: 6 };
    return (
      <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(19,27,46,.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ width: 460, maxWidth: '100%', background: '#fff', borderRadius: 16, boxShadow: 'var(--shadow-lg)', padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><DS.Icon name="key" size={22} color="var(--mgh-primary)" /><span style={{ font: '700 20px/26px var(--font-sans)', color: 'var(--mgh-ink)' }}>{hasPw ? 'Change password' : 'Create a password'}</span></div>
              <span style={{ font: '400 13px/18px var(--font-sans)', color: 'var(--mgh-ink-2)', marginTop: 4, display: 'block' }}>{hasPw ? 'Confirm it is you with your current password, or verify with Google if you usually sign in with Google.' : 'You signed in with Google. Create a password to also sign in with ' + ((currentUser && currentUser.email) || 'your email') + '.'}</span>
            </div>
            <button onClick={close} style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 4 }}><DS.Icon name="close" size={20} color="var(--mgh-ink-3)" /></button>
          </div>
          {hasPw && !pw.googleToken ? <div><label style={label}>Current password</label><input type="password" autoComplete="current-password" value={pw.current} onChange={set('current')} style={input} /></div> : null}
          {hasPw ? (pw.googleToken
            ? <div style={{ font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-success)' }}>Verified with Google{pw.googleEmail ? ' • ' + pw.googleEmail : ''}</div>
            : <DS.Button variant="secondary" icon="login" onClick={this.verifyWithGoogle}>Forgot it? Verify with Google instead</DS.Button>) : null}
          <div><label style={label}>New password</label><input type="password" autoComplete="new-password" value={pw.next} onChange={set('next')} style={input} /></div>
          <div><label style={label}>Confirm new password</label><input type="password" autoComplete="new-password" value={pw.confirm} onChange={set('confirm')} style={input} /></div>
          <span style={{ font: '400 12px/16px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>At least 10 characters, with upper case, lower case and a number.</span>
          {pw.error ? <div style={{ font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-danger)' }}>{pw.error}</div> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <DS.Button variant="secondary" onClick={close}>Cancel</DS.Button>
            <DS.Button icon="save" disabled={pw.saving} onClick={this.submitPassword}>{pw.saving ? 'Saving…' : hasPw ? 'Change password' : 'Create password'}</DS.Button>
          </div>
        </div>
      </div>
    );
  }

  openNewAdjustmentModal = () => {
    const emps = window.EMPLOYEES || [];
    if (!emps.length) { this.flash('Add an employee before creating adjustments'); return; }
    const first = emps[0];
    this.setState({
      showAdjModal: true,
      newAdj: {
        employeeId: first.id,
        name: first.name,
        role: first.role,
        avatar: first.avatar,
        type: '',
        cat: 'Discretionary incentive pool',
        kind: 'bonus',
        amt: '',
        tax: 'DGII Taxable ISR',
        taxTone: 'info',
        target: first.bank || '',
        status: 'Pending Approval'
      }
    });
  };

  async submitNewAdjustment() {
    const { newAdj } = this.state;
    const numAmt = parseFloat(newAdj.amt);
    if (!newAdj.name || !newAdj.type || isNaN(numAmt)) {
      this.flash('Please provide valid employee, type and numeric amount');
      return;
    }
    try {
      await api.createAdjustment({
        id: `ADJ-${Date.now().toString().slice(-6)}`,
        name: newAdj.name,
        role: newAdj.role,
        avatar: newAdj.avatar,
        type: newAdj.type,
        cat: newAdj.cat,
        kind: newAdj.kind,
        amt: numAmt,
        tax: newAdj.tax,
        taxTone: newAdj.taxTone,
        target: newAdj.target,
        status: newAdj.status
      });
      this.setState({ showAdjModal: false });
      this.flash(`Adjustment saved for ${newAdj.name} • saved to SQLite & audit log`);
      await this.loadFromApi();
    } catch(err) {
      this.flash('Creation blocked: ' + err.message);
    }
  }

  queueSeveranceAdjustment = async (sevEmp, totalSeverance) => {
    try {
      await api.createAdjustment({
        id: `ADJ-${Date.now().toString().slice(-6)}`,
        name: sevEmp.name,
        role: sevEmp.role,
        avatar: sevEmp.avatar,
        type: 'Statutory Severance (Ley 16-92)',
        cat: 'Desahucio & Prestaciones Laborales',
        kind: 'bonus',
        amt: totalSeverance,
        tax: 'Statutory Exempt (Art. 86)',
        taxTone: 'success',
        target: sevEmp.bank || 'Banco BHD León',
        status: 'Pending Approval'
      });
      this.flash(`Liquidación de $${totalSeverance.toLocaleString('en-US', { minimumFractionDigits: 2 })} encolada en ajustes para ${sevEmp.name}`);
      await this.loadFromApi();
    } catch(e) {
      this.flash('Error encolando ajuste: ' + (e.message || 'Error'));
    }
  };

  exportFiniquito = (sevEmp, calc) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.flash('Por favor habilite ventanas emergentes para imprimir finiquito');
      return;
    }
    const dateStr = new Date().toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' });
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Finiquito y Liquidación - ${sevEmp.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #111; line-height: 1.5; }
    .header { border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    .company { font-size: 20px; font-weight: 800; }
    .title { font-size: 16px; font-weight: 700; text-transform: uppercase; margin-top: 4px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
    th, td { padding: 10px 12px; border: 1px solid #ddd; }
    th { background: #f5f5f5; text-align: left; }
    .num { text-align: right; }
    .total-row { font-weight: 800; font-size: 15px; background: #fafafa; }
    .legal { font-size: 11px; color: #555; margin-top: 24px; line-height: 1.6; text-align: justify; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 60px; font-size: 13px; text-align: center; }
    .sig-line { border-top: 1px solid #000; padding-top: 8px; margin-top: 40px; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; display: flex; gap: 10px;">
    <button onclick="window.print()" style="padding: 8px 16px; font-weight: 600; cursor: pointer; background: #0b1f44; color: #fff; border: none; border-radius: 4px;">Imprimir / Guardar como PDF</button>
    <button onclick="window.close()" style="padding: 8px 16px; cursor: pointer; border: 1px solid #ccc; background: #fff; border-radius: 4px;">Cerrar</button>
  </div>
  <div class="header">
    <div>
      <div class="company">MY GLOBAL HUB DOMINICANA SRL</div>
      <div class="title">Recibo de Finiquito y Liquidación de Prestaciones Laborales</div>
      <div style="font-size: 12px; color: #666;">Código de Trabajo de la República Dominicana (Ley 16-92)</div>
    </div>
    <div style="text-align: right; font-size: 12px;">
      <div><strong>Fecha:</strong> ${dateStr}</div>
      <div><strong>Ref:</strong> FIN-${Date.now().toString().slice(-6)}</div>
    </div>
  </div>
  <div class="meta-grid">
    <div><strong>Empleado:</strong> ${sevEmp.name}</div>
    <div><strong>Cédula / RNC:</strong> ${sevEmp.nid || '—'}</div>
    <div><strong>Cargo:</strong> ${sevEmp.role}</div>
    <div><strong>ID Empleado:</strong> ${sevEmp.id}</div>
    <div><strong>Tiempo en servicio:</strong> ${calc.tenureYears} años, ${calc.tenureMonths} meses</div>
    <div><strong>Salario ordinario mensual:</strong> $${calc.monthlySal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
    <div><strong>Salario diario promedio:</strong> $${calc.dailySal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
    <div><strong>Causa de terminación:</strong> ${calc.causeLabel}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Concepto de Liquidación</th>
        <th>Base de Cálculo</th>
        <th class="num">Monto (USD)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Preaviso Legal (Art. 76)</td>
        <td>${calc.preavisoDays} días @ $${calc.dailySal.toFixed(2)}/día</td>
        <td class="num">$${calc.preavisoAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr>
        <td>Auxilio de Cesantía (Art. 80)</td>
        <td>${calc.cesantiaDays} días @ $${calc.dailySal.toFixed(2)}/día</td>
        <td class="num">$${calc.cesantiaAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr>
        <td>Vacaciones No Gozadas (Art. 177-181)</td>
        <td>${calc.vacationDays} días @ $${calc.dailySal.toFixed(2)}/día</td>
        <td class="num">$${calc.vacationAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr>
        <td>Salario de Navidad Proporcional (Regalía Pascual - Art. 219)</td>
        <td>Ley 16-92 Art. 219 (Exento de TSS e ISR)</td>
        <td class="num">$${calc.regaliaAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr class="total-row">
        <td colspan="2">TOTAL LIQUIDACIÓN Y DESCARGO FINIQUITO</td>
        <td class="num">$${calc.totalSeverance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>
    </tbody>
  </table>
  <div class="legal">
    El/la abajo firmante declara haber recibido de MY GLOBAL HUB DOMINICANA SRL a su entera y total satisfacción la suma descrita en este documento por concepto de todas sus prestaciones laborales, salarios devengados, vacaciones y regalía pascual con motivo de la terminación del contrato de trabajo que los unía, otorgando a favor de la empresa el más amplio, formal y definitivo descargo y finiquito legal, declarando que no tiene ninguna reclamación civil, laboral ni de ninguna otra índole presente o futura.
  </div>
  <div class="signatures">
    <div>
      <div class="sig-line">
        <strong>${sevEmp.name}</strong><br/>
        Firma del Trabajador<br/>
        Cédula: ${sevEmp.nid || '___________________'}
      </div>
    </div>
    <div>
      <div class="sig-line">
        <strong>MY GLOBAL HUB DOMINICANA SRL</strong><br/>
        Por: Recursos Humanos / Finanzas
      </div>
    </div>
  </div>
</body>
</html>`);
    printWindow.document.close();
    this.flash('Finiquito legal generado para impresión y firma');
  };

  exportPayrollRegisterCSV = () => {
    const emps = window.EMPLOYEES || [];
    if (!emps.length) {
      this.flash('No employee data available to export');
      return;
    }
    const headers = ['Employee ID', 'Name', 'Role', 'Department', 'Entity', 'Hourly Rate', 'Reg Hours', 'OT Hours', 'PTO Hours', 'Total Hours', 'Est Gross Pay', 'Primary Bank', 'Payment Method'];
    const rows = emps.map(e => [
      e.id,
      `"${e.name || ''}"`,
      `"${e.role || ''}"`,
      `"${e.dept || ''}"`,
      `"${e.entity || ''}"`,
      e.rate || 0,
      e.reg || 80,
      e.ot || 0,
      e.pto || 0,
      (Number(e.reg || 80) + Number(e.ot || 0) + Number(e.pto || 0)).toFixed(1),
      (Number(e.gross) || (Number(e.rate || 50) * 80)).toFixed(2),
      `"${e.bank || 'Banco BHD León'}"`,
      `"${e.pmethod || 'Bank Deposit'}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MGH_Payroll_Register_2025.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.flash('Payroll register exported as CSV file');
  };

  exportPayrollRunDisbursementCSV = (run) => {
    if (!run || !run.items) return;
    const headers = ['Employee ID', 'Employee Name', 'Role', 'Regular Hours', 'Overtime Hours', 'Gross Earnings', 'Statutory Deductions', 'Net Payout', 'Payout Rail', 'Target Account / Hash'];
    const rows = run.items.map(it => [
      it.employee_id || it.id || 'MGH-000',
      `"${it.employee_name || it.name}"`,
      `"${it.employee_role || it.role}"`,
      it.hours ? it.hours.regular : (it.reg_hours || 80),
      it.hours ? it.hours.overtime : (it.ot_hours || 0),
      Number(it.gross_pay || (it.earnings && it.earnings.grossPay) || 0).toFixed(2),
      Number(it.total_deductions || (it.deductions && it.deductions.total) || 0).toFixed(2),
      Number(it.net_pay || it.netPay || 0).toFixed(2),
      `"${it.payoutDistribution && it.payoutDistribution[0] ? it.payoutDistribution[0].rail : 'ACH Direct Deposit'}"`,
      `"${it.payoutDistribution && it.payoutDistribution[0] ? (it.payoutDistribution[0].account || it.payoutDistribution[0].wallet || '••••9012') : '••••9012'}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Disbursement_Batch_${run.periodId || 'Run'}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.flash(`Disbursement file downloaded for ${run.periodId}`);
  };

  sync(p,what){p.catch(e=>{console.warn('[api]',e.message);if(this.state.apiOnline)this.flash(what+' blocked by server: '+e.message)})}
  componentWillUnmount(){
    clearInterval(this._iv);
    window.removeEventListener('resize', this._rs);
    window.removeEventListener('mgh-wf', this._wf);
    window.removeEventListener('mgh-rbac', this._rb);
    window.removeEventListener('mgh-att-leave', this._attLeave);
    window.removeEventListener('mgh-att-punch', this._attPunch);
    window.removeEventListener('mgh-lang', this._lang);
    window.removeEventListener('mgh-stub', this._lang);
    window.removeEventListener('mgh-open-password', this.openPassword);
    window.removeEventListener('mgh-i18n-missing', this._miss);
    window.removeEventListener('hashchange', this.onHash);
  }
  // Keep the screen in sync with the URL hash (back/forward buttons, shared links)
  onHash=()=>{
    const hh=(location.hash||'').slice(1).split('/');
    const MTb={myentry:'entry',mysheets:'sheets',myhistory:'history'}[hh[0]];
    const h=MTb?'mytime':hh[0];
    if(h&&(KIT.includes(h)||['periods','adjustments','workflows','mytime','addEmployee','languages','empCreated'].includes(h))){
      this.setState(st=>({route:h,empId:hh[1]||st.empId,...(MTb?{myTab:MTb}:{})}));
    }
  };
  nowMin(){const n=new Date();return n.getHours()*60+n.getMinutes()}
  syncAtt(days){
    const A=window.MGH_ATT;if(!A)return;
    const myEmpId = this.state.currentUser && (this.state.currentUser.employeeId || this.state.currentUser.employee_id);
    if (!myEmpId) return;
    (days||this.state.myDays).forEach(e=>{if(e.type==='Regular'&&(e.in||e.out))A.setPunches(myEmpId,e.d.toISOString().slice(0,10),e);});
  }
  componentDidUpdate(pp,ps){if(ps&&ps.myDays!==this.state.myDays)this.syncAtt();}
  applyLeave(){
    const A=window.MGH_ATT;if(!A)return;
    const myEmpId = this.state.currentUser && (this.state.currentUser.employeeId || this.state.currentUser.employee_id);
    if (!myEmpId) return;
    this.setState(s=>({myDays:s.myDays.map(e=>{const l=A.leaveOn(myEmpId,e.d.toISOString().slice(0,10));return l&&e.type!=='Weekend'?{...e,type:l.type==='Sick'?'Sick':'PTO',leaveId:l.id}:e})}));
  }
  pclient(p){
    const M=window.__MGH_CLIENT_OF||{};
    return p?(M[p]||'—'):'—';
  }
  crumbRoute(txt){
    const I=window.MGH_I18N,tr=x=>I?I.tx(x):x,eq=x=>x===txt||tr(x)===txt;
    const extra={'Employee Directory':'employees','Workforce':'employees','Payroll & Finance':'periods','Enterprise Payroll':'periods','Cycles & Compliance':'periods','Employee Self-Service':'mytime','System':'admin','Administration':'admin','System / Administration':'admin','Approvals':'queue','Pay Stubs':'paystub','Contractors':'contractors','Integrations':'jira','Overview':'dashboard','Attendance & Time':'attendance','Attendance':'attendance','Operations':'ops','Operations Center':'ops','Permissions':'permissions','Roles & Permissions':'permissions','Languages':'languages','Daily Activities':'actDaily','Registro por actividades':'actDaily','Registro de jornada':'attDaily'};
    for(const k in extra)if(eq(k))return extra[k];
    return null;
  }
  navFor(){
    const R=window.MGH_RBAC;if(!R)return NAV;
    const selfEmp=R.scopeOf('employees.view')==='self',selfPay=R.scopeOf('payslips.view')==='self';
    const selfCtr=R.scopeOf('contractors.view')==='self';
    const selfTime=R.can('timesheets.self');
    return NAV.map(g=>({...g,items:g.items.flatMap(it=>it.key==='mytime'&&selfTime?[{key:'myentry',label:'Time Entry',icon:'more_time'},{key:'mysheets',label:'My Timesheets',icon:'calendar_view_week'},{key:'myhistory',label:'Approval History',icon:'history'}]:[it]).filter(it=>it.children?it.children.some(c=>R.canRoute(c.key)):R.canRoute(it.key)).map(it=>{
      if(it.children){
        return {...it,children:it.children.filter(c=>R.canRoute(c.key))};
      }
      return it.key==='employees'&&selfEmp?{...it,key:'profile',label:'My Profile',icon:'account_circle'}:it.key==='paystub'&&selfPay?{...it,label:'My Payslips'}:it.key==='contractors'&&selfCtr?{...it,label:'My Contractor Info'}:it.key==='approvals'?{...it,badge:undefined}:it;
    })})).filter(g=>g.items.length);
  }
  panelVals(){
    const WF=window.MGH_WF,R=window.MGH_RBAC,s=this.state;
    if(!WF||!R)return {notifOpen:false,orgMenu:false};
    const fdt=iso=>{const t=new Date(iso);return t.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})};
    const items=WF.notifications();
    return {
      orgMenu:!!s.orgMenu,closeOrgMenu:()=>this.setState({orgMenu:false}),
      orgItems:R.ORGS.filter(o=>R.orgs().includes(o.id)).map(o=>({name:o.id,person:R.me().memberships[o.id]+' • '+o.currency+' • '+o.timezone+' • '+o.payroll,run:()=>{R.setOrg(o.id);this.setState({orgMenu:false});this.flash('Organization • '+o.id+' • '+R.role)},bg:o.id===R.org?'var(--mgh-primary-50)':'transparent',check:o.id===R.org?'check':''})),
      notifOpen:!!s.notifOpen,closeNotif:()=>this.setState({notifOpen:false}),notifTitle:'Notifications • '+WF.role+' • '+(R.orgSettings()?R.orgSettings().short:'Dominicana'),
      notifItems:items.slice(0,30).map(n=>({text:n.text,ref:n.ref,at:fdt(n.at),dot:n.read?'transparent':'var(--mgh-accent)'})),notifEmpty:items.length===0,notifHas:items.length>0,
      markRead:()=>WF.markAllRead()
    };
  }
  langVals(){
    const I=window.MGH_I18N,s=this.state;if(!I)return {isLang:false,langMenu:false,langCode:'ES'};
    const cur=I.lang,en=I.enabled;
    const pick=c=>{if(!I.setLang(c)){this.flash(I.tx('Enable this language first'));return}this.setState({langMenu:false});};
    return {
      langCode:cur.toUpperCase().slice(0,2),langMenu:!!s.langMenu,closeLangMenu:()=>this.setState({langMenu:false}),
      langMenuItems:I.LOCALES.filter(l=>en.includes(l.code)).map(l=>({name:l.name+(l.code===I.defaultLang?' (Default)':''),code:l.code.toUpperCase(),run:()=>pick(l.code),bg:l.code===cur?'var(--mgh-primary-50)':'transparent',check:l.code===cur?'check':'',color:l.code===cur?'var(--mgh-primary)':'var(--mgh-ink)'})),
      langAdd:()=>{this.setState({langMenu:false});this.go('languages')},
      isLogin:s.route==='login',login:s.login||{email:'',pw:''},
      loginLangs:I.LOCALES.filter(l=>en.includes(l.code)).map(l=>({name:l.name,code:l.code.toUpperCase(),run:()=>I.setLang(l.code),check:l.code===cur?'check_circle':'',bg:l.code===cur?'var(--mgh-primary-50)':'var(--mgh-surface-1)',ring:l.code===cur?'inset 0 0 0 2px var(--mgh-primary)':'none'})),
      setLoginEmail:v=>{const x=typeof v==='string'?v:v.target.value;this.setState(st=>({login:{...(st.login||{}),email:x}}))},
      setLoginPw:v=>{const x=typeof v==='string'?v:v.target.value;this.setState(st=>({login:{...(st.login||{}),pw:x}}))},
      doLogin:()=>{const l=this.state.login||{};if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(l.email||'')||!l.pw){this.flash(I.tx('Enter your email and password'));return}this.setState({login:{email:'',pw:''}});this.go('periods');this.flash(I.tx('Signed in')+' • '+(cur==='es'?'Español':'English'))},
      isLang:s.route==='languages',langCrumbs:['System / Administration','Languages'],
      langDefault:I.defaultLang,langDefaultOpts:[{value:'es',label:'Español'},{value:'en',label:'English'}],
      setLangDefault:v=>{const c=typeof v==='string'?v:v.target.value;if(I.setDefault(c))this.flash(I.tx('Default language updated')+' • '+(c==='es'?'Español':'English'))},
      langEnOn:en.includes('en'),toggleEn:()=>{const on=en.includes('en');if(!I.setEnabled('en',!on)){this.flash(I.tx('The default language cannot be disabled'));return}this.flash(I.tx(on?'Language disabled':'Language enabled')+' • English')},
      langRows:I.LOCALES.map(l=>{const pct=I.completion(l.code),on=en.includes(l.code);return {name:l.name,en:l.en,code:l.code,isDefault:l.code===I.defaultLang,on,dir:l.dir.toUpperCase(),pct,pctLabel:pct+'%',active:l.code===cur,rowBg:l.code===cur?'var(--mgh-primary-50)':'transparent',
        toggle:()=>{if(!I.setEnabled(l.code,!on)){this.flash(I.tx('The default language cannot be disabled'));return}this.flash(I.tx(on?'Language disabled':'Language enabled')+' • '+l.name)},
        preview:()=>pick(l.code)}}),
      langFormats:(()=>{const f=I.formats();return [['Date',f.date],['Time',f.time],['Currency',f.currency],['Number',f.number]].map(x=>({k:x[0],v:x[1]}))})()
    };
  }
  wfCfgVals(){
    const WF=window.MGH_WF,R=window.MGH_RBAC;if(!WF||!R)return {wfCfgRows:[],wfAddOpts:[],otRule:'weekly'};
    const c=WF.config,roles=R.ROLE_IDS.filter(r=>R.MATRIX['timesheets.approve'].grants[r]);
    const ok=(r,m)=>{if(r===false)this.flash('At least one approver must stay enabled');else this.flash(m)};
    return {
      wfCfgRows:c.steps.map((x,i)=>({n:'Step '+(i+2),label:x.label,role:x.role,roleOpts:roles.map(r=>({value:r,label:r+' • '+WF.person(r)})),on:x.enabled,opacity:x.enabled?'1':'0.5',
        toggle:()=>ok(WF.toggleStep(i),x.label+(x.enabled?' disabled':' enabled')),setRole:v=>{WF.setStepRole(i,typeof v==='string'?v:v.target.value);this.flash(x.label+' → '+(typeof v==='string'?v:v.target.value))},
        up:()=>WF.moveStep(i,-1),down:()=>WF.moveStep(i,1),remove:()=>{if(WF.removeStep(i))this.flash(x.label+' removed');else this.flash('At least one approver is required')}})),
      wfFlowText:['Employee',...WF.steps().map(x=>x.label),'Paid'].join(' → '),
      wfAddOpts:Object.keys(WF.CATALOG).filter(k=>!c.steps.some(x=>x.key===k)).map(k=>({label:'Add '+WF.CATALOG[k].label,run:()=>{WF.addStep(k);this.flash(WF.CATALOG[k].label+' step added before Payroll')}})),
      wfReset:()=>{WF.resetConfig();this.flash('Workflow reset • Employee → Supervisor → Manager → Payroll → Paid')},
      otRule:c.ot.rule,otOpts:[{value:'weekly',label:'Weekly (44h)'},{value:'daily',label:'Daily (8h)'},{value:'both',label:'Daily + Weekly'},{value:'custom',label:'Custom'}],
      setOtRule:v=>{const r=typeof v==='string'?v:v.target.value;WF.setOT(r==='weekly'?{rule:r,weekly:44}:r==='daily'?{rule:r,daily:8}:r==='both'?{rule:r,daily:8,weekly:44}:{rule:r});this.flash('Overtime rule • '+WF.otLabel())},
      otCustom:c.ot.rule==='custom',otDaily:String(c.ot.daily),otWeekly:String(c.ot.weekly),otLabel:WF.otLabel(),
      setOtDaily:v=>{const n=parseFloat(typeof v==='string'?v:v.target.value);if(n>0&&n<=24)WF.setOT({daily:n})},setOtWeekly:v=>{const n=parseFloat(typeof v==='string'?v:v.target.value);if(n>0&&n<=80)WF.setOT({weekly:n})}};
  }
  setDay(i,k,v){this.setState(s=>{const d=[...s.myDays];d[i]={...d[i],[k]:v};return {myDays:d}});const WF=window.MGH_WF;if(WF&&this.state.myPeriodKey==='09')WF.logEdit('MGH-1042','PP-2025-09','Day '+(i+1)+' '+({in:'clock in',lo:'lunch out',li:'lunch in',out:'clock out',type:'day type',note:'note'}[k]||k))}
  setNE(k,v){this.setState(s=>({ne:{...s.ne,[k]:v}}))}
  go=(r,id)=>{
    const MT={myentry:'entry',mysheets:'sheets',myhistory:'history'},alias=r;
    if(MT[r]){this.setState({myTab:MT[r]});r='mytime';}
    this.setState(s=>({route:r,empId:id||s.empId,notifOpen:false,orgMenu:false,langMenu:false}));
    const h='#'+alias+(id?'/'+id:'');
    try{if(location.hash!==h)history.pushState(null,'',h);}catch(e){}
    if(this.scroller.current)this.scroller.current.scrollTop=0;
  };
  flash=m=>{this.setState({toast:m});clearTimeout(this._t);this._t=setTimeout(()=>this.setState({toast:''}),2600)};
  el(name,props,children){const DS=window.MyGlobalHubDesignSystem_2a603d;return DS&&DS[name]?React.createElement(DS[name],props,children):null}
  btns(list){return React.createElement(React.Fragment,null,...list.filter(b=>b&&b[3]).map((b,i)=>this.el('Button',{key:i,variant:b[0],icon:b[1],onClick:b[3]},b[2])))}
  // Same quincena calendar as the backend (backend/src/payroll.js) for every year. Status: the backend's stored
  // value (this.state.ov) wins; otherwise the same date rule the backend uses (past → Closed, today → Open).
  period(n, year = new Date().getFullYear()){
    const m = Math.floor((n - 1) / 2);
    const isFirstHalf = (n - 1) % 2 === 0;
    const lastDay = new Date(year, m + 1, 0).getDate();
    const startDay = isFirstHalf ? 1 : 16;
    const endDay = isFirstHalf ? 15 : lastDay;
    const s = new Date(Date.UTC(year, m, startDay));
    const e = new Date(Date.UTC(year, m, endDay));
    const pay = new Date(Date.UTC(year, m, Math.min(lastDay, endDay + (this.state.offset || 5))));
    const todayStr = (window.MGH_ATT && window.MGH_ATT.TODAY) || new Date().toISOString().slice(0, 10);
    const sStr = s.toISOString().slice(0, 10), eStr = e.toISOString().slice(0, 10);
    let st = todayStr > eStr ? 'Closed' : todayStr >= sStr ? 'Open' : 'Draft';
    const id = `PP-${year}-${String(n).padStart(2, '0')}`;
    st = this.state.ov[id] || st;
    return {n,id,s,e,pay,status:st,dl:[[add(e,1),'10:00'],[add(e,1),'18:00'],[add(e,2),'12:00'],[add(e,2),'17:00'],[add(e,4),'12:00']]};
  }
  async setStatus(id,st,msg){
    try {
      await api.setPeriodStatus(id,st);
      this.setState(s=>({ov:{...s.ov,[id]:st},dialog:null}));
      this.flash(msg);
      await this.loadFromApi();
    } catch(e) {
      this.flash('Action blocked by RBAC: ' + e.message);
    }
  }
  dayCalc(e,isToday,now){
    if(['PTO','Holiday','Sick'].includes(e.type))return {hrs:8,ot:0,missing:false,err:{},credit:true};
    if(e.type==='Weekend')return {hrs:0,ot:0,missing:false,err:{}};
    const a=tm(e.in),lo=tm(e.lo),li=tm(e.li),b=tm(e.out),err={};
    if(b!=null&&a!=null&&b<=a)err.out='Before clock-in';
    if(li!=null&&lo!=null&&li<lo)err.li='Before lunch out';
    let end=b!=null?b:(isToday&&a!=null?now:null);
    if(a==null||end==null)return {hrs:0,ot:0,missing:false,err,blank:a==null};
    let lunch=lo!=null?((li!=null?li:(isToday?now:lo))-lo):0;
    const mins=Math.max(0,end-a-lunch);const hrs=mins/60;
    return {hrs,ot:Math.max(0,hrs-8),missing:!isToday&&(lo!=null&&li==null),err,running:isToday&&b==null};
  }
  myVals(){
    const s = this.state;
    return {
      isMy: s.route === 'mytime',
    };
  }

  addVals(){
    const n=this.state.ne,S=k=>v=>this.setNE(k,typeof v==='string'||typeof v==='boolean'?v:(v&&v.target?(v.target.type==='checkbox'?v.target.checked:v.target.value):v));
    const T=(k,label,o={})=>({isText:true,isSelect:false,isToggle:false,label,value:n[k],set:S(k),ph:o.ph||'',hint:o.hint||'',err:o.err||'',mono:!!o.mono,type:o.type||'text',prefix:o.prefix,suffix:o.suffix});
    const L=(k,label,options)=>({isText:false,isSelect:true,isToggle:false,label,value:n[k],options,set:S(k)});
    const G=(k,label,hint)=>({isText:false,isSelect:false,isToggle:true,label,hint,value:!!n[k],set:()=>this.setNE(k,!n[k])});
    const emailOk=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(n.email);
    const useCb=n.pmethod!=='Bank Deposit',useBank=n.pmethod!=='Coinbase Only';
    const cbA=n.pmethod==='Coinbase Only'?100:(useCb?Math.min(100,Math.max(0,Number(n.cbAlloc)||0)):0);
    const alloc=Number(n.alloc)||0,bankTarget=100-cbA;
    const allocOk=!useBank?true:(n.bank2?alloc>0&&alloc<bankTarget:alloc===bankTarget);
    const emOk=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(n.cbEmail);
    const wOk=n.cbNetwork==='Solana'?/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(n.cbWallet):/^0x[a-fA-F0-9]{40}$/.test(n.cbWallet);
    const cbOk=!useCb||(emOk&&wOk&&n.cbKyc&&n.cbW8&&(n.pmethod==='Coinbase Only'||(cbA>0&&cbA<100)));
    const personal=!!(n.first&&n.last&&emailOk&&n.nid),employ=!!(n.title&&n.start),pay=Number(n.rate)>0,bank=(!useBank||!!(n.acct&&n.route&&allocOk))&&cbOk,jira=!!n.jira;
    const pc=PAYCALC(n.rate,n.freq,n.tax,n.cur);const fullName=(n.first||n.last)?(n.first+' '+n.last).trim():'New Employee';
    const sd=n.start?new Date(n.start+'T00:00:00Z'):null;let firstP='—';if(sd&&!isNaN(sd)){const k=Math.floor((sd-ANCHOR)/(14*DAY))+1;const st=add(ANCHOR,14*(k-1));firstP='PP-2025-'+String(k).padStart(2,'0')+' ('+f(st)+' – '+f(add(st,13))+')'}
    const st=b=>b?'done':'pending';const cur=[personal,employ,pay,bank,jira].indexOf(false);
    const missing=[];if(!personal)missing.push('personal info');if(!employ)missing.push('job title & start date');if(!pay)missing.push('hourly rate');if(useBank&&!(n.acct&&n.route&&allocOk))missing.push('bank details');if(!cbOk)missing.push('Coinbase payout details');
    return {
      isAddEmp:this.state.route==='addEmployee',addCrumbs:['Workforce','Employee Directory','Add Employee'],
      addActions:this.btns([['ghost','close','Cancel',()=>this.go('employees')],['primary','person_add','Create Employee',()=>{const make=async pending=>{try{const r=await api.createEmployee({...n,fullName,pending});const newId=r&&r.id;if(!newId)throw new Error('the server did not return an employee ID');const facts=[['Employee ID',newId],['Job title',n.title||'—'],['Department',n.dept],['Entity',n.entity],['Supervisor',n.mgr],['Type',n.etype],['Start date',n.start||'—'],['First period',firstP],['Rate',n.rate?'$'+Number(n.rate).toFixed(2)+' / hr '+n.cur:'—'],['Payment method',n.pmethod],['Tax profile',n.tax],['Est. gross / period',pay?fmtC(pc.gross,n.cur):'—'],['Est. deductions',pay?(pc.exempt?'Exempt • '+fmtC(0,n.cur):fmtC(pc.ded,n.cur)):'—'],['Est. net / period',pay?fmtC(pc.net,n.cur):'—'],['Approval route',n.flow]];this.setState({dialog:null,created:{id:newId,initialPassword:(r&&r.initialPassword)||'',by:(this.state.currentUser&&this.state.currentUser.name)||'',name:fullName,title:(n.title||'Job title pending')+' • '+n.dept,email:n.email,pending,facts,useCb,useBank,jira:!!n.jira,when:new Date().toLocaleString('en-US',{month:'short',day:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}});this.go('empCreated');this.flash(fullName+' created as '+newId+' • saved to database');await this.loadFromApi();}catch(err){this.setState({dialog:null});this.flash('Creation blocked: '+err.message);}};
          if(missing.length){this.setState({dialog:{title:'Create with missing details?',body:'Still missing: '+missing.join(', ')+'. The record will be created as Pending Onboarding and excluded from payroll until these are completed.',confirm:'Create as Pending',variant:'primary',icon:'person_add',run:()=>make(missing)}});return}make([])}]]),
      addSteps:['Personal','Employment','Payroll','Banking','Jira & Approvals'].map((l,i)=>({label:l,state:i===cur?'current':st([personal,employ,pay,bank,jira][i])})),
      addSections:[
        {icon:'person',title:'Personal Information',sub:'Legal identity used on pay stubs and statutory filings',fields:[T('first','First name',{ph:'Ana'}),T('last','Last name',{ph:'Martínez'}),T('email','Work email',{ph:'name@myglobalhub.com',err:n.email&&!emailOk?'Enter a valid email':''}),T('password','Initial access password (optional)',{ph:'Leave empty to generate a secure one',hint:'If empty, a random password is generated and shown once after saving'}),T('phone','Phone',{ph:'+1 (809) 555-0142'}),T('nid','Cédula / SSN / NI number',{ph:'001-0000000-0',mono:true}),T('dob','Date of birth',{type:'date'})]},
        {icon:'work',title:'Employment',sub:'Entity, reporting line and contract',fields:[L('entity','Operating entity',['MGH Dominicana SRL']),L('dept','Department',['Engineering','Product','Infrastructure','Quality','Analytics','Finance','Security','HR & People']),T('title','Job title',{ph:'Backend Engineer'}),L('mgr','Supervisor',['',...(window.EMPLOYEES||[]).map(e=>e.name).filter(Boolean)]),L('etype','Employment type',['Full-time','Part-time','Contractor / Exempt']),T('start','Start date',{type:'date',hint:'First period: '+firstP}),T('loc','Work location',{ph:'Santo Domingo, DR'})]},
        {icon:'payments',title:'Payroll & Compensation',sub:'Bi-weekly by default • 80h standard period',fields:[L('freq','Pay frequency',['Bi-Weekly','Weekly','Semi-Monthly','Monthly']),T('rate','Hourly rate',{ph:'50.00',prefix:'$',suffix:'/ hr'}),L('cur','Pay currency',['USD','DOP','GBP']),L('tax','Tax profile',['DGII ISR + TSS (Dominican Republic)','US Federal W-4 + State','UK PAYE + NI','Exempt (no tax deductions)']),G('ot','Overtime eligible','1.5× after 44h / week')]},
        ...(n.etype==='Contractor / Exempt'?[{icon:'handshake',title:'Contract Details',sub:'Contractors appear on the Contractors page and stay out of payroll tax reports',fields:[T('cStart','Contract start',{type:'date'}),T('cEnd','Contract end',{type:'date'}),L('cTax','Tax form',['W-8BEN (non-US individual)','W-8BEN-E (non-US entity)','W-9 (US person)','Local invoice + RNC (DR)']),G('cInvoice','Invoice required per period','Contractor uploads an invoice before payout')]}]:[]),
        {icon:'payments',title:'Payment Method',sub:'International employees can be paid in USDC through Coinbase Business',fields:[Object.assign(L('pmethod','How is this employee paid?',['Bank Deposit','Coinbase Only','Split: Bank + Coinbase']),{set:v=>{const m=typeof v==='string'?v:v.target.value;this.setState(s=>({ne:{...s.ne,pmethod:m,...(m==='Split: Bank + Coinbase'?{cbAlloc:'20',alloc:'80',bank2:''}:m==='Bank Deposit'?{alloc:'100'}:{})}}))}})]},
        ...(useBank?[{icon:'account_balance',title:'Bank Accounts',sub:'Split deposits across banks • bank share '+bankTarget+'% of net pay',fields:[L('bank','Primary bank',['Banco BHD León','Banco Popular','Banreservas','Chase Bank USA','Wells Fargo','Barclays']),T('acct','Account number / IBAN',{ph:'DO28 BHDL 0000 0000 0000 0000',mono:true}),T('route','Routing / SWIFT',{ph:'BHDLDOSD',mono:true}),T('alloc','Primary allocation',{suffix:'%',err:allocOk||(useCb&&!(cbA>0&&cbA<100))?'':(n.bank2?'Primary must be under '+bankTarget+'% when a secondary bank is set':'Must be '+bankTarget+'% of net pay')}),T('bank2','Secondary bank (optional)',{ph:'Chase Bank USA',hint:n.bank2?'Receives '+Math.max(0,bankTarget-alloc)+'%':''})]}]:[]),
        ...(useCb?[{icon:'currency_bitcoin',title:'Coinbase Payout (International)',sub:'Paid through Coinbase Business on pay date • USD net pay sent 1:1 as USDC',fields:[
          T('cbEmail','Coinbase account email',{ph:'name@email.com',err:n.cbEmail&&!emOk?'Enter a valid email':''}),
          T('cbId','Coinbase user / account ID (optional)',{ph:'cb_8f2a…',mono:true}),
          L('cbCountry','Country of residence',['Colombia','Mexico','Brazil','Argentina','Philippines','India','Nigeria','Spain','Portugal','Other']),
          L('cbAsset','Payout asset',['USDC','BTC','ETH']),
          L('cbNetwork','Network',['Base','Ethereum','Polygon','Solana']),
          T('cbWallet','Wallet address',{ph:n.cbNetwork==='Solana'?'Base58 address (32–44 chars)':'0x… (40 hex characters)',mono:true,err:n.cbWallet&&!wOk?'Not a valid '+n.cbNetwork+' address':'',hint:'Must belong to the Coinbase account above'}),
          ...(n.pmethod==='Coinbase Only'?[]:[T('cbAlloc','Coinbase share of net pay',{suffix:'%',err:cbA>0&&cbA<100?'':'Use 1–99% for a split'})]),
          G('cbKyc','Coinbase identity verified (KYC)','Required before the first payout'),
          G('cbW8','W-8BEN / tax form on file','Non-US contractors • no US withholding')]}]:[]),
        {icon:'sync_alt',title:'Jira & Approvals',sub:'Worklog binding and approval routing',fields:[L('project','Assigned Project',['MSHP — Project Planning','Atlas Core Platform','Perf Infrastructure','Global Hub v3','Insights Lake','Core Billing Services','Internal Ops']),T('jira','Atlassian account email',{ph:'name@globalhub.atlassian.net'}),T('projects','Projects',{ph:'Arawaki, Wokokai, Treslog',mono:true}),L('flow','Approval route',['Employee → Supervisor → PM → HR → Finance','Employee → Supervisor → HR → Finance'])]}],
      newEmp:{fullName,titleLine:(n.title||'Job title')+' • '+n.dept,
        facts:[['Employee ID','Assigned on save'],['Entity',n.entity],['Supervisor',n.mgr],['Type',n.etype],['Rate',n.rate?'$'+Number(n.rate).toFixed(2)+' / hr '+n.cur:'—'],['First period',firstP.split(' ')[0]],['Payout split',[useBank?(n.bank2?n.bank+' '+alloc+'% • '+n.bank2+' '+(bankTarget-alloc)+'%':n.bank+' '+bankTarget+'%'):'',useCb?'Coinbase '+n.cbAsset+' ('+n.cbNetwork+') '+cbA+'%':''].filter(Boolean).join(' • ')],...(useCb&&n.cbWallet?[['Wallet',n.cbWallet.slice(0,6)+'…'+n.cbWallet.slice(-4)]]:[])].map(x=>({k:x[0],v:x[1]})),
        payEst:{show:pay,exempt:pc.exempt,hoursLabel:n.freq+' • '+pc.hours+'h',gross:fmtC(pc.gross,n.cur),net:fmtC(pc.net,n.cur),lines:pc.lines.map(l=>({k:l[0],v:l[1]==='Exempt'?'Exempt':'−'+fmtC(l[2],n.cur)})),note:pc.exempt?'Tax-exempt profile • no statutory withholding applied':'Estimate based on '+n.tax},
        checks:[[personal,'Personal & identity complete'],[employ,'Employment details complete'],[pay,'Hourly rate set'],...(useBank?[[allocOk&&!!n.acct,'Bank allocation totals '+bankTarget+'%']]:[]),...(useCb?[[wOk,'Coinbase wallet address valid'],[n.cbKyc&&n.cbW8,'KYC verified & tax form on file']]:[]),[(useBank?(n.bank2?bankTarget:alloc):0)+cbA===100&&(!useBank||!useCb||(cbA>0&&cbA<100)),'Payout allocations total 100%'],[jira,'Jira account bound (optional)']].map(c=>({t:c[1],icon:c[0]?'check_circle':'radio_button_unchecked',color:c[0]?'var(--mgh-success)':'var(--mgh-ink-4)'}))}};
  }
  createdVals(){
    const c=this.state.created;if(!c)return {isCreated:false};
    const pend=c.pending.length>0;
    const S=(icon,title,sub,status,tone)=>({icon,title,sub,status,tone});
    const steps=[
      // Only what the backend actually did is marked Done; manual follow-ups are "To do" (no emails/verifications are sent)
      S('person_add','Employee record created',c.id+' • '+c.when,'Done','success'),
      S('login','Login account',c.email?'Can sign in with '+c.email+' • share the initial password securely':'No work email • no login account',c.email?'Created':'Missing',c.email?'success':'warning'),
      ...(c.useBank?[S('account_balance','Bank account verification','Confirm the account details with the employee before the first pay date','To do','neutral')]:[]),
      ...(c.useCb?[S('currency_bitcoin','Coinbase wallet check','Confirm the wallet address, KYC and W-8BEN before the first pay date','To do','neutral')]:[]),
      S('sync_alt','Jira account',c.jira?'Atlassian account saved on the employee record':'No Atlassian account bound',c.jira?'Saved':'Optional',c.jira?'info':'neutral'),
      S('event_repeat','Enrolled in first pay period',pend?'Held until onboarding items are completed':'Timesheet opens automatically',pend?'On Hold':'Scheduled',pend?'warning':'info')];
    return {isCreated:true,created:c,createdPending:pend,createdPendingText:'Complete '+c.pending.join(', ')+' to include this employee in payroll.',
      createdBadge:this.el('Badge',{tone:pend?'warning':'success',dot:true},pend?'Pending Onboarding':'Active • Ready for Payroll'),
      createdCrumbs:['Workforce','Employee Directory',c.id],
      createdActions:this.btns([['secondary','person_add','Add Another Employee',()=>this.go('addEmployee')],['secondary','badge','View Directory',()=>this.go('employees')],['primary','account_circle','Open Profile',()=>this.go('profile',(this.state.created&&this.state.created.id)||'MGH-1163')]]),
      createdFixBtn:this.el('Button',{size:'sm',variant:'secondary',icon:'edit',onClick:()=>this.go('addEmployee')},'Complete Details'),
      createdFacts:c.facts.map(x=>({k:x[0],v:x[1]})),createdSteps:steps,
      createdDone:steps.filter(x=>x.tone==='success').length+' of '+steps.length+' complete'};
  }
  saveProofs(p){try{localStorage.setItem('mgh-proofs',JSON.stringify(p.map(x=>({...x,thumb:x.thumb&&x.thumb.length<400000?x.thumb:null}))))}catch(e){}}
  readFile(file){if(!file)return;if(file.size>8e6){this.flash('File too large • max 8 MB');return}
    const isImg=/^image\//.test(file.type);
    if(isImg){const fr=new FileReader();fr.onload=()=>this.setState({pfFile:{name:file.name,type:file.type,size:file.size,thumb:fr.result},drag:false});fr.readAsDataURL(file)}
    else this.setState({pfFile:{name:file.name,type:file.type,size:file.size,thumb:null},drag:false});}
  proofVals(){
    const s=this.state;
    const TR={bhd:{bank:'Banco BHD León',amount:'$3,042.39 USD',rail:'ACH',ref:'Batch ID #BHD-8823',refLabel:'Trace / reference #',refPh:'BHD-8823-0420'},chase:{bank:'Chase Bank USA, N.A.',amount:'$760.60 USD',rail:'FedWire',ref:'FEDWIRE #US-042119',refLabel:'IMAD / OMAD #',refPh:'20250420MMQFMP2N000119'},coinbase:{bank:'Coinbase • USDC (Base)',amount:'—',rail:'On-chain',ref:'Not used for this employee',refLabel:'Transaction hash',refPh:'0x…64 hex characters'}};
    const has=k=>s.proofs.some(p=>p.transfer===k);
    const t=TR[s.pf.transfer],f=s.pfFile;
    const val=v=>typeof v==='string'?v:(v&&v.target?v.target.value:'');
    return {
      isStub:s.route==='paystub'&&!!window.__mghStub&&window.MGH_RBAC.can('payroll.generate'),
      proofBadge:this.el('Badge',{tone:has('bhd')&&has('chase')?'success':'warning',dot:true},has('bhd')&&has('chase')?'All transfers confirmed':((has('bhd')?1:0)+(has('chase')?1:0))+' of 2 transfers confirmed'),
      transfers:['bhd','chase'].map(k=>({...TR[k],status:has(k)?'Proof Attached':'Awaiting Proof',tone:has(k)?'success':'warning',bg:has(k)?'var(--mgh-success-bg)':'var(--mgh-surface-1)'})),
      transferOpts:[{value:'bhd',label:'Banco BHD León • ACH • 80%'},{value:'chase',label:'Chase Bank USA • FedWire • 20%'},{value:'coinbase',label:'Coinbase • USDC transaction hash'}],
      pf:{...s.pf,refLabel:t.refLabel,refPh:t.refPh},
      setPfTransfer:v=>this.setState(st=>({pf:{...st.pf,transfer:val(v)}})),setPfRef:v=>this.setState(st=>({pf:{...st.pf,ref:val(v)}})),setPfDate:v=>this.setState(st=>({pf:{...st.pf,date:val(v)}})),
      dz:{border:s.drag?'var(--mgh-primary)':f?'var(--mgh-success)':'var(--mgh-surface-3)',bg:s.drag?'var(--mgh-primary-50)':f?'var(--mgh-success-bg)':'var(--surface-app)',icon:f?(f.thumb?'image':'picture_as_pdf'):'cloud_upload',
        title:f?f.name:'Drop the bank transfer confirmation here',sub:f?(Math.round(f.size/1024)+' KB • click to replace'):'PDF, PNG or JPG up to 8 MB • or click to browse'},
      onDragOver:e=>{e.preventDefault();if(!s.drag)this.setState({drag:true})},onDragLeave:()=>this.setState({drag:false}),
      onDrop:e=>{e.preventDefault();this.readFile(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0])},
      onPick:e=>this.readFile(e.target.files&&e.target.files[0]),
      attachProof:()=>{
        const isCb=s.pf.transfer==='coinbase';
        if(isCb&&!/^0x[a-fA-F0-9]{64}$/.test(s.pf.ref)){this.flash('Enter a valid transaction hash (0x + 64 hex)');return}
        if(!isCb&&!f){this.flash('Drop or choose the confirmation file first');return}
        if(!isCb&&!s.pf.ref.trim()){this.flash('Enter the '+t.refLabel.toLowerCase());return}
        const p={id:Date.now(),by:(s.currentUser&&s.currentUser.name)||'',transfer:s.pf.transfer,bank:t.bank,amount:t.amount,ref:t.refLabel+': '+s.pf.ref,date:s.pf.date,file:f?f.name:'On-chain record',thumb:f&&f.thumb,type:f?f.type:'hash',when:new Date().toLocaleString('en-US',{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'})};
        const next=[...s.proofs.filter(x=>x.transfer!==p.transfer),p];this.saveProofs(next);
        this.setState({proofs:next,pfFile:null,pf:{...s.pf,ref:''}});this.sync(api.saveProof(p),'Proof of payment');this.flash('Proof attached'+(window.__mghStub?' to '+window.__mghStub.id+' • '+window.__mghStub.period:''));},
      hasProofs:s.proofs.length>0,
      proofs:s.proofs.map(p=>({...p,thumb:p.thumb?'url('+p.thumb+')':'none',noThumb:!p.thumb,icon:p.type==='hash'?'link':'picture_as_pdf',remove:()=>{const next=s.proofs.filter(x=>x.id!==p.id);this.saveProofs(next);this.setState({proofs:next});this.sync(api.deleteProof(p.id),'Proof removal');this.flash('Proof removed')}}))};
  }
  renderVals(){
    const o=this._rv(),R=window.MGH_RBAC;if(!R)return o;
    const route=this.state.route,emp=this.state.empId;
    // Self-scoped users always land on their own profile (the kit screen ignores empId for them)
    const denied=!R.canRoute(route)||(route==='profile'&&emp&&R.scopeOf('employees.view')!=='self'&&!R.can('employees.view',emp));
    if(denied)Object.keys(o).forEach(k=>{if(/^is[A-Z]/.test(k))o[k]=false});
    const perms=R.routePerms(route);
    if(!R.can('timesheets.self')){o.myStatusBadge=null;o.myActions=null;o.myDesc='Timesheets waiting at your approval step in '+R.org+'. Open one to review hours, worklogs and punches.'}else o.myDesc='Clock in and out, record breaks, log project work and review your bi-weekly timesheet before submission.';
    o.isDenied=denied;o.deniedTitle='403 • Access Denied';
    o.deniedText=(R.me().person+' • '+(R.role||'—')+' • '+R.org)+(perms?' — requires '+(perms.length?perms.join(' or '):'—'):' — unknown route #'+route);
    o.deniedHome=()=>this.go(R.homeRoute());o.deniedSwitch=()=>this.handleLogout();
    return o;
  }
  _rv(){
    const s=this.state,route=s.route,isKit=KIT.includes(route);
    const curP = getCurrentPeriod();
    const curYear = curP.year;
    const all=[];
    for(let n=1;n<=24;n++)all.push(this.period(n, curYear));
    const activePeriodNum = curP.periodNumber;
    const curIdx = Math.max(0, Math.min(all.length - 1, activePeriodNum - 1));
    const cur=all[curIdx] || all[0];
    const fl={all:()=>true,active:p=>!LOCKED.includes(p.status),locked:p=>LOCKED.includes(p.status)};
    const q=s.pq.trim().toLowerCase();
    const shown=all.filter(fl[s.periodFilter]).filter(p=>!q||p.id.toLowerCase().includes(q)).sort((a,b)=>{const pr=x=>x.n===activePeriodNum?0:x.n===activePeriodNum+1?1:x.n>activePeriodNum?2+x.n:100-x.n;return pr(a)-pr(b)});
    const periodRows=shown.slice(0,12).map(p=>{
      const locked=LOCKED.includes(p.status),isCur=p.n===activePeriodNum;
      const dl=p.dl.map(([d,t],i)=>{const past=locked||(isCur&&i<2);const curStep=isCur&&i===2;return {v:(past&&!locked&&isCur?'Passed • ':'')+f(d)+', '+t,color:curStep?'var(--mgh-warning)':past?'var(--mgh-success)':'var(--mgh-ink-2)',font:(curStep||past&&isCur?'700':'400')+' 13px/18px var(--font-sans)',bg:curStep?'var(--mgh-warning-bg)':'transparent'}});
      let act;
      if(p.status==='Draft')act=['secondary','play_arrow','Open',()=>this.setStatus(p.id,'Open',p.id+' opened for time entry • employees notified')];
      else if(p.status==='Closed'||p.status==='Archived')act=['ghost','lock_open','Reopen',()=>this.setState({dialog:{title:'Reopen '+p.id+'?',body:'Reopening a locked period requires dual approval from the Payroll Administrator and Finance VP. Original records stay immutable — any change posts as an adjustment in the next open period.',confirm:'Request Reopen',variant:'primary',icon:'key',run:()=>{this.setState({dialog:null});this.flash('Reopening locked periods is not available yet • post corrections as Payroll Adjustments')}}})];
      else if(p.status==='Paid'||p.status==='Approved')act=['dark','lock','Lock',()=>this.setStatus(p.id,'Closed',p.id+' locked • SHA-256 seal written')];
      else act=[isCur?'primary':'secondary','visibility','Review Cycle',()=>this.go('approvals')];
      return {id:p.id,start:fy(p.s),end:fy(p.e),cutoff:f(p.e)+', 23:59',dl,pay:fy(p.pay),status:p.status,statusShort:SHORT[p.status]||p.status,tone:TONE(p.status),locked,
        hasFlag:isCur||p.n===activePeriodNum+1||p.n===activePeriodNum-1,flag:isCur?'Current Cycle':p.n===activePeriodNum+1?'Next in Queue':'Previous Cycle',flagTone:isCur?'success':p.n===activePeriodNum+1?'info':'warning',
        rowBg:isCur?'var(--mgh-primary-50)':'transparent',actVariant:act[0],actIcon:act[1],actLabel:act[2],act:act[3]};
    });
    const lockedCount=all.filter(p=>LOCKED.includes(p.status)).length;
    const daysTo=Math.max(0, Math.round((cur.pay-new Date())/DAY));
    const WFc=window.MGH_WF,wfSteps=WFc?WFc.steps():[];
    const STAGES_ARR=['employee',...wfSteps.map(x=>x.key),'paid'].map(k=>{const x=STAGE_INFO[k]||STAGE_INFO.manager,stp=wfSteps.find(y=>y.key===k);const r=stp?stp.role:k==='employee'?'Employee':'Payroll';return {...x,kv:[['Role',r],['Person',WFc?WFc.person(r):r]],owner:r+' • '+(WFc?WFc.person(r):r)}});
    const stg=STAGES_ARR[Math.min(s.stage,STAGES_ARR.length-1)]||STAGES[0];
    const stages=STAGES_ARR.map((x,i)=>{const on=i===s.stage,dark=x.final;return {no:'Stage '+String(i+1).padStart(2,'0')+(x.final?' Final':''),title:x.title,icon:x.icon,desc:x.desc,kv:x.kv.map(a=>({k:a[0],v:a[1]})),tag:x.tag,pick:()=>this.setState({stage:i}),no:'Step '+String(i+1).padStart(2,'0')+(x.final?' • Final':''),
      bg:dark?'var(--mgh-navy)':on?'var(--mgh-primary-50)':'var(--mgh-surface-1)',fg:dark?'#FAF8FF':'var(--mgh-ink)',shadow:on?'inset 0 0 0 2px var(--mgh-primary), var(--shadow-md)':'none',
      chipBg:dark?'var(--mgh-success-300)':'var(--mgh-navy)',chipFg:dark?'var(--mgh-navy)':'#fff',iconColor:dark?'var(--mgh-success-300)':'var(--mgh-primary)',boxBg:dark?'rgba(255,255,255,.08)':'#fff',
      tagBg:{success:'var(--mgh-success-bg)',neutral:'var(--mgh-surface-3)',warning:'var(--mgh-warning-bg)',info:'var(--mgh-accent-50)',onDarkSuccess:'var(--mgh-success-300)'}[x.tagTone],tagFg:{success:'var(--mgh-success)',neutral:'var(--mgh-ink-2)',warning:'#8A5A00',info:'var(--mgh-accent-hover)',onDarkSuccess:'var(--mgh-navy)'}[x.tagTone]}});
    const af={all:()=>true,bonus:a=>a.kind==='bonus',stipend:a=>a.kind==='stipend',deduction:a=>a.kind==='deduction',retro:a=>a.kind==='retro'};
    const adjShownRows=s.adj.filter(af[s.adjFilter]);
    const net=s.adj.reduce((t,a)=>t+a.amt,0);
    const cnt=k=>s.adj.filter(af[k]).length;
    return {
      entity: (() => {
        const cu = this.state.currentUser;
        const R = window.MGH_RBAC;
        const userOrg = (cu && cu.entity) || (R ? R.org : 'My Global Hub Dominicana SRL');
        const o = (R && R.orgSettings) ? R.orgSettings(userOrg) : null;
        const isDR = /dominicana/i.test(userOrg);
        const isUS = /usa/i.test(userOrg);
        const isUK = /uk/i.test(userOrg);
        const countryName = isDR ? 'República Dominicana' : isUS ? 'Estados Unidos' : isUK ? 'Reino Unido' : (o && o.country ? o.country : 'República Dominicana');
        const currency = (o && o.currency) || (isDR ? 'DOP' : 'USD');
        const tz = (o && o.timezone) || 'America/Santo_Domingo';
        const rawRole = (cu && cu.role) || (R ? R.role : 'Admin');
        const rolesList = (cu && cu.roles && Array.isArray(cu.roles))
          ? cu.roles
          : String(rawRole).split(',').map(r => r.trim()).filter(Boolean);
        const roleDisplayMap = {
          'admin': 'Administrador',
          'platform admin': 'Administrador de Plataforma',
          'org admin': 'Administrador de Organización',
          'manager': 'Manager',
          'pm': 'Project Manager',
          'supervisor': 'Supervisor',
          'hr': 'Recursos Humanos',
          'payroll': 'Nómina',
          'cfo': 'Finanzas',
          'employee': 'Colaborador',
          'contractor': 'Contratista'
        };
        const formattedRoles = rolesList.map(r => roleDisplayMap[r.toLowerCase()] || r.toUpperCase()).join(' • ');

        return {
          label: 'Región de Operación',
          name: userOrg,
          sub: `${countryName} • ${currency} • ${tz}`,
          tag: formattedRoles || 'ADMINISTRADOR'
        };
      })(),
      nav:this.navFor(),
      navKey:route==='profile'?((window.MGH_RBAC&&window.MGH_RBAC.scopeOf('employees.view')==='self')?'profile':'employees'):route==='empCreated'?'employees':route==='mytime'&&window.MGH_RBAC&&window.MGH_RBAC.can('timesheets.self')?({sheets:'mysheets',history:'myhistory'}[this.state.myTab]||'myentry'):route,
      go:k=>k==='profile'?this.go('profile',(window.MGH_RBAC&&window.MGH_RBAC.me()||{}).emp):this.go(k),
      goKit:this.go,
      notify:this.flash,
      jiraStatus: null,
      user: (() => {
        const m = window.MGH_RBAC ? window.MGH_RBAC.me() : null;
        const cu = this.state.currentUser;
        if (cu) {
          const rawRole = cu.role || 'Admin';
          const rolesList = (cu.roles && Array.isArray(cu.roles))
            ? cu.roles
            : String(rawRole).split(',').map(r => r.trim()).filter(Boolean);
          const roleDisplayMap = {
            'admin': 'Administrador',
            'platform admin': 'Administrador de Plataforma',
            'org admin': 'Administrador de Organización',
            'manager': 'Manager',
            'pm': 'Project Manager',
            'supervisor': 'Supervisor',
            'hr': 'Recursos Humanos',
            'payroll': 'Nómina',
            'cfo': 'Finanzas',
            'employee': 'Colaborador',
            'contractor': 'Contratista'
          };
          const formattedRoles = rolesList.map(r => roleDisplayMap[r.toLowerCase()] || r.toUpperCase()).join(' • ');
          const isDR = /dominicana/i.test(cu.entity || '');
          const regionShort = isDR ? 'República Dominicana' : (cu.entity || 'República Dominicana');

          return {
            name: cu.name,
            role: `${formattedRoles} • ${regionShort}`,
            avatar: cu.avatar || (m ? m.avatar : null) || null
          };
        }
        return m ? { name: m.person, role: m.role + ' • ' + (m.org || 'MGH'), avatar: m.avatar } : { name: '—', role: '' };
      })(),
      meName:window.MGH_RBAC?window.MGH_RBAC.me().person:'',
      meAvatar:window.MGH_RBAC?(window.MGH_RBAC.me().avatar||''):'',
      period:(this.state.vw||window.innerWidth)-288<840?undefined:{code:cur.id,range:`(${curP.range})`,phase:curP.phase},
      notifCount:window.MGH_WF?window.MGH_WF.unread():0,
      ...this.panelVals(),
      topActions:((L)=>{const DS=window.MyGlobalHubDesignSystem_2a603d;if(!DS||(this.state.vw||window.innerWidth)-288>=1040)return L;return React.createElement(React.Fragment,null,L.map((a,k)=>React.createElement(DS.IconButton,{key:k,icon:a.icon,title:a.label,'aria-label':a.label,tone:a.variant==='dark'?'default':'tinted',onClick:a.onClick,style:a.variant==='dark'?{background:'var(--mgh-navy)',color:'#fff'}:undefined})))})([
        {label:(window.MGH_RBAC&&window.MGH_RBAC.orgSettings()?window.MGH_RBAC.orgSettings().short:'Dominicana'),icon:'domain',variant:'secondary',onClick:()=>this.setState(st=>({orgMenu:!st.orgMenu,langMenu:false}))},
        {label:(window.MGH_I18N?window.MGH_I18N.lang:'es').toUpperCase().slice(0,2),icon:'language',variant:'secondary',onClick:()=>this.setState(st=>({langMenu:!st.langMenu,orgMenu:false}))},
        {label:'Bulk Actions',icon:'checklist',variant:'secondary',onClick:()=>this.go('queue')},
        {label:'Export Register',icon:'download',variant:'secondary',onClick:()=>this.exportPayrollRegisterCSV()}
      ]),
      ...this.langVals(),
      ...this.wfCfgVals(),
      scroller:this.scroller,route,empId:s.empId,isKit,isPeriods:route==='periods',isAdj:route==='adjustments',isWf:route==='workflows',
      // periods
      periodsCrumbs:['Enterprise Payroll','Cycles & Compliance',`CY-${curYear} Calendar`],
      periodsActions:this.btns([
        ['primary','calculate','Run Cycle Payroll (Backend Engine)',()=>this.executePayrollCalculation(cur.id)],
        ['secondary','calendar_month',`Generate ${curYear + 1} Pay Calendar`,async()=>{try{const r=await api.periods(curYear + 1);this.flash((Array.isArray(r)?r.length:0)+' pay periods available for '+(curYear + 1))}catch(e){this.flash('Could not generate '+(curYear + 1)+' calendar • '+e.message)}}],
        ['secondary','tune','Create Payroll Adjustment',()=>this.go('adjustments')],
        ['secondary','upload_file','Upload Bank Confirmations',()=>this.go('paystub')],
        ['secondary','ios_share','Export Annual Schedule'],
        null
      ]),
      periodKpis:(()=>{
        // Elapsed share of the current quincena, and adjustments that are still pending approval
        const pStart=new Date(curP.startDate+'T00:00:00'),pEnd=new Date(curP.endDate+'T23:59:59');
        const elapsed=Math.max(0,Math.min(100,Math.round((Date.now()-pStart)/(pEnd-pStart)*100)));
        const pendAdj=(s.adj||[]).filter(a=>/pending/i.test(a.status||''));
        const pendAmt=pendAdj.reduce((t,a)=>t+(Number(a.amt)||0),0);
        return [
          {label:'Current active cycle',value:cur.id,icon:'event_available',tone:'primary',footer:`${curP.rangeShort}, ${curYear} • Phase: ${curP.phase}`,progress:elapsed},
          {label:'Upcoming payroll date',value:f(cur.pay)+', '+curYear,icon:'calendar_month',tone:'accent',footer:'In '+daysTo+' days'},
          {label:'Locked / completed',value:lockedCount+' Periods',icon:'verified_user',tone:'success',footer:'Closed, paid or archived in '+curYear},
          {label:'Open adjustments',value:pendAdj.length+' Pending',icon:'pending_actions',tone:'warning',footer:pendAdj.length?money(pendAmt)+' pending approval':'Nothing pending'}];
      })(),
      periodFilterOpts:[{value:'all',label:'All Cycles',count:all.length},{value:'active',label:'Active & Upcoming',count:all.filter(fl.active).length},{value:'locked',label:'Locked / Completed',count:lockedCount}],
      periodFilter:s.periodFilter,setPeriodFilter:v=>this.setState({periodFilter:v}),pq:s.pq,setPq:v=>this.setState({pq:typeof v==='string'?v:(v&&v.target?v.target.value:'')}),searchStyle:{width:280},
      periodCols:[['Pay period','left'],['Work start','left'],['Work end','left'],['Payroll cutoff','left'],['Emp. deadline','left'],['Sup. deadline','left'],['PM deadline','left'],['HR deadline','left'],['Finance deadline','left'],['Pay date','left'],['Status','left'],['Actions','right']].map(x=>({label:x[0],align:x[1]})),
      periodRows,periodCount:all.length,periodShown:periodRows.length+(shown.length>12?' of '+shown.length+' matching':''),
      lockRules:[{t:'Automatic Period Freeze',d:'Periods lock 24 hours post disbursement. All direct edits permanently rejected.'},{t:'Hours, Rates & Calculations Preserved',d:'Gross, deductions, employer contributions and net pay stored exactly as computed.'},{t:'Corrections via Payroll Adjustments Only',d:'Retro pay or deductions are new entries routed through approval.'},{t:'Two-Party Override Required',d:'Unlocking an archived cycle requires Finance VP and Lead Auditor dual-signature.'}],
      saveSettingsBtn:null,
      // Read from the live config (attendance rules, workflow engine, holidays loaded from the backend)
      settingsRows:(()=>{
        const A=window.MGH_ATT,W=window.MGH_WF,O=window.MGH_RBAC&&window.MGH_RBAC.orgSettings();
        const rules=A?A.rulesFor(O&&O.id):null;
        const hols=A?A.holidays(O&&O.id).filter(h=>String(h.date).startsWith(String(curYear))).length:0;
        const flow=W&&W.config&&W.config.steps?W.config.steps.filter(x=>x.enabled).map(x=>x.label||x.key).join(' → '):'—';
        return [['Pay frequency','Quincenal (1–15 / 16–end of month)'],['Standard shift',rules?rules.start+' • '+rules.shift+'h/day':'—'],['Overtime rule',W&&W.otLabel?W.otLabel():'—'],['Holiday calendar',(O?O.country:'')+' '+curYear+' • '+hols+' day'+(hols===1?'':'s')],['Time zone',O?O.timezone:'—'],['Payroll cutoff time','23:59 on work end'],['Approval workflow',flow]].map(x=>({k:x[0],v:x[1]}));
      })(),
      offset:s.offset,offUp:()=>this.setState(st=>({offset:Math.min(14,st.offset+1)})),offDown:()=>this.setState(st=>({offset:Math.max(3,st.offset-1)})),
      autoGen:s.autoGen,toggleAuto:()=>this.setState(st=>({autoGen:!st.autoGen})),
      notifRows:[['New pay period opens','All employees • Email + in-app'],['Timesheets are due','24h and 2h before deadline • Email + Slack'],['Approvals are pending','Every 4h until SLA • Approvers'],['Payroll is approved','Payroll admins & Finance'],['Payroll has been paid','All employees • pay stub link'],['A new pay period begins','Day 1 • 07:00 AST']].map((x,i)=>({ev:x[0],meta:x[1],on:!!s.notifOn[i],toggle:()=>this.setState(st=>{const a=[...st.notifOn];a[i]=a[i]?0:1;return {notifOn:a}})})),
      goAudit:()=>this.go('audit'),
      // adjustments
      adjCrumbs:['Payroll & Finance','Adjustments',cur.id],
      adjActions:this.btns([
        
        
        
        ['dark','add_circle','New Adjustment Entry',()=>this.openNewAdjustmentModal()]
      ]),
      // All figures derived from the adjustment records loaded from the backend
      adjKpis:(()=>{
        const L=s.adj||[],abs=a=>Math.abs(Number(a.amt)||0);
        const pend=L.filter(a=>/pending/i.test(a.status||''));
        const sev=L.filter(a=>/sever|cesant|preaviso|liquidaci/i.test((a.kind||'')+' '+(a.type||'')+' '+(a.cat||'')));
        const exAmt=L.filter(a=>/exempt|exento/i.test(a.tax||'')).reduce((t,a)=>t+abs(a),0),allAmt=L.reduce((t,a)=>t+abs(a),0);
        const exPct=allAmt?Math.round(exAmt/allAmt*100):null;
        return [{label:'Total cycle adjustments',value:money(net).replace('+',''),icon:'tune',tone:'primary',footer:L.length+' record'+(L.length===1?'':'s')+' • '+cur.id},
          {label:'Pending approval',value:String(pend.length),icon:'pending_actions',tone:'success',footer:pend.length?money(pend.reduce((t,a)=>t+(Number(a.amt)||0),0))+' awaiting approval':'Nothing pending'},
          {label:'Severance cases',value:String(sev.length),icon:'gavel',tone:'warning',footer:'Preaviso, cesantía & liquidación records'},
          {label:'Taxable vs exempt',value:exPct==null?'—':(100-exPct)+'% / '+exPct+'%',icon:'pie_chart',tone:'accent',footer:'By adjustment amount'}];
      })(),
      adjTitle:`Cycle ${cur.id} Adjustments & Bonuses Register`,
      adjFilterOpts:[{value:'all',label:'All Adjustments',count:cnt('all')},{value:'bonus',label:'Discretionary Bonuses',count:cnt('bonus')},{value:'stipend',label:'Expense Stipends',count:cnt('stipend')},{value:'deduction',label:'Statutory Deductions',count:cnt('deduction')},{value:'retro',label:'Retroactive Corrections',count:cnt('retro')}],
      adjFilter:s.adjFilter,setAdjFilter:v=>this.setState({adjFilter:v}),
      adjCols:[['Employee ID & name','left'],['Type & category','left'],['Gross amount','right'],['Tax treatment','left'],['Allocation target','left'],['Approved by & timestamp','left'],['Status','left'],['Actions','right']].map(x=>({label:x[0],align:x[1]})),
      adjRows:adjShownRows.map(a=>({...a,amount:money(a.amt),amtColor:a.amt<0?'var(--mgh-danger)':'var(--mgh-success)',tone:ATONE(a.status),history:()=>this.go('audit'),approve:()=>{this.setState(st=>({adj:st.adj.map(x=>x.id===a.id?{...x,status:'Approved & Queued'}:x)}));this.sync(api.updateAdjustment(a.id,{status:'Approved & Queued'}),'Adjustment');this.flash(a.type+' approved for '+a.name)}})),
      adjShown:adjShownRows.length,adjTotal:s.adj.length,adjNet:money(net),
      accruingBadge:this.el('Badge',{tone:'success',size:'sm',uppercase:true},'Accruing'),simBadge:this.el('Badge',{tone:'warning',size:'sm',uppercase:true},'Simulation mode'),
      sevCalc: (() => {
        const pool = (window.__MGH_DATA && window.__MGH_DATA.EMPLOYEES) || window.EMPLOYEES || [];
        // Real employee only (no sample person); tenure defaults to the employee's start date
        const emp = pool.find(x => x.id === s.sevEmpId) || pool[0] || { id: '', name: '—', role: '', rate: 0, gross: 0, bank: '' };
        const monthlySal = (emp.rate ? emp.rate * 160 : (emp.gross ? emp.gross * 2 : 0));
        const dailySal = +(monthlySal / 23.83).toFixed(2);
        const cause = s.sevCause || 'desahucio_employer';
        const startIso = /^\d{4}-\d{2}-\d{2}/.test(String(emp.joined || '')) ? String(emp.joined).slice(0, 10) : null;
        const tenM = startIso ? Math.max(0, (() => { const a = new Date(startIso + 'T00:00:00'), b = new Date(); return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) - (b.getDate() < a.getDate() ? 1 : 0); })()) : 0;
        const tenureYears = s.sevTenureYears ?? Math.floor(tenM / 12);
        const tenureMonths = s.sevTenureMonths ?? tenM % 12;
        const vacationDays = s.sevVacationDays ?? 0;

        let preavisoDays = 0;
        if (cause === 'desahucio_employer' || cause === 'dimision') {
          const totM = tenureYears * 12 + tenureMonths;
          if (totM >= 12) preavisoDays = 28;
          else if (totM >= 6) preavisoDays = 14;
          else if (totM >= 3) preavisoDays = 7;
        }

        let cesantiaDays = 0;
        if (cause === 'desahucio_employer' || cause === 'desahucio_worked' || cause === 'dimision') {
          const ratePerYr = tenureYears >= 5 ? 23 : 21;
          cesantiaDays = tenureYears * ratePerYr;
          if (tenureMonths >= 6) cesantiaDays += 13;
          else if (tenureMonths >= 3) cesantiaDays += 6;
        }

        const preavisoAmt = +(preavisoDays * dailySal).toFixed(2);
        const cesantiaAmt = +(cesantiaDays * dailySal).toFixed(2);
        const vacationAmt = +(vacationDays * dailySal).toFixed(2);
        const regaliaAmt = +((((tenureMonths % 12) || 4) / 12) * monthlySal).toFixed(2);
        const totalSeverance = +(preavisoAmt + cesantiaAmt + vacationAmt + regaliaAmt).toFixed(2);

        const causeLabels = {
          desahucio_employer: 'Desahucio por Empleador (con Preaviso)',
          desahucio_worked: 'Desahucio por Empleador (Preaviso Trabajado)',
          dimision: 'Dimisión Justificada (Art. 96–102)',
          despido: 'Despido Justificado (Solo Derechos Adquiridos)',
          renuncia: 'Renuncia Voluntaria (Solo Derechos Adquiridos)'
        };

        return {
          emp,
          pool,
          monthlySal,
          dailySal,
          cause,
          causeLabel: causeLabels[cause] || cause,
          tenureYears,
          tenureMonths,
          vacationDays,
          preavisoDays,
          preavisoAmt,
          cesantiaDays,
          cesantiaAmt,
          vacationAmt,
          regaliaAmt,
          totalSeverance,
          lines: [
            { k: `Preaviso legal (${preavisoDays} días • Art. 76)`, v: '$' + preavisoAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
            { k: `Auxilio de Cesantía (${cesantiaDays} días • Art. 80)`, v: '$' + cesantiaAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
            { k: `Vacaciones no gozadas (${vacationDays} días • Art. 177)`, v: '$' + vacationAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
            { k: `Regalía Pascual proporcional (Art. 219)`, v: '$' + regaliaAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
          ]
        };
      })(),
      severance: [],
      // workflows
      wfCrumbs:['System','Administration','Approval Workflows'],
      wfActions:this.btns([['secondary','history','Audit Workflow Logs',()=>this.go('audit')],['secondary','play_arrow','Simulate Approval Pipeline'],['success','add_circle','Create Workflow Rule']]),
      // From the live workflow configuration and roster (no SLA / velocity data is recorded yet)
      wfKpis:(()=>{
        const W=window.MGH_WF,steps=W&&W.config&&W.config.steps?W.config.steps.filter(x=>x.enabled):[];
        const n=(window.EMPLOYEES||[]).length;
        return [{label:'Approval steps',value:String(steps.length),icon:'account_tree',tone:'primary',footer:steps.map(x=>x.label||x.key).join(' → ')||'—'},
          {label:'Employees covered',value:String(n),icon:'groups',tone:'success',footer:'Active roster in this organization'},
          {label:'Overtime rule',value:W&&W.otLabel?W.otLabel():'—',icon:'more_time',tone:'warning',footer:'Applied when splitting regular / OT hours'}];
      })(),
      stages,stageDetail:[{k:'Owner',v:stg.owner},{k:'Deadline / SLA',v:stg.sla},{k:'Rule',v:stg.rule},{k:'Notification',v:stg.notify}],
      rules:RULES.map((r,i)=>({...r,iconBg:RTONE[r.tone][0],iconColor:RTONE[r.tone][1],on:!!s.ruleOn[i],toggle:()=>this.setState(st=>{const a=[...st.ruleOn];a[i]=a[i]?0:1;return {ruleOn:a}})})),
      statusMap:STATUSES.map((n,i)=>({name:n,tone:TONE(n),edit:['Payroll admin (dates)','Employee','Employee','Supervisor (return)','PM (return)','HR (return)','Frozen','Frozen','Locked','Locked','Adjustments only','Permanent'][i]})),
      ...this.myVals(),...this.addVals(),...this.createdVals(),...this.proofVals(),
      // shared
      hasToast:!!s.toast,toast:s.toast,hasDialog:!!s.dialog,dlg:s.dialog||{},closeDialog:()=>this.setState({dialog:null}),confirmDialog:()=>s.dialog&&s.dialog.run(),stop:e=>e.stopPropagation()
    };
  }

  renderLoginScreen() {
    const { loginEmail, loginPassword, loginError, loginLoading, toast } = this.state;

    return (
      <div style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at top, #1A3668 0%, #0D1B36 50%, #070F1E 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        fontFamily: "var(--font-sans)",
        color: "#fff",
        boxSizing: "border-box"
      }}>
        <div style={{
          width: "980px",
          maxWidth: "100%",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "28px",
          background: "rgba(255, 255, 255, 0.04)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "24px",
          padding: "36px",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.65)"
        }}>
          {/* LEFT: BRANDING & SYSTEM OVERVIEW */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "28px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <img src="assets/logo-mgh.png" alt="My Global Hub" style={{ height: "48px" }} />
                <div>
                  <div style={{ font: "800 22px/28px var(--font-sans)", letterSpacing: "-0.4px", color: "#fff" }}>
                    My Global Hub
                  </div>
                  <div style={{ font: "700 11px/14px var(--font-mono)", color: "#0094CC", letterSpacing: "0.6px", textTransform: "uppercase" }}>
                    Enterprise Payroll & Timekeeping
                  </div>
                </div>
              </div>

              <div>
                <h1 style={{ font: "800 28px/36px var(--font-sans)", color: "#fff", margin: "0 0 10px" }}>
                  Corporate Identity & Access Guard
                </h1>
                <p style={{ font: "400 14px/22px var(--font-sans)", color: "rgba(255, 255, 255, 0.72)", margin: "0" }}>
                  Institutional authentication required. Access to multi-jurisdiction payroll calculations, timesheet approvals, and statutory ledgers is restricted by role.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="material-symbols-outlined" style={{ color: "#10B981", fontSize: "20px" }}>verified_user</span>
                  <div style={{ font: "500 12px/17px var(--font-sans)", color: "rgba(255, 255, 255, 0.88)" }}>
                    <strong style={{ color: "#fff" }}>Zero Unauthenticated Access:</strong> All routes, employees, and compensation data require a verified session token.
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="material-symbols-outlined" style={{ color: "#38BDF8", fontSize: "20px" }}>lock</span>
                  <div style={{ font: "500 12px/17px var(--font-sans)", color: "rgba(255, 255, 255, 0.88)" }}>
                    <strong style={{ color: "#fff" }}>Cryptographic Audit Trail:</strong> Every login and payroll action is sealed in SQLite with append-only SHA-256 hashes.
                  </div>
                </div>
              </div>
            </div>

            <div style={{ font: "400 11px/16px var(--font-mono)", color: "rgba(255,255,255,0.45)" }}>
              My Global Hub • Dominicana SRL
            </div>
          </div>

          {/* RIGHT: LOGIN FORM & QUICK ROLES */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "#ffffff", borderRadius: "18px", padding: "28px", color: "var(--mgh-ink)", boxShadow: "var(--shadow-xl)" }}>
              <div style={{ marginBottom: "18px" }}>
                <span style={{ font: "700 20px/26px var(--font-sans)", color: "var(--mgh-ink)", display: "block" }}>
                  Sign In to Workspace
                </span>
                <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>
                  Enter your corporate email and password below
                </span>
              </div>

              {loginError ? (
                <div style={{ padding: "10px 14px", borderRadius: "8px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5", font: "600 12px/16px var(--font-sans)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>error</span>
                  <span>{loginError}</span>
                </div>
              ) : null}

              {/* GOOGLE SIGN-IN BUTTON */}
              <button
                type="button"
                disabled={loginLoading}
                onClick={this.handleGoogleLogin}
                style={{
                  width: "100%",
                  padding: "11px 16px",
                  borderRadius: "10px",
                  background: "#ffffff",
                  color: "#1F2937",
                  border: "1px solid #D1D5DB",
                  font: "600 14px/20px var(--font-sans)",
                  cursor: loginLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  transition: "all 0.15s ease",
                  marginBottom: "14px",
                  boxSizing: "border-box"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#F9FAFB"; e.currentTarget.style.borderColor = "#9CA3AF"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.borderColor = "#D1D5DB"; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{loginLoading ? "Iniciando con Google…" : "Continuar con Google Workspace"}</span>
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "14px 0 16px" }}>
                <div style={{ flex: 1, height: "1px", background: "var(--mgh-surface-2)" }} />
                <span style={{ font: "600 11px/14px var(--font-sans)", color: "var(--mgh-ink-3)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  O usa tus credenciales
                </span>
                <div style={{ flex: 1, height: "1px", background: "var(--mgh-surface-2)" }} />
              </div>

              <form onSubmit={e => { e.preventDefault(); this.handleLogin(); }} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", font: "600 12px/16px var(--font-sans)", color: "var(--mgh-ink-2)", marginBottom: "6px" }}>
                    Corporate Email
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => this.setState({ loginEmail: e.target.value })}
                    placeholder="name@myglobalhub.com"
                    required
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid var(--mgh-surface-3)",
                      font: "500 14px var(--font-sans)",
                      color: "var(--mgh-ink)",
                      boxSizing: "border-box"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", font: "600 12px/16px var(--font-sans)", color: "var(--mgh-ink-2)", marginBottom: "6px" }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={e => this.setState({ loginPassword: e.target.value })}
                    placeholder="••••••••••••"
                    required
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid var(--mgh-surface-3)",
                      font: "500 14px var(--font-sans)",
                      color: "var(--mgh-ink)",
                      boxSizing: "border-box"
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  style={{
                    marginTop: "6px",
                    width: "100%",
                    padding: "12px 18px",
                    borderRadius: "8px",
                    background: "var(--mgh-primary)",
                    color: "#fff",
                    border: "none",
                    font: "700 14px var(--font-sans)",
                    cursor: loginLoading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "var(--shadow-md)"
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    {loginLoading ? "hourglass_empty" : "login"}
                  </span>
                  <span>{loginLoading ? "Authenticating…" : "Sign In to Workspace"}</span>
                </button>
              </form>
            </div>
          </div>
        </div>

        {toast ? (
          <div style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", zIndex: "120", background: "var(--mgh-navy)", color: "#fff", padding: "10px 16px", borderRadius: "12px", boxShadow: "var(--shadow-lg)", display: "flex", gap: "8px", alignItems: "center", font: "600 13px/18px var(--font-sans)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--mgh-success-300)" }}>check_circle</span>
            {toast}
          </div>
        ) : null}
      </div>
    );
  }

  render() {
    if (this.state.authChecking) {
      return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0F1A30", color: "#fff", fontFamily: "var(--font-sans)", gap: "16px" }}>
          <img src="assets/logo-mgh.png" alt="My Global Hub" style={{ height: "54px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255, 255, 255, 0.7)", fontSize: "14px", fontWeight: "500" }}>
            Verifying corporate session & RBAC credentials…
          </div>
        </div>
      );
    }

    if (!this.state.currentUser) {
      return this.renderLoginScreen();
    }

    const v = this.renderVals();
    return (
      <div style={{ display: "flex", height: "100vh", background: "var(--surface-app)", fontFamily: "var(--font-sans)" }}>
        <DS.Sidebar logoSrc="assets/logo-mgh.png" product="Enterprise Payroll" entity={v.entity} sections={v.nav} active={v.navKey} onNavigate={v.go} status={v.jiraStatus} user={v.user} onLogout={this.handleLogout} />
        <main ref={v.scroller} className="mgh-scroll" style={{ flex: "1", minWidth: "0", overflowY: "auto", overflowX: "hidden", background: "#fff" }}>
          <DS.TopBar
            period={v.period}
            notifications={window.MGH_WF ? window.MGH_WF.unread() : 0}
            onNotificationsClick={() => this.setState(s => ({ notifOpen: !s.notifOpen, orgMenu: false, langMenu: false }))}
            avatar={v.user.avatar}
            userName={v.user.name}
            userEmail={this.state.currentUser ? this.state.currentUser.email : (window.MGH_RBAC && window.MGH_RBAC.me() ? window.MGH_RBAC.me().email : 'admin@myglobalhub.net')}
            userRole={this.state.currentUser ? this.state.currentUser.role : (window.MGH_RBAC && window.MGH_RBAC.me() ? window.MGH_RBAC.me().title : v.user.role)}
            userEntity={this.state.currentUser ? this.state.currentUser.entity : (window.MGH_RBAC && window.MGH_RBAC.orgSettings() ? window.MGH_RBAC.orgSettings().short : 'MGH Dominicana')}
            empId={(window.MGH_RBAC && window.MGH_RBAC.me() ? window.MGH_RBAC.me().emp : null)}
            currentUser={this.state.currentUser}
            actions={v.topActions}
            onNavigate={v.go}
            onLogout={this.handleLogout}
            onOpenLangMenu={() => this.setState(s => ({ langMenu: !s.langMenu, orgMenu: false }))}
          />
          {v.isDenied ? (
            <div style={{ padding: "48px 28px", maxWidth: "800px", margin: "0 auto" }}>
              <DS.Card icon="lock" title={v.deniedTitle} subtitle={v.deniedText}>
                <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                  <DS.Button variant="primary" icon="home" onClick={v.deniedHome}>Go to my home page</DS.Button>
                  <DS.Button variant="secondary" icon="logout" onClick={this.handleLogout}>Cerrar sesión</DS.Button>
                </div>
              </DS.Card>
            </div>
          ) : null}
          {v.isKit && !v.isDenied ? (
            <>
              <KitScreen route={v.route} go={v.goKit} notify={v.notify} empId={v.empId} currentUser={this.state.currentUser} onReloadData={() => this.loadFromApi()} />
            </>
          ) : null}
          {v.isLang && !v.isDenied ? (
            <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "20px", maxWidth: "1600px" }}>
              <DS.PageHeader breadcrumbs={v.langCrumbs} title="Language Management" description="The application supports Spanish (default) and English. Choose the default, enable English and preview both." />
              <DS.Card icon="tune" title="Language settings">
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", padding: "10px 0", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)" }}>Default application language</span>
                      <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>Used when a user has not chosen a language</span>
                    </div>
                    <div data-i18n-skip="" style={{ width: "200px" }}>
                      <DS.Select value={v.langDefault} options={v.langDefaultOpts} onChange={v.setLangDefault} />
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", padding: "10px 0", borderTop: "1px solid var(--mgh-surface-2)" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)" }}>Enable English</span>
                      <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>Users can switch to English from the top navigation</span>
                    </div>
                    <DS.Toggle checked={v.langEnOn} onChange={v.toggleEn} />
                  </div>
                </div>
              </DS.Card>
              <DS.Card icon="translate" title="Languages" subtitle="Pay stubs, PDFs, emails and exports use the employee's language" padding={0}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "560px" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "12px 20px", background: "var(--mgh-surface-1)", font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-2)" }}>Language</th>
                        <th style={{ textAlign: "left", padding: "12px 10px", background: "var(--mgh-surface-1)", font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-2)" }}>Code</th>
                        <th style={{ textAlign: "left", padding: "12px 10px", background: "var(--mgh-surface-1)", font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-2)" }}>Default</th>
                        <th style={{ textAlign: "center", padding: "12px 10px", background: "var(--mgh-surface-1)", font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-2)" }}>Enabled</th>
                        <th style={{ textAlign: "right", padding: "12px 20px", background: "var(--mgh-surface-1)", font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-2)" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(v.langRows || []).map((l, _idx) => (
                        <tr key={l.code} style={{ background: l.rowBg, borderBottom: "1px solid var(--mgh-surface-2)" }}>
                          <td style={{ padding: "12px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span data-i18n-skip="" style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)" }}>{l.name}</span>
                              <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>{l.en}</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 10px" }}><DS.Badge mono size="sm">{l.code}</DS.Badge></td>
                          <td style={{ padding: "12px 10px" }}>{l.isDefault ? <DS.Badge tone="success" size="sm" dot>Default</DS.Badge> : null}</td>
                          <td style={{ padding: "12px 10px", textAlign: "center" }}><DS.Toggle checked={l.on} onChange={l.toggle} /></td>
                          <td style={{ padding: "12px 20px", textAlign: "right" }}><DS.Button size="sm" variant="ghost" icon="visibility" onClick={l.preview}>Preview</DS.Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DS.Card>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "20px", alignItems: "start" }}>
                <DS.Card icon="public" title="Locale formats" subtitle="Dates, currency, numbers and time adapt to the selected language">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {(v.langFormats || []).map((f, _idx) => (
                      <div key={_idx} style={{ display: "flex", justifyContent: "space-between", gap: "14px", padding: "10px 12px", borderRadius: "8px", background: "var(--mgh-surface-1)" }}>
                        <span style={{ font: "600 12px/16px var(--font-sans)", color: "var(--mgh-ink-2)" }}>{f.k}</span>
                        <span data-i18n-skip="" style={{ font: "700 13px/18px var(--font-sans)", color: "var(--mgh-ink)", textAlign: "right" }}>{f.v}</span>
                      </div>
                    ))}
                  </div>
                </DS.Card>
              </div>
            </div>
          ) : null}
          {/* PROOF OF PAYMENT (below Pay Stub) */}
          {v.isStub ? (
            <>
              <div style={{ padding: "0 28px 28px", maxWidth: "1600px" }}>
                <DS.Card icon="task_alt" title="Proof of Payment" subtitle="Attach bank transfer confirmations or Coinbase transaction hashes • printed on the pay stub and logged to the Audit Log" actions={v.proofBadge}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: "10px" }}>
                      {(v.transfers || []).map((t, _i0) => (
                        <Fragment key={_i0}>
                          <div style={{ padding: "14px", borderRadius: "12px", background: t.bg, display: "flex", flexDirection: "column", gap: "6px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                              <span style={{ font: "600 14px/20px var(--font-sans)", color: "var(--mgh-ink)" }}>
                                {t.bank}
                              </span>
                              <DS.Badge tone={t.tone} size="sm" dot={true}>
                                {t.status}
                              </DS.Badge>
                            </div>
                            <span style={{ font: "800 22px/28px var(--font-sans)", letterSpacing: "-0.4px", color: "var(--mgh-ink)" }}>
                              {t.amount}
                            </span>
                            <span style={{ font: "700 11px/14px var(--font-mono)", color: "var(--mgh-ink-3)" }}>
                              {t.rail}
                              {" • "}
                              {t.ref}
                            </span>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: "10px", alignItems: "end" }}>
                      <DS.Select label="Transfer" value={v.pf.transfer ?? ''} options={v.transferOpts} onChange={v.setPfTransfer} />
                      <DS.TextField label={v.pf.refLabel} value={v.pf.ref ?? ''} onChange={v.setPfRef} placeholder={v.pf.refPh} mono={true} />
                      <DS.TextField label="Value date" type="date" value={v.pf.date ?? ''} onChange={v.setPfDate} />
                    </div>
                    <label onDragOver={v.onDragOver} onDragLeave={v.onDragLeave} onDrop={v.onDrop} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px", minHeight: "150px", padding: "20px", borderRadius: "12px", border: `2px dashed ${v.dz.border}`, background: v.dz.bg, cursor: "pointer", textAlign: "center" }}>
                      <input type="file" accept="image/*,application/pdf" onChange={v.onPick} style={{ display: "none" }} />
                      <DS.Icon name={v.dz.icon} size={28} color="var(--mgh-primary)" />
                      <span style={{ font: "600 14px/20px var(--font-sans)", color: "var(--mgh-ink)" }}>
                        {v.dz.title}
                      </span>
                      <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>
                        {v.dz.sub}
                      </span>
                    </label>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>
                        Proofs can be removed until PP-2025-08 is locked (Apr 21). After lock they become part of the sealed record.
                      </span>
                      <DS.Button icon="attach_file" onClick={v.attachProof}>
                        Attach Proof to Pay Stub
                      </DS.Button>
                    </div>
                    {v.hasProofs ? (
                      <>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          {(v.proofs || []).map((p, _i0) => (
                            <Fragment key={_i0}>
                              <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 0", borderTop: "1px solid var(--mgh-surface-2)" }}>
                                <div style={{ width: "64px", height: "64px", flex: "none", borderRadius: "8px", background: "var(--mgh-surface-1)", backgroundImage: p.thumb, backgroundSize: "cover", backgroundPosition: "center", display: "grid", placeItems: "center" }}>
                                  {p.noThumb ? (
                                    <>
                                      <DS.Icon name={p.icon} size={24} color="var(--mgh-primary)" />
                                    </>
                                  ) : null}
                                </div>
                                <div style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "2px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                    <span style={{ font: "600 14px/20px var(--font-sans)", color: "var(--mgh-ink)" }}>
                                      {p.bank}
                                      {" • "}
                                      {p.amount}
                                    </span>
                                    <DS.Badge tone="success" size="sm" icon="verified">
                                      Payment Confirmed
                                    </DS.Badge>
                                  </div>
                                  <span style={{ font: "700 11px/14px var(--font-mono)", color: "var(--mgh-ink-2)", wordBreak: "break-all" }}>
                                    {p.ref}
                                  </span>
                                  <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>
                                    {p.file}
                                    {" • value date "}
                                    {p.date}
                                    {p.by ? " • uploaded by " + p.by + " " : " • uploaded "}
                                    {p.when}
                                  </span>
                                </div>
                                <DS.IconButton icon="delete" title="Remove" onClick={p.remove} />
                              </div>
                            </Fragment>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                </DS.Card>
              </div>
            </>
          ) : null}
          {/* MY WORK & QUINCENA TIME VIEW */}
          {v.isMy ? (
            <MyTimeView
              key={this.state.myTab || 'entry'}
              tab={window.MGH_RBAC && window.MGH_RBAC.can('timesheets.self') ? (this.state.myTab || 'entry') : 'entry'}
              user={this.state.currentUser || (window.MGH_RBAC && window.MGH_RBAC.me())}
              empId={(window.MGH_RBAC && window.MGH_RBAC.can('timesheets.self') ? null : this.state.empId) || (this.state.currentUser && (this.state.currentUser.employee_id || this.state.currentUser.employeeId)) || null}
              notify={this.flash}
              go={this.go}
            />
          ) : null}
          {/* ADD EMPLOYEE */}
          {v.isAddEmp ? (
            <>
              <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "20px", maxWidth: "1600px" }}>
                <DS.PageHeader breadcrumbs={v.addCrumbs} title="Add Employee" description="Create the employee record, payroll profile, bank allocations and Jira binding. The employee joins the next open bi-weekly period automatically." actions={v.addActions} />
                <DS.Card>
                  <DS.Stepper steps={v.addSteps} />
                </DS.Card>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "20px", alignItems: "start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    {(v.addSections || []).map((sec, _i0) => (
                      <Fragment key={_i0}>
                        <DS.Card icon={sec.icon} title={sec.title} subtitle={sec.sub}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "14px" }}>
                            {(sec.fields || []).map((fd, _i2) => (
                              <Fragment key={_i2}>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  {fd.isText ? (
                                    <>
                                      <DS.TextField label={fd.label} value={fd.value ?? ''} onChange={fd.set} placeholder={fd.ph} hint={fd.hint} error={fd.err} mono={fd.mono} type={fd.type} prefix={fd.prefix} suffix={fd.suffix} />
                                    </>
                                  ) : null}
                                  {fd.isSelect ? (
                                    <>
                                      <DS.Select label={fd.label} value={fd.value ?? ''} options={fd.options} onChange={fd.set} />
                                    </>
                                  ) : null}
                                  {fd.isToggle ? (
                                    <>
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", padding: "10px 12px", borderRadius: "8px", background: "var(--mgh-surface-1)", minHeight: "56px" }}>
                                        <div style={{ display: "flex", flexDirection: "column" }}>
                                          <span style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)" }}>
                                            {fd.label}
                                          </span>
                                          <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>
                                            {fd.hint}
                                          </span>
                                        </div>
                                        <DS.Toggle checked={fd.value ?? false} onChange={fd.set} />
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                              </Fragment>
                            ))}
                          </div>
                        </DS.Card>
                      </Fragment>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px", position: "sticky", top: "84px" }}>
                    <DS.Card title="Record Preview" icon="badge">
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                        <DS.Avatar name={v.newEmp.fullName} size={48} />
                        <div style={{ display: "flex", flexDirection: "column", minWidth: "0" }}>
                          <span style={{ font: "700 16px/22px var(--font-sans)", color: "var(--mgh-ink)" }}>
                            {v.newEmp.fullName}
                          </span>
                          <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>
                            {v.newEmp.titleLine}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {(v.newEmp.facts || []).map((x, _i0) => (
                          <Fragment key={_i0}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", padding: "8px 0", borderTop: "1px solid var(--mgh-surface-2)" }}>
                              <span style={{ font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-2)" }}>
                                {x.k}
                              </span>
                              <span style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)", textAlign: "right" }}>
                                {x.v}
                              </span>
                            </div>
                          </Fragment>
                        ))}
                      </div>
                    </DS.Card>
                    {v.newEmp.payEst.show ? (
                      <>
                        <DS.Card title="Estimated Pay per Period" icon="calculate">
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", padding: "8px 0" }}>
                              <span style={{ font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-2)" }}>
                                {"Gross • "}
                                {v.newEmp.payEst.hoursLabel}
                              </span>
                              <span style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)", fontVariantNumeric: "tabular-nums" }}>
                                {v.newEmp.payEst.gross}
                              </span>
                            </div>
                            {(v.newEmp.payEst.lines || []).map((l, _i0) => (
                              <Fragment key={_i0}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", padding: "8px 0", borderTop: "1px solid var(--mgh-surface-2)" }}>
                                  <span style={{ font: "500 13px/18px var(--font-sans)", color: "var(--mgh-ink-2)" }}>
                                    {l.k}
                                  </span>
                                  <span style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)", fontVariantNumeric: "tabular-nums" }}>
                                    {l.v}
                                  </span>
                                </div>
                              </Fragment>
                            ))}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "8px", padding: "14px", borderRadius: "8px", background: "var(--mgh-navy)", color: "#fff" }}>
                              <span style={{ font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase" }}>
                                Est. net pay
                              </span>
                              <span style={{ font: "800 20px/24px var(--font-sans)", fontVariantNumeric: "tabular-nums" }}>
                                {v.newEmp.payEst.net}
                              </span>
                            </div>
                            <span style={{ marginTop: "8px", font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>
                              {v.newEmp.payEst.note}
                            </span>
                          </div>
                        </DS.Card>
                      </>
                    ) : null}
                    <DS.Card tone="muted" title="Readiness Checks" icon="checklist">
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {(v.newEmp.checks || []).map((c, _i0) => (
                          <Fragment key={_i0}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", font: "500 13px/18px var(--font-sans)", color: "var(--mgh-ink)" }}>
                              <DS.Icon name={c.icon} size={16} color={c.color} />
                              {c.t}
                            </div>
                          </Fragment>
                        ))}
                      </div>
                    </DS.Card>
                  </div>
                </div>
              </div>
            </>
          ) : null}
          {/* EMPLOYEE CREATED */}
          {v.isCreated ? (
            <>
              <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "20px", maxWidth: "1600px" }}>
                <DS.PageHeader breadcrumbs={v.createdCrumbs} title="Employee Created" description="The record is saved and onboarding has started. Track the remaining steps below." actions={v.createdActions} />
                <DS.Card>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                    <DS.Avatar name={v.created.name} size={56} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "1", minWidth: "200px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ font: "700 22px/28px var(--font-sans)", color: "var(--mgh-ink)" }}>
                          {v.created.name}
                        </span>
                        <span style={{ font: "700 12px/16px var(--font-mono)", padding: "2px 6px", borderRadius: "4px", background: "var(--mgh-navy)", color: "#fff" }}>
                          {v.created.id}
                        </span>
                      </div>
                      <span style={{ font: "400 13px/18px var(--font-sans)", color: "var(--mgh-ink-3)" }}>
                        {v.created.title}
                        {" • Created "}
                        {v.created.when}
                        {v.created.by ? " by " + v.created.by : ""}
                      </span>
                    </div>
                    <div>
                      {v.createdBadge}
                    </div>
                  </div>
                </DS.Card>
                {v.created.initialPassword ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 20px", borderRadius: "12px", background: "var(--mgh-primary-50)", flexWrap: "wrap" }}>
                    <DS.Icon name="key" size={18} color="var(--mgh-primary)" />
                    <div style={{ flex: "1", minWidth: "220px", display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)" }}>
                        {"Initial password for " + (v.created.email || "this account") + " — shown only once"}
                      </span>
                      <span style={{ font: "700 16px/22px var(--font-mono)", color: "var(--mgh-ink)", letterSpacing: "0.5px" }}>{v.created.initialPassword}</span>
                      <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>Share it privately. They can change it from the user menu → Cambiar contraseña, or sign in with Google.</span>
                    </div>
                    <DS.Button size="sm" variant="secondary" icon="content_copy" onClick={() => { try { navigator.clipboard.writeText(v.created.initialPassword); this.flash("Password copied"); } catch (e) { this.flash("Copy failed • select and copy it manually"); } }}>Copy</DS.Button>
                  </div>
                ) : null}
                {v.createdPending ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 20px", borderRadius: "12px", background: "var(--mgh-warning-bg)", flexWrap: "wrap" }}>
                      <DS.Icon name="warning" size={18} color="var(--mgh-warning)" />
                      <span style={{ flex: "1", minWidth: "200px", font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)" }}>
                        {v.createdPendingText}
                      </span>
                      <div>
                        {v.createdFixBtn}
                      </div>
                    </div>
                  </>
                ) : null}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "20px", alignItems: "start" }}>
                  <DS.Card icon="checklist" title="Onboarding Progress" subtitle={v.createdDone}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {(v.createdSteps || []).map((st, _i0) => (
                        <Fragment key={_i0}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", borderTop: "1px solid var(--mgh-surface-2)" }}>
                            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "var(--mgh-surface-1)", display: "grid", placeItems: "center", flex: "none" }}>
                              <DS.Icon name={st.icon} size={18} color="var(--mgh-primary)" />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", flex: "1", minWidth: "0" }}>
                              <span style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)" }}>
                                {st.title}
                              </span>
                              <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>
                                {st.sub}
                              </span>
                            </div>
                            <DS.Badge tone={st.tone} size="sm">
                              {st.status}
                            </DS.Badge>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </DS.Card>
                  <DS.Card icon="badge" title="Record Summary">
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {(v.createdFacts || []).map((x, _i0) => (
                        <Fragment key={_i0}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", padding: "8px 0", borderTop: "1px solid var(--mgh-surface-2)" }}>
                            <span style={{ font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-2)" }}>
                              {x.k}
                            </span>
                            <span style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)", textAlign: "right" }}>
                              {x.v}
                            </span>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </DS.Card>
                </div>
              </div>
            </>
          ) : null}
          {/* PAY PERIODS & PROCESSING */}
          {v.isPeriods ? (
            <>
              <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "20px", maxWidth: "1600px" }}>
                <DS.PageHeader breadcrumbs={v.periodsCrumbs} title={"Pay Periods & Processing Schedule"} description="Manage annual bi-weekly payroll cycles, multi-tier approval deadlines, retroactive adjustment queues and period locking protocols." actions={v.periodsActions} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "14px" }}>
                  {(v.periodKpis || []).map((k, _i0) => (
                    <Fragment key={_i0}>
                      <DS.StatCard label={k.label} value={k.value ?? ''} icon={k.icon} tone={k.tone} footer={k.footer} progress={k.progress} />
                    </Fragment>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 20px", borderRadius: "12px", background: "var(--mgh-surface-1)", flexWrap: "wrap" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#fff", display: "grid", placeItems: "center", flex: "none" }}>
                    <DS.Icon name="lock_clock" size={18} color="var(--mgh-primary)" />
                  </div>
                  <div style={{ flex: "1", minWidth: "260px", display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ font: "600 16px/22px var(--font-sans)", color: "var(--mgh-ink)" }}>
                      Period Locking Protocol Policy
                    </span>
                    <span style={{ font: "400 13px/18px var(--font-sans)", color: "var(--mgh-ink-2)" }}>
                      Closed pay periods are cryptographically archived. Direct timesheet alteration is disabled across all roles. Retroactive hours, commissions or corrections must flow through an auditable Payroll Adjustment.
                    </span>
                  </div>
                  <DS.Badge tone="neutral" icon="schedule">
                    Auto-lock: 24h post pay date
                  </DS.Badge>
                  <DS.Button variant="dark" icon="shield_lock" onClick={v.goAudit}>
                    Open Audit Log
                  </DS.Button>
                </div>
                <DS.Card padding={0}>
                  <div style={{ padding: "20px 20px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "14px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ display: "inline-flex", alignItems: "baseline", gap: "6px", padding: "6px 12px", borderRadius: "8px", background: "var(--mgh-surface-1)", alignSelf: "flex-start" }}>
                        <span style={{ font: "500 13px/18px var(--font-sans)", color: "var(--mgh-ink-2)" }}>
                          Calendar Year:
                        </span>
                        <span style={{ font: "700 16px/22px var(--font-sans)", color: "var(--mgh-ink)" }}>
                          2025 (
                          {v.periodCount}
                          {" Pay Cycles)"}
                        </span>
                      </div>
                      <DS.FilterChips options={v.periodFilterOpts} value={v.periodFilter ?? ''} onChange={v.setPeriodFilter} />
                    </div>
                    <DS.SearchField value={v.pq ?? ''} onChange={v.setPq} placeholder="Filter cycle (e.g. PP-2025-08)" style={v.searchStyle} />
                  </div>
                  <div className="mgh-scroll" style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: "1180px", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {(v.periodCols || []).map((h, _i0) => (
                            <Fragment key={_i0}>
                              <th style={{ textAlign: h.align, padding: "12px 14px", background: "var(--mgh-surface-1)", font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-2)", whiteSpace: "nowrap" }}>
                                {h.label}
                              </th>
                            </Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(v.periodRows || []).map((p, _i0) => (
                          <Fragment key={_i0}>
                            <tr style={{ background: p.rowBg, borderBottom: "1px solid var(--mgh-surface-2)" }}>
                              <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span style={{ font: "700 15px/20px var(--font-sans)", letterSpacing: "-0.2px", color: "var(--mgh-ink)" }}>
                                    {p.id}
                                  </span>
                                  {p.locked ? (
                                    <>
                                      <DS.Icon name="lock" size={14} color="var(--mgh-success)" />
                                    </>
                                  ) : null}
                                  {p.hasFlag ? (
                                    <>
                                      <DS.Badge tone={p.flagTone} size="sm">
                                        {p.flag}
                                      </DS.Badge>
                                    </>
                                  ) : null}
                                </div>
                              </td>
                              <td style={{ padding: "12px 14px", font: "400 13px/18px var(--font-sans)", color: "var(--mgh-ink-2)", whiteSpace: "nowrap" }}>
                                {p.start}
                              </td>
                              <td style={{ padding: "12px 14px", font: "400 13px/18px var(--font-sans)", color: "var(--mgh-ink-2)", whiteSpace: "nowrap" }}>
                                {p.end}
                              </td>
                              <td style={{ padding: "12px 14px", font: "400 13px/18px var(--font-sans)", color: "var(--mgh-ink-2)", whiteSpace: "nowrap" }}>
                                {p.cutoff}
                              </td>
                              {(p.dl || []).map((d, _i2) => (
                                <Fragment key={_i2}>
                                  <td style={{ padding: "12px 14px", font: d.font, color: d.color, background: d.bg, whiteSpace: "nowrap" }}>
                                    {d.v}
                                  </td>
                                </Fragment>
                              ))}
                              <td style={{ padding: "12px 14px", font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)", whiteSpace: "nowrap" }}>
                                {p.pay}
                              </td>
                              <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                                <DS.Badge tone={p.tone} dot={true} size="sm">
                                  {p.statusShort}
                                </DS.Badge>
                              </td>
                              <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                                <DS.Button variant={p.actVariant} size="sm" icon={p.actIcon} onClick={p.act}>
                                  {p.actLabel}
                                </DS.Button>
                              </td>
                            </tr>
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", flexWrap: "wrap", font: "400 13px/18px var(--font-sans)", color: "var(--mgh-ink-2)" }}>
                    <span>
                      {"Showing "}
                      <strong style={{ color: "var(--mgh-ink)" }}>
                        {v.periodShown}
                      </strong>
                      {" of "}
                      {v.periodCount}
                      {" pay cycles in 2025 • Standard Bi-Weekly Schedule (Dominicana SRL)"}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--mgh-ink-3)" }}>
                      {"Numbering: PP-{YYYY}-{NN} • quincenas 1–15 and 16–end of month • pay date +5 days"}
                    </span>
                  </div>
                </DS.Card>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,460px),1fr))", gap: "20px", alignItems: "start" }}>
                  <DS.Card icon="policy" title="Cycle Locking Rules" subtitle="Non-repudiation parameters enforced for Dominican Republic DGII statutory reporting">
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {(v.lockRules || []).map((r, _i0) => (
                        <Fragment key={_i0}>
                          <div style={{ display: "flex", gap: "10px", padding: "10px 12px", borderRadius: "8px", background: "var(--mgh-surface-1)" }}>
                            <DS.Icon name="check_circle" size={16} color="var(--mgh-success)" />
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <span style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)" }}>
                                {r.t}
                              </span>
                              <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-2)" }}>
                                {r.d}
                              </span>
                            </div>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </DS.Card>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,460px),1fr))", gap: "20px", alignItems: "start" }}>
                  <DS.Card icon="tune" title="Payroll Settings" subtitle="Applies to My Global Hub and all its projects" actions={v.saveSettingsBtn}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {(v.settingsRows || []).map((s, _i0) => (
                        <Fragment key={_i0}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", padding: "10px 0", borderBottom: "1px solid var(--mgh-surface-2)" }}>
                            <span style={{ font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-2)" }}>
                              {s.k}
                            </span>
                            <span style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)", textAlign: "right" }}>
                              {s.v}
                            </span>
                          </div>
                        </Fragment>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", padding: "10px 0", borderBottom: "1px solid var(--mgh-surface-2)" }}>
                        <span style={{ font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-2)" }}>
                          Default pay date offset
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <DS.IconButton icon="remove" title="Decrease" onClick={v.offDown} />
                          <span style={{ font: "800 18px/24px var(--font-sans)", color: "var(--mgh-ink)", minWidth: "72px", textAlign: "center" }}>
                            +
                            {v.offset}
                            {" days"}
                          </span>
                          <DS.IconButton icon="add" title="Increase" onClick={v.offUp} />
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", padding: "12px 0 0" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)" }}>
                            Automatic period generation
                          </span>
                          <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>
                            Creates next year's 26 cycles on Nov 1 as Draft
                          </span>
                        </div>
                        <DS.Toggle checked={v.autoGen ?? false} onChange={v.toggleAuto} />
                      </div>
                    </div>
                  </DS.Card>
                  <DS.Card icon="notifications_active" title="Automatic Notifications" subtitle="Employees and managers are notified at every milestone">
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {(v.notifRows || []).map((n, _i0) => (
                        <Fragment key={_i0}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", padding: "10px 0", borderBottom: "1px solid var(--mgh-surface-2)" }}>
                            <div style={{ display: "flex", flexDirection: "column", minWidth: "0" }}>
                              <span style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)" }}>
                                {n.ev}
                              </span>
                              <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>
                                {n.meta}
                              </span>
                            </div>
                            <DS.Toggle checked={n.on ?? false} onChange={n.toggle} />
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </DS.Card>
                </div>
              </div>
            </>
          ) : null}
          {/* ADJUSTMENTS */}
          {v.isAdj ? (
            <>
              <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "20px", maxWidth: "1600px" }}>
                <DS.PageHeader breadcrumbs={v.adjCrumbs} title={"Payroll Adjustments & Statutory Severance Engine"} description={"One-off bonuses, expense reimbursements, equipment stipends, Dominican statutory Regalía Pascual (13th month) and Prestaciones Laborales (severance & preaviso) calculations."} actions={v.adjActions} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "14px" }}>
                  {(v.adjKpis || []).map((k, _i0) => (
                    <Fragment key={_i0}>
                      <DS.StatCard label={k.label} value={k.value ?? ''} icon={k.icon} tone={k.tone} footer={k.footer} />
                    </Fragment>
                  ))}
                </div>
                <DS.Card icon="receipt_long" title={v.adjTitle || "Adjustments & Bonuses Register"} subtitle="Audit register of one-off compensation items, non-taxable stipends and payroll corrections queued for release" padding={0}>
                  <div style={{ padding: "0 20px 14px" }}>
                    <DS.FilterChips options={v.adjFilterOpts} value={v.adjFilter ?? ''} onChange={v.setAdjFilter} />
                  </div>
                  <div className="mgh-scroll" style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: "1000px", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {(v.adjCols || []).map((h, _i0) => (
                            <Fragment key={_i0}>
                              <th style={{ textAlign: h.align, padding: "12px 14px", background: "var(--mgh-surface-1)", font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-2)", whiteSpace: "nowrap" }}>
                                {h.label}
                              </th>
                            </Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(v.adjRows || []).map((a, _i0) => (
                          <Fragment key={_i0}>
                            <tr style={{ borderBottom: "1px solid var(--mgh-surface-2)" }}>
                              <td style={{ padding: "12px 14px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  <DS.Avatar name={a.name} src={a.avatar} size={32} />
                                  <div style={{ display: "flex", flexDirection: "column" }}>
                                    <span style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)" }}>
                                      {a.name}
                                    </span>
                                    <span style={{ font: "700 11px/14px var(--font-mono)", color: "var(--mgh-ink-3)" }}>
                                      {a.id}
                                      {" • "}
                                      {a.role}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: "12px 14px" }}>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  <span style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)" }}>
                                    {a.type}
                                  </span>
                                  <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>
                                    {a.cat}
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: "12px 14px", textAlign: "right", font: "700 13px/18px var(--font-sans)", color: a.amtColor, whiteSpace: "nowrap" }}>
                                {a.amount}
                              </td>
                              <td style={{ padding: "12px 14px" }}>
                                <DS.Badge tone={a.taxTone} size="sm">
                                  {a.tax}
                                </DS.Badge>
                              </td>
                              <td style={{ padding: "12px 14px", font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-2)" }}>
                                {a.target}
                              </td>
                              <td style={{ padding: "12px 14px", font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-2)" }}>
                                {a.by}
                              </td>
                              <td style={{ padding: "12px 14px" }}>
                                <DS.Badge tone={a.tone} dot={true} size="sm">
                                  {a.status}
                                </DS.Badge>
                              </td>
                              <td style={{ padding: "12px 14px", textAlign: "right" }}>
                                <div style={{ display: "inline-flex", gap: "4px" }}>
                                  <DS.IconButton icon="history" title="History" onClick={a.history} />
                                  <DS.IconButton icon="check" title="Approve" onClick={a.approve} />
                                </div>
                              </td>
                            </tr>
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: "14px 20px", font: "400 13px/18px var(--font-sans)", color: "var(--mgh-ink-2)" }}>
                    {"Showing "}
                    {v.adjShown}
                    {" of "}
                    {v.adjTotal}
                    {" active cycle adjustments • Net total "}
                    {v.adjNet}
                  </div>
                </DS.Card>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ font: "700 22px/28px var(--font-sans)", letterSpacing: "-0.44px", color: "var(--mgh-ink)" }}>
                    Dominican Labor Code (Código de Trabajo Ley 16-92) Calculators
                  </span>
                  <span style={{ font: "400 13px/18px var(--font-sans)", color: "var(--mgh-ink-2)" }}>
                    Automated legal engines governing mandatory Christmas salary reserves (Art. 219) and statutory termination settlements (Art. 76–86).
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,460px),1fr))", gap: "20px", alignItems: "start" }}>
                  <DS.Card icon="redeem" title="Regalía Pascual (13th Salary) Engine" subtitle={"Código de Trabajo Art. 219–222 • Exempt from ISR & TSS"} actions={v.accruingBadge}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      <div style={{ padding: "14px", borderRadius: "8px", background: "var(--mgh-surface-1)", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <span style={{ font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-2)" }}>
                          Dominican statutory formula
                        </span>
                        <div style={{ padding: "12px", borderRadius: "8px", background: "#fff", textAlign: "center", font: "700 16px/22px var(--font-sans)", color: "var(--mgh-ink)" }}>
                          Regalía = ( Σ Ordinary Earned Salaries in Calendar Year ) / 12
                        </div>
                        <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-2)" }}>
                          Computed over ordinary base earnings. Excludes overtime, tips, profit sharing and expense stipends.
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div style={{ padding: "12px", borderRadius: "8px", background: "var(--mgh-surface-1)" }}>
                          <div style={{ font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-2)" }}>
                            Eligible employees
                          </div>
                          <div style={{ font: "700 16px/22px var(--font-sans)", color: "var(--mgh-ink)" }}>
                            {(window.EMPLOYEES || []).filter(e => !/contractor|exempt/i.test(e.type || '') && e.status !== 'Inactive').length} active staff
                          </div>
                          <div style={{ font: "600 11px/14px var(--font-sans)", color: "var(--mgh-ink-3)" }}>
                            Accrual is computed from saved payroll runs
                          </div>
                        </div>
                        <div style={{ padding: "12px", borderRadius: "8px", background: "var(--mgh-surface-1)" }}>
                          <div style={{ font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-2)" }}>
                            Statutory deadline
                          </div>
                          <div style={{ font: "700 16px/22px var(--font-sans)", color: "var(--mgh-ink)" }}>
                            {'Dec 20, ' + new Date().getFullYear()}
                          </div>
                          <div style={{ font: "600 11px/14px var(--font-sans)", color: "var(--mgh-danger)" }}>
                            Mandatory payout date
                          </div>
                        </div>
                      </div>
                    </div>
                  </DS.Card>
                  <DS.Card icon="gavel" title="Prestaciones Laborales Simulator" subtitle="Ley 16-92 Articles 76–86 (Desahucio Laboral)" actions={v.simBadge}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <label style={{ display: 'block', font: '700 11px/14px var(--font-sans)', color: 'var(--mgh-ink-2)', marginBottom: 4, textTransform: 'uppercase' }}>Empleado</label>
                          <select
                            value={this.state.sevEmpId || ((window.EMPLOYEES || [])[0] || {}).id || ''}
                            onChange={e => this.setState({ sevEmpId: e.target.value })}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', background: '#fff', font: '600 13px var(--font-sans)', color: 'var(--mgh-ink)' }}
                          >
                            {(v.sevCalc.pool || []).map(e => <option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', font: '700 11px/14px var(--font-sans)', color: 'var(--mgh-ink-2)', marginBottom: 4, textTransform: 'uppercase' }}>Causa de Salida</label>
                          <select
                            value={this.state.sevCause || 'desahucio_employer'}
                            onChange={e => this.setState({ sevCause: e.target.value })}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', background: '#fff', font: '600 13px var(--font-sans)', color: 'var(--mgh-ink)' }}
                          >
                            <option value="desahucio_employer">Desahucio por Empleador (con Preaviso)</option>
                            <option value="desahucio_worked">Desahucio (Preaviso Trabajado)</option>
                            <option value="dimision">Dimisión Justificada (Art. 96-102)</option>
                            <option value="despido">Despido Justificado (Solo Adquiridos)</option>
                            <option value="renuncia">Renuncia Voluntaria (Solo Adquiridos)</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        <div>
                          <label style={{ display: 'block', font: '700 11px/14px var(--font-sans)', color: 'var(--mgh-ink-2)', marginBottom: 4, textTransform: 'uppercase' }}>Años Servicio</label>
                          <input type="number" min="0" max="35" value={v.sevCalc.tenureYears} onChange={e => this.setState({ sevTenureYears: Math.max(0, parseInt(e.target.value, 10) || 0) })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', background: '#fff', font: '600 13px var(--font-sans)', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', font: '700 11px/14px var(--font-sans)', color: 'var(--mgh-ink-2)', marginBottom: 4, textTransform: 'uppercase' }}>Meses</label>
                          <input type="number" min="0" max="11" value={v.sevCalc.tenureMonths} onChange={e => this.setState({ sevTenureMonths: Math.max(0, Math.min(11, parseInt(e.target.value, 10) || 0)) })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', background: '#fff', font: '600 13px var(--font-sans)', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', font: '700 11px/14px var(--font-sans)', color: 'var(--mgh-ink-2)', marginBottom: 4, textTransform: 'uppercase' }}>Vacaciones Pend.</label>
                          <input type="number" min="0" max="30" value={this.state.sevVacationDays ?? 0} onChange={e => this.setState({ sevVacationDays: Math.max(0, parseInt(e.target.value, 10) || 0) })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', background: '#fff', font: '600 13px var(--font-sans)', boxSizing: 'border-box' }} />
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", borderRadius: "8px", background: "var(--mgh-surface-1)" }}>
                        <DS.Avatar name={v.sevCalc.emp.name} src={v.sevCalc.emp.avatar} size={32} />
                        <div style={{ flex: "1" }}>
                          <div style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)" }}>
                            {v.sevCalc.emp.name}
                          </div>
                          <div style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>
                            {v.sevCalc.emp.role} • Salario base mensual ${v.sevCalc.monthlySal.toLocaleString('en-US', { minimumFractionDigits: 2 })} (Promedio ${v.sevCalc.dailySal}/día)
                          </div>
                        </div>
                        <DS.Badge tone="neutral" size="sm">
                          Antigüedad {v.sevCalc.tenureYears}a, {v.sevCalc.tenureMonths}m
                        </DS.Badge>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {(v.sevCalc.lines || []).map((s, _i0) => (
                          <Fragment key={_i0}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", padding: "8px 0", borderBottom: "1px solid var(--mgh-surface-2)", font: "400 13px/18px var(--font-sans)", color: "var(--mgh-ink-2)" }}>
                              <span>
                                {s.k}
                              </span>
                              <span style={{ fontWeight: "700", color: "var(--mgh-ink)" }}>
                                {s.v}
                              </span>
                            </div>
                          </Fragment>
                        ))}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "14px", padding: "14px", borderRadius: "8px", background: "var(--mgh-navy)", color: "#fff" }}>
                        <div>
                          <div style={{ font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-nav-text)" }}>
                            Total pasivo laboral a liquidar
                          </div>
                          <div style={{ font: "600 11px/14px var(--font-sans)", color: "var(--mgh-success-300)" }}>
                            Exención TSS & ISR verificada (Ley 16-92 Art. 86)
                          </div>
                        </div>
                        <span style={{ font: "800 28px/32px var(--font-sans)", letterSpacing: "-1px" }}>
                          ${v.sevCalc.totalSeverance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <DS.Button variant="secondary" icon="picture_as_pdf" style={{ flex: 1 }} onClick={() => this.exportFiniquito(v.sevCalc.emp, v.sevCalc)}>
                          Imprimir Finiquito
                        </DS.Button>
                        <DS.Button variant="dark" icon="add_task" style={{ flex: 1 }} onClick={() => this.queueSeveranceAdjustment(v.sevCalc.emp, v.sevCalc.totalSeverance)}>
                          Encolar en Ajustes
                        </DS.Button>
                      </div>
                    </div>
                  </DS.Card>
                </div>
              </div>
            </>
          ) : null}
          {/* APPROVAL WORKFLOWS */}
          {v.isWf ? (
            <>
              <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "20px", maxWidth: "1600px" }}>
                <DS.PageHeader breadcrumbs={v.wfCrumbs} title={"Approval Workflows & Policy Governance"} description="Configure sequential multi-tier timesheet and payroll approval pipelines, monetary sign-off thresholds, automated Jira variance rules and statutory lock protocols." actions={v.wfActions} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "14px" }}>
                  {(v.wfKpis || []).map((k, _i0) => (
                    <Fragment key={_i0}>
                      <DS.StatCard label={k.label} value={k.value ?? ''} unit={k.unit} icon={k.icon} tone={k.tone} footer={k.footer} progress={k.progress} />
                    </Fragment>
                  ))}
                </div>
                <DS.Card>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px", flexWrap: "wrap", marginBottom: "20px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <DS.Badge tone="dark" size="sm" uppercase={true}>
                          Active pipeline model
                        </DS.Badge>
                      </div>
                      <span style={{ font: "700 22px/28px var(--font-sans)", letterSpacing: "-0.44px", color: "var(--mgh-ink)" }}>
                        Bi-Weekly Timesheet & Statutory Payroll Approval Sequence
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "8px", background: "var(--mgh-surface-1)", font: "500 13px/18px var(--font-sans)", color: "var(--mgh-ink-2)" }}>
                      <DS.Icon name="lock_clock" size={16} color="var(--mgh-success)" />
                      {"Auto-freeze cutoff: "}
                      <strong style={{ color: "var(--mgh-ink)" }}>
                        23:59 on the last day of each quincena
                      </strong>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: "10px" }}>
                    {(v.stages || []).map((s, _i0) => (
                      <Fragment key={_i0}>
                        <button onClick={s.pick} style={{ textAlign: "left", cursor: "pointer", border: "0", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px", fontFamily: "var(--font-sans)", background: s.bg, color: s.fg, boxShadow: s.shadow }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", padding: "2px 8px", borderRadius: "9999px", background: s.chipBg, color: s.chipFg }}>
                              {s.no}
                            </span>
                            <DS.Icon name={s.icon} size={18} color={s.iconColor} />
                          </div>
                          <span style={{ font: "700 16px/22px var(--font-sans)", letterSpacing: "-0.1px" }}>
                            {s.title}
                          </span>
                          <span style={{ font: "400 12px/16px var(--font-sans)", opacity: "0.85" }}>
                            {s.desc}
                          </span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px 10px", borderRadius: "8px", background: s.boxBg }}>
                            {(s.kv || []).map((kv, _i2) => (
                              <Fragment key={_i2}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", font: "600 11px/14px var(--font-sans)" }}>
                                  <span style={{ textTransform: "uppercase", letterSpacing: "0.44px", opacity: "0.7" }}>
                                    {kv.k}
                                  </span>
                                  <span style={{ textAlign: "right" }}>
                                    {kv.v}
                                  </span>
                                </div>
                              </Fragment>
                            ))}
                          </div>
                          <span style={{ alignSelf: "flex-start", font: "700 11px/14px var(--font-sans)", padding: "3px 8px", borderRadius: "9999px", background: s.tagBg, color: s.tagFg }}>
                            {s.tag}
                          </span>
                        </button>
                      </Fragment>
                    ))}
                  </div>
                  <div style={{ marginTop: "14px", padding: "14px", borderRadius: "8px", background: "var(--mgh-surface-1)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "14px" }}>
                    {(v.stageDetail || []).map((d, _i0) => (
                      <Fragment key={_i0}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-3)" }}>
                            {d.k}
                          </span>
                          <span style={{ font: "500 13px/18px var(--font-sans)", color: "var(--mgh-ink)" }}>
                            {d.v}
                          </span>
                        </div>
                      </Fragment>
                    ))}
                  </div>
                </DS.Card>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "20px", alignItems: "start" }}>
                  <DS.Card title={"Threshold & Trigger Rules Matrix"} subtitle="Reference policy • not enforced automatically yet" icon="rule" padding={0}>
                    <div className="mgh-scroll" style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", minWidth: "640px", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left", padding: "12px 14px", background: "var(--mgh-surface-1)", font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-2)" }}>
                              Condition / policy rule
                            </th>
                            <th style={{ textAlign: "left", padding: "12px 14px", background: "var(--mgh-surface-1)", font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-2)" }}>
                              Autonomous trigger action
                            </th>
                            <th style={{ textAlign: "center", padding: "12px 14px", background: "var(--mgh-surface-1)", font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-2)" }}>
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(v.rules || []).map((r, _i0) => (
                            <Fragment key={_i0}>
                              <tr style={{ borderBottom: "1px solid var(--mgh-surface-2)" }}>
                                <td style={{ padding: "14px" }}>
                                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                                    <span style={{ width: "32px", height: "32px", borderRadius: "8px", flex: "none", display: "grid", placeItems: "center", background: r.iconBg }}>
                                      <DS.Icon name={r.icon} size={16} color={r.iconColor} />
                                    </span>
                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                      <span style={{ font: "600 14px/20px var(--font-sans)", color: "var(--mgh-ink)" }}>
                                        {r.cond}
                                      </span>
                                      <span style={{ font: "600 11px/14px var(--font-sans)", color: "var(--mgh-ink-3)" }}>
                                        {"Scope: "}
                                        {r.scope}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: "14px" }}>
                                  <div style={{ display: "flex", flexDirection: "column" }}>
                                    <span style={{ font: "500 13px/18px var(--font-sans)", color: "var(--mgh-ink)" }}>
                                      {r.action}
                                    </span>
                                    <span style={{ font: "400 11px/14px var(--font-sans)", color: "var(--mgh-ink-3)" }}>
                                      {r.meta}
                                    </span>
                                  </div>
                                </td>
                                <td style={{ padding: "14px", textAlign: "center" }}>
                                  <DS.Toggle checked={r.on ?? false} onChange={r.toggle} />
                                </td>
                              </tr>
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DS.Card>
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <DS.Card title="Status Mapping" subtitle="12 period statuses → who can edit" icon="account_tree">
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {(v.statusMap || []).map((s, _i0) => (
                          <Fragment key={_i0}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: "7px 0", borderBottom: "1px solid var(--mgh-surface-2)" }}>
                              <DS.Badge tone={s.tone} size="sm">
                                {s.name}
                              </DS.Badge>
                              <span style={{ font: "500 12px/16px var(--font-sans)", color: "var(--mgh-ink-2)", textAlign: "right" }}>
                                {s.edit}
                              </span>
                            </div>
                          </Fragment>
                        ))}
                      </div>
                    </DS.Card>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </main>
        {v.hasToast ? (
          <>
            <div style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", zIndex: "120", background: "var(--mgh-navy)", color: "#fff", padding: "10px 16px", borderRadius: "12px", boxShadow: "var(--shadow-lg)", display: "flex", gap: "8px", alignItems: "center", font: "600 13px/18px var(--font-sans)" }}>
              <DS.Icon name="check_circle" size={16} color="var(--mgh-success-300)" />
              {v.toast}
            </div>
          </>
        ) : null}
        {v.hasDialog ? (
          <>
            <div onClick={v.closeDialog} style={{ position: "fixed", inset: "0", zIndex: "100", background: "rgba(19,27,46,.4)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
              <div onClick={v.stop} style={{ width: "480px", maxWidth: "100%", background: "#fff", borderRadius: "16px", boxShadow: "var(--shadow-lg)", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <span style={{ font: "600 18px/24px var(--font-sans)", color: "var(--mgh-ink)" }}>
                  {v.dlg.title}
                </span>
                <span style={{ font: "400 13px/18px var(--font-sans)", color: "var(--mgh-ink-2)" }}>
                  {v.dlg.body}
                </span>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                  <DS.Button variant="secondary" onClick={v.closeDialog}>
                    Cancel
                  </DS.Button>
                  <DS.Button variant={v.dlg.variant} icon={v.dlg.icon} onClick={v.confirmDialog}>
                    {v.dlg.confirm}
                  </DS.Button>
                </div>
              </div>
            </div>
          </>
        ) : null}



        {/* PAYROLL RUN DETAILS MODAL */}
        {this.state.payrollRunModal ? (
          <div onClick={() => this.setState({ payrollRunModal: null })} style={{ position: "fixed", inset: "0", zIndex: "115", background: "rgba(19,27,46,.6)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "980px", maxWidth: "100%", maxHeight: "92vh", background: "#fff", borderRadius: "16px", boxShadow: "var(--shadow-lg)", padding: "28px", display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <DS.Icon name="payments" size={24} color="var(--mgh-primary)" />
                    <span style={{ font: "700 20px/26px var(--font-sans)", color: "var(--mgh-ink)" }}>
                      Payroll Register • {this.state.payrollRunModal.periodId || 'Cycle Summary'}
                    </span>
                    <DS.Badge tone={this.state.payrollRunModal.status === 'Approved' ? 'success' : 'warning'} size="sm" dot={true}>
                      {this.state.payrollRunModal.status}
                    </DS.Badge>
                  </div>
                  <span style={{ font: "400 13px/18px var(--font-sans)", color: "var(--mgh-ink-2)", marginTop: "4px", display: "block" }}>
                    Engine: Version {this.state.payrollRunModal.rulesVersion || '2025.1'} • Calculated with DGII (DR), TSS, US W-4 and UK PAYE statutory rules
                  </span>
                </div>
                <button onClick={() => this.setState({ payrollRunModal: null })} style={{ background: "transparent", border: "0", cursor: "pointer", padding: "4px" }}>
                  <DS.Icon name="close" size={20} color="var(--mgh-ink-3)" />
                </button>
              </div>

              {/* KPI CARDS */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "12px" }}>
                <div style={{ padding: "14px", borderRadius: "12px", background: "var(--mgh-surface-1)", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ font: "700 11px/14px var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--mgh-ink-3)" }}>Workforce</span>
                  <span style={{ font: "800 22px/28px var(--font-sans)", color: "var(--mgh-ink)" }}>{this.state.payrollRunModal.totalEmployees} Employees</span>
                  <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-2)" }}>{this.state.payrollRunModal.totalHours} Total Hours</span>
                </div>
                <div style={{ padding: "14px", borderRadius: "12px", background: "var(--mgh-surface-1)", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ font: "700 11px/14px var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--mgh-ink-3)" }}>Gross Payroll</span>
                  <span style={{ font: "800 22px/28px var(--font-sans)", color: "var(--mgh-ink)" }}>${Number(this.state.payrollRunModal.totalGross || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-success)" }}>Base + OT + Adjustments</span>
                </div>
                <div style={{ padding: "14px", borderRadius: "12px", background: "var(--mgh-warning-bg)", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ font: "700 11px/14px var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.5px", color: "#8A5A00" }}>Statutory Deductions</span>
                  <span style={{ font: "800 22px/28px var(--font-sans)", color: "#8A5A00" }}>-${Number(this.state.payrollRunModal.totalDeductions || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <span style={{ font: "400 12px/16px var(--font-sans)", color: "#8A5A00" }}>TSS, DGII, FICA & PAYE</span>
                </div>
                <div style={{ padding: "14px", borderRadius: "12px", background: "var(--mgh-success-bg)", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ font: "700 11px/14px var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--mgh-success)" }}>Net Disbursement</span>
                  <span style={{ font: "800 22px/28px var(--font-sans)", color: "var(--mgh-success)" }}>${Number(this.state.payrollRunModal.totalNet || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-success)" }}>100% Balanced</span>
                </div>
              </div>

              {/* REGISTER ITEMS TABLE */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "var(--mgh-surface-1)", borderBottom: "1px solid var(--mgh-surface-2)" }}>
                      <th style={{ padding: "10px 14px", fontWeight: "700", color: "var(--mgh-ink-2)" }}>Employee</th>
                      <th style={{ padding: "10px 14px", fontWeight: "700", color: "var(--mgh-ink-2)", textAlign: "right" }}>Hours</th>
                      <th style={{ padding: "10px 14px", fontWeight: "700", color: "var(--mgh-ink-2)", textAlign: "right" }}>Gross</th>
                      <th style={{ padding: "10px 14px", fontWeight: "700", color: "var(--mgh-ink-2)", textAlign: "right" }}>Deductions</th>
                      <th style={{ padding: "10px 14px", fontWeight: "700", color: "var(--mgh-ink-2)", textAlign: "right" }}>Net Pay</th>
                      <th style={{ padding: "10px 14px", fontWeight: "700", color: "var(--mgh-ink-2)" }}>Payout Rail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(this.state.payrollRunModal.items || []).map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid var(--mgh-surface-2)" }}>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontWeight: "600", color: "var(--mgh-ink)" }}>{item.employee_name || item.name}</span>
                            <span style={{ fontSize: "11px", color: "var(--mgh-ink-3)" }}>{item.employee_role || item.role}</span>
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                          {(item.hours ? item.hours.total : (Number(item.reg_hours || 0) + Number(item.ot_hours || 0))).toFixed(1)}h
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: "600" }}>
                          ${Number(item.gross_pay || (item.earnings && item.earnings.grossPay) || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--mgh-danger)" }}>
                          -${Number(item.total_deductions || (item.deductions && item.deductions.total) || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: "700", color: "var(--mgh-success)" }}>
                          ${Number(item.net_pay || item.netPay || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: "11px", color: "var(--mgh-ink-2)" }}>
                          {item.payoutDistribution && item.payoutDistribution[0] ? `${item.payoutDistribution[0].rail} (${item.payoutDistribution[0].percentage}%)` : 'Bank'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ACTIONS */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "10px" }}>
                <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>
                  {this.state.payrollRunModal.status === 'Approved'
                    ? 'This cycle is approved and locked. Records are permanent.'
                    : 'Requires Finance VP or Administrator sign-off to finalize and lock.'}
                </span>
                <div style={{ display: "flex", gap: "10px" }}>
                  <DS.Button variant="secondary" onClick={() => this.setState({ payrollRunModal: null })}>
                    Close
                  </DS.Button>
                  <DS.Button variant="dark" icon="download" onClick={() => this.exportPayrollRunDisbursementCSV(this.state.payrollRunModal)}>
                    Export ACH Batch (CSV)
                  </DS.Button>
                  {this.state.payrollRunModal.status !== 'Approved' && ['finance', 'admin'].includes((this.state.currentUser && this.state.currentUser.role) || '') ? (
                    <DS.Button variant="primary" icon="verified" onClick={() => this.approveCurrentPayrollRun(this.state.payrollRunModal.id)}>
                      Approve & Lock Payroll Run
                    </DS.Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* CHANGE / SET PASSWORD MODAL */}
        {this.state.pw ? this.renderPasswordModal() : null}

        {/* NEW ADJUSTMENT ENTRY MODAL */}
        {this.state.showAdjModal ? (
          <div onClick={() => this.setState({ showAdjModal: false })} style={{ position: "fixed", inset: "0", zIndex: "115", background: "rgba(19,27,46,.6)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "640px", maxWidth: "100%", maxHeight: "90vh", background: "#fff", borderRadius: "16px", boxShadow: "var(--shadow-lg)", padding: "28px", display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <DS.Icon name="tune" size={24} color="var(--mgh-primary)" />
                    <span style={{ font: "700 20px/26px var(--font-sans)", color: "var(--mgh-ink)" }}>
                      New Payroll Adjustment Entry
                    </span>
                  </div>
                  <span style={{ font: "400 13px/18px var(--font-sans)", color: "var(--mgh-ink-2)", marginTop: "4px", display: "block" }}>
                    Queue a performance bonus, expense stipend, retroactive correction or deduction with full audit trail.
                  </span>
                </div>
                <button onClick={() => this.setState({ showAdjModal: false })} style={{ background: "transparent", border: "0", cursor: "pointer", padding: "4px" }}>
                  <DS.Icon name="close" size={20} color="var(--mgh-ink-3)" />
                </button>
              </div>

              {/* FORM FIELDS */}
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", font: "600 12px/16px var(--font-sans)", color: "var(--mgh-ink-2)", marginBottom: "6px" }}>Beneficiary Employee</label>
                  <select
                    value={this.state.newAdj.employeeId}
                    onChange={e => {
                      const empId = e.target.value;
                      const emp = (window.EMPLOYEES || []).find(x => x.id === empId);
                      if (emp) {
                        this.setState(s => ({
                          newAdj: { ...s.newAdj, employeeId: emp.id, name: emp.name, role: emp.role, avatar: emp.avatar, target: emp.bank || 'Banco BHD León' }
                        }));
                      }
                    }}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--mgh-surface-3)", font: "500 14px var(--font-sans)", color: "var(--mgh-ink)", background: "var(--surface-app)" }}
                  >
                    {(window.EMPLOYEES || []).map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.id} — {emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", font: "600 12px/16px var(--font-sans)", color: "var(--mgh-ink-2)", marginBottom: "6px" }}>Adjustment Type</label>
                    <input
                      type="text"
                      value={this.state.newAdj.type}
                      onChange={e => this.setState(s => ({ newAdj: { ...s.newAdj, type: e.target.value } }))}
                      placeholder="e.g. Q1 Performance Bonus"
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--mgh-surface-3)", font: "500 14px var(--font-sans)", color: "var(--mgh-ink)" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", font: "600 12px/16px var(--font-sans)", color: "var(--mgh-ink-2)", marginBottom: "6px" }}>Category / Classification</label>
                    <select
                      value={this.state.newAdj.kind}
                      onChange={e => {
                        const kind = e.target.value;
                        const catMap = { bonus: 'Discretionary incentive pool', stipend: 'Hardware & remote office', retro: 'Jira on-call rate delta', deduction: 'Statutory health / withholding delta' };
                        this.setState(s => ({ newAdj: { ...s.newAdj, kind, cat: catMap[kind] || 'Special adjustment' } }));
                      }}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--mgh-surface-3)", font: "500 14px var(--font-sans)", color: "var(--mgh-ink)", background: "var(--surface-app)" }}
                    >
                      <option value="bonus">Discretionary Bonus</option>
                      <option value="stipend">Expense Stipend</option>
                      <option value="retro">Retroactive Parity</option>
                      <option value="deduction">Payroll Deduction</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", font: "600 12px/16px var(--font-sans)", color: "var(--mgh-ink-2)", marginBottom: "6px" }}>Gross Amount (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={this.state.newAdj.amt}
                      onChange={e => this.setState(s => ({ newAdj: { ...s.newAdj, amt: e.target.value } }))}
                      placeholder="1500.00"
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--mgh-surface-3)", font: "600 14px var(--font-mono)", color: "var(--mgh-ink)" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", font: "600 12px/16px var(--font-sans)", color: "var(--mgh-ink-2)", marginBottom: "6px" }}>Tax Profile Treatment</label>
                    <select
                      value={this.state.newAdj.tax}
                      onChange={e => {
                        const tax = e.target.value;
                        const toneMap = { 'DGII Taxable ISR': 'info', 'TSS Exempt': 'success', 'Statutory Deduction': 'neutral', 'Non-Taxable Reimbursement': 'success' };
                        this.setState(s => ({ newAdj: { ...s.newAdj, tax, taxTone: toneMap[tax] || 'info' } }));
                      }}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--mgh-surface-3)", font: "500 14px var(--font-sans)", color: "var(--mgh-ink)", background: "var(--surface-app)" }}
                    >
                      <option value="DGII Taxable ISR">DGII Taxable ISR</option>
                      <option value="TSS Exempt">TSS Exempt</option>
                      <option value="Statutory Deduction">Statutory Deduction</option>
                      <option value="Non-Taxable Reimbursement">Non-Taxable Reimbursement</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", font: "600 12px/16px var(--font-sans)", color: "var(--mgh-ink-2)", marginBottom: "6px" }}>Disbursement Target Rail</label>
                  <input
                    type="text"
                    value={this.state.newAdj.target}
                    onChange={e => this.setState(s => ({ newAdj: { ...s.newAdj, target: e.target.value } }))}
                    placeholder="e.g. Banco BHD León • Checking"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--mgh-surface-3)", font: "500 14px var(--font-sans)", color: "var(--mgh-ink)" }}
                  />
                </div>
              </div>

              {/* ACTIONS */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <DS.Button variant="secondary" onClick={() => this.setState({ showAdjModal: false })}>
                  Cancel
                </DS.Button>
                <DS.Button variant="primary" icon="save" onClick={() => this.submitNewAdjustment()}>
                  Save & Queue Adjustment
                </DS.Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* ORG MENU MODAL */}
        {this.state.orgMenu ? (
          <>
            <div onClick={() => this.setState({ orgMenu: false })} style={{ position: "fixed", inset: "0", zIndex: "90" }} />
            <div style={{ position: "fixed", top: "60px", right: "24px", zIndex: "91", width: "360px", maxWidth: "calc(100vw - 48px)", background: "#fff", borderRadius: "12px", boxShadow: "var(--shadow-lg)", padding: "8px", display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ padding: "6px 10px", font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-3)" }}>
                Active organization • data never crosses organizations
              </span>
              {(v.orgItems || []).map((o, idx) => (
                <div key={idx} role="button" onClick={o.run} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 10px", borderRadius: "8px", cursor: "pointer", background: o.bg }}>
                  <div style={{ flex: "1", display: "flex", flexDirection: "column", minWidth: "0" }}>
                    <span style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)" }}>{o.name}</span>
                    <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>{o.person}</span>
                  </div>
                  {o.check ? <DS.Icon name={o.check} size={16} color="var(--mgh-primary)" /> : null}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {/* NOTIFICATIONS MODAL */}
        {this.state.notifOpen ? (
          <>
            <div onClick={() => this.setState({ notifOpen: false })} style={{ position: "fixed", inset: "0", zIndex: "90" }} />
            <div style={{ position: "fixed", top: "60px", right: "24px", zIndex: "91", width: "360px", maxWidth: "calc(100vw - 48px)", maxHeight: "70vh", overflowY: "auto", background: "#fff", borderRadius: "12px", boxShadow: "var(--shadow-lg)", padding: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 6px 8px" }}>
                <span style={{ font: "700 14px/20px var(--font-sans)", color: "var(--mgh-ink)" }}>{v.notifTitle}</span>
                <DS.Button size="sm" variant="ghost" icon="done_all" onClick={v.markRead}>Mark all read</DS.Button>
              </div>
              {v.notifEmpty ? <span style={{ padding: "14px 6px", font: "400 13px/18px var(--font-sans)", color: "var(--mgh-ink-3)" }}>No notifications for this role yet.</span> : null}
              {(v.notifItems || []).map((n, idx) => (
                <div key={idx} style={{ display: "flex", gap: "10px", padding: "10px 6px", borderTop: "1px solid var(--mgh-surface-2)" }}>
                  <span style={{ width: "8px", height: "8px", marginTop: "6px", borderRadius: "9999px", flex: "none", background: n.dot }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: "0" }}>
                    <span style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-ink)" }}>{n.text}</span>
                    <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--mgh-ink-3)" }}>{n.ref} • {n.at}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {/* LANG MENU MODAL */}
        {this.state.langMenu ? (
          <>
            <div onClick={() => this.setState({ langMenu: false })} style={{ position: "fixed", inset: "0", zIndex: "90" }} />
            <div style={{ position: "fixed", top: "60px", right: "24px", zIndex: "91", width: "240px", background: "#fff", borderRadius: "12px", boxShadow: "var(--shadow-lg)", padding: "8px", display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ padding: "6px 10px", font: "700 11px/14px var(--font-sans)", letterSpacing: "0.55px", textTransform: "uppercase", color: "var(--mgh-ink-3)" }}>Language</span>
              {(v.langMenuItems || []).map((o, idx) => (
                <div key={idx} role="button" onClick={o.run} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 10px", borderRadius: "8px", cursor: "pointer", background: o.bg }}>
                  <span style={{ font: "700 11px/14px var(--font-mono)", color: "var(--mgh-ink-3)", width: "22px" }}>{o.code}</span>
                  <span style={{ flex: "1", font: "600 13px/18px var(--font-sans)", color: o.color }}>{o.name}</span>
                  {o.check ? <DS.Icon name={o.check} size={16} color="var(--mgh-primary)" /> : null}
                </div>
              ))}
              <div style={{ height: "1px", background: "var(--mgh-surface-2)", margin: "4px 0" }} />
              <div role="button" onClick={v.langAdd} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 10px", borderRadius: "8px", cursor: "pointer" }}>
                <DS.Icon name="add" size={16} color="var(--mgh-primary)" />
                <span style={{ font: "600 13px/18px var(--font-sans)", color: "var(--mgh-primary)" }}>Add Language</span>
              </div>
            </div>
          </>
        ) : null}

        {/* DIALOG */}
        {this.state.dialog ? (
          <div onClick={() => this.setState({ dialog: null })} style={{ position: "fixed", inset: "0", zIndex: "100", background: "rgba(19,27,46,.4)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "480px", maxWidth: "100%", background: "#fff", borderRadius: "16px", boxShadow: "var(--shadow-lg)", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <span style={{ font: "600 18px/24px var(--font-sans)", color: "var(--mgh-ink)" }}>{this.state.dialog.title}</span>
              <span style={{ font: "400 13px/18px var(--font-sans)", color: "var(--mgh-ink-2)" }}>{this.state.dialog.body}</span>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <DS.Button variant="secondary" onClick={() => this.setState({ dialog: null })}>Cancel</DS.Button>
                <DS.Button variant={this.state.dialog.variant} icon={this.state.dialog.icon} onClick={() => { const r = this.state.dialog && this.state.dialog.run; if (r) r(); }}>{this.state.dialog.confirm}</DS.Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
}
