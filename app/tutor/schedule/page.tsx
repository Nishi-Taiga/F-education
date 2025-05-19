  return (
    <div className="container py-4 md:py-8">
      {/* ヘッダー部分 */}
      <header className="bg-white mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBackToDashboard}
              className="mr-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">シフト登録</h1>
              <p className="text-muted-foreground">授業可能な日時を登録してください</p>
            </div>
          </div>
          
          <Button onClick={() => setShowAddShiftModal(true)} className="shadow-sm">
            <Plus className="mr-2 h-4 w-4" />
            シフトを追加
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {/* メインコンテンツ */}
        <Card className="shadow-md">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl flex items-center">
                <CalendarRange className="mr-2 h-5 w-5 text-blue-600" />
                <span className="text-xl">
                  {format(currentWeekStart, 'yyyy年M月d日', { locale: ja })} -
                  {format(addDays(currentWeekStart, 6), 'M月d日', { locale: ja })}
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToPreviousWeek}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToCurrentWeek}
                >
                  今週
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToNextWeek}
                  className="h-8 w-8"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-lg">読み込み中...</span>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {/* 曜日ヘッダー */}
                {weekdays.map((day, i) => (
                  <div
                    key={day}
                    className={cn(
                      "text-center font-medium py-2 rounded-md",
                      i === 0 && "text-red-500",
                      i === 6 && "text-blue-500"
                    )}
                  >
                    {day}
                  </div>
                ))}
                
                {/* 日付と予約 */}
                {weekDays.map((day, dayIndex) => {
                  const dayShifts = getShiftsForDate(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "border rounded-md p-2 min-h-[150px] flex flex-col",
                        isSameDay(day, new Date()) && "bg-blue-50 border-blue-200",
                        dayIndex === 0 && "text-red-500",
                        dayIndex === 6 && "text-blue-500"
                      )}
                    >
                      <div className="text-right mb-2 font-medium">
                        {format(day, 'd')}
                      </div>
                      <div className="flex-grow space-y-1 overflow-auto">
                        {dayShifts.length > 0 ? (
                          dayShifts.map(shift => (
                            <div
                              key={shift.id}
                              className={cn(
                                "text-xs p-2 rounded-md border flex justify-between items-center",
                                shift.isBooked
                                  ? "bg-blue-100 border-blue-200 text-blue-800"
                                  : "bg-green-100 border-green-200 text-green-800"
                              )}
                            >
                              <div>
                                <div className="font-medium">{shift.startTime} - {shift.endTime}</div>
                                <div>{shift.isBooked ? "予約済" : "空き"}</div>
                              </div>
                              {!shift.isBooked && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteShift(shift.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-center text-gray-500 py-2">
                            シフトなし
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-2 border-t">
            <div className="w-full text-sm text-gray-500">
              <div className="flex items-center gap-6 justify-center">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded bg-green-100 border border-green-200 mr-1.5"></div>
                  <span>空きシフト</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200 mr-1.5"></div>
                  <span>予約済み</span>
                </div>
              </div>
            </div>
          </CardFooter>
        </Card>
        
        {/* シフト一覧表示 - タブスタイルで表示 */}
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">今後のシフト</TabsTrigger>
            <TabsTrigger value="add">新規登録</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upcoming">
            <Card>
              <CardHeader>
                <CardTitle>登録済みシフト一覧</CardTitle>
                <CardDescription>今後の登録シフトを確認できます</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingShifts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {upcomingShifts.map(shift => (
                      <div
                        key={shift.id}
                        className={cn(
                          "p-4 border rounded-lg flex flex-col",
                          shift.isBooked
                            ? "bg-blue-50 border-blue-200"
                            : "bg-green-50 border-green-200"
                        )}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-medium text-lg">
                              {format(shift.date, 'yyyy年M月d日(E)', { locale: ja })}
                            </h3>
                            <p className="text-md">{shift.startTime} - {shift.endTime}</p>
                          </div>
                          <Badge variant={shift.isBooked ? "default" : "outline"} className={
                            shift.isBooked 
                              ? "bg-blue-100 text-blue-800 border-blue-200" 
                              : "bg-green-100 text-green-800 border-green-200"
                          }>
                            {shift.isBooked ? "予約済み" : "空き"}
                          </Badge>
                        </div>
                        
                        <Separator className="my-2" />
                        
                        <div className="flex justify-end mt-2">
                          {!shift.isBooked && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteShift(shift.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              削除
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 border border-dashed rounded-md">
                    <CalendarRange className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                    <p className="text-muted-foreground">
                      登録済みのシフトはありません
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setShowAddShiftModal(true)}
                    >
                      シフトを追加する
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="add">
            <Card>
              <CardHeader>
                <CardTitle>新規シフト登録</CardTitle>
                <CardDescription>授業可能な日時を登録してください</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* 単発 or 繰り返し選択 */}
                  <Tabs defaultValue="single" className="w-full" onValueChange={(val) => setIsRecurring(val === 'recurring')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="single">単発シフト</TabsTrigger>
                      <TabsTrigger value="recurring">繰り返しシフト</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="single" className="mt-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>日付を選択</Label>
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            disabled={{ before: new Date() }}
                            className="border rounded-md p-3 mx-auto"
                          />
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="recurring" className="mt-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>開始日</Label>
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            disabled={{ before: new Date() }}
                            className="border rounded-md p-3"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>終了日</Label>
                          <Calendar
                            mode="single"
                            selected={recurringEndDate}
                            onSelect={setRecurringEndDate}
                            disabled={{ before: selectedDate }}
                            className="border rounded-md p-3"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>繰り返す曜日</Label>
                        <div className="flex flex-wrap gap-2">
                          {weekdays.map((day, index) => (
                            <Button
                              key={day}
                              type="button"
                              variant={recurringDays.includes(index) ? "default" : "outline"}
                              className={cn(
                                "w-9 h-9 p-0",
                                index === 0 && !recurringDays.includes(index) && "text-red-500",
                                index === 6 && !recurringDays.includes(index) && "text-blue-500"
                              )}
                              onClick={() => toggleRecurringDay(index)}
                            >
                              {day}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                  
                  {/* 時間選択 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime">開始時間</Label>
                      <Select value={startTime} onValueChange={setStartTime}>
                        <SelectTrigger>
                          <SelectValue placeholder="開始時間を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="endTime">終了時間</Label>
                      <Select value={endTime} onValueChange={setEndTime}>
                        <SelectTrigger>
                          <SelectValue placeholder="終了時間を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-4">
                    <Button 
                      onClick={handleSaveShift} 
                      disabled={saveLoading}
                      className="w-full md:w-auto"
                    >
                      {saveLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          保存中...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          シフトを保存
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* シフト追加モーダル */}
      <Dialog open={showAddShiftModal} onOpenChange={setShowAddShiftModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>シフト追加</DialogTitle>
            <DialogDescription>
              授業可能な日時を登録してください
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* 単発 or 繰り返し選択 */}
            <Tabs defaultValue="single" className="w-full" onValueChange={(val) => setIsRecurring(val === 'recurring')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single">単発シフト</TabsTrigger>
                <TabsTrigger value="recurring">繰り返しシフト</TabsTrigger>
              </TabsList>
              
              <TabsContent value="single" className="mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>日付を選択</Label>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={{ before: new Date() }}
                      className="border rounded-md p-3"
                    />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="recurring" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>開始日</Label>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={{ before: new Date() }}
                    className="border rounded-md p-3"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>終了日</Label>
                  <Calendar
                    mode="single"
                    selected={recurringEndDate}
                    onSelect={setRecurringEndDate}
                    disabled={{ before: selectedDate }}
                    className="border rounded-md p-3"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>繰り返す曜日</Label>
                  <div className="flex flex-wrap gap-2">
                    {weekdays.map((day, index) => (
                      <Button
                        key={day}
                        type="button"
                        variant={recurringDays.includes(index) ? "default" : "outline"}
                        className={cn(
                          "w-9 h-9 p-0",
                          index === 0 && !recurringDays.includes(index) && "text-red-500",
                          index === 6 && !recurringDays.includes(index) && "text-blue-500"
                        )}
                        onClick={() => toggleRecurringDay(index)}
                      >
                        {day}
                      </Button>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            {/* 時間選択 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">開始時間</Label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="開始時間を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endTime">終了時間</Label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="終了時間を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddShiftModal(false)}>
              キャンセル
            </Button>
            <Button 
              onClick={handleSaveShift} 
              disabled={saveLoading}
              className="ml-2"
            >
              {saveLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  シフトを保存
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}