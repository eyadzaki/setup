// All the products, their texts and links (source of truth: PRODUCTS.md).
// SCENE lists the clickable pieces in the 3D scene; `id` matches the group
// built in scene.js. INSIDE lists the parts shown inside the case card.

export const TAG = 'eyadzaki0b-20';
export const amazon = asin => `https://www.amazon.com/dp/${asin}?tag=${TAG}`;

export const CATS = {
  monitors: 'الشاشات',
  pc: 'الجهاز',
  audio: 'الصوت',
  stream: 'البث والتصوير',
  input: 'الإدخال',
  furniture: 'الأثاث',
};

export const CLOSE_NOTE = 'المنتج في الرابط مختلف شوي عن اللي عندي، لأن نسختي مو متوفرة. تحت مقارنة بين الاثنين.';
export const SUPPORT_LINE = 'إذا اشتريت من نفس الرابط، بتدعمني بدون ما يزيد عليك السعر 💜';
export const CHAIR_NOTE = 'الكرسي ما أنصحك تشتريه أونلاين. روح محل وجرّبه بنفسك، الراحة تختلف من شخص لشخص.';

export const CHANNELS = {
  kick: { label: 'Kick', url: 'https://kick.com/eyadzaki' },
  youtube: { label: 'YouTube', url: 'https://www.youtube.com/@Eyadzaki' },
  bro: { label: 'قناة التختيم', url: 'https://www.youtube.com/@brobrayal' },
  tiktok: { label: 'TikTok', url: 'https://www.tiktok.com/@eyadzaki621' },
  instagram: { label: 'Instagram', url: 'https://www.instagram.com/eyadzaki621/' },
};

