import { RelationshipList } from '../../components/relationship-list';
export default function Muted() {
  return (
    <section className="card">
      <h1>บัญชีที่ปิดเสียง</h1>
      <RelationshipList
        endpoint="/v1/me/muted"
        empty="ยังไม่มีบัญชีที่ปิดเสียง"
        action="unmute"
      />
    </section>
  );
}
