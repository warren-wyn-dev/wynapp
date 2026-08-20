# WYN V1.0.0 Product Specification

| รายการ | รายละเอียด |
|---|---|
| สถานะ | Draft — รอ Founder Approval |
| เจ้าของเอกสาร | Product Manager |
| ผู้ตรวจสอบ | WYN CTO |
| ตลาดเริ่มต้น | ประเทศไทย |
| ภาษา | ภาษาไทยเป็นหลัก และต้องรองรับการเพิ่มภาษาอังกฤษในอนาคต |
| อายุขั้นต่ำเริ่มต้น | 18 ปี |
| ขอบเขตเอกสาร | Product Specification เท่านั้น ไม่ใช่ technical design |

## 1. Product Summary

WYN V1.0.0 คือแพลตฟอร์มโซเชียลแบบ mobile-first สำหรับผู้ใช้อายุ 18 ปีขึ้นไปในประเทศไทย ผู้ใช้สามารถเผยแพร่ **Drop**, ติดตามผู้ใช้, สนทนาแบบ 1:1, เข้าร่วม **Club** ซึ่งเป็น Community และค้นพบผู้สร้างสรรค์ผ่าน WYN Top 100 ได้ โดยให้ความสำคัญกับความปลอดภัย ความเป็นส่วนตัว การเข้าถึงได้ และการบังคับใช้สิทธิ์จากฝั่ง server

ประสบการณ์ต้องสะอาด ทันสมัย พรีเมียม เป็นมิตร ใช้พื้นที่สีขาว 80–90% และใช้สีรุ้งเป็น accent เพียง 10–20% ไม่ใช่พื้นผิวสีรุ้งทั้งระบบ

## 2. Product Goals และ Success Criteria

### 2.1 Goals

1. ผู้ใช้ใหม่สมัคร เข้าสู่ระบบ ตั้งค่าโปรไฟล์ และเริ่มติดตามผู้ใช้หรือ Club ได้อย่างปลอดภัย
2. ผู้ใช้สร้าง ค้นพบ และมีส่วนร่วมกับ Drop ทั้งในพื้นที่สาธารณะและใน Club ได้
3. ผู้ใช้ควบคุมความเป็นส่วนตัว การแจ้งเตือน และปฏิสัมพันธ์ที่ไม่ต้องการได้
4. ทีมดูแลระบบรับ report ตรวจสอบ ดำเนินมาตรการ และตรวจย้อนหลัง action สำคัญได้ผ่าน WYN Admin ที่แยกจาก Consumer WYN
5. การจัดอันดับและ Trending ต้องไม่ผสม engagement ภายใน Club เข้ากับ WYN Global Trending โดยตรง

### 2.2 V1 Release Outcomes

- P0 ทั้งหมดใน `FEATURE_PRIORITY.md` ผ่าน acceptance criteria และไม่มี CRITICAL security finding ที่ยังไม่แก้ไข
- flow สำคัญใน `USER_FLOWS.md` มี complete, loading, empty, validation, permission-denied และ recoverable-error state ตามความเหมาะสม
- การอ่านหรือแก้ไขข้อมูล private, การจัดการ Club และการใช้ WYN Admin ถูกตรวจสิทธิ์ที่ server ทุกครั้ง
- การลบเนื้อหาเป็น safe soft-delete และไม่ทำให้ข้อมูลที่จำเป็นต่อ moderation/audit สูญหาย
- UI หลักใช้งานบน mobile viewport ได้ รองรับ keyboard, screen reader, focus visibility, contrast และ touch target ที่เหมาะสม

> ค่าเป้าหมายเชิงตัวเลข เช่น activation, retention, latency และ moderation SLA ยังต้องให้ Founder ตัดสินใจก่อนใช้เป็น release KPI

## 3. Users และ Surfaces

### 3.1 User Types

