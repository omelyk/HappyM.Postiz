'use client';

import { FormEvent, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import styles from './appliance-login.module.css';

export function ApplianceLogin() {
  const fetchData = useFetch();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [changeToken, setChangeToken] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (changeToken && (newPassword !== confirmation || newPassword.length < 12)) {
      setError('Inserisci la stessa nuova password in entrambi i campi, con almeno 12 caratteri.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetchData(changeToken ? '/auth/initial-admin-password' : '/auth/login', {
        method: 'POST',
        body: JSON.stringify(changeToken
          ? { token: changeToken, password: newPassword }
          : { email: identifier.trim().toLowerCase() === 'superadmin'
              ? 'superadmin@social-manager.local' : identifier.trim(),
              password, provider: 'LOCAL', providerToken: '' }),
      });
      if (!response.ok) {
        if (changeToken && response.status === 401) {
          setChangeToken(''); setNewPassword(''); setConfirmation('');
          setError('Richiesta scaduta. Accedi nuovamente con la password iniziale.');
        } else {
          setError(changeToken ? 'Impossibile aggiornare la password. Verifica i dati e riprova.'
            : 'Accesso non riuscito. Verifica utente e password.');
        }
        return;
      }
      const result = await response.json();
      if (result.passwordChangeRequired && typeof result.changeToken === 'string') {
        setPassword(''); setChangeToken(result.changeToken); setVisible(false);
        return;
      }
      if (result.login) window.location.assign('/');
      else setError('Impossibile completare l’accesso.');
    } catch {
      setError('Servizio non raggiungibile. Riprova tra poco.');
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className={styles.form} aria-busy={busy}>
      <div className={styles.formHeading}>
        <h1>{changeToken ? 'Scegli la tua password' : 'Accedi'}</h1>
        <p>{changeToken ? 'Al primo accesso sostituisci la password iniziale per continuare.'
          : 'Il tuo spazio per gestire la comunicazione social.'}</p>
      </div>
      {!changeToken && <label className={styles.field}>
        <span>Utente o email</span>
        <input name="username" autoComplete="username" required autoCapitalize="none"
          spellCheck={false} value={identifier} onChange={e => setIdentifier(e.target.value)}
          placeholder="Inserisci utente o email" disabled={busy} autoFocus />
      </label>}
      <label className={styles.field}>
        <span>{changeToken ? 'Nuova password' : 'Password'}</span>
        <span className={styles.passwordField}>
          <input name={changeToken ? 'new-password' : 'password'}
            type={visible ? 'text' : 'password'} required minLength={changeToken ? 12 : undefined}
            maxLength={256} autoComplete={changeToken ? 'new-password' : 'current-password'}
            value={changeToken ? newPassword : password} disabled={busy}
            onChange={e => changeToken ? setNewPassword(e.target.value) : setPassword(e.target.value)}
            placeholder={changeToken ? 'Almeno 12 caratteri' : 'Inserisci la password'} />
          <button type="button" className={styles.reveal} onClick={() => setVisible(!visible)}
            aria-label={visible ? 'Nascondi password' : 'Mostra password'} aria-pressed={visible}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
              {visible && <path d="m3 3 18 18" />}
            </svg>
          </button>
        </span>
      </label>
      {changeToken && <label className={styles.field}>
        <span>Conferma nuova password</span>
        <input name="confirm-password" type="password" required minLength={12} maxLength={256}
          autoComplete="new-password" disabled={busy} value={confirmation}
          onChange={e => setConfirmation(e.target.value)} placeholder="Ripeti la nuova password" />
      </label>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button type="submit" disabled={busy} className={styles.submit}>
        {busy ? 'Accesso in corso…' : changeToken ? 'Salva password e accedi' : 'Accedi a Social Manager'}
        {!busy && <span aria-hidden="true">→</span>}
      </button>
      <p className={styles.localNote}>
        <svg width="14" height="16" viewBox="0 0 16 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <rect x="2" y="8" width="12" height="9" rx="2" /><path d="M4.5 8V5a3.5 3.5 0 0 1 7 0v3M8 11v3" />
        </svg>
        Accesso locale all’appliance
      </p>
    </form>
  );
}