// store: 'amazon' (asin) | 'noon' | 'official' (url) | null
export const PRODUCTS = {
  'lg-side': { img: 'images/lg-side.jpg',
    name: 'LG 27U421A-B', cat: 'monitors', store: 'amazon', asin: 'B0DVJNK91K',
    desc: 'شاشة 27 بوصة بدقة Full HD (1920×1080) وشغّالة عندي على 75Hz، فيها منفذ USB-C يشحن لين 15 واط.',
    opinion: 'حاط ثنتين على الجناب للشات والبرامج. للشغل الجانبي تقضي الغرض، بس لا تتوقع منها شي للقيمنق.',
  },
  'lg-center': { img: 'images/lg-center.jpg',
    name: 'LG UltraGear 27GS60F', cat: 'monitors', store: 'official', url: 'https://www.lg.com/levant_en/monitors/lg-27gs60f-b',
    desc: 'شاشة قيمنق 27 بوصة IPS بدقة Full HD و 1ms وشغّالة عندي على 144Hz، تدعم G-Sync و FreeSync.',
    opinion: 'هي شاشة القيمنق الأساسية حقتي. الفرق واضح عن الـ 75Hz اللي على الجناب، وهي اللي ألعب عليها في البث.',
  },
  case: { img: 'images/case.jpg',
    name: 'INFINIARC Cube Flow XL', cat: 'pc', store: 'noon',
    url: 'https://www.noon.com/saudi-en/infiniarc-cube-flow-xl-case-with-6-rgb-fans-premium-gaming-pc-case-with-stunning-illumination/ZABD1F2608567F073E76EZ/p/',
    desc: 'كيس مكعب بجنبين زجاج، يجي معه 6 مراوح RGB.',
    opinion: 'شكله حلو تحت المكتب، ومساحته كويسة وتركيب القطع فيه سهل.',
  },
  hd650: { img: 'images/hd650.jpg',
    name: 'Sennheiser HD 650', cat: 'audio', store: 'amazon', asin: 'B00018MSNI',
    desc: 'سماعة Open-Back سلكية للاستماع والاستوديو، معروفة بصوتها الطبيعي والواضح.',
    opinion: 'أكثر قطعة أستخدمها. الصوت نظيف ومريحة على الراس لساعات. بس لأنها Open-Back، اللي حولك يسمعون اللي تسمعه.',
  },
  keyboard: {
    name: 'E-YOOSO Z99', cat: 'input', store: 'amazon', asin: 'B0F7H7L6XJ', close: true,
    desc: 'كيبورد ميكانيكي سلكي بـ 99 زر، السويتشات خطية ومشحّمة وقابلة للتبديل، ومن جوا فيه Gasket ورغوة تمتص الصوت.',
    opinion: 'سعره معقول وصوته Creamy ناعم. للبث ممتاز لأنه مو مزعج في المايك.',
    compare: [['الموديل', 'Z99', 'Z-99'], ['اللون', 'رمادي', 'أبيض / رمادي'], ['الإضاءة', 'LED أخضر', 'RGB'], ['التوصيل', 'سلكي', 'سلكي'], ['عدد الأزرار', '99', '99']],
  },
  mouse: { img: 'images/mouse.jpg',
    name: 'Ajazz AJ159 Apex', cat: 'input', store: 'amazon', asin: 'B0D5BCYL39',
    desc: 'ماوس قيمنق لاسلكي وزنه 56 جرام، حساسه PAW3950، ومعه قاعدة شحن مغناطيسية فيها شاشة.',
    opinion: 'خفيف مرّة. القاعدة تبيّن لك البطارية، تحطه عليها وانت قايم وخلاص.',
  },
  'pad-xl': { img: 'images/pad.jpg',
    name: 'SteelSeries QcK XL', cat: 'input', store: 'amazon', asin: 'B0DZ1QB918', close: true,
    desc: 'ماوس باد قماش كبير يغطي جزء كبير من المكتب، وتحته مطاط ما يزحلق.',
    opinion: 'قماش عادي بس يسوي الشغل. حاطه تحت كقاعدة على طول المكتب.',
    compare: [['الموديل', 'QcK XL (النسخة الكلاسيك)', 'QcK XL Performance Balance'], ['المقاس', '900 × 400 مم', '900 × 400 مم'], ['السطح', 'قماش QcK العادي', 'قماش أكثف بحواف مخيطة']],
  },
  'pad-l': { img: 'images/pad.jpg',
    name: 'SteelSeries QcK+ (L)', cat: 'input', store: 'amazon', asin: 'B004DCLJ6A',
    desc: 'ماوس باد قماش بمقاس 450 × 400 مم.',
    opinion: 'حاطه فوق الكبير عشان منطقة الماوس تكون أنعم. قديم بس للحين شغال.',
  },
  mic: { img: 'images/mic.jpg',
    name: 'MAONO PD400X', cat: 'audio', store: 'amazon', asin: 'B0BBVY9L7C',
    desc: 'مايك Dynamic يشتغل بـ USB و XLR، فيه زر لمس للكتم ومخرج سماعة.',
    opinion: 'يلقط صوتك انت بس وما يلقط الغرفة كثير، وهذا اللي تبغاه في البث.',
  },
  'mic-arm': { img: 'images/mic-arm.jpg',
    name: 'FIFINE BM88', cat: 'audio', store: 'amazon', asin: 'B0C45H4WG9',
    desc: 'ذراع مايك منخفض يتركب على طرف المكتب بمشبك، ويمر السلك من داخله.',
    opinion: 'ما يغطي الشاشة، وثابت وما يطيح.',
  },
  interface: { img: 'images/interface.jpg',
    name: 'MAONO PS22', cat: 'audio', store: 'amazon', asin: 'B0D9P3Y22C', close: true,
    desc: 'كرت صوت USB، توصّل فيه المايك XLR أو قيتار، وتتحكم من مقابضه في مستوى صوت المايك والسماعة. يجي مع برنامج يقسّم لك صوت اللعبة والشات والمايك في البث.',
    opinion: 'خلّى صوت المايك أنظف، والتحكم بالصوت صار من المقبض بدل البرامج. للبث مرّة مفيد.',
    compare: [['الموديل', 'PS22', 'PS22 Lite'], ['الجودة', '24-bit / 192kHz', '24-bit / 192kHz'], ['قوة الـ Gain', 'لين 60dB', 'لين 56dB'], ['منافذ USB-C', '2', '1'], ['Phantom 48V', 'فيه', 'فيه'], ['الحجم', 'أكبر، فيه مقابض أكثر', 'أصغر وأخف']],
  },
  controller: { img: 'images/controller.jpg',
    name: 'Xbox Wireless Controller · Robot White', cat: 'input', store: 'amazon', asin: 'B08K4HLCPR',
    desc: 'يد إكس بوكس الرسمية، تشتغل لاسلكي أو بالسلك على الإكس بوكس والكمبيوتر والجوال.',
    opinion: 'ما فيها شي مميز، بس شغالة على الكمبيوتر بدون أي تعريفات.',
  },
  battery: { img: 'images/battery.jpg',
    name: 'بطاريات يد الإكس بوكس + قاعدة الشحن', cat: 'input', store: 'amazon', asin: 'B07NS61HVY', close: true,
    desc: 'بطاريتين تشحنهم وتركّبهم في اليد بدل البطاريات العادية، ومعهم قاعدة تشحن الاثنين مع بعض.',
    opinion: 'أحسن من البطاريات العادية. وحدة في اليد ووحدة تشحن، وتطول معاي.',
    compare: [['الماركة', 'AOLION', 'Ukor'], ['عدد البطاريات', '2', '2'], ['السعة', '2650mAh لكل وحدة', '6200mWh لكل وحدة'], ['قاعدة شحن', 'فيه', 'فيه']],
    extra: { label: 'نسختي الأصلية في نون', url: 'https://www.noon.com/saudi-ar/Z04EFD59C55EDDF72EFB3Z/p/' },
  },
  ringlight: {
    name: 'رينج لايت 10" مع ستاند 59"', cat: 'stream', store: 'amazon', asin: 'B088635TJM',
    desc: 'حلقة إضاءة LED مقاسها 10 بوصة على ستاند لين 150 سم، معها حامل جوال، وتقدر تتحكم في قوتها ولونها.',
    opinion: 'رخيصة وتقضي الغرض للكام. فيها ثلاث درجات ألوان وتتحكم في القوة.',
  },
  webcam: { img: 'images/webcam.jpg',
    name: 'Razer Kiyo Pro Ultra', cat: 'stream', store: 'amazon', asin: 'B0CT6FFK4R',
    desc: 'كاميرا ويب 4K بحساس كبير، تصلّح الإضاءة تلقائيًا، وفيها مايك وغطاء للعدسة.',
    opinion: 'الصورة واضحة حتى لو الإضاءة مو مرّة، والغطاء حلو لما تقفل.',
  },
  'cam-stand': {
    name: 'jusmo Desk Mount', cat: 'stream', store: 'amazon', asin: 'B08RYS8YZR',
    desc: 'عمود ألمنيوم يتثبت على المكتب بمشبك، تقدر تطوّله وتقصّره، وفي راسه رأس يلف 360°.',
    opinion: 'ترفع الكام للارتفاع اللي تبغاه، وما ياخذ مكان على المكتب.',
  },
  desk: { img: 'images/desk.jpg',
    name: 'Chulovs L-Shaped 130cm', cat: 'furniture', store: 'noon',
    url: 'https://www.noon.com/saudi-ar/l-shaped-gaming-desk-with-led-lights-and-power-outlets-50-4-computer-desk-with-monitor-stand-and-carbon-fiber-surface-corner-desk-with-cup-holder-gaming-table-with-hooks-black/ZF9E54CD34979AC34C063Z/p/',
    desc: 'مكتب زاوية على شكل L، سطحه كاربون فايبر، وفيه رف للشاشات وإضاءة LED وفيش كهرباء وخطّاف للسماعة.',
    opinion: 'مساحته كافية لثلاث شاشات، بس لا تتوقع إنه ضخم.',
  },
  chair: {
    name: 'كرسي Recliner', cat: 'furniture', store: null,
    desc: 'كرسي استرخاء (Recliner) بنفس شكل La-Z-Boy.',
    opinion: CHAIR_NOTE,
  },

  // inside the case
  cpu: {
    name: 'Intel Core i7-12700F', cat: 'pc', part: 'المعالج', store: 'amazon', asin: 'B09WW3DY8S',
    desc: 'معالج إنتل الجيل 12، فيه 12 نواة (8 أداء + 4 كفاءة)، بدون كرت شاشة مدمج.',
    opinion: 'يشغّل اللعبة والبث مع بعض بدون ما يتعب.',
  },
  mobo: { img: 'images/mobo.jpg',
    name: 'Gigabyte B760 Gaming X DDR5', cat: 'pc', part: 'المذربورد', store: 'amazon', asin: 'B0BZ54DR5L', close: true,
    desc: 'مذربورد ATX لمعالجات إنتل الجيل 12 و 13 و 14، يدعم رامات DDR5 وفيه منافذ M.2 للتخزين.',
    opinion: 'فيها كل اللي أحتاجه بدون زيادات ما لها داعي.',
    compare: [['الموديل', 'B760 Gaming X DDR5', 'B760 Gaming X AX DDR5'], ['WiFi و Bluetooth', 'ما فيه', 'WiFi 6E + Bluetooth'], ['باقي المواصفات', 'نفسها', 'نفسها']],
  },
  gpu: { img: 'images/gpu.jpg',
    name: 'Gigabyte RTX 4070 SUPER Eagle OC 12G', cat: 'pc', part: 'كرت الشاشة', store: 'amazon', asin: 'B0CSJYJP6M',
    desc: 'كرت شاشة RTX 4070 Super بذاكرة 12GB GDDR6X وثلاث مراوح، ويدعم DLSS 3.',
    opinion: 'يشغّل أي لعبة على 1080p بأعلى إعدادات، ويبث بالـ NVENC بدون ما يأثر على الأداء.',
  },
  ram: { img: 'images/ram.jpg',
    name: 'Kingston FURY Beast 64GB DDR5 6000 CL40', cat: 'pc', part: 'الرامات', store: 'official', url: 'https://www.kingston.com/datasheets/KF560C40BBK2-64.pdf',
    desc: 'رامات 64GB (قطعتين × 32GB) من نوع DDR5 بسرعة 6000MT/s، وتدعم XMP.',
    opinion: '64GB كثيرة شوي، بس مفيدة لما تفتح البث والمتصفح واللعبة مع بعض.',
  },
  ssd: {
    name: 'Kingston FURY Renegade 2TB', cat: 'pc', part: 'التخزين الأساسي', store: 'amazon', asin: 'B0BJL7MMNF', close: true,
    desc: 'هارد NVMe M.2 من الجيل الرابع (PCIe 4.0)، سرعته لين 7300MB/s.',
    opinion: 'الويندوز والألعاب تفتح بسرعة.',
    compare: [['الموديل', 'SFYRD/2000G', 'SFYRDK/2000G'], ['السعة', '2TB', '2TB'], ['السرعة', 'لين 7300MB/s', 'لين 7300MB/s'], ['مبرّد حراري', 'ما فيه', 'فيه (مناسب للـ PS5)']],
  },
  ssd2: { img: 'images/ssd2.jpg',
    name: 'Samsung 990 PRO 4TB Heatsink', cat: 'pc', part: 'التخزين الإضافي', store: 'amazon', asin: 'B0CHHFR1LG',
    desc: 'هارد NVMe من الجيل الرابع سعته 4TB، سرعته لين 7450MB/s، ومعه مبرّد حراري.',
    opinion: 'حاطه للتسجيلات والألعاب الكبيرة. سريع ومساحته تكفي.',
  },
  capture: { img: 'images/capture.jpg',
    name: 'ezcap324B Live Gamer RAW 4K', cat: 'pc', part: 'كرت التسجيل', store: 'amazon', asin: 'B0C28LBHVF', close: true,
    desc: 'كرت تسجيل داخلي يتركب في منفذ PCIe. تدخل فيه صورة الإكس بوكس أو أي جهاز بـ HDMI، وتبثها أو تسجلها، وتمر الصورة للشاشة بدون تأخير يذكر.',
    opinion: 'أبث فيه ألعاب الأجهزة الثانية. ما يحتاج تعريفات، يشتغل على OBS على طول.',
    compare: [['الماركة', 'ezcap', 'ERYUE (نفس الكرت 324B بماركة ثانية)'], ['أعلى تسجيل', '4K30، 1440p60، 1080p120', '4K30، 1440p60، 1080p120'], ['المنفذ', 'PCIe Gen2 x1', 'PCIe Gen2 x1']],
    extra: { label: 'الصفحة الرسمية', url: 'https://www.ezcap.com/ezcap324b' },
  },
  psu: { img: 'images/psu.jpg',
    name: 'Corsair RM750e', cat: 'pc', part: 'مزود الطاقة', store: 'amazon', asin: 'B0DPR6X7JX', close: true,
    desc: 'باور 750 واط بشهادة 80+ Gold، وكل أسلاكه تنفك (Fully Modular)، وصوته هادي.',
    opinion: 'طاقته كافية للجهاز، وصوته ما ينسمع.',
    compare: [['الإصدار', 'RM750e (CP-9020262)', 'RM750e (2025)'], ['المعيار', 'ATX 3.0', 'ATX 3.1 + سلك 12V-2x6'], ['القوة والشهادة', '750W Gold', '750W Gold']],
  },
  cooler: { img: 'images/cooler.jpg',
    name: 'DeepCool AK620', cat: 'pc', part: 'المبرد', store: 'noon',
    url: 'https://www.noon.com/saudi-ar/deepcool-ak620-120mm-pwm-fans-cpu-air-cooler-cpu-fan-support-intel-lga2066-2011-v3-2011-1700-1200-1151-1150-1155-and-amd-am5-am4-r-ak620-bknnmt-g-1/ZB6DB619027739557F5F8Z/p/',
    desc: 'مبرد هواء ببرجين و 6 أنابيب نحاس ومروحتين 120 مم.',
    opinion: 'المعالج يبقى بارد حتى في البث الطويل، وصوته هادي.',
  },
};