- **Guest:** ดูได้เฉพาะเนื้อหาสาธารณะตาม policy ที่ Founder อนุมัติ; ไม่สามารถ engage หรือเข้าถึงข้อมูล private
- **Registered User:** ผู้ใช้อายุอย่างน้อย 18 ปีที่ผ่าน authentication และใช้งาน Consumer WYN
- **Private Account Owner:** Registered User ที่อนุมัติ follower ก่อนให้เข้าถึงเนื้อหาสำหรับ follower
- **Club Member:** สมาชิก Club ตาม role Owner, Admin, Moderator หรือ Member
- **Admin User:** บุคลากรที่ได้รับ role ใน WYN Admin ตามหลัก least privilege

### 3.2 Product Surfaces

- **Consumer WYN:** พื้นที่สำหรับผู้ใช้ทั่วไป ได้แก่ feed, Drop, engagement, graph, discovery, profile, Club, chat, notification และ privacy/safety
- **WYN Admin:** application แยกจาก Consumer WYN สำหรับ operations และ moderation; session, route และ authorization ต้องไม่พึ่งการซ่อน UI ฝั่ง client

## 4. Functional Requirements

### 4.1 Authentication & Account

**User stories**

- ในฐานะผู้ใช้อายุ 18 ปีขึ้นไป ฉันต้องการสมัครและเข้าสู่ระบบเพื่อใช้ฟีเจอร์ที่ต้องยืนยันตัวตน
- ในฐานะเจ้าของบัญชี ฉันต้องการออกจากระบบและจัดการข้อมูลบัญชีของตนอย่างปลอดภัย

**Requirements / Acceptance criteria**

