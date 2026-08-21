import './globals.css'; import type { ReactNode } from 'react';
export default function Layout({children}:{children:ReactNode}){return <html lang="th"><body><main className="shell"><div className="rainbow"/><nav className="nav" aria-label="หลัก"><a href="/login">เข้าสู่ระบบ</a><a href="/register">สมัครสมาชิก</a><a href="/settings">ตั้งค่า</a></nav>{children}</main></body></html>}
