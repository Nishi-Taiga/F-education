                        }
                        
                        const shiftInfo = day.shifts[timeSlot];
                        const isPast = parseISO(day.date) < subDays(new Date(), 1);
                        
                        // シフトが変更待ちかどうかを確認
                        const isPending = pendingShifts.some(
                          shift => shift.date === day.date && shift.time_slot === timeSlot
                        );
                        
                        return (
                          <td 
                            key={`${day.date}-${timeSlot}`} 
                            className={`p-2 text-center ${textColorClass} ${
                              day.date === formattedToday ? "bg-primary/10" : ""
                            } ${
                              isPending ? "bg-yellow-50" : ""
                            }`}
                          >
                            <div className="flex flex-col items-center">
                              <Switch
                                checked={
                                  // 保留中の変更があればそれを表示
                                  pendingShifts.find(
                                    shift => shift.date === day.date && shift.time_slot === timeSlot
                                  )?.is_available ?? 
                                  // なければ既存の設定を表示
                                  (shiftInfo?.isAvailable ?? false)
                                }
                                onCheckedChange={() => 
                                  handleShiftToggle(
                                    day.date, 
                                    timeSlot, 
                                    // 保留中の変更があればそれを基準に切り替え
                                    pendingShifts.find(
                                      shift => shift.date === day.date && shift.time_slot === timeSlot
                                    )?.is_available ?? 
                                    // なければ既存の設定を基準に切り替え
                                    (shiftInfo?.isAvailable ?? false)
                                  )
                                }
                                disabled={isPast || isSaving}
                              />
                              
                              <div className={`text-xs mt-1 ${isPending ? "font-medium text-yellow-600" : "text-muted-foreground"}`}>
                                {pendingShifts.find(
                                  shift => shift.date === day.date && shift.time_slot === timeSlot
                                )?.is_available ?? 
                                (shiftInfo?.isAvailable ?? false) ? "可能" : "不可"}
                                {isPending && " (未保存)"}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <div className="mt-6 flex justify-end">
            <Button
              variant="default"
              onClick={saveAllPendingShifts}
              disabled={pendingShifts.length === 0 || isSaving}
              className="text-xs md:text-sm flex items-center gap-1 md:gap-2 h-8 md:h-10 px-2 md:px-4"
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
              ) : (
                <Save className="h-3 w-3 md:h-4 md:w-4" />
              )}
              <span className="hidden md:inline">変更を保存</span>
              <span className="inline md:hidden">保存</span>
              {pendingShifts.length > 0 && <span className="font-medium">({pendingShifts.length})</span>}
            </Button>
          </div>
          
          <div className="mt-6">
            <Separator className="my-4" />
            <div className="text-xs md:text-sm text-muted-foreground space-y-1">
              <p>※ 過去の日付のシフトは変更できません</p>
              <p>※ 変更は「保存」ボタンを押すまで反映されません</p>
              <p>※ 黄色でハイライトされている項目は未保存の変更です</p>
              <p className="hidden md:block">※ 既に予約が入っている時間帯は、予約をキャンセルしない限りシフトを変更できません</p>
              <p className="block md:hidden">※ 予約済みの時間帯は変更できません</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}