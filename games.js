/* ============================================================
   รายการเกมทั้งหมด — ไฟล์นี้แก้ผ่านหน้า "จัดการเกม" (admin.html)
   หรือจะแก้มือก็ได้ (เป็น JSON ปกติ)
   ============================================================ */

const GAMES = [
  {
    "title": "ตราดเมืองนี้...ใครดูแล?",
    "description": "เรียนรู้การปกครองส่วนท้องถิ่นผ่านจังหวัดตราด ว่าใครดูแลบ้านเมืองของเรา เล่นแข่งเป็นทีม",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.6"
    ],
    "url": "https://script.google.com/macros/s/AKfycbzPaqUlPw0KL-KUXgXky3Zg5KmgCRX1e-bWPKkcRGwWWu4mDoUiBPRVe_fsJNnj38uCLg/exec",
    "emoji": "🏛️",
    "color": "#0e7490"
  },
  {
    "title": "ตะลุย 4 ภาค ล่าขุมทรัพย์วัฒนธรรมไทย",
    "description": "",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.4"
    ],
    "url": "https://script.google.com/macros/s/AKfycbyh06btl1iUVI-qbQX5Kd3M6_xMliVz3cWxvXnCjyIFyMAfmw9NkxnNuRAqCedLWR4V/exec",
    "color": "#4f8ef7"
  },
  {
    "title": "แบบทดสอบท้องถิ่นกับชุมชน",
    "description": "",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.5"
    ],
    "url": "https://script.google.com/macros/s/AKfycbx90G6p6Bwe8y9ZFEqPg79t4sA6um5bcCN8ubikzlUr_PbwgaJgJ5T1jYeWboYSWE3E/exec",
    "color": "#4f8ef7"
  },
  {
    "title": "วัฒนธรรมน่ารู้",
    "description": "",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.4"
    ],
    "url": "https://script.google.com/macros/s/AKfycby0M2jFxxZddwDYLjEyDEhqUP4i9kLUWyiv88jAN2HnWLB_Porfgdq-LYNEQKgjpOwe/exec",
    "color": "#ee291b"
  },
  {
    "title": "อารยธรรมจีนกับไทยและอาเซียน",
    "description": "",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.5"
    ],
    "url": "https://script.google.com/macros/s/AKfycbx7mQ35S7qcyknVPWIuIyK4BxdRVUOVlJTC6dFye9D0NRd1SehgYxXLVRF1GjihEEIwOQ/exec",
    "color": "#e90101"
  },
  {
    "title": "4 กุญแจพิทักษ์สิทธิเด็ก",
    "description": "",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.4"
    ],
    "url": "https://script.google.com/macros/s/AKfycbxT0mM8453Aii25tT1AwgroTrN0tKnEgw0rtBCYEZDRAXMQVoNwFCWyDO3Ybxsl4_Y/exec",
    "color": "#7119f5"
  },
  {
    "title": "ศึกปัญญา รัตนโกสินทร์รุ่งเรือง",
    "description": "",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.6"
    ],
    "url": "https://script.google.com/macros/s/AKfycbwsO2Okq_20whV8_DIGeMy02OwYYQxLIjKqUPWaXtt7gomK6vzg2KBYG-0BXbGArm5OVQ/exec",
    "color": "#064aa2"
  },
  {
    "title": "แบบทดสอบ กฎหมายน่ารู้",
    "description": "",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.6"
    ],
    "url": "https://script.google.com/macros/s/AKfycbySNoetU34kkLWr7NryrCSehPATht0OXC5Xm5J-DdDltFl84_naVh636613DvRNrn9o/exec",
    "color": "#4200bd"
  }
];

window.GAMES = GAMES;
