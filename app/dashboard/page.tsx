授業レポート</span>
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