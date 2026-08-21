export default function Security() {
  return (
    <section className="card">
      <h1>ความปลอดภัย</h1>
      <form className="grid">
        <label>
          รหัสผ่านปัจจุบัน
          <input type="password" />
        </label>
        <label>
          รหัสผ่านใหม่
          <input type="password" minLength={12} />
        </label>
        <button>เปลี่ยนรหัสผ่าน</button>
      </form>
    </section>
  );
}
