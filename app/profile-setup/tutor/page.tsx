を入力してください" }),
  birth_date: z.string().min(1, { message: "生年月日を入力してください" }),
  subjects: z.string().min(1, { message: "担当科目を選択してください" }),
  bio: z.string().optional(),
});

type TutorProfileForm = z.infer<typeof tutorProfileSchema>;

export default function TutorProfileSetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  // 講師情報フォーム
  const tutorForm = useForm<TutorProfileForm>({
    resolver: zodResolver(tutorProfileSchema),
    defaultValues: {
      last_name: "",
      first_name: "",
      last_name_furigana: "",
      first_name_furigana: "",
      university: "",
      birth_date: "",
      subjects: "",
      bio: "",
    },
  });

  // 講師情報の送信
  const onTutorSubmit = async (values: TutorProfileForm) => {
    setIsLoading(true);
    try {
      // セッション情報を取得
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("セッションが見つかりません。再ログインしてください。");
      }
      
      // ユーザーID
      const userId = session.user.id;
      
      // ユーザーメタデータの更新
      await supabase.auth.updateUser({
        data: { 
          role: 'tutor',
          profile_completed: true
        }
      });
      
      // 講師プロフィールの更新
      const { error: profileUpdateError } = await supabase
        .from('tutor_profiles')
        .update({
          last_name: values.last_name,
          first_name: values.first_name,
          last_name_furigana: values.last_name_furigana,
          first_name_furigana: values.first_name_furigana,
          university: values.university,
          birth_date: values.birth_date,
          subjects: values.subjects,
          bio: values.bio || null,
          profile_completed: true,
        })
        .eq('user_id', userId);
        
      if (profileUpdateError) throw profileUpdateError;
      
      toast({
        title: "講師情報が保存されました",
        description: "ダッシュボードに進みます",
      });
      
      // ダッシュボードに進む
      router.push('/dashboard');
    } catch (error: any) {
      console.error("講師情報保存エラー:", error);
      toast({
        title: "エラー",
        description: `講師情報の保存に失敗しました: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 科目の選択肢
  const subjectOptions = [
    { value: "数学", label: "数学" },
    { value: "英語", label: "英語" },
    { value: "国語", label: "国語" },
    { value: "理科", label: "理科" },
    { value: "社会", label: "社会" },
    { value: "物理", label: "物理" },
    { value: "化学", label: "化学" },
    { value: "生物", label: "生物" },
    { value: "地学", label: "地学" },
    { value: "世界史", label: "世界史" },
    { value: "日本史", label: "日本史" },
    { value: "地理", label: "地理" },
    { value: "公民", label: "公民" },
    { value: "情報", label: "情報" },
  ];

  // 科目選択の処理
  const handleSubjectToggle = (subject: string) => {
    setSelectedSubjects(prev => {
      const isSelected = prev.includes(subject);
      let newSubjects;
      
      if (isSelected) {
        // 選択解除
        newSubjects = prev.filter(s => s !== subject);
      } else {
        // 選択追加
        newSubjects = [...prev, subject];
      }
      
      // フォームの値を更新
      tutorForm.setValue('subjects', newSubjects.join(','));
      return newSubjects;
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-primary">F education</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">講師プロフィール設定</h2>
          <p className="mt-1 text-sm text-gray-600">サービスを利用するために必要な講師情報を入力してください</p>
        </div>

        <Card className="p-6">
          <CardHeader>
            <CardTitle>講師情報を入力</CardTitle>
            <CardDescription>授業提供に必要な情報です</CardDescription>
          </CardHeader>
          
          <CardContent>
            <Form {...tutorForm}>
              <form onSubmit={tutorForm.handleSubmit(onTutorSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={tutorForm.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>姓</FormLabel>
                        <FormControl>
                          <Input placeholder="山田" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={tutorForm.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>名</FormLabel>
                        <FormControl>
                          <Input placeholder="太郎" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={tutorForm.control}
                    name="last_name_furigana"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>姓（ふりがな）</FormLabel>
                        <FormControl>
                          <Input placeholder="やまだ" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={tutorForm.control}
                    name="first_name_furigana"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>名（ふりがな）</FormLabel>
                        <FormControl>
                          <Input placeholder="たろう" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={tutorForm.control}
                    name="university"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>大学名</FormLabel>
                        <FormControl>
                          <Input placeholder="○○大学" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={tutorForm.control}
                    name="birth_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>生年月日</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={tutorForm.control}
                  name="subjects"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>担当科目（複数選択可）</FormLabel>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
                        {subjectOptions.map(option => (
                          <div
                            key={option.value}
                            className={`
                              cursor-pointer px-3 py-2 rounded-md text-sm font-medium text-center
                              ${selectedSubjects.includes(option.value)
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}
                            `}
                            onClick={() => handleSubjectToggle(option.value)}
                          >
                            {option.label}
                          </div>
                        ))}
                      </div>
                      <input type="hidden" {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={tutorForm.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>自己紹介（任意）</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="生徒に向けた自己紹介や、得意な指導スタイル、専門分野などをご記入ください" 
                          {...field} 
                          className="min-h-[100px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => router.push('/profile-selection')}
                    className="flex items-center"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    戻る
                  </Button>

                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="flex items-center"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        登録して完了
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
