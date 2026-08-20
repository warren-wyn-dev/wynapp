# WYN V1.0.0 User Flows

**Owner:** Product Manager

**Reviewer:** WYN CTO
**Status:** Draft — รอ Founder Approval

## Flow Conventions

- ทุก protected step ต้องตรวจ authentication และ authorization ที่ server
- ทุก flow ต้องมี loading, validation, permission-denied และ recoverable-error state ตามความเหมาะสม
- ทุก surface ต้องใช้ privacy, block, mute, moderation และ soft-delete state ล่าสุด
- ชื่อปุ่ม/copy เป็นแนวทาง product; final Thai copy ผ่าน UI/UX review

## UF-01 Register

**Precondition:** ผู้ใช้ยังไม่มี session

**Success:** สร้างบัญชีอายุ 18+ และเข้าสู่ onboarding/account-ready state

1. ผู้ใช้เลือก “สมัครใช้งาน”
2. ระบบแสดงข้อมูล/credential ตาม authentication method ที่ Founder อนุมัติ พร้อมวันเกิดหรือ age assurance
3. ผู้ใช้กรอกข้อมูล ยอมรับ terms/privacy ที่จำเป็น และ submit
4. server ตรวจรูปแบบ, uniqueness, eligibility อายุ 18+, abuse controls และ consent
5. หากต้อง verification ระบบส่งและยืนยันตามช่องทางที่อนุมัติ
6. ระบบสร้างบัญชีเป็น **Public โดยค่าเริ่มต้น** และสร้าง authenticated session
7. ผู้ใช้เข้าสู่ขั้นตั้งค่า profile หรือ Home

**Exceptions:** อายุต่ำกว่า 18 ถูกปฏิเสธ; username/account ซ้ำ; verification หมดอายุ; rate limit; network/server error ต้อง retry ได้โดยไม่สร้างบัญชีซ้ำ

## UF-02 Login

1. ผู้ใช้กรอก credential ตามวิธีที่อนุมัติ
2. server ตรวจ credential และสถานะบัญชี
3. หากสำเร็จ ระบบสร้าง session และพาไป Home/จุดหมายเดิมที่มีสิทธิ์
4. หากไม่สำเร็จ แสดง error ที่ไม่บอกว่า account ใดมีอยู่เกินความจำเป็น

**Exceptions:** invalid credential, verification/recovery required, restricted/suspended/banned account, rate limit และ system error

## UF-03 Logout

**Precondition:** ผู้ใช้มีหรือเคยมี active session บนอุปกรณ์

**Success:** active session และ credential สำหรับต่ออายุ session ที่ผูกกับ session นั้นถูก invalidate ที่ server และไม่สามารถใช้กับ protected action หรือสร้าง session ใหม่ได้

1. ผู้ใช้เลือก “ออกจากระบบ”
2. client ส่งคำขอ Logout พร้อม session credential ไปยัง server และเข้าสู่ loading state โดยป้องกันการ submit ซ้ำที่ไม่จำเป็น
3. server invalidate active session และ credential สำหรับต่ออายุ session ที่ผูกกับ session นั้น
4. server ตอบผลแบบ idempotent: คำขอซ้ำ หรือ session ที่ invalid/หมดอายุแล้ว ให้ผลเป็น logged-out โดยไม่สร้าง session ใหม่และไม่เปิดเผยรายละเอียดของ session
5. หลัง server ยืนยันผล client ล้าง credential และข้อมูล private ที่ cache ไว้บนอุปกรณ์ แล้วพาผู้ใช้ไปยัง signed-out surface
6. protected request และการพยายามต่ออายุ session ด้วย credential เดิมหลัง Logout ต้องถูก server ปฏิเสธ

