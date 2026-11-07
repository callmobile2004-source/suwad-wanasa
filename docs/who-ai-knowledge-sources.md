# أوراس: سجل مصادر قاعدة «خمّن منو آني؟»

هذا السجل يوضح مصدر التصنيفات الثابتة وحدود ما يسمح للمحرك بالإجابة عنه. قاعدة الخيارات في `who-ai-knowledge.js` تطابق مصفوفة اللعبة في `app.js` حرفياً: **18 فئة و439 خياراً**. اختبار الانحدار يتحقق من هذا التطابق.

## سياسة الإجابة

- الإجابة المحلية حتمية: لا يستعمل المحرك Gemini لتقرير نعم/لا عن السر المختار في جلسة التدريب النشطة.
- لا تتحول المعلومة غير الموجودة إلى «لا». النفي يُسمح به فقط عندما توجد مجموعة اكتمال موثقة مثل `originKnown` أو `franchiseKnown` أو `universeKnown` أو `fieldKnown`.
- مجموعة موطن المصارع جزئية عمداً؛ تضم فقط المصارعين الثمانية الذين ثبت موطنهم في ملفات WWE الرسمية المدرجة أدناه. بقية المصارعين يمتنع المحرك عن تخمين موطنهم.
- تصنيفات الشخصيات التاريخية إيجابية فقط؛ إذا لم يكن الدور مثبتاً في المجموعة، فالنتيجة امتناع لا نفي.
- «دار الأوبرا» اسم عام لا يحدد أي دار أوبرا؛ لذلك لا يُفترض أنه دار أوبرا سيدني. وكذلك «سبيكتر» لا يُنسب إلى امتياز لعبة من دون تحديد موثوق.
- «بلد السيارة» يعني بلد منشأ/هوية الشركة المصنّعة، لا بلد تجميع طراز بعينه.
- تصنيف القارات للدول يتبع معيار الأمم المتحدة M49، لا الادعاء بأن الدولة لا تمتد جغرافياً إلى قارة أخرى. لذلك روسيا ضمن أوروبا وتركيا ضمن آسيا في هذا التصنيف الإحصائي.
- شلالات نياگرا مصنفة في كندا والولايات المتحدة، وإيفرست في نيبال والصين؛ هذا التداخل مقصود وليس تناقضاً.

## الدول والمعالم والطبيعة

