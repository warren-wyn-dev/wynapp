export default function Clubs() {
  return (
    <section className="clubs-page">
      <header>
        <p className="eyebrow">COMMUNITIES</p>
        <h1>WYN Clubs</h1>
        <p className="muted">
          ค้นหาพื้นที่ที่ใช่ พบสมาชิกใหม่ และแชร์ Drops ด้วยกัน
        </p>
      </header>
      <form className="search-form" action="/clubs">
        <label className="sr-only" htmlFor="club-q">
          ค้นหา Club
        </label>
        <input id="club-q" name="q" placeholder="ค้นหาชื่อหรือ @slug" />
        <button>ค้นหา</button>
      </form>
      <div className="club-grid">
        <article className="wyn-card">
          <span className="club-avatar">✨</span>
          <h2>Suggested Clubs</h2>
          <p className="muted">
            คำแนะนำจะปรับตามความสนใจและความสัมพันธ์ โดยไม่เปิดเผยข้อมูล Club
            ส่วนตัว
          </p>
        </article>
        <article className="wyn-card">
          <span className="club-avatar">🔥</span>
          <h2>Popular now</h2>
          <p className="muted">จัดอันดับจากกิจกรรมภายในแต่ละ Club เท่านั้น</p>
        </article>
      </div>
      <a className="wyn-button club-create-link" href="/clubs/create">
        สร้าง Club
      </a>
    </section>
  );
}