**Failure behavior:** หาก network/server error ทำให้ยืนยันการ invalidate ไม่ได้ client ต้องล้าง credential ออกจากอุปกรณ์เท่าที่ทำได้ แต่ต้องไม่แสดงว่า Logout สำเร็จ; แสดงสถานะปลอดภัยว่า session อาจยัง active พร้อม Retry โดยไม่เปิดเผย credential/session detail และ retry ต้องไม่ทำให้เกิด session ใหม่

**P0 verification scenarios:**

- **Successful invalidation:** หลังได้รับผลสำเร็จ การเรียก protected action และการต่ออายุ session ด้วย credential เดิมต้องถูกปฏิเสธ
- **Idempotent replay:** การส่ง Logout ซ้ำด้วย credential เดิม รวมถึงกรณี session หมดอายุหรือถูก invalidate ไปแล้ว ต้องยังได้สถานะ logged-out โดยไม่สร้าง session/credential ใหม่และไม่เปิดเผยว่า session เคยมีอยู่หรือไม่
- **Unconfirmed invalidation:** เมื่อจำลอง network timeout หรือ server failure ก่อนยืนยันผล UI ต้องไม่แสดง success, ต้องไม่พาผู้ใช้กลับเข้า authenticated surface ด้วย credential เดิม และต้องแสดงคำเตือนกับ Retry ที่ปลอดภัย

## UF-04 Create Drop

1. ผู้ใช้เปิด composer
2. เพิ่มข้อความ/caption และเลือก hashtag, mention, external link, poll, location หรือรูป 0–9 รูป
3. ระบบ validate แบบทันทีโดยไม่ถือว่า client validation เพียงพอ
4. ผู้ใช้เลือก Save Draft หรือ Publish
5. ถ้า Save Draft ระบบบันทึกเป็น private และกลับมาแก้ไขได้เฉพาะเจ้าของ
6. ถ้า Publish server ตรวจสิทธิ์, content, link/media, จำนวนรูปสูงสุด 9 และกติกา poll/location
7. ระบบเผยแพร่ Drop และแสดง success state

**Exceptions:** empty Drop, รูปเกิน 9, upload บางรูปผิดพลาด, mention ไม่มีสิทธิ์, poll invalid, connectivity loss; ต้องไม่ publish ซ้ำจากการ retry

**Edit/Delete branch:** เจ้าของเปิดเมนู → Edit ได้ภายใน 30 นาที → save แล้วแสดง Edited; หรือ Delete → confirm → safe soft-delete และหายจาก normal surfaces

## UF-05 View Feed

1. ผู้ใช้เข้า Home และเห็น For You เป็น tab ที่กำหนดตาม approved UX
2. server ส่งเฉพาะ Drop ที่ผู้ใช้มีสิทธิ์ โดยกรอง block, mute, privacy และ moderation
3. ผู้ใช้เลื่อน feed, refresh และสลับ For You/Following
4. ระบบรักษาตำแหน่ง/โหลดหน้าถัดไปตาม UX design
5. ผู้ใช้เปิด Drop หรือ engage ได้หากยังมีสิทธิ์

**States:** skeleton/loading, empty Following พร้อมคำแนะนำที่ปลอดภัย, retry error, end of feed, content unavailable ระหว่างเปิด; Club content ต้องคง visibility และไม่ป้อน Global Trending โดยตรง

## UF-06 Follow / Unfollow

1. ผู้ใช้เปิด profile ที่ไม่ block กัน
2. ถ้าเป็น Public เลือก Follow → server สร้าง relation → ปุ่มเป็น Following
3. ถ้าเป็น Private ให้ไป UF-14
4. ผู้ใช้เลือก Unfollow และยืนยันเมื่อ UX กำหนด
5. server ยกเลิก relation และ revoke private access ที่อาศัย relation นั้น

**Exceptions:** self-follow, duplicate action, blocked user, target unavailable และ race เมื่อ privacy เปลี่ยน

## UF-07 Comment และ Threaded Reply

