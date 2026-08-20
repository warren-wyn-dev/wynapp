# WYN V1.0.0 Feature Priority

**Owner:** Product Manager

**Reviewer:** WYN CTO
**Status:** Draft — รอ Founder Approval

## Priority Definitions

- **P0 — ต้องมีเพื่อเปิด V1:** ขาดแล้วไม่สามารถส่งมอบ value หลักหรือเปิดใช้งานอย่างปลอดภัยได้ จึง block V1 release
- **P1 — สำคัญแต่ตามหลังได้:** อยู่ในขอบเขต V1 แต่สามารถส่งเป็น V1.x หลัง initial launch ได้เมื่อมีแผนและ Founder ยอมรับ
- **P2 — Enhancement:** มีคุณค่าและอยู่ใน product direction แต่เลื่อนได้โดยไม่ทำลาย core V1
- **Future:** ไม่อยู่ใน V1; รายการ Future ระบุไว้เฉพาะใน [`OUT_OF_SCOPE.md`](./OUT_OF_SCOPE.md)

Priority นี้จัดระดับ capability ไม่ได้อนุมัติ implementation และไม่ลบล้าง acceptance criteria ด้าน security, privacy, accessibility หรือ server-side authorization

## P0 — V1 Launch Blockers

| Area | Feature / minimum launch slice | เหตุผล |
|---|---|---|
| Authentication | Register, Login, Logout ตาม UF-03, age gate 18+, account status handling | ต้องมี identity, server-side session invalidation ที่ทดสอบได้ และป้องกันผู้ใช้อายุต่ำกว่าเกณฑ์ |
| Account privacy | Public default, switch Public/Private, Privacy Settings | เป็นกติกาหลักของ V1 |
| Home | For You และ Following พร้อม loading/empty/error | เป็นเส้นทางค้นพบและบริโภค content หลัก |
| Drop | Text, caption, hashtag, mention, external link | core publishing |
| Drop media | รูปภาพสูงสุด 9 รูป พร้อม validation | core publishing ที่ Founder กำหนด |
| Drop lifecycle | Draft, publish, edit ภายใน 30 นาที + Edited status, safe soft-delete | รักษา control และ integrity ของ content |
| Engagement | Like, Comment, Threaded Reply, ReDrop, Quote ReDrop, Share, Save, Views | core social loop |
| Social graph | Follow, Unfollow, Followers, Following | core graph และ Following feed |
| Private graph | Follow Request: send/cancel/accept/decline และ access revocation | จำเป็นต่อ Private Account |
| Search | Users, Drops, Hashtags และ Clubs | ค้นหา people/content/community หลัก |
| Discovery | Trending Topics พร้อมแยก Club engagement ออกจาก Global Trending | discovery และ product rule สำคัญ |
| WYN Top 100 | Public Creator Ranking | core product ที่ Founder ระบุสำหรับ V1 |
| Profile | Avatar, Cover, Display Name, Username, Bio, Website และ counts | identity/profile ขั้นต่ำ |
| Profile content | Drops, ReDrops, Media, Likes tabs พร้อม privacy enforcement | profile discovery ตาม core scope |
| Club foundation | Public/Private, profile, rules, members, Owner/Admin/Moderator/Member | core community และ governance |
| Club membership | Join, Leave, Join Request และ server-side role/membership checks | access control สำหรับ community |
| Club content | Club Drops, Poll, รูปสูงสุด 9 รูป, Pin | core Club participation |
| Club safety | Club moderation และ audit action สำคัญ | เปิด Club อย่างปลอดภัย |
| Ranking isolation | Club engagement ไม่เข้า Global Trending โดยตรง; Club Ranking แยก | hard product invariant |
| Basic Chat | 1:1 Text, Reply, Read/Unread, Message Request | minimum private communication loop |
| Chat safety | Delete own message, Block, Report | safety baseline สำหรับ messaging |
| Notifications | Like, Comment, Reply, ReDrop, Quote ReDrop, Follow, Follow Request, Mention, Chat, Club, System | feedback loops และ system communication |
| Safety | Block, Mute, Report และ Notification Settings | release safety/privacy baseline |
| Reporting | Report User, Drop, Comment, Club, Message | coverage ของ reportable entities |
| Moderation | No Action, Warning, Remove Content, Restrict, Suspend, Ban | operations safety baseline |
| Audit | Audit trail สำหรับ moderation/Admin/Club action สำคัญ | accountability และ investigation |
| Admin separation | WYN Admin เป็น application แยก พร้อม server authorization | ลด privilege exposure |
| Admin operations | User/Drop/Club Management, Report Center, Moderation, Audit Logs | minimum operational control |
| Admin access | OWNER, SUPER_ADMIN, MODERATOR, SUPPORT, ANALYST, CONTENT_ADMIN พร้อม least privilege | role baseline ที่ Founder กำหนด |
| Design/accessibility | Mobile-first, 80–90% white, 10–20% rainbow accent, accessible states | product direction และ usability baseline |
| Localization | Thai primary, structure ready for English | initial market requirement |

