import { RelationshipList } from '../../../components/relationship-list';
export default async function Followers({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return (
    <section className="card">
      <h1>ผู้ติดตาม @{username}</h1>
      <RelationshipList
        endpoint={`/v1/users/${encodeURIComponent(username)}/followers`}
        empty="ยังไม่มีผู้ติดตาม"
      />
    </section>
  );
}
