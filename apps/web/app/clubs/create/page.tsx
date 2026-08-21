export default function CreateClub() {
  return (
    <section className="club-editor">
      <p className="eyebrow">NEW COMMUNITY</p>
      <h1>สร้าง Club</h1>
      <p className="muted">คุณจะเป็น Owner และดูแลสมาชิก กฎ และเนื้อหา</p>
      <form className="wyn-card grid">
        <label>
          ชื่อ Club
          <input name="name" required minLength={2} maxLength={80} />
        </label>
        <label>
          Slug
          <input
            name="slug"
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="design-thailand"
          />
        </label>
        <label>
          รายละเอียด
          <textarea name="description" maxLength={2000} />
        </label>
        <label>
          การมองเห็น
          <select name="visibility">
            <option value="PUBLIC">Public — ทุกคนเห็นและเข้าร่วมได้</option>
            <option value="PRIVATE">Private — ต้องส่งคำขอเข้าร่วม</option>
          </select>
        </label>
        <button type="submit">สร้าง Club</button>
      </form>
    </section>
  );
}
