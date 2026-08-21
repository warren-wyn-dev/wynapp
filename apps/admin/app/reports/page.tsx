'use client';
import { useEffect, useState } from 'react';
import { adminFetch, AdminApiError } from '../lib/admin-api';
import { ReportRow } from './report-row';

type Report = {
  id: string;
  target_type: string;
  target_id: string;
  reason_code: string;
  source_surface: string;
  status: string;
  created_at: string;
};

export default function ReportsPage() {
  const [items, setItems] = useState<Report[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [errorCode, setErrorCode] = useState('');

  useEffect(() => {
    adminFetch<Report[]>('/admin/v1/reports')
      .then((data) => {
        setItems(data);
        setStatus('ready');
      })
      .catch((e: unknown) => {
        setErrorCode(e instanceof AdminApiError ? e.code : 'UNKNOWN');
        setStatus('error');
      });
  }, []);

  return (
    <section className="grid">
      <header>
        <span className="eyebrow">REPORT CENTER</span>
        <h1>รายงานที่รอดำเนินการ</h1>
      </header>
      {status === 'loading' && (
        <p role="status" className="muted">
          กำลังโหลด…
        </p>
      )}
      {status === 'error' && (
        <p role="alert">
          โหลดรายงานไม่สำเร็จ
          {errorCode === 'FORBIDDEN' ? ' — บทบาทของคุณไม่มีสิทธิ์ดูรายงาน' : ''}
        </p>
      )}
      {status === 'ready' && items.length === 0 && (
        <p className="muted">ไม่มีรายงานในขณะนี้</p>
      )}
      {status === 'ready' && (
        <div className="report-list">
          {items.map((report) => (
            <ReportRow key={report.id} report={report} />
          ))}
        </div>
      )}
    </section>
  );
}