## P1 — Important, May Follow Initial Launch

| Area | Feature | เงื่อนไข/หมายเหตุ |
|---|---|---|
| Drop | Poll | หากเลื่อน ต้องไม่แสดง composer option จนกติกา poll อนุมัติครบ |
| Drop | Location | opt-in เท่านั้นและต้องมี privacy copy ชัดเจน |
| Discovery | Topics และ Suggested Users | ต้องผ่าน privacy/safety review ของ suggestion signals |
| Club discovery | Suggested Clubs | ต้องไม่เปิดเผย Private Club ที่ไม่มีสิทธิ์ |
| Club | Club Ranking surface | แยกจาก Global Trending อย่างชัดเจน; Founder ต้องยืนยันสูตร/eligibility |
| Basic Chat | Image และ Share Drop/Profile/Club | ต้อง validate upload และรักษาสิทธิ์ของ shared entity |
| Notifications | Trending | ต้องมี anti-spam/grouping และ opt-out policy |
| WYN Admin | Appeals | Founder ต้องอนุมัติ policy, eligibility และ SLA |
| WYN Admin | System Announcements | ต้องจำกัด role, confirm และ audit |
| WYN Admin | Dashboard และ Basic Analytics | ใช้ข้อมูลขั้นต่ำและจำกัดตาม role |
| WYN Admin | Feature Flags | ต้องมี role control, audit และ safe rollout design |

## P2 — Enhancements

| Area | Feature | คุณค่า |
|---|---|---|
| Feed | คุณภาพของ ranking controls และคำอธิบาย recommendation เพิ่มเติม | เพิ่ม user control/transparency หลัง core feed เสถียร |
| Discovery | การปรับแต่ง suggested users/clubs และ dismiss feedback | เพิ่ม relevance โดยไม่ block core discovery |
| Notifications | Advanced grouping/filter controls ภายในประเภทที่ V1 รองรับ | ลด noise และเพิ่ม control |
| Moderation | Workflow productivity เช่น saved views/queues และ richer internal notes | เพิ่มประสิทธิภาพทีมหลัง baseline ปลอดภัย |
| Analytics | การแตก metric เชิงลึกโดยคง privacy | ช่วยตัดสินใจหลัง KPI และ governance ได้รับอนุมัติ |
| Accessibility | Usability refinements จากการทดสอบกับผู้ใช้จริง | ปรับปรุงต่อเนื่องเหนือ baseline ที่เป็น P0 |

## Release Rule

1. P0 ทุกข้อและข้อกำหนด cross-cutting ที่เกี่ยวข้องต้องผ่านก่อน V1.0.0
2. P1 ที่ไม่รวมใน initial launch ต้องมี owner, milestone และ Founder ยอมรับการเลื่อน
3. P2 ห้ามแย่ง capacity จาก unresolved P0/security finding
4. Future ห้ามถูกนำเข้า backlog ของ V1 โดยปริยาย; ต้องผ่าน product change control
5. Founder Decisions ใน Product Specification ต้องปิดก่อน feature ที่ขึ้นกับ decision นั้นเข้าสู่ technical design/implementation
