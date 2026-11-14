'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import RestaurantLogo from './RestaurantLogo';
import { api } from '@/lib/client';

export default function ForgotPasswordForm() {
  const [step, setStep] = useState<'email' | 'otp' | 'password' | 'done'>('email');
  const [email, setEmail] = useState(''); const [otp, setOtp] = useState(''); const [token, setToken] = useState('');
  const [pw, setPw] = useState(''); const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const run = async (fn: () => Promise<void>) => { setErr(''); setBusy(true); try { await fn(); } catch (e: any) { setErr(e.message); } setBusy(false); };
  const sendOtp = (e: React.FormEvent) => { e.preventDefault(); run(async () => { await api('/api/auth/forgot', { body: { email } }); setStep('otp'); }); };
  const checkOtp = (e: React.FormEvent) => { e.preventDefault(); run(async () => { const r = await api<{ resetToken: string }>('/api/auth/verify-otp', { body: { email, otp } }); setToken(r.resetToken); setStep('password'); }); };
  const savePassword = (e: React.FormEvent) => { e.preventDefault(); run(async () => { await api('/api/auth/reset', { body: { email, resetToken: token, password: pw, confirm } }); setToken(''); setStep('done'); }); };
  const restart = () => { setErr(''); setOtp(''); setToken(''); setPw(''); setConfirm(''); setStep('email'); };
  const error = err && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</p>;
  const spin = busy && <Loader2 size={16} className="animate-spin" />;

  return (
    <main className="flex min-h-screen items-center justify-center px-5 pb-10 pt-24">
      <div className="panel w-full max-w-md space-y-4 p-7">
        <div className="flex justify-center"><RestaurantLogo variant="auth" /></div>
        {step === 'email' && (
          <form onSubmit={sendOtp} className="space-y-4">
            <h1 className="font-serif text-3xl gold-text">Forgot your password?</h1>
            <p className="text-taupe">Enter the email you signed up with. We will email you a 6-digit OTP.</p>
            <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            {error}
            <button disabled={busy} className="btn-gold w-full disabled:opacity-60">{spin}Send OTP</button>
          </form>
        )}
        {step === 'otp' && (
          <form onSubmit={checkOtp} className="space-y-4">
            <h1 className="font-serif text-3xl gold-text">Enter the OTP</h1>
            <p className="text-taupe">If an account exists for <b className="text-champagne">{email}</b>, we have emailed a 6-digit OTP (valid for 5 minutes). Check your spam folder too.</p>
            <input className="input tracking-[0.4em]" placeholder="6-digit OTP" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} autoComplete="one-time-code" required />
            {error}
            <button disabled={busy || otp.length !== 6} className="btn-gold w-full disabled:opacity-60">{spin}Verify OTP</button>
            <button type="button" onClick={restart} className="block w-full text-sm text-taupe hover:text-champagne">Send a new OTP</button>
          </form>
        )}
        {step === 'password' && (
          <form onSubmit={savePassword} className="space-y-4">
            <h1 className="font-serif text-3xl gold-text">Set a new password</h1>
            <p className="text-taupe">OTP verified. Choose a new password for <b className="text-champagne">{email}</b>.</p>
            <input className="input" type="password" placeholder="New password (8+ characters, letters & numbers)" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
            <input className="input" type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            {error}
            <button disabled={busy} className="btn-gold w-full disabled:opacity-60">{spin}Save new password</button>
            <button type="button" onClick={restart} className="block w-full text-sm text-taupe hover:text-champagne">Start over</button>
          </form>
        )}
        {step === 'done' && (
          <div className="space-y-4 text-center">
            <h1 className="font-serif text-3xl gold-text">Password changed</h1>
            <p className="text-taupe">You can now log in with your new password.</p>
            <Link href="/login" className="btn-gold w-full">Go to log in</Link>
          </div>
        )}
        {step !== 'done' && <Link href="/login" className="block text-center text-sm text-taupe hover:text-champagne">← Back to log in</Link>}
      </div>
    </main>
  );
}
