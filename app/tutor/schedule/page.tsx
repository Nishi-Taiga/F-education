  // シフト情報を取得
  const fetchShifts = async (tutorId: number) => {
    try {
      const { data, error } = await supabase
        .from('tutor_shifts')
        .select('*')
        .eq('tutor_id', tutorId)
        .order('date', { ascending: true });
        
      if (error) {
        throw error;
      }
      
      console.log("Fetched shifts:", data);
      
      // シフトデータを整形
      const formattedShifts = data.map(shift => ({
        id: shift.id,
        date: new Date(shift.date),
        startTime: shift.start_time,
        endTime: shift.end_time,
        isBooked: shift.is_booked,
      }));
      
      setShifts(formattedShifts);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      toast({
        title: "エラー",
        description: "シフト情報の取得に失敗しました",
        variant: "destructive",
      });
    }
  };
  
  // シフト保存
  const handleSaveShift = async () => {
    if (!selectedDate || !startTime || !endTime || !tutorProfile) {
      toast({
        title: "入力エラー",
        description: "日付と時間を入力してください",
        variant: "destructive",
      });
      return;
    }
    
    // 開始時間が終了時間より後の場合
    if (startTime >= endTime) {
      toast({
        title: "入力エラー",
        description: "終了時間は開始時間より後の時間を設定してください",
        variant: "destructive",
      });
      return;
    }
    
    setSaveLoading(true);
    
    try {
      if (!isRecurring) {
        // 単発シフトの保存
        await saveSingleShift(selectedDate, startTime, endTime);
      } else {
        // 繰り返しシフトの保存
        if (!recurringEndDate || recurringDays.length === 0) {
          toast({
            title: "入力エラー",
            description: "繰り返し設定を入力してください",
            variant: "destructive",
          });
          return;
        }
        
        await saveRecurringShifts(selectedDate, recurringEndDate, recurringDays, startTime, endTime);
      }
      
      toast({
        title: "シフトを保存しました",
        description: "シフト情報が正常に保存されました",
      });
      
      // モーダルを閉じてデータをリロード
      setShowAddShiftModal(false);
      if (tutorProfile) {
        await fetchShifts(tutorProfile.id);
      }
      
      // フォームをリセット
      resetShiftForm();
    } catch (error: any) {
      console.error("Error saving shift:", error);
      toast({
        title: "エラー",
        description: error.message || "シフト情報の保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setSaveLoading(false);
    }
  };
  
  // 単発シフトの保存
  const saveSingleShift = async (date: Date, start: string, end: string) => {
    const { error } = await supabase
      .from('tutor_shifts')
      .insert({
        tutor_id: tutorProfile.id,
        date: format(date, 'yyyy-MM-dd'),
        start_time: start,
        end_time: end,
        is_booked: false,
      });
      
    if (error) {
      throw error;
    }
  };
  
  // 繰り返しシフトの保存
  const saveRecurringShifts = async (
    startDate: Date,
    endDate: Date,
    days: number[],
    startTime: string,
    endTime: string
  ) => {
    // 開始日から終了日までの日付を取得
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
    
    // 指定曜日のみのシフトを抽出
    const shiftsToCreate = dateRange.filter(date => days.includes(getDay(date)))
      .map(date => ({
        tutor_id: tutorProfile.id,
        date: format(date, 'yyyy-MM-dd'),
        start_time: startTime,
        end_time: endTime,
        is_booked: false,
      }));
    
    if (shiftsToCreate.length === 0) {
      throw new Error("指定した条件では登録可能なシフトがありません");
    }
    
    // シフトを一括登録
    const { error } = await supabase
      .from('tutor_shifts')
      .insert(shiftsToCreate);
      
    if (error) {
      throw error;
    }
    
    return shiftsToCreate.length;
  };
  
  // シフト削除
  const handleDeleteShift = async (shiftId: number) => {
    try {
      const { error } = await supabase
        .from('tutor_shifts')
        .delete()
        .eq('id', shiftId);
        
      if (error) {
        throw error;
      }
      
      // シフト一覧を更新
      setShifts(shifts.filter(shift => shift.id !== shiftId));
      
      toast({
        title: "シフトを削除しました",
        description: "シフト情報が正常に削除されました",
      });
    } catch (error: any) {
      console.error("Error deleting shift:", error);
      toast({
        title: "エラー",
        description: error.message || "シフト情報の削除に失敗しました",
        variant: "destructive",
      });
    }
  };
  
  // 繰り返し曜日の選択
  const toggleRecurringDay = (day: number) => {
    setRecurringDays(prev => 
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };
  
  // フォームリセット
  const resetShiftForm = () => {
    setSelectedDate(new Date());
    setStartTime('10:00');
    setEndTime('12:00');
    setIsRecurring(false);
    setRecurringEndDate(addDays(new Date(), 30));
    setRecurringDays([]);
  };
  
  // 前の週へ移動
  const goToPreviousWeek = () => {
    setCurrentWeekStart(prev => subDays(prev, 7));
  };
  
  // 次の週へ移動
  const goToNextWeek = () => {
    setCurrentWeekStart(prev => addDays(prev, 7));
  };
  
  // 今週へ移動
  const goToCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };
  
  // ダッシュボードに戻る処理
  const handleBackToDashboard = () => {
    try {
      // ログイン状態を保持するために、単純にルーターを使う
      router.push('/dashboard');
    } catch (error) {
      console.error("Error navigating to dashboard:", error);
      toast({
        title: "エラー",
        description: "ダッシュボードへの遷移に失敗しました",
        variant: "destructive",
      });
    }
  };
  
  // 曜日の配列
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  
  // 現在の週の日付を生成
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  
  // 指定された日付のシフトを取得
  const getShiftsForDate = (date: Date) => {
    return shifts.filter(shift => 
      isSameDay(shift.date, date)
    ).sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  // 将来のシフト（今日以降）
  const upcomingShifts = shifts.filter(shift => 
    shift.date >= new Date()
  ).sort((a, b) => a.date.getTime() - b.date.getTime());

  // 読み込み中の表示
  if (loading) {
    return (
      <div className="container py-8 flex justify-center">
        <div className="text-center">
          <CalendarIcon className="h-8 w-8 mb-4 mx-auto animate-pulse" />
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }