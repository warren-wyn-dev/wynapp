import { RelationshipList } from '../../../components/relationship-list';
export default async function Following({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return (
    <section className="card">
      <h1>@{username} กำลังติดตาม</h1>
      <RelationshipList
        endpoint={`/v1/users/${encodeURIComponent(username)}/following`}
        empty="ยังไม่ได้ติดตามใคร"
      />
    </section>
  );
}
