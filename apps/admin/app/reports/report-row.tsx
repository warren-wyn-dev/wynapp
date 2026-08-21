'use client';
import { useState } from 'react';
import { adminFetch, AdminApiError } from '../lib/admin-api';

type Report = {
  id: string;
  target_type: string;
  target_id: string;
  reason_code: string;
  source_surface: string;
  status: string;
  created_at: string;
};
type Case = {
  id: string;
  status: string;
  version: number;
};
const ACTION_TYPES = [
  'NO_ACTION',
  'WARNING',
  'REMOVE_CONTENT',
  'RESTRICT',
  'SUSPEND',
  'BAN',
] as const;

export function ReportRow({ report }: { report: Report }) {
  const [current, setCurrent] = useState(report);
  const [moderationCase, setModerationCase] = useState<Case | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsStepUp, setNeedsStepUp] = useState(false);
  const [password, setPassword] = useState('');
  const [actionType, setActionType] =
    useState<(typeof ACTION_TYPES)[number]>('WARNING');
  const [reasonCode, setReasonCode] = useState('');
  const [notes, setNotes] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  async function openCase() {
    setBusy(true);
    setError('');
    try {
      const created = await adminFetch<Case>(
        `/admin/v1/reports/${report.id}/case`,
        { method: 'POST' },
      );
      setModerationCase(created);
      setCurrent((c) => ({ ...c, status: 'LINKED_TO_CASE' }));
    } catch (e) {
      setError(e instanceof AdminApiError ? e.code : 'เกิดข้อผิดพลาด');
    } finally {
      setBusy(false);
    }
  }

  async function submitAction() {
    if (!moderationCase) return;
    setBusy(true);
    setError('');
    try {
      await adminFetch(`/admin/v1/cases/${moderationCase.id}/actions`, {
        method: 'POST',
        body: {
          actionType,
          reasonCode: reasonCode || actionType,
          notes: notes || undefined,
          idempotencyKey: crypto.randomUUID(),
          expectedVersion: moderationCase.version,
        },
      });
      setModerationCase((c) =>
        c ? { ...c, status: 'ACTIONED', version: c.version + 1 } : c,
      );
      setNeedsStepUp(false);
    } catch (e) {
      if (e instanceof AdminApiError && e.code === 'STEP_UP_REQUIRED') {
        setNeedsStepUp(true);
        setPendingAction(() => submitAction);
      } else {
        setError(e instanceof AdminApiError ? e.code : 'เกิดข้อผิดพลาด');
      }
    } finally {
      setBusy(false);
    }
  }

  async function stepUp() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/admin/v1/auth/step-up', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-admin-csrf-token': sessionStorage.getItem('wyn_admin_csrf') ?? '',
        },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) throw new Error('step-up failed');
      setPassword('');
      setNeedsStepUp(false);
      pendingAction?.();
    } catch {
      setError('ยืนยันตัวตนไม่สำเร็จ ตรวจสอบรหัสผ่านอีกครั้ง');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="wyn-card report-row-card">
      <header className="report-row">
        <div>
          <strong>
            {current.target_type} · {current.reason_code}
          </strong>
          <p className="muted">
            จาก {current.source_surface} ·{' '}
            {new Date(current.created_at).toLocaleString('th-TH')}
          </p>
          <p className="muted">target: {current.target_id}</p>
        </div>
        <span className="badge">{current.status}</span>
      </header>

      {!moderationCase && current.status === 'RECEIVED' && (
        <button disabled={busy} onClick={() => void openCase()}>
          เปิด Case
        </button>
      )}

      {moderationCase && (
        <fieldset className="grid case-actions">
          <legend>
            Case {moderationCase.id.slice(0, 8)} · {moderationCase.status}
          </legend>
          <label>
            การดำเนินการ
            <select
              value={actionType}
              onChange={(e) =>
                setActionType(e.target.value as (typeof ACTION_TYPES)[number])
              }
            >
              {ACTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            รหัสเหตุผล (reason code)
            <input
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              placeholder={actionType}
              maxLength={50}
            />
          </label>
          <label>
            บันทึกเพิ่มเติม (ไม่บังคับ)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
            />
          </label>
          <button disabled={busy} onClick={() => void submitAction()}>
            ยืนยันการดำเนินการ
          </button>

          {needsStepUp && (
            <div className="grid step-up">
              <p role="alert">
                การดำเนินการนี้ต้องยืนยันตัวตนอีกครั้ง (step-up)
              </p>
              <label>
                รหัสผ่าน
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button
                disabled={busy || !password}
                onClick={() => void stepUp()}
              >
                ยืนยันตัวตน
              </button>
            </div>
          )}
        </fieldset>
      )}

      {error && <p role="alert">{error}</p>}
    </article>
  );
}
