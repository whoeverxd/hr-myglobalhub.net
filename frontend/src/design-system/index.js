// My Global Hub Design System (namespace MyGlobalHubDesignSystem_2a603d).
// Components: Avatar, Badge, Button, Card, Icon, IconButton, ActivityFeed, DataTable, KeyValue,
// MetricTile, Pagination, ProgressBar, StatCard, Stepper, TableToolbar, Checkbox, FilterChips,
// SearchField, Select, TextField, Toggle, PageHeader, Sidebar, Tabs, TopBar.
import '../setup-globals.js';
import './styles.css';
import './_ds_bundle.js';
import TopBar from './TopBar.jsx';

// The bundle was exported from the design prototype and injects demo globals (sample people such as
// "Carlos Mendez", a frozen PERIOD, its own SCREENS/App with wrong asset paths). Production shows backend
// data only: clear them right after the bundle runs, before the kit and the app read them.
if (typeof window !== 'undefined') {
  window.EMPLOYEES = [];
  for (const k of ['SCREENS', 'App', 'PERIOD']) {
    try { delete window[k]; } catch (e) { /* non-configurable */ }
    if (k in window) window[k] = undefined;
  }
}

export const DS = window.MyGlobalHubDesignSystem_2a603d;

if (DS) {
  DS.TopBar = TopBar;
  if (typeof window !== 'undefined' && window.MyGlobalHubDesignSystem_2a603d) {
    window.MyGlobalHubDesignSystem_2a603d.TopBar = TopBar;
  }
}

if (DS && DS.__errors && DS.__errors.length) {
  console.error('[design-system] bundle reported errors:', DS.__errors);
}

