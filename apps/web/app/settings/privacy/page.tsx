export default function Privacy() {
  return (
    <section className="card">
      <h1>ความเป็นส่วนตัว</h1>
      <label>
        การมองเห็น
        <select defaultValue="PUBLIC">
          <option value="PUBLIC">สาธารณะ</option>
          <option value="PRIVATE">ส่วนตัว</option>
        </select>
      </label>
      <button>บันทึก</button>
    </section>
  );
}
