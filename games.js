/* ============================================================
   รายการเกมทั้งหมด — ไฟล์นี้แก้ผ่านหน้า "จัดการเกม" (admin.html)
   หรือจะแก้มือก็ได้ (เป็น JSON ปกติ)
   หมายเหตุ: ห้ามเปลี่ยน "id" ของเกมที่เผยแพร่แล้ว (ลิงก์แชร์อ้างจาก id)
   ============================================================ */

const GAMES = [
  {
    "id": "game",
    "title": "ตราดเมืองนี้...ใครดูแล?",
    "description": "เรียนรู้การปกครองส่วนท้องถิ่นผ่านจังหวัดตราด ว่าใครดูแลบ้านเมืองของเรา เล่นแข่งเป็นทีม",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.6"
    ],
    "url": "https://script.google.com/macros/s/AKfycbzPaqUlPw0KL-KUXgXky3Zg5KmgCRX1e-bWPKkcRGwWWu4mDoUiBPRVe_fsJNnj38uCLg/exec",
    "emoji": "🏛️",
    "color": "#0e7490",
    "topic": "การปกครองส่วนท้องถิ่น",
    "mode": "ทีม",
    "tags": [
      "หน้าที่พลเมือง",
      "ท้องถิ่น"
    ]
  },
  {
    "id": "game-2",
    "title": "ตะลุย 4 ภาค ล่าขุมทรัพย์วัฒนธรรมไทย",
    "description": "ผจญภัย 4 ภาค เรียนรู้วัฒนธรรมท้องถิ่นไทยแต่ละภูมิภาค",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.4"
    ],
    "url": "https://script.google.com/macros/s/AKfycbyh06btl1iUVI-qbQX5Kd3M6_xMliVz3cWxvXnCjyIFyMAfmw9NkxnNuRAqCedLWR4V/exec",
    "emoji": "🗺️",
    "color": "#4f8ef7",
    "topic": "ภูมิภาคและวัฒนธรรมไทย",
    "tags": [
      "ภูมิศาสตร์",
      "วัฒนธรรม"
    ]
  },
  {
    "id": "game-3",
    "title": "แบบทดสอบท้องถิ่นกับชุมชน",
    "description": "แบบทดสอบเรื่องท้องถิ่นและชุมชนของเรา",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.5"
    ],
    "url": "https://script.google.com/macros/s/AKfycbx90G6p6Bwe8y9ZFEqPg79t4sA6um5bcCN8ubikzlUr_PbwgaJgJ5T1jYeWboYSWE3E/exec",
    "emoji": "📝",
    "color": "#4f8ef7",
    "topic": "ท้องถิ่นและชุมชน",
    "tags": [
      "ท้องถิ่น",
      "แบบทดสอบ"
    ]
  },
  {
    "id": "game-4",
    "title": "วัฒนธรรมน่ารู้",
    "description": "เรียนรู้ขนบธรรมเนียมและวัฒนธรรมไทยแบบสนุกๆ",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.4"
    ],
    "url": "https://script.google.com/macros/s/AKfycby0M2jFxxZddwDYLjEyDEhqUP4i9kLUWyiv88jAN2HnWLB_Porfgdq-LYNEQKgjpOwe/exec",
    "emoji": "🎭",
    "color": "#ee291b",
    "topic": "ขนบธรรมเนียมและวัฒนธรรมไทย",
    "tags": [
      "วัฒนธรรม"
    ]
  },
  {
    "id": "game-5",
    "title": "อารยธรรมจีนกับไทยและอาเซียน",
    "description": "เชื่อมโยงอารยธรรมจีนกับไทยและเพื่อนบ้านอาเซียน",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.5"
    ],
    "url": "https://script.google.com/macros/s/AKfycbx7mQ35S7qcyknVPWIuIyK4BxdRVUOVlJTC6dFye9D0NRd1SehgYxXLVRF1GjihEEIwOQ/exec",
    "emoji": "🏯",
    "color": "#e90101",
    "topic": "อารยธรรมและอาเซียน",
    "tags": [
      "ประวัติศาสตร์",
      "อาเซียน"
    ]
  },
  {
    "id": "game-6",
    "title": "4 กุญแจพิทักษ์สิทธิเด็ก",
    "description": "เรียนรู้สิทธิเด็ก 4 ด้านผ่านภารกิจ",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.4"
    ],
    "url": "https://script.google.com/macros/s/AKfycbxT0mM8453Aii25tT1AwgroTrN0tKnEgw0rtBCYEZDRAXMQVoNwFCWyDO3Ybxsl4_Y/exec",
    "emoji": "🔑",
    "color": "#7119f5",
    "topic": "สิทธิเด็ก 4 ด้าน",
    "tags": [
      "หน้าที่พลเมือง",
      "สิทธิเด็ก"
    ]
  },
  {
    "id": "game-7",
    "title": "ศึกปัญญา รัตนโกสินทร์รุ่งเรือง",
    "description": "ตอบคำถามประวัติศาสตร์สมัยรัตนโกสินทร์",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.6"
    ],
    "url": "https://script.google.com/macros/s/AKfycbwsO2Okq_20whV8_DIGeMy02OwYYQxLIjKqUPWaXtt7gomK6vzg2KBYG-0BXbGArm5OVQ/exec",
    "emoji": "👑",
    "color": "#064aa2",
    "topic": "ประวัติศาสตร์รัตนโกสินทร์",
    "tags": [
      "ประวัติศาสตร์"
    ]
  },
  {
    "id": "game-8",
    "title": "แบบทดสอบ กฎหมายน่ารู้",
    "description": "แบบทดสอบกฎหมายใกล้ตัวที่ควรรู้",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.6"
    ],
    "url": "https://script.google.com/macros/s/AKfycbySNoetU34kkLWr7NryrCSehPATht0OXC5Xm5J-DdDltFl84_naVh636613DvRNrn9o/exec",
    "emoji": "⚖️",
    "color": "#4200bd",
    "topic": "กฎหมายใกล้ตัว",
    "tags": [
      "หน้าที่พลเมือง",
      "กฎหมาย",
      "แบบทดสอบ"
    ]
  },
  {
    "id": "game-9",
    "title": "กระดานภารกิจทีมประชาธิปไตย",
    "description": "เกมกระดานเรียนรู้ประชาธิปไตย เล่นเป็นทีม",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.4"
    ],
    "url": "https://script.google.com/macros/s/AKfycbwkvO0ammcY77NsiMByq-pAT47cB_cFPJUIw1SjoDUZrtjzTvkWcghXLBBcugf96l1xsg/exec",
    "emoji": "🗳️",
    "color": "#4f8ef7",
    "topic": "ประชาธิปไตย",
    "mode": "ทีม",
    "tags": [
      "หน้าที่พลเมือง",
      "เกมกระดาน"
    ]
  },
  {
    "id": "game-10",
    "title": "นักโบราณคดีน้อย",
    "description": "สวมบทนักโบราณคดี เรียนรู้หลักฐานทางประวัติศาสตร์",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.4"
    ],
    "url": "https://script.google.com/macros/s/AKfycbz_jwq9k942xWJkZlPFPCvFhnK8A07rlxqcZWnACtySvuRLlCSmxCG7LIZHJtShWH5O/exec",
    "emoji": "🏺",
    "color": "#1d6303",
    "topic": "หลักฐานทางประวัติศาสตร์",
    "tags": [
      "ประวัติศาสตร์"
    ]
  },
  {
    "id": "game-11",
    "title": "ภารกิจทะเบียนราษฎร",
    "description": "เรียนรู้งานทะเบียนราษฎรและเอกสารสำคัญของพลเมือง",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.6"
    ],
    "url": "https://script.google.com/macros/s/AKfycbwYdrzsJUrxBiGcY85BUS6FDR6KGv3BNcxHLuIaZ5PuNo2NEz0c4Ncxbb2J8w5quDgx/exec",
    "emoji": "📋",
    "color": "#003899",
    "topic": "งานทะเบียนราษฎร",
    "tags": [
      "หน้าที่พลเมือง"
    ]
  },
  {
    "id": "game-12",
    "title": "ภารกิจพลเมืองดี รู้สิทธิ รู้หน้าที่",
    "description": "เรียนรู้สิทธิและหน้าที่ของพลเมืองดี",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.5"
    ],
    "url": "https://script.google.com/macros/s/AKfycbzUMA-WUDpGgLa9T2bvosnAo0Usge3s5uO9Hh_jKhmaQgsX_90M-d9enaoAD9MU0Rua/exec",
    "emoji": "🤝",
    "color": "#4f8ef7",
    "topic": "สิทธิและหน้าที่พลเมือง",
    "tags": [
      "หน้าที่พลเมือง"
    ]
  },
  {
    "id": "game-13",
    "title": "เกมพลเมืองดี",
    "description": "ฝึกเป็นพลเมืองดีในสังคม",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.4"
    ],
    "url": "https://script.google.com/macros/s/AKfycby6WaMKeO_PyDAS4zsYN8mr24-SFyYugo_JBWGwmLjAQ7ejLixJhbCD6oMs44WpSu6Wpw/exec",
    "emoji": "🌟",
    "color": "#e114b5",
    "topic": "พลเมืองดีในสังคม",
    "tags": [
      "หน้าที่พลเมือง"
    ]
  },
  {
    "id": "game-14",
    "title": "ฮีโร่พิทักษ์สิทธิเด็ก",
    "description": "สวมบทฮีโร่ปกป้องสิทธิเด็ก",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.5"
    ],
    "url": "https://script.google.com/macros/s/AKfycbx-WB45gk236f9wg0h_jv0gYoTWWlHTs8-zBMwLyGYjGXaoqbjiNNt2zcgUMTzT2Izl/exec",
    "emoji": "🦸",
    "color": "#ff9d14",
    "topic": "สิทธิเด็ก",
    "tags": [
      "หน้าที่พลเมือง",
      "สิทธิเด็ก"
    ]
  },
  {
    "id": "game-15",
    "title": "เกมธรรมะหรรษา",
    "description": "เรียนหลักธรรมพุทธศาสนาแบบสนุกๆ",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.3"
    ],
    "url": "https://script.google.com/macros/s/AKfycbzIpjsSHiVx9VPPLg2ocMj3FvwJcgKLxRMLe8jtDAFCP0VROH8oGFBvfpfwgjuSOhFg/exec",
    "emoji": "🪷",
    "color": "#ccb100",
    "topic": "หลักธรรมพุทธศาสนา",
    "tags": [
      "ศาสนา"
    ]
  },
  {
    "id": "game-16",
    "title": "เกมส์พิทักษ์สิทธิเด็ก",
    "description": "เรียนรู้และปกป้องสิทธิเด็ก",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.5"
    ],
    "url": "https://script.google.com/macros/s/AKfycbyxSLhejIR8RV02cgk3PhconhD41jItKb6G1IbRWyw2LSOztfbOgcKokGvGSxCns7Fr/exec",
    "emoji": "🛡️",
    "color": "#dbafe4",
    "topic": "สิทธิเด็ก",
    "tags": [
      "หน้าที่พลเมือง",
      "สิทธิเด็ก"
    ]
  },
  {
    "id": "game-17",
    "title": "กระดานตลาดทุเรียน",
    "description": "เกมกระดานจำลองตลาดทุเรียน บูรณาการหลายวิชา",
    "subject": "บูรณาการ",
    "grades": [
      "ป.5"
    ],
    "url": "https://script.google.com/macros/s/AKfycbzOlRW-FH3gxN6S9NrOeODPfSGwGMQeB79N0gWiDGDA_KFWK8ENFhrGM5odWMQ_vxej/exec",
    "emoji": "🛒",
    "color": "#1a7425",
    "topic": "ตลาดและการซื้อขาย",
    "tags": [
      "เศรษฐศาสตร์",
      "เกมกระดาน"
    ]
  },
  {
    "id": "game-18",
    "title": "เกมคำใบ้ขึ้นจอ",
    "description": "ศาสนาเปรียบเทียบ",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.6"
    ],
    "url": "https://script.google.com/macros/s/AKfycbx8mvGXGt38Rb8-IJcqqKPsYt_JDpKUeWdnA15klheCkiqBHRzajDSefPb465vqNegPKQ/exec",
    "emoji": "💡",
    "color": "#b6d0fb",
    "topic": "ศาสนาเปรียบเทียบ",
    "tags": [
      "ศาสนา"
    ]
  },
  {
    "id": "game-19",
    "title": "ท่องแดนธรรม นำปัญญา",
    "description": "ท่องโลกธรรมะ เรียนรู้หลักธรรมนำปัญญา",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.6"
    ],
    "url": "https://script.google.com/macros/s/AKfycby2ElaaTLeNkAQHMAHXTYO1PjSeOqwol8QNJo_zA62y9uQNK0KSGhXHXKKkYTTcAPBI/exec",
    "emoji": "🧘",
    "color": "#f59b00",
    "topic": "หลักธรรมนำปัญญา",
    "tags": [
      "ศาสนา"
    ]
  }
];

window.GAMES = GAMES;
