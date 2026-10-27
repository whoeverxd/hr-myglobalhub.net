// The My Global Hub design-system bundle and the UI-kit screens were authored for a
// global-React environment (Claude Design). Expose React on window before they load.
import React from 'react';
import * as ReactDOM from 'react-dom';

window.React = React;
window.ReactDOM = ReactDOM;

// Global safety guards for .toFixed across all data types
if (!Boolean.prototype.toFixed) {
  Boolean.prototype.toFixed = function(digits = 1) {
    return (0).toFixed(digits);
  };
}
if (!String.prototype.toFixed) {
  String.prototype.toFixed = function(digits = 1) {
    const num = Number(this);
    return isNaN(num) ? (0).toFixed(digits) : num.toFixed(digits);
  };
}

// Initialize corporate engines
import './lib/i18n.js';
import './lib/rbac.js';
import './lib/workflow.js';
import './lib/attendance.js';

