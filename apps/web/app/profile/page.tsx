import { MediaPicker } from '../components/media-picker';
export default function Page() {
  return (
    <section className="wyn-card">
      <h1>Profile</h1>
      <p>จัดการรูปโปรไฟล์ที่ผ่านการตรวจสอบความปลอดภัยก่อนเผยแพร่</p>
      <MediaPicker purpose="PROFILE_AVATAR" label="เลือกรูปประจำตัว" />
      <MediaPicker purpose="PROFILE_COVER" label="เลือกรูปหน้าปก" />
    </section>
  );
}
