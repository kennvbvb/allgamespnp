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
  },
  {
    "title": "กระดานภารกิจทีมประชาธิปไตย",
    "description": "",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.4"
    ],
    "url": "https://script.google.com/macros/s/AKfycbwkvO0ammcY77NsiMByq-pAT47cB_cFPJUIw1SjoDUZrtjzTvkWcghXLBBcugf96l1xsg/exec",
    "color": "#4f8ef7"
  },
  {
    "title": "นักโบราณคดีน้อย",
    "description": "",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.4"
    ],
    "url": "https://script.google.com/macros/s/AKfycbz_jwq9k942xWJkZlPFPCvFhnK8A07rlxqcZWnACtySvuRLlCSmxCG7LIZHJtShWH5O/exec",
    "color": "#1d6303"
  },
  {
    "title": "ภารกิจทะเบียนราษฎร",
    "description": "",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.6"
    ],
    "url": "https://script.google.com/macros/s/AKfycbwYdrzsJUrxBiGcY85BUS6FDR6KGv3BNcxHLuIaZ5PuNo2NEz0c4Ncxbb2J8w5quDgx/exec",
    "color": "#003899"
  },
  {
    "title": "ภารกิจพลเมืองดี รู้สิทธิ รู้หน้าที่",
    "description": "",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.5"
    ],
    "url": "https://script.google.com/macros/s/AKfycbzUMA-WUDpGgLa9T2bvosnAo0Usge3s5uO9Hh_jKhmaQgsX_90M-d9enaoAD9MU0Rua/exec",
    "color": "#4f8ef7"
  },
  {
    "title": "เกมพลเมืองดี",
    "description": "",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.4"
    ],
    "url": "https://script.google.com/macros/s/AKfycby6WaMKeO_PyDAS4zsYN8mr24-SFyYugo_JBWGwmLjAQ7ejLixJhbCD6oMs44WpSu6Wpw/exec",
    "color": "#e114b5"
  },
  {
    "title": "ฮีโร่พิทักษ์สิทธิเด็ก",
    "description": "",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.5"
    ],
    "url": "https://script.google.com/macros/s/AKfycbx-WB45gk236f9wg0h_jv0gYoTWWlHTs8-zBMwLyGYjGXaoqbjiNNt2zcgUMTzT2Izl/exec",
    "color": "#ff9d14"
  },
  {
    "title": "เกมธรรมะหรรษา",
    "description": "",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.3"
    ],
    "url": "https://script.google.com/macros/s/AKfycbzIpjsSHiVx9VPPLg2ocMj3FvwJcgKLxRMLe8jtDAFCP0VROH8oGFBvfpfwgjuSOhFg/exec",
    "color": "#ccb100"
  },
  {
    "title": "เกมส์พิทักษ์สิทธิเด็ก",
    "description": "",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.5"
    ],
    "url": "https://script.google.com/macros/s/AKfycbyxSLhejIR8RV02cgk3PhconhD41jItKb6G1IbRWyw2LSOztfbOgcKokGvGSxCns7Fr/exec",
    "color": "#dbafe4"
  },
  {
    "title": "กระดานตลาดทุเรียน",
    "description": "",
    "subject": "บูรณาการ",
    "grades": [
      "ป.5"
    ],
    "url": "https://script.google.com/macros/s/AKfycbzOlRW-FH3gxN6S9NrOeODPfSGwGMQeB79N0gWiDGDA_KFWK8ENFhrGM5odWMQ_vxej/exec",
    "color": "#1a7425"
  },
  {
    "title": "เกมคำใบ้ขึ้นจอ",
    "description": "ศาสนาเปรียบเทียบ",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.6"
    ],
    "url": "https://script.google.com/macros/s/AKfycbx8mvGXGt38Rb8-IJcqqKPsYt_JDpKUeWdnA15klheCkiqBHRzajDSefPb465vqNegPKQ/exec",
    "color": "#b6d0fb"
  },
  {
    "title": "ท่องแดนธรรม นำปัญญา",
    "description": "",
    "subject": "สังคมศึกษาฯ",
    "grades": [
      "ป.6"
    ],
    "url": "https://script.google.com/macros/s/AKfycby2ElaaTLeNkAQHMAHXTYO1PjSeOqwol8QNJo_zA62y9uQNK0KSGhXHXKKkYTTcAPBI/exec",
    "color": "#f59b00"
  }
];

window.GAMES = GAMES;
