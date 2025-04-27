'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

export default function StudentRegisterPage() {
  const router = useRouter();
  const supabase = useSupabaseClient();

  const [guardian, setGuardian] = useState({
    lastName: "",
    firstName: "",
    lastNameKana: "",
    firstNameKana: "",
    zipCode: "",
    address: "",
    addressDetail: "",
    roomNumber: "",
    email: "",
    phoneNumber: "",
  });

  const [student, setStudent] = useState({
    lastName: "",
    firstName: "",
    lastNameKana: "",
    firstNameKana: "",
    gender: "",
    school: "",
    grade: "",
    birthDate: ""
  });

  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAddressFromZip = async (zip: string) => {
    if (!zip || zip.length < 7) return;
    const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zip.replace("-", "")}`);
    const data = await response.json();
    if (data?.results?.length > 0) {
      const result = data.results[0];
      const fullAddress = `${result.address1}${result.address2}${result.address3}`;
      setGuardian(prev => ({ ...prev, address: fullAddress }));
    }
  };

  const handleRegister = async () => {
    if (isSubmitting) return; // 連打防止（追加）
    
    setIsSubmitting(true); // 最初に確実に無効化！
    setShowConfirm(false);
  
    const currentTimestamp = new Date().toISOString();
  
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
  
    if (userError || !user) {
      alert("ログイン情報が確認できません。再度ログインしてください。");
      setIsSubmitting(false);
      return;
    }
  
    const authUserId = user.id;
  
    // 1. 保護者情報登録
    const { addressDetail, roomNumber, ...guardianBase } = guardian;
    const guardianToInsert = {
      ...guardianBase,
      address: guardian.address,
      address_detail: addressDetail,
      room_number: roomNumber,
      created_at: currentTimestamp,
      user_id: authUserId,
    };
  
    const { data: guardianData, error: guardianError } = await supabase
      .from("guardians")
      .insert([guardianToInsert])
      .select();
  
    if (guardianError) {
      alert("保護者情報の登録に失敗しました: " + guardianError.message);
      setIsSubmitting(false);
      return;
    }
  
    const guardianId = guardianData?.[0]?.id;
  
    if (!guardianId) {
      alert("保護者情報の登録に失敗しました。（IDが取得できません）");
      setIsSubmitting(false);
      return;
    }
  
    // 2. 生徒情報登録
    const studentToInsert = {
      ...student,
      user_id: authUserId,
      guardian_id: guardianId,
      created_at: currentTimestamp,
    };
  
    const { error: studentError } = await supabase
      .from("students")
      .insert([studentToInsert]);
  
    if (studentError) {
      alert("生徒情報の登録に失敗しました: " + studentError.message);
      setIsSubmitting(false);
      return;
    }
  
    alert("プロフィール登録が完了しました。");
    router.push("/student/dashboard");
  };
  
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">生徒・保護者プロフィール登録</h1>

      <h2 className="text-xl font-semibold mt-6 mb-2">保護者情報</h2>
      <div className="grid grid-cols-2 gap-4">
        <input placeholder="姓" value={guardian.lastName} onChange={e => setGuardian({ ...guardian, lastName: e.target.value })} className="border p-2" />
        <input placeholder="名" value={guardian.firstName} onChange={e => setGuardian({ ...guardian, firstName: e.target.value })} className="border p-2" />
        <input placeholder="せい（ふりがな）" value={guardian.lastNameKana} onChange={e => setGuardian({ ...guardian, lastNameKana: e.target.value })} className="border p-2" />
        <input placeholder="めい（ふりがな）" value={guardian.firstNameKana} onChange={e => setGuardian({ ...guardian, firstNameKana: e.target.value })} className="border p-2" />
        <input placeholder="郵便番号（例: 123-4567）" value={guardian.zipCode} onChange={e => setGuardian({ ...guardian, zipCode: e.target.value })} onBlur={() => fetchAddressFromZip(guardian.zipCode)} className="border p-2" />
        <input placeholder="住所（都道府県・市区町村）" value={guardian.address} onChange={e => setGuardian({ ...guardian, address: e.target.value })} className="border p-2" />
        <input placeholder="番地・建物名" value={guardian.addressDetail} onChange={e => setGuardian({ ...guardian, addressDetail: e.target.value })} className="border p-2 col-span-2" />
        <input placeholder="部屋番号" value={guardian.roomNumber} onChange={e => setGuardian({ ...guardian, roomNumber: e.target.value })} className="border p-2 col-span-2" />
        <input placeholder="メールアドレス" value={guardian.email} onChange={e => setGuardian({ ...guardian, email: e.target.value })} className="border p-2 col-span-2" />
        <input placeholder="電話番号（例: 090-1234-5678）" value={guardian.phoneNumber} onChange={e => setGuardian({ ...guardian, phoneNumber: e.target.value })} className="border p-2 col-span-2" />
      </div>

      <h2 className="text-xl font-semibold mt-6 mb-2">生徒情報</h2>
      <div className="grid grid-cols-2 gap-4">
        <input placeholder="姓" value={student.lastName} onChange={e => setStudent({ ...student, lastName: e.target.value })} className="border p-2" />
        <input placeholder="名" value={student.firstName} onChange={e => setStudent({ ...student, firstName: e.target.value })} className="border p-2" />
        <input placeholder="せい（ふりがな）" value={student.lastNameKana} onChange={e => setStudent({ ...student, lastNameKana: e.target.value })} className="border p-2" />
        <input placeholder="めい（ふりがな）" value={student.firstNameKana} onChange={e => setStudent({ ...student, firstNameKana: e.target.value })} className="border p-2" />
        <select value={student.gender} onChange={e => setStudent({ ...student, gender: e.target.value })} className="border p-2 col-span-2">
          <option value="">性別を選択</option>
          <option value="男">男</option>
          <option value="女">女</option>
          <option value="その他">その他</option>
        </select>
        <input placeholder="学校名" value={student.school} onChange={e => setStudent({ ...student, school: e.target.value })} className="border p-2 col-span-2" />
        <select value={student.grade} onChange={e => setStudent({ ...student, grade: e.target.value })} className="border p-2 col-span-2">
          <option value="">学年を選択</option>
          {["小学1年生", "小学2年生", "小学3年生", "小学4年生", "小学5年生", "小学6年生",
            "中学1年生", "中学2年生", "中学3年生",
            "高校1年生", "高校2年生", "高校3年生"].map(grade => <option key={grade} value={grade}>{grade}</option>)}
        </select>
        <input type="date" placeholder="生年月日" value={student.birthDate} onChange={e => setStudent({ ...student, birthDate: e.target.value })} className="border p-2 col-span-2" />
      </div>

      <div className="mt-6">
        <button className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400" disabled={isSubmitting} onClick={handleRegister}>
          {isSubmitting ? "登録中..." : "登録する"}
        </button>
      </div>
    </div>
  );
}