1. ผู้ใช้เปิด Drop ที่มีสิทธิ์และเปิด comments
2. กรอก Comment หรือเลือก Reply ใต้ comment
3. server ตรวจ visibility, block, moderation และ content validity
4. ระบบสร้าง comment/reply ใน thread และแจ้งผู้เกี่ยวข้องตาม settings
5. หากต้นทางถูกลบ/ปิดสิทธิ์ก่อน submit ระบบไม่สร้าง comment และแจ้งเหตุอย่างปลอดภัย

## UF-08 ReDrop / Quote ReDrop

1. ผู้ใช้เลือก ReDrop บน Drop ที่มีสิทธิ์
2. เลือก ReDrop ทันที หรือ Quote ReDrop
3. สำหรับ Quote ผู้ใช้เพิ่มข้อความและ submit ผ่าน validation แบบ Drop
4. server ตรวจสิทธิ์ต้นฉบับและสร้าง reference
5. ระบบแสดงใน surface ที่เหมาะสมและส่ง notification ตาม settings

**Exceptions:** ต้นฉบับ private/removed ระหว่าง flow, ผู้สร้าง block ผู้ใช้, duplicate ReDrop; reference ต้องไม่เปิดเผยเนื้อหาแก่ผู้ไม่มีสิทธิ์

## UF-09 Join Club

1. ผู้ใช้เปิด Club Profile
2. server แสดงข้อมูลตาม Public/Private visibility
3. Public Club: ผู้ใช้เลือก Join → server ตรวจ eligibility → เป็น Member
4. Private Club: ผู้ใช้เลือก Request to Join → สร้าง pending request
5. role ที่ได้รับสิทธิ์ accept/decline; เมื่อ accept ผู้ขอเป็น Member และได้รับ notification
6. Member เลือก Leave; Owner ต้องทำ ownership step ที่ policy กำหนดก่อน leave

**Exceptions:** blocked/banned member, duplicate request, Club restricted/removed, role ไม่มีสิทธิ์อนุมัติ

## UF-10 Create Club Drop

**Precondition:** ผู้ใช้เป็นสมาชิกและ role/policy อนุญาตให้ post

1. ผู้ใช้เปิด composer ภายใน Club
2. เพิ่ม text/poll/รูปสูงสุด 9 รูปตาม Club Rules
3. server ตรวจ membership, role, Club state, rules และ Drop validation
4. ระบบ publish ใน Club context เท่านั้น
5. engagement ถูกบันทึกใน Club context และ **ไม่ส่งเข้า Global Trending โดยตรง**
6. role ที่ได้รับสิทธิ์ pin หรือ moderate ได้ โดย action สำคัญถูก audit

## UF-11 Send Message

1. ผู้ใช้เปิด profile หรือ existing 1:1 conversation
2. server ตรวจ block และ message policy
3. หากยังไม่ได้รับอนุญาต ข้อความแรกเข้า Message Request; ผู้รับ accept, decline, block หรือ report ได้
4. ใน accepted conversation ผู้ใช้ส่ง Text/Image, Reply หรือ Share Drop/Profile/Club
5. server validate content/media และสิทธิ์ shared entity แล้วส่ง message
6. ระบบอัปเดต read/unread ตาม privacy policy
7. ผู้ส่งเลือก Delete own message; ระบบใช้ semantics ที่อนุมัติและรักษา report evidence ที่จำเป็น

**Exceptions:** blocked mid-flow, image invalid, entity ไม่มีสิทธิ์/ถูกลบ, delivery failure และ duplicate retry

## UF-12 Report Content

ใช้กับ User, Drop, Comment, Club และ Message

