として登録</Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={selectTutorAccount}>
            <CardHeader>
              <CardTitle className="flex items-center">
                <GraduationCap className="mr-2 h-5 w-5" />
                講師アカウント
              </CardTitle>
              <CardDescription>
                生徒に授業を提供する講師の方向け
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside text-sm space-y-1 text-gray-600">
                <li>授業スケジュールの管理ができます</li>
                <li>生徒の授業履歴を確認できます</li>
                <li>レポート作成と共有ができます</li>
              </ul>
              <Button className="w-full mt-4">講師として登録</Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          ご不明な点がある場合は、サポートにお問い合わせください。
          <br />
          <a href="mailto:support@feducation.com" className="text-primary hover:underline">
            support@feducation.com
          </a>
        </p>
      </div>
    </div>
  );
}
