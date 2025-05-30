import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Student } from "@/app/dashboard/parent/profile/page"; // Student型をインポート

interface StudentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onSave: (student: Student) => void;
}

export function StudentEditModal({ isOpen, onClose, student, onSave }: StudentEditModalProps) {
  const [editedStudent, setEditedStudent] = useState<Student | null>(null);

  useEffect(() => {
    setEditedStudent(student ? { ...student } : null);
  }, [student]);

  if (!isOpen || !editedStudent) return null; // editedStudentがnullの場合は何も表示しない

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setEditedStudent(prev => {
      if (!prev) return null;
      return { ...prev, [id]: value };
    });
  };

  const handleSave = () => {
    if (editedStudent) {
      onSave(editedStudent);
    }
  };

  // 学年の選択肢 (ParentProfileEditからコピー)
  const gradeOptions = [
    { value: 'preschool', label: '未就学' },
    { value: 'elementary_1', label: '小学校1年' },
    { value: 'elementary_2', label: '小学校2年' },
    { value: 'elementary_3', label: '小学校3年' },
    { value: 'elementary_4', label: '小学校4年' },
    { value: 'elementary_5', label: '小学校5年' },
    { value: 'elementary_6', label: '小学校6年' },
    { value: 'junior_high_1', label: '中学校1年' },
    { value: 'junior_high_2', label: '中学校2年' },
    { value: 'junior_high_3', label: '中学校3年' },
    { value: 'high_school_1', label: '高校1年' },
    { value: 'high_school_2', label: '高校2年' },
    { value: 'high_school_3', label: '高校3年' },
    { value: 'other', label: 'その他' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{student?.id ? '生徒情報編集' : '新しい生徒を追加'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* 生徒情報入力フォーム（ParentProfileEditから移植） */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="lastName" className="text-right">姓</Label>
            <Input id="lastName" value={editedStudent.lastName} onChange={handleInputChange} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="firstName" className="text-right">名</Label>
            <Input id="firstName" value={editedStudent.firstName} onChange={handleInputChange} className="col-span-3" required />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="lastNameFurigana" className="text-right">姓（ふりがな）</Label>
            <Input id="lastNameFurigana" value={editedStudent.lastNameFurigana} onChange={handleInputChange} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="firstNameFurigana" className="text-right">名（ふりがな）</Label>
            <Input id="firstNameFurigana" value={editedStudent.firstNameFurigana} onChange={handleInputChange} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="gender" className="text-right">性別</Label>
             <select
                id="gender"
                value={editedStudent.gender}
                onChange={handleInputChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ring-offset-background focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 col-span-3"
                required
              >
               <option value="">選択してください</option>
               <option value="male">男性</option>
               <option value="female">女性</option>
               <option value="other">その他</option>
             </select>
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="birthDate" className="text-right">生年月日</Label>
             <Input
              id="birthDate"
              type="date"
              value={editedStudent.birthDate}
              onChange={handleInputChange}
              className="col-span-3" required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="school" className="text-right">学校名</Label>
            <Input id="school" value={editedStudent.school} onChange={handleInputChange} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="grade" className="text-right">学年</Label>
              <select
                id="grade"
                value={editedStudent.grade}
                onChange={handleInputChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ring-offset-background focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 col-span-3"
                required
              >
               <option value="">選択してください</option>
               {gradeOptions.map(option => (
                   <option key={option.value} value={option.value}>{option.label}</option>
               ))}
             </select>
          </div>

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button type="button" onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 