1. ผู้ใช้เลือก Report จาก entity
2. ระบบแสดง reason taxonomy และช่อง context ตาม policy
3. ผู้ใช้ submit; server ตรวจ authentication, entity และ rate/abuse controls
4. ระบบสร้าง report แบบ confidential และแสดง confirmation โดยไม่สัญญาผลลัพธ์ที่ยังไม่ตรวจ
5. WYN Admin นำ report เข้า Report Center ให้ role ที่มีสิทธิ์
6. ผู้ดูแลตรวจ evidence และเลือก No Action, Warning, Remove Content, Restrict, Suspend หรือ Ban
7. ระบบ enforce action, บันทึก audit trail และแจ้งผล/appeal ตาม policy

**Exceptions:** entity ถูกลบแล้วแต่มี evidence, duplicate report, reporter ถูก block (ยังต้อง report ได้เมื่อมี context ที่เข้าถึงโดยชอบ), upload/context failure

## UF-13 Create Club

1. ผู้ใช้ที่ eligible เลือก Create Club
2. กรอก Club name, profile, Public/Private, description และ Rules
3. server validate eligibility, uniqueness/content และ abuse controls
4. ระบบสร้าง Club และกำหนดผู้สร้างเป็น Owner
5. Owner เชิญ/รับสมาชิกและกำหนด role ตาม permission matrix

**Founder Decision dependency:** eligibility ในการสร้าง Club, uniqueness rule, creation limit และ moderation pre-check

## UF-14 Private Account Follow Request

1. เจ้าของบัญชีเปิด Privacy Settings และเปลี่ยน Public → Private
2. server บันทึก privacy; follower เดิมได้รับผลตาม policy ที่ Founder อนุมัติ
3. ผู้ขอเปิด profile และเลือก Follow
4. server สร้าง pending request โดยไม่เปิด private content
5. เจ้าของเห็น notification/request list และเลือก Accept หรือ Decline
6. Accept → สร้าง follower relation และให้สิทธิ์ตาม policy; Decline → ปิด request โดยไม่สร้าง relation
7. ผู้ขอยกเลิก pending request ได้; เจ้าของ remove follower ได้ภายหลัง

**Exceptions:** duplicate request, block ระหว่าง pending, target กลับเป็น Public, account unavailable; server ต้อง resolve race โดยไม่ให้สิทธิ์เกินควร

## UF-15 Block / Mute

1. ผู้ใช้เลือก Block หรือ Mute จาก profile/content/chat
2. ระบบอธิบายผลกระทบและขอ confirmation สำหรับ Block
3. server บันทึก action และใช้กับ search, graph, feed, notification, Club และ chat ตาม policy
4. Mute ซ่อน content/notification โดยไม่แจ้งเป้าหมาย
5. ผู้ใช้จัดการรายการ blocked/muted จาก Privacy Settings ได้

## UF-16 Admin Moderation และ Appeal

1. Admin user เข้าสู่ WYN Admin application แยก
2. server ตรวจ admin session และ role/action permission
3. ผู้มีสิทธิ์เปิด report/evidence และประวัติ target เท่าที่จำเป็น
4. เลือก action, reason และ scope; destructive/high-impact action ต้องมี confirmation ตาม design
5. server ตรวจสิทธิ์ซ้ำ ดำเนินการ และ append audit trail
6. หาก eligible ผู้ใช้ยื่น appeal; case ส่งให้ role ที่ policy กำหนด
7. ผู้ตรวจ appeal ยืนยันหรือแก้ decision และระบบ audit/notify

**Security cases:** direct API bypass, privilege escalation, self-approval/conflict policy, stale evidence, concurrent decision และ log tampering ต้องถูกปฏิเสธ/ตรวจพบ

## Flow Traceability

| Flow | Primary areas |
|---|---|
| UF-01–03 | Authentication & Account |
| UF-04 | Drop |
| UF-05 | Home, Discovery |
| UF-06, UF-14 | Social Graph, Privacy |
| UF-07–08 | Engagement |
| UF-09–10, UF-13 | Club |
| UF-11 | Basic Chat |
| UF-12, UF-16 | Safety, Moderation, WYN Admin |
| UF-15 | Safety & Privacy |
