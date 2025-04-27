'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

export default function StudentSignupPage() {
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
    phoneNumber: ""  // 電話番号
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
    setShowConfirm(false);
    setIsSubmitting(true);

    const currentTimestamp = new Date().toISOString(); // 現在の日時をISOフォーマットで取得

    const { addressDetail, roomNumber, ...guardianBase } = guardian;
    const guardianToInsert = {
      ...guardianBase,
      address: `${guardian.address} ${addressDetail} ${roomNumber}`, // 住所を繋げずそのまま登録
      created_at: currentTimestamp  // 登録日時を追加
    };

    const { data: guardianData, error: guardianError } = await supabase.from("guardians").insert([guardianToInsert]).select();
    if (guardianError) {
      alert("保護者情報の登録に失敗しました: " + guardianError.message);
      setIsSubmitting(false);
      return;
    }

    const guardianId = guardianData?.[0]?.id;

    const { error: studentError } = await supabase.from("students").insert([{
      ...student,
      guardian_id: guardianId,
      created_at: currentTimestamp  // 登録日時を追加
    }]);
    if (studentError) {
      alert("生徒情報の登録に失敗しました: " + studentError.message);
      setIsSubmitting(false);
      return;
    }

    alert("登録が完了しました");
    router.push("/student/login");
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">生徒・保護者新規登録</h1>

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
        <input placeholder="メールアドレス" value={guardian.email} onChange={e => setGuardian({ ...guardian, email: e.target.value })} className="border p-2 col-span-2" />  {/* メールアドレス追加 */}
        <input placeholder="電話番号（例: 090-1234-5678）" value={guardian.phoneNumber} onChange={e => setGuardian({ ...guardian, phoneNumber: e.target.value })} className="border p-2 col-span-2" />  {/* 電話番号追加 */}
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
        <button className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50" onClick={() => setShowConfirm(true)} disabled={isSubmitting}>確認</button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-lg font-bold mb-2">入力内容の確認</h2>
            <p><strong>保護者:</strong> {guardian.lastName} {guardian.firstName} / {guardian.lastNameKana} {guardian.firstNameKana}</p>
            <p><strong>住所:</strong> {guardian.zipCode} {guardian.address} {guardian.addressDetail} {guardian.roomNumber}</p>
            <p><strong>電話番号:</strong> {guardian.phoneNumber}</p>  {/* 電話番号表示 */}
            <p><strong>メールアドレス:</strong> {guardian.email}</p>
            <p><strong>生徒:</strong> {student.lastName} {student.firstName} / {student.lastNameKana} {student.firstNameKana}</p>
            <p><strong>性別:</strong> {student.gender}</p>
            <p><strong>生年月日:</strong> {student.birthDate}</p>
            <p><strong>学校:</strong> {student.school}</p>
            <p><strong>学年:</strong> {student.grade}</p>
            <div className="flex justify-end mt-4">
              <button onClick={handleRegister} className="bg-green-500 text-white px-4 py-2 mr-2 rounded disabled:opacity-50" disabled={isSubmitting}>
                {isSubmitting ? "登録中..." : "登録する"}
              </button>
              <button onClick={() => setShowConfirm(false)} className="bg-gray-400 text-white px-4 py-2 rounded" disabled={isSubmitting}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
