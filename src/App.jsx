import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import './styles.css';

function RecoveryNotice() {
  return (
    <main className="page-shell">
      <div className="brand-mark" aria-hidden="true">V</div>
      <p className="eyebrow">VANTORIS X MONEY</p>
      <h1>One clear view of your money.</h1>
      <p className="intro">
        A secure member experience for account activity, transfers, and financial operations.
      </p>
      <section className="status-panel" aria-labelledby="status-title">
        <span className="status-dot" />
        <div>
          <h2 id="status-title">Application recovery in progress</h2>
          <p>The repository is missing core application files and service modules. Member banking and payment actions are not enabled on this recovery screen. No funds are moved here.</p>
        </div>
      </section>
      <p className="fine-print">For safety, do not enter credentials or payment details until the complete application and its backend integrations have been restored and tested.</p>
    </main>
  );
}

export default function App() {
  return <BrowserRouter><RecoveryNotice /></BrowserRouter>;
}
