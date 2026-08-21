export default function Settings() {
  return (
    <section className="card">
      <h1>การตั้งค่าบัญชี</h1>
      <div className="grid">
        <a href="/settings/account">บัญชี</a>
        <a href="/settings/security">ความปลอดภัย</a>
        <a href="/settings/sessions">เซสชัน</a>
        <a href="/settings/privacy">ความเป็นส่วนตัว</a>
        <a href="/settings/follow-requests">คำขอติดตาม</a>
        <a href="/settings/blocked">บัญชีที่บล็อก</a>
        <a href="/settings/muted">บัญชีที่ปิดเสียง</a>
        <a href="/settings/delete-account">ลบบัญชี</a>
      </div>
    </section>
  );
}
