export default async function ClubProfile({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <section className="club-profile">
      <div className="club-cover" />
      <header className="wyn-card club-profile-header">
        <span className="club-avatar large">🌈</span>
        <div>
          <p className="eyebrow">PUBLIC CLUB</p>
          <h1>{slug.replaceAll('-', ' ')}</h1>
          <p className="muted">
            @{slug} · สมาชิกและกิจกรรมแสดงตามสิทธิ์จากเซิร์ฟเวอร์
          </p>
        </div>
        <button>เข้าร่วม</button>
      </header>
      <nav className="club-tabs" aria-label="Club">
        <a href="#feed">Feed</a>
        <a href="#pinned">Pinned</a>
        <a href="#rules">Rules</a>
        <a href="#members">Members</a>
      </nav>
      <section id="pinned" className="wyn-card">
        <h2>📌 Pinned Drops</h2>
        <p className="muted">
          Owner, Admin หรือ Moderator ปักหมุดได้สูงสุด 3 รายการ
        </p>
      </section>
      <section id="feed">
        <h2>Club Feed</h2>
        <div className="wyn-state">ยังไม่มี Drop — เริ่มบทสนทนาแรกของ Club</div>
      </section>
      <aside id="rules" className="wyn-card">
        <h2>กฎของ Club</h2>
        <p className="muted">อ่านกฎก่อนเข้าร่วมและโพสต์</p>
      </aside>
    </section>
  );
}
