# WYN V1.0.0 Out of Scope

**Owner:** Product Manager

**Reviewer:** WYN CTO
**Status:** Draft — รอ Founder Approval

## Purpose

เอกสารนี้เป็นขอบเขตเชิงลบของ WYN V1.0.0 รายการด้านล่างเป็น **Future** และห้ามถูกออกแบบหรือ implement เป็นส่วนหนึ่งของ V1 โดยปริยาย การนำรายการใดกลับเข้าสู่ scope ต้องผ่าน Product Manager impact assessment, CTO review และ Founder approval ตาม change control

## Future — Not in V1

| Capability | V1 boundary |
|---|---|
| WYN Shop | ไม่มี storefront, catalog, cart หรือ commerce workflow |
| Marketplace | ไม่มี buyer/seller marketplace, listing หรือ transaction workflow |
| Payment | ไม่มีการรับ/จ่ายเงิน, wallet, payout, billing หรือ payment-provider integration |
| WYN Pop | ไม่รวม product/module WYN Pop ใน V1 |
| WYN AI / ZEN | ไม่มี AI assistant, generative feature หรือ ZEN experience |
| Live Streaming | ไม่มีการสร้าง รับชม หรือ moderate live stream |
| Video Call | ไม่มีการโทรวิดีโอใน chat หรือ surface อื่น |
| Group Chat | Basic Chat จำกัดเฉพาะ 1:1; ไม่มีห้องสนทนาหลายคน |
| Advanced Creator Economy | ไม่มี subscription, tipping, paid content, revenue share, monetization dashboard หรือ creator payout |

## Guardrails

- External Link ใน Drop ไม่เท่ากับ Shop, Marketplace หรือ Payment และต้องไม่มี in-app transaction
- Share Drop/Profile/Club ใน Basic Chat ไม่ขยาย scope ไปสู่ Group Chat หรือ Video Call
- WYN Top 100 เป็น public creator ranking เท่านั้น ไม่สร้าง monetization entitlement
- Basic Analytics ใน WYN Admin มีไว้เพื่อ operations/product health ตามสิทธิ์ ไม่ใช่ creator economy analytics
- Feature Flags ใช้ควบคุมฟีเจอร์ที่อนุมัติแล้วเท่านั้น ไม่ใช่ช่องทางซ่อน Future feature ที่ยังไม่ได้อนุมัติ
- การกล่าวถึงความพร้อมรองรับ English หมายถึง localization-ready architecture/copy structure ไม่ใช่การรับรอง English launch ใน V1

## Re-entry Criteria

Future capability จะกลับมาพิจารณาได้เมื่อ Founder ร้องขอหรืออนุมัติอย่างชัดเจน และต้องมีอย่างน้อย:

1. PRD และ acceptance criteria แยก
2. ผลกระทบต่อ safety, privacy, legal/compliance, moderation และ operations
3. CTO/Architecture review และ cost/dependency assessment
4. priority เทียบกับ P0/P1 ที่ยังค้าง
5. Founder approval สำหรับ scope และ change-controlled decision ที่เกี่ยวข้อง

จนกว่าจะครบเกณฑ์ดังกล่าว รายการเหล่านี้ต้องคงสถานะ **Future / Out of Scope V1**