- **الدول والقارات:** [معيار الأمم المتحدة M49](https://unstats.un.org/unsd/methodology/m49/)، مع قائمة البلدان والمناطق التابعة للأمم المتحدة.
- **المعالم:** [مركز التراث العالمي لليونسكو](https://whc.unesco.org/en/list/) مرجع للتحقق من أسماء المواقع وبلدانها. أُبقيت المواقع الحدودية في أكثر من بلد عندما يلزم.
- **الثمار:** [منظمة الأغذية والزراعة FAO](https://www.fao.org/4/y2515e/y2515e04.htm) مرجع عام لتصنيف الثمار؛ لا يُستنتج لون ثابت لفاكهة تتغير ألوان أصنافها.
- **الطيور والكائنات البحرية والحيوانات:** التصنيف يقتصر على خصائص مستقرة واضحة (مثل الطيران، الثدييات، الزواحف، الأسماك واللافقاريات). الحجم يُسند فقط للحيوانات التي لا يغيّر اختلاف السلالة/النوع حكمها بصورة كبيرة؛ وزن الكلب مثلاً غير محسوم من الاسم العام.
- **الآلات الموسيقية:** تصنيف عائلات الآلات الوترية والنفخ والإيقاع ولوحة المفاتيح بالاستناد إلى مرجع كامبريدج الأكاديمي: [Cambridge – Orchestration](https://assets.cambridge.org/97811070/25165/frontmatter/9781107025165_frontmatter.pdf).
- **الرياضات:** تصنيف أولي إلى جماعية وفردية، مع سمات مستقلة للمائية والقتالية؛ يمكن أن تكون الرياضة فردية وقتالية في آن واحد.

## المصارعة وكرة القدم والسيارات

- **المصارعون:** ملفات WWE الرسمية، وبالتحديد:
  - [John Cena](https://www.wwe.com/superstars/john-cena)
  - [Roman Reigns](https://www.wwe.com/superstars/roman-reigns)
  - [The Rock](https://www.wwe.com/superstars/the-rock)
  - [Seth Rollins](https://www.wwe.com/superstars/seth-rollins)
  - [Cody Rhodes](https://www.wwe.com/superstars/cody-rhodes)
  - [Kevin Owens](https://www.wwe.com/superstars/kevin-owens)
  - [Finn Bálor](https://www.wwe.com/superstars/finn-balor)
  - [Drew McIntyre](https://www.wwe.com/superstars/drew-mcintyre)

  حقائق هذه المجموعة تعبّر عن موطن/مدينة المصارع كما تعرضها WWE، وليست ادعاءً مستقلاً عن الجنسية القانونية.
- **لاعبو كرة القدم:** [FIFA](https://www.fifa.com/) وسجلات المنتخبات والاتحادات الوطنية الرسمية؛ الجنسية الرياضية ثابتة ولا تتبدل بتبدل النادي. قائمة جوائز FIFA الرسمية توفر تحققاً إضافياً من أسماء اللاعبين المشاركين: [The Best FIFA – قائمة الفائزين](https://www.fifa.com/it/the-best-fifa-football-awards/articles/tutti-vincitori-the-best-fifa).
- **السيارات:** بلد الشركة المصنّعة من تاريخها/ملفها الرسمي، لا من بلد مصنع التجميع:
  - [Toyota](https://global.toyota/en/company/history/)
  - [Nissan](https://www.nissan-global.com/EN/COMPANY/PROFILE/)
  - [Honda](https://global.honda/en/about/history/)
  - [BMW Group](https://www.bmwgroup.com/en/company/history.html)
  - [Mercedes-Benz Group](https://group.mercedes-benz.com/company/tradition/company-history/)
  - [Ferrari](https://www.ferrari.com/en-EN/history)
  - [Lamborghini](https://www.lamborghini.com/en-en/history)
  - [Ford](https://corporate.ford.com/about/history.html)
  - [Hyundai](https://www.hyundai.com/worldwide/en/company/history)
  - [Volvo](https://www.volvocars.com/intl/v/history/)

  صُحح خطأ تصنيفي سابق: McLaren بريطانية وليست إيطالية، وVolvo سويدية وليست ألمانية. Tesla مصنّفة شركة أمريكية؛ أما صفة «كهربائية» فتُسند إلى Tesla فقط ضمن الخيارات الحالية.

## شخصيات الألعاب والأفلام والأنمي والأبطال الخارقون

- **شخصيات الألعاب:** صفحات الناشرين الرسمية، ومنها [PlayStation – God of War](https://www.playstation.com/en-ph/games/god-of-war/)، [Ubisoft – The Ezio Collection](https://www.ubisoft.com/en-US/game/assassins-creed/the-ezio-collection)، [CAPCOM – Resident Evil](https://game.capcom.com/residentevil/)، وموقع [Nintendo](https://www.nintendo.com/us/whatsnew/sora-from-kingdom-hearts-revealed-as-the-final-dlc-fighter-coming-to-super-smash-bros-ultimate/).
- **الأفلام والأبطال الخارقون:** ملفات الشخصيات الرسمية لدى [Marvel](https://www.marvel.com/characters/) و[DC](https://www.dc.com/characters)، ومواقع الامتيازات الرسمية للأعمال الأخرى.
- **الأنمي:** مواقع السلاسل والناشرين الرسمية، مع مرجع مساعد لتوثيق Luffy وZoro وسياق One Piece: [Netflix Tudum – طاقم One Piece الياباني الأصلي](https://www.netflix.com/tudum/articles/one-piece-original-japanese-cast-joins-series).

التصنيف هنا هو الانتماء إلى السلسلة/العالم، وليس افتراض صفة أو قدرة غير مذكورة في مصدر.

## المهن والشخصيات التاريخية

- **المهن:** [O*NET OnLine](https://www.onetonline.org/) قاعدة مهنية تابعة لوزارة العمل الأمريكية، وتُستخدم لتجميع الأعمال بحسب المجال الأساسي (طب، تعليم، قانون، سلامة عامة، نقل، حرف، تقنية وغيرها).
- **الشخصيات التاريخية:** [Britannica – Biographies](https://www.britannica.com/biography/)، [Nobel Prize – Marie Curie](https://www.nobelprize.org/womenwhochangedscience/stories/marie-curie.)، ومراجع HISTORY عن [Alexander the Great](https://www.history.com/articles/alexander-the-great)، [Hannibal](https://www.history.com/articles/hannibal)، [Julius Caesar](https://www.history.com/articles/julius-caesar) و[Cleopatra](https://www.history.com/articles/cleopatra-suicide).

التصنيفات التاريخية قد تتداخل (مثل ابن سينا: طبيب وفيلسوف). المحرك يجيب عن العضوية الإيجابية المثبتة فقط، ولا يستنتج نفياً من عدم إدراج اسم في مجال آخر.

## حدود المراجعة

هذا سجل المصادر المعتمدة للمجموعات الثابتة الحالية، وليس ترخيصاً لإضافة معلومة جديدة بلا مصدر خاص بها. قبل إضافة أسماء أو حقائق جديدة، ينبغي إرفاق صفحة المصدر المناسبة واختبار الحقيقة والمرادفات والنفي. الاختبارات الحالية تتحقق من كل عنصر في كل مجموعة بيانات، وكل intent جديد، والتقسيمات الحصرية، والحقائق الحدودية، والامتناع عند الغموض.
