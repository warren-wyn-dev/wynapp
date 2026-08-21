import { RelationshipList } from '../../components/relationship-list';
export default function Blocked() { return <section className="card"><h1>บัญชีที่บล็อก</h1><RelationshipList endpoint="/v1/me/blocked" empty="ยังไม่มีบัญชีที่บล็อก" action="unblock" /></section>; }
