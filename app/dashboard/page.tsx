  
                  <Button
                    variant="outline"
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
                    onClick={() => router.push("/report-edit")}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-50 rounded-full flex items-center justify-center mb-1 md:mb-2">
                        <FileText className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                      </div>
                      <span className="text-xs md:text-sm font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px] md:max-w-none">レポート作成</span>
                    </div>
                  </Button>
                </div>
              </div>
            ) : (
              // 保護者/生徒用メニュー
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                {/* 保護者アカウントのみにチケット購入ボタンを表示 */}
                {userRole !== 'student' && userRole !== 'tutor' && (
                  <Button
                    variant="outline"
                    className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
                    onClick={() => router.push("/tickets")}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-green-50 rounded-full flex items-center justify-center mb-1 md:mb-2">
                        <Ticket className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                      </div>
                      <span className="text-xs md:text-sm font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px] md:max-w-none">チケット購入</span>
                    </div>
                  </Button>
                )}
                
                {/* 全てのユーザーに授業予約ボタンを表示 */}
                <Button
                  variant="outline"
                  className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
                  onClick={() => router.push("/booking")}
                >
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-50 rounded-full flex items-center justify-center mb-1 md:mb-2">
                      <CalendarCheck className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                    </div>
                    <span className="text-xs md:text-sm font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px] md:max-w-none">授業予約</span>
                  </div>
                </Button>
                
                {/* レポート一覧ボタンを追加 */}
                <Button
                  variant="outline"
                  className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
                  onClick={() => router.push("/reports")}
                >
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-purple-50 rounded-full flex items-center justify-center mb-1 md:mb-2">
                      <FileText className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />
                    </div>
                    <span className="text-xs md:text-sm font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px] md:max-w-none">授業レポート</span>
                  </div>
                </Button>
                
                {/* 設定ボタン */}
                <Button
                  variant="outline"
                  className="h-auto py-3 md:py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
                  onClick={() => router.push("/settings")}
                >
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-50 rounded-full flex items-center justify-center mb-1 md:mb-2">
                      <Settings className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
                    </div>
                    <span className="text-xs md:text-sm font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px] md:max-w-none">設定</span>
                  </div>
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