export const INSIDE = ['cpu', 'gpu', 'mobo', 'ram', 'ssd', 'ssd2', 'capture', 'psu', 'cooler'];

// Pieces in the 3D scene. Numbers are given at boot, left to right as the
// scene first appears (that is also the tour order).
export const SCENE = [
  { id: 'monitor-left',   product: 'lg-side',   label: 'الشاشة اليسرى' },
  { id: 'monitor-center', product: 'lg-center', label: 'الشاشة الوسطى' },
  { id: 'monitor-right',  product: 'lg-side',   label: 'الشاشة اليمنى' },
  { id: 'case',           product: 'case',      label: 'الكيس' },
  { id: 'headphones',     product: 'hd650',     label: 'السماعة' },
  { id: 'keyboard',       product: 'keyboard',  label: 'الكيبورد' },
  { id: 'mouse',          product: 'mouse',     label: 'الماوس' },
  { id: 'pad-xl',         product: 'pad-xl',    label: 'ماوس باد كبير' },
  { id: 'pad-l',          product: 'pad-l',     label: 'ماوس باد أصغر' },
  { id: 'mic',            product: 'mic',       label: 'المايك' },
  { id: 'mic-arm',        product: 'mic-arm',   label: 'ستاند المايك' },
  { id: 'interface',      product: 'interface', label: 'كرت الصوت' },
  { id: 'controller',     product: 'controller', label: 'يد التحكم' },
  { id: 'battery',        product: 'battery',   label: 'البطاريات' },
  { id: 'ringlight',      product: 'ringlight', label: 'الرينج لايت' },
  { id: 'webcam',         product: 'webcam',    label: 'الكاميرا' },
  { id: 'cam-stand',      product: 'cam-stand', label: 'ستاند الكاميرا' },
  { id: 'desk',           product: 'desk',      label: 'المكتب' },
  { id: 'chair',          product: 'chair',     label: 'الكرسي' },
];

export const SCENE_BY_ID = Object.fromEntries(SCENE.map(s => [s.id, s]));
// Every distinct product counts once toward "اكتشفت X من 27".
export const TOTAL = Object.keys(PRODUCTS).length;

export function productLink(p) {
  if (p.store === 'amazon') return { url: amazon(p.asin), label: 'شوف المنتج', sponsored: true };
  if (p.store === 'noon' || p.store === 'official') return { url: p.url, label: 'شوف المنتج' };
  return null;
}