- ระบบต้องตรวจอายุขั้นต่ำ 18 ปีตามวิธีที่ Founder อนุมัติ และไม่อนุญาตบัญชีที่แจ้งอายุต่ำกว่าเกณฑ์
- username ต้องไม่ซ้ำ; รูปแบบ username, credential method, account recovery และ verification เป็น Founder Decision
- บัญชีใหม่เป็น Public โดยค่าเริ่มต้น และเจ้าของบัญชีเปลี่ยนเป็น Private ได้
- protected action ต้องยืนยันตัวตนและตรวจ authorization ที่ server; error ต้องไม่เปิดเผย credential หรือข้อมูล private
- Logout เป็น P0 และต้อง implement/ทดสอบตาม canonical flow [`UF-03 Logout`](./USER_FLOWS.md#uf-03-logout); การล้าง state หรือ credential เฉพาะที่ client ไม่ถือเป็น Logout สำเร็จ
- เมื่อ Logout สำเร็จ server ต้อง invalidate active session และ credential สำหรับต่ออายุ session ที่ผูกกับ session นั้นก่อนแสดงผลสำเร็จ; credential ดังกล่าวต้องไม่สามารถใช้เข้าถึง protected action หรือสร้าง session ใหม่ได้อีก
- Logout ต้องเป็น idempotent: การส่งคำขอซ้ำหรือ logout session ที่ invalid/หมดอายุแล้วต้องได้ผลลัพธ์เป็น logged-out โดยไม่สร้าง session ใหม่หรือเปิดเผยรายละเอียดของ session
- หาก server ยืนยันการ invalidate ไม่สำเร็จ ระบบต้องไม่แสดงว่า Logout สำเร็จ ต้องนำ credential ออกจาก authenticated state ทันที แสดงสถานะที่ปลอดภัยว่าอาจยังมี active session และให้ผู้ใช้ retry ได้; หากจำเป็นต้องเก็บ credential เพื่อ retry ต้องแยกเก็บอย่างปลอดภัย ใช้ได้เฉพาะส่งคำขอ invalidate เดิม และต้องลบทิ้งเมื่อ server ยืนยันผล ห้ามใช้ credential ดังกล่าวเรียก protected action, ต่ออายุ session หรือ fallback เป็นการล้าง client state เพียงอย่างเดียวแล้วถือว่า logout สำเร็จ
- ต้องมีสถานะ validation, duplicate account/username, invalid credential, locked/restricted account และ recoverable system error

### 4.2 Home

Home มีสอง feed:

- **For You:** เนื้อหาสาธารณะที่ระบบคัดสรรตาม ranking policy ที่จะอนุมัติภายหลัง
- **Following:** Drop ที่ผู้ใช้มีสิทธิ์เห็นจากบัญชีที่ติดตาม รวม ReDrop ตาม policy ที่อนุมัติ

**Acceptance criteria**

- ผู้ใช้สลับ tab ได้โดยเห็น tab ที่กำลังใช้งานชัดเจน
- feed ต้องเคารพ block, mute, private account, removed/restricted content และ moderation decision
- ต้องมี loading, empty, retry/error, refresh และ end-of-feed state
- content จาก Club ต้องไม่เข้าสู่ Global Trending โดยตรง; การปรากฏใน Home ต้องยังคงตรวจ membership/visibility ของ Club

### 4.3 Drop

ผู้ใช้สร้าง Drop แบบข้อความอย่างเดียวหรือแนบรูปภาพได้สูงสุด 9 รูป พร้อม caption, hashtag, mention, external link, poll และ location รวมถึงบันทึก draft, edit และ delete

**Rules / Acceptance criteria**

- จำนวนรูปต่อ Drop สูงสุด 9 รูปและต้องถูกตรวจที่ trusted boundary
- ผู้สร้าง preview, publish, save draft และ discard draft ได้; draft เป็น private ต่อเจ้าของ
- mention และ hashtag ต้องแสดงผลและเชื่อมไปยัง entity ที่ถูกต้องโดยไม่ข้าม privacy/block rules
- external link ต้องแสดงอย่างปลอดภัยและไม่ถูกตีความเป็น trusted content
- poll ต้องบังคับกติกาที่ server; จำนวนตัวเลือก ระยะเวลา การเปลี่ยนคะแนน และการเปิดเผยผลเป็น Founder Decision
- location เป็นข้อมูลที่ผู้ใช้เลือกแนบโดยสมัครใจ; ต้องไม่แนบ location โดยปริยาย
- เจ้าของแก้ไข Drop ได้ภายใน 30 นาทีหลัง publish เท่านั้น; หลังแก้ไขต้องแสดงสถานะ **Edited**
- เจ้าของลบ Drop ของตนได้ด้วย safe soft-delete; เนื้อหาที่ถูกลบต้องไม่แสดงใน surfaces ปกติ แต่เก็บข้อมูลขั้นต่ำที่จำเป็นต่อ audit/moderation ตาม retention policy
- การ edit/delete ต้องตรวจ ownership และสถานะ moderation ที่ server
- ต้องมี validation สำหรับ empty submission, รูปเกินจำนวน, upload ไม่สำเร็จ, content ที่ไม่มีสิทธิ์ mention/view และ edit window หมดอายุ

### 4.4 Engagement

รองรับ Like, Comment, Threaded Reply, ReDrop, Quote ReDrop, Share, Save และ Views

**Acceptance criteria**

- ผู้ใช้ toggle Like และ Save ได้โดยผลลัพธ์ idempotent; Save เป็นข้อมูล private ของผู้ใช้
- Comment และ Threaded Reply ต้องแสดงลำดับ/ความสัมพันธ์ที่เข้าใจได้และเคารพ block, privacy และ moderation
- ReDrop กระจาย Drop ต้นฉบับ; Quote ReDrop เพิ่มข้อความของผู้ ReDrop และคง reference ไปยังต้นฉบับเมื่อผู้ชมยังมีสิทธิ์
- Share รองรับการแชร์ผ่านช่องทางที่ Product รองรับโดยไม่ทำให้ private content กลายเป็น public
- Views ต้องป้องกันการนับซ้ำ/การปั่นตาม policy ที่อนุมัติ; นิยาม view เป็น Founder Decision
- action ทั้งหมดต้องถูกตรวจสิทธิ์และไม่สามารถใช้ direct API เพื่อ engage กับ content ที่มองไม่เห็น ถูกลบ หรือถูกจำกัด

### 4.5 Social Graph

รองรับ Follow, Unfollow, Followers, Following, Follow Request และ Private Account

**Acceptance criteria**

- การ follow บัญชี Public สำเร็จทันที; บัญชี Private สร้าง pending Follow Request
- เจ้าของบัญชี Private accept หรือ decline request ได้; requester ยกเลิก request ได้
- Unfollow และการลบ follower ต้องอัปเดตสิทธิ์การเข้าถึงเนื้อหา private
- รายการ Followers/Following ต้องเคารพ block และ privacy policy
- ระบบต้องป้องกัน duplicate request และ action ต่อบัญชีที่ block กัน

### 4.6 Search & Discovery

รองรับการค้นหา Users, Drops, Hashtags, Topics และ Clubs รวมถึง Trending Topics, Suggested Users และ Suggested Clubs

**Acceptance criteria**

- ผลลัพธ์แบ่งประเภทชัดเจน รองรับ empty/no-result, loading, error และ pagination/continuation
- ผลลัพธ์ต้องไม่เปิดเผย private, blocked, removed, banned หรือ unauthorized entity
- suggestion ต้องมีทาง dismiss ตาม policy ที่อนุมัติ และไม่ใช้ข้อมูล private เกินความจำเป็น
- Global Trending ต้องคำนวณจาก eligible global engagement เท่านั้น; Club engagement ไม่ถูกนำมาคำนวณโดยตรง
- Club discovery และ Club Ranking (ถ้ามี surface ใน V1) ต้องเป็นคนละบริบทกับ Global Trending

### 4.7 WYN Top 100

V1 เป็น **Public Creator Ranking** ที่แสดงผู้สร้างสรรค์ 100 อันดับต่อสาธารณะ

**Acceptance criteria**

- แสดง rank และ creator profile ที่ยัง active และ public/eligible เท่านั้น
- ต้องไม่ทำให้ข้อมูล private หรือ moderation signal ถูกเปิดเผย
- ต้องมีกระบวนการป้องกัน manipulation และ re-evaluation เมื่อ account ถูก restrict, suspend หรือ ban
- สูตร ranking, ช่วงเวลาคำนวณ, cadence, tie-breaker และ eligibility เป็น Founder Decision
- engagement ภายใน Club ต้องไม่ถูกนำไปคิด Global Trending โดยตรง; การนำไปคิด WYN Top 100 หรือไม่ยังต้อง Founder ตัดสินใจ

### 4.8 Profile

Profile รองรับ Avatar, Cover, Display Name, Username, Bio, Website, Followers, Following และ tab Drops, ReDrops, Media, Likes

**Acceptance criteria**

- เจ้าของแก้ไข field ของตนได้ภายใต้ validation และ moderation rules
- username ไม่ซ้ำ; website เป็น external/untrusted link; media upload ต้องผ่าน validation
- Likes tab และการมองเห็นข้อมูล engagement ต้องเป็นไปตาม privacy setting ที่อนุมัติ
- ผู้ชมที่ไม่มีสิทธิ์ต้องไม่เห็น private content แม้เรียก API โดยตรง
- ต้องมี empty states สำหรับแต่ละ tab และสถานะ unavailable สำหรับบัญชี blocked, suspended, banned หรือ removed ตาม policy

### 4.9 Club

Club คือ Community มีประเภท **Public** และ **Private** และมี roles ตามลำดับสิทธิ์ **Owner, Admin, Moderator, Member**

รองรับ Club Profile, Rules, Members, Club Drops, Poll, รูปสูงสุด 9 รูป, Join/Leave, Join Request, Pin และ Moderation

**Acceptance criteria**

- Public Club เข้าร่วมได้ตาม policy; Private Club ต้องใช้ Join Request และการอนุมัติจาก role ที่ได้รับสิทธิ์
- server ต้องตรวจ membership และ role สำหรับทุก protected Club action โดย deny by default
- Owner จัดการ role ที่ได้รับอนุญาตได้; matrix รายละเอียดของ Admin/Moderator และการโอน ownership เป็น Founder Decision
- Club Drop ต้องเคารพกฎ Drop เรื่องรูปสูงสุด 9 รูป, poll, edit, soft-delete และ content safety
- role ที่ได้รับสิทธิ์ pin/unpin และ moderate Club content ได้; action สำคัญต้องมี audit trail
- สมาชิก leave ได้ ยกเว้น Owner ต้องจัดการ ownership ตาม policy ก่อน; การ remove/ban member ต้องไม่เปิดช่อง bypass ด้วย direct API
- Private Club content ต้องไม่แสดงต่อ non-member ใน search, share preview, feed หรือ direct URL
- **Club engagement ต้องเก็บเป็นสัญญาณแยกจาก Global Trending และห้ามนำไปคำนวณ WYN Global Trending โดยตรง**
- Club Ranking และ Global Trending ต้องแยก dataset/context, label และ surface อย่างชัดเจน

### 4.10 Basic Chat

รองรับการสนทนา 1:1: Text, Image, Reply, Read/Unread, Message Request, Delete own message, Block, Report และ Share Drop/Profile/Club

**Acceptance criteria**

- ผู้ใช้ส่งข้อความได้เฉพาะตาม privacy/message policy; ข้อความจากผู้ที่ยังไม่อนุญาตเข้าสู่ Message Request
- ผู้รับ accept/decline request ได้ และ block/report ได้โดยไม่ต้องตอบกลับ
- reply ต้องอ้างข้อความเดิมอย่างปลอดภัย; shared entity ต้องแสดง unavailable หากผู้รับไม่มีสิทธิ์หรือ entity ถูกลบ
- read/unread ต้องสะท้อนสถานะตามกติกาที่อนุมัติ และเคารพ privacy setting
- ผู้ส่งลบข้อความของตนได้ตาม semantics ที่ Founder อนุมัติ; การลบต้องไม่ทำลายหลักฐาน report ที่จำเป็น
- image ต้องผ่าน validation; error ต้องไม่เปิดเผย storage location หรือข้อมูล private

### 4.11 Notifications

รองรับ Like, Comment, Reply, ReDrop, Quote ReDrop, Follow, Follow Request, Mention, Chat, Club, Trending และ System

**Acceptance criteria**

- แสดง read/unread และนำผู้ใช้ไปยัง destination ที่ยังมีสิทธิ์เข้าถึง
- notification ของ entity ที่ถูกลบหรือสิทธิ์เปลี่ยนต้องไม่เปิดเผยเนื้อหาเดิม
- ผู้ใช้ปรับ notification settings ตามประเภทที่รองรับได้ ยกเว้น System ที่จำเป็นตาม policy
- ต้องลด duplicate/noisy notification ตาม grouping policy ที่อนุมัติ

### 4.12 Safety & Privacy

รองรับ Block, Mute, Report, Public/Private Account, Privacy Settings และ Notification Settings

**Acceptance criteria**

- Block ต้องหยุด interaction และการเข้าถึงระหว่างคู่บัญชีในทุก relevant surface รวม search, follow, feed, Club และ chat ตาม policy
- Mute ซ่อน content/notification จากผู้ mute โดยไม่แจ้งเป้าหมาย
- privacy change ต้องมีผลกับ server authorization ไม่ใช่เฉพาะ UI
- settings ต้องมีคำอธิบายผลกระทบ สถานะสำเร็จ/ล้มเหลว และค่า current state ที่ชัดเจน
- report ต้องไม่เปิดเผยตัวผู้รายงานแก่ผู้ถูกรายงานใน Consumer WYN

### 4.13 Moderation

รับ Report ต่อ User, Drop, Comment, Club และ Message

Moderation actions: **No Action, Warning, Remove Content, Restrict, Suspend, Ban**

**Acceptance criteria**

- report ต้องเก็บประเภท entity, reason, context ที่จำเป็น, reporter, status และ timestamps โดยจำกัดผู้เข้าถึง
- moderator เห็นเฉพาะ case ที่ role อนุญาตและดำเนิน action ได้ตาม least privilege
- action สำคัญต้องมี audit trail แบบตรวจย้อนหลังได้ ซึ่งบันทึก actor, action, target, reason, timestamp และผลลัพธ์ โดยไม่เก็บ secret หรือข้อมูลเกินจำเป็น
- Remove Content ใช้ safe soft-delete; Restrict/Suspend/Ban ต้องถูกบังคับใช้ในทุก Consumer และ Admin entry point ที่เกี่ยวข้อง
- No Action ต้องปิด case พร้อมเหตุผล; Warning ต้องบันทึกและส่งการสื่อสารตาม policy
- Appeals รองรับผ่าน WYN Admin; eligibility, SLA และจำนวนครั้ง appeal เป็น Founder Decision

### 4.14 WYN Admin

WYN Admin ต้องเป็น application แยกจาก Consumer WYN รองรับ Dashboard, User Management, Drop Management, Club Management, Report Center, Moderation, Appeals, System Announcements, Audit Logs, Basic Analytics และ Feature Flags

Admin roles: **OWNER, SUPER_ADMIN, MODERATOR, SUPPORT, ANALYST, CONTENT_ADMIN**

**Acceptance criteria**

- ทุก capability ต้องใช้ server-side role/action authorization และ least privilege; การซ่อนเมนูไม่ถือเป็น authorization
- Dashboard/Basic Analytics แสดงเฉพาะข้อมูลที่ role มีสิทธิ์และลดการแสดง personal data
- User, Drop และ Club Management ต้องรองรับค้นหา ตรวจสถานะ และดำเนิน action เฉพาะที่ role อนุญาต
- Report Center เชื่อม report กับ evidence, decision, action และ appeal โดยคง auditability
- System Announcements และ Feature Flags ต้องจำกัด role มี confirmation และ audit trail; rollout rules รายละเอียดเป็น technical design ภายหลัง
- Audit Logs ต้องค้นและตรวจย้อนหลังได้ และผู้ใช้ Admin ทั่วไปแก้ไขหรือลบ log ไม่ได้
- role-permission matrix, admin authentication requirements และ retention เป็น Founder Decision/security design gate

## 5. Cross-cutting Product Requirements

### 5.1 Authorization, Privacy และ Data Safety

- server ต้อง enforce ownership, visibility, membership, role และ moderation state ทุกครั้ง
- deny by default และไม่เชื่อ client-provided identity, counts, role, visibility หรือ ranking signal
- safe soft-delete ใช้กับ user-generated content ที่ลบ โดยซ่อนจาก product surfaces และรักษาข้อมูลเท่าที่จำเป็นตาม retention/legal policy
- share, notification, search index, cache และ direct URL ต้องไม่ bypass privacy/block/removal
- action สำคัญของ moderation, Admin, Club role/pin และ feature flag ต้อง audit ได้

### 5.2 UX และ Accessibility

- ออกแบบ mobile-first และ responsive; core flow ต้องไม่พึ่ง hover
- พื้นผิวใช้สีขาว 80–90% และ rainbow accent 10–20%; สีไม่ใช่วิธีเดียวในการสื่อสถานะ
- รองรับ semantic labels, keyboard navigation, visible focus, readable contrast, scalable text และ touch targets
- ทุกหน้าหลักต้องพิจารณา loading, skeleton (เมื่อเหมาะสม), empty, validation, permission denied, offline/retry และ unexpected error
- ภาษาไทยเป็น primary copy; โครงสร้างข้อความต้องพร้อมแยก translation และรองรับ English โดยไม่ hard-code layout กับความยาวภาษาไทย

### 5.3 Integrity และ Ranking Separation

- Global Trending ใช้เฉพาะ engagement ที่ eligible ใน global/public context
- Club engagement ต้องมี namespace/context แยกและไม่ส่งเข้า Global Trending โดยตรง
- Club Ranking (หากเปิดใช้) ต้องคำนวณและนำเสนอแยกจาก Global Trending
- count และ ranking signal ต้องคำนวณจาก trusted events พร้อมกลไกป้องกัน manipulation ที่กำหนดใน technical design

## 6. Dependencies และ Handoffs

หลัง Founder อนุมัติ Product Specification:

1. CTO ตรวจ scope, feasibility, risk และ Founder approval gates
2. Software Architect ออกแบบ boundaries, authorization, ranking separation และ Admin separation
3. UI/UX จัดทำ information architecture, states และ accessible mobile-first design
4. Database Engineer ออกแบบ ownership, constraints, soft-delete, audit และ retention
5. QA & Security จัดทำ test plan ครอบคลุม cross-user access, direct API bypass, privacy, Club isolation, engagement manipulation, upload, chat/report และ Admin privilege escalation

เอกสารนี้ไม่อนุญาตให้เริ่ม implementation, database, migration, framework installation หรือ deployment ก่อนผ่าน gate ที่เกี่ยวข้อง

## 7. Founder Decisions Required

| ID | Product decision | เหตุผล/ผลกระทบ |
|---|---|---|
| FD-01 | วิธีสมัคร/เข้าสู่ระบบ, verification, recovery และเกณฑ์ตรวจอายุ 18+ | กระทบ conversion, abuse, privacy และ security architecture |
| FD-02 | รูปแบบ username และข้อจำกัดการเปลี่ยน username | กระทบ identity, mention และ impersonation |
| FD-03 | Guest สามารถเห็น surface/ข้อมูลสาธารณะใดบ้าง | กระทบ discovery, privacy และ SEO |
| FD-04 | นิยาม Views และกติกาป้องกันการนับซ้ำ | กระทบตัวเลขสาธารณะ, ranking และ abuse |
| FD-05 | Poll: จำนวนตัวเลือก, ระยะเวลา, เปลี่ยน vote ได้หรือไม่, anonymous/result visibility | กระทบ UX และ integrity |
| FD-06 | For You, Trending Topics และ suggestion principles | กระทบ safety, fairness และ personalization |
| FD-07 | WYN Top 100: formula, period, cadence, eligibility, tie-breaker และ Club engagement eligibility | กระทบความน่าเชื่อถือและ manipulation |
| FD-08 | Club role-permission matrix, ownership transfer, member removal/ban และผู้อนุมัติ Join Request | กระทบ authorization และ governance |
| FD-09 | ใครสร้าง Club ได้ และ Public Club ใช้ auto-join หรือ approval | กระทบ abuse และ moderation load |
| FD-10 | Chat policy: ใครส่ง request ได้, read receipt privacy และ semantics ของ Delete own message | กระทบ privacy, harassment และ evidence |
| FD-11 | Block semantics เมื่อผู้ใช้พบกันใน Club เดียวกัน | ต้องรักษาความปลอดภัยโดยไม่ทำลาย Club context |
| FD-12 | Profile Likes tab visibility และรายการ Followers/Following visibility | กระทบ privacy expectations |
| FD-13 | Report taxonomy, moderation SLA, appeal eligibility/process และ user notice | กระทบ fairness และ operations |
| FD-14 | Admin role-permission matrix, stronger authentication และ audit/UGC retention | เป็น security-policy decision ที่ต้องอนุมัติ |
| FD-15 | KPI เป้าหมายและ non-functional targets สำหรับ V1 | ใช้ตัดสิน release readiness และ capacity |

## 8. Risks และ CTO Review Notes

- **High — Scope density:** V1 ครอบคลุม feed, Club, chat, ranking และ Admin; CTO แนะนำให้ P0 เป็น release contract และกำหนด P1/P2 milestone แยกก่อน implementation
- **High — Authorization complexity:** Private account, Club roles, block และ Admin roles ซ้อนกัน ต้องมี permission model และ negative authorization tests ก่อนเขียน application code
- **High — Ranking integrity:** ต้องแยก Club signals ออกจาก Global Trending ตั้งแต่ event/data design และทดสอบ manipulation
- **High — Moderation/privacy:** Message evidence, soft-delete, appeals และ audit retention ต้องมี Founder-approved policy
- **Medium — Localization/accessibility:** ภาษาไทยต้องเป็น primary โดยไม่ปิดทาง English และ UI ต้องทดสอบข้อความยาว/ขนาดตัวอักษร
- **Review status:** CTO review ยังไม่ถือว่าอนุมัติจนกว่า Founder ตอบ Founder Decisions และอนุมัติ Product Specification ฉบับนี้

## 9. Scope References

- ลำดับความสำคัญ: [`FEATURE_PRIORITY.md`](./FEATURE_PRIORITY.md)
- Flow หลัก: [`USER_FLOWS.md`](./USER_FLOWS.md)
- สิ่งที่ไม่อยู่ใน V1: [`OUT_OF_SCOPE.md`](./OUT_OF_SCOPE.md)
