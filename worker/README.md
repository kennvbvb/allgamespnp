# 🔐 ระบบล็อกอินหน้า admin (ไม่ต้องวาง token เอง)

ปกติหน้า `admin.html` ให้ครูสร้าง **PAT** แล้ว copy-paste เอง ซึ่งมีข้อเสีย: หมดอายุแล้วต้องทำใหม่, เสี่ยงหลุดถ้าเผลอวางผิดที่, และใช้บนเครื่องคนอื่นไม่ปลอดภัย

ตัวนี้เปลี่ยนเป็น **กดปุ่มเดียวล็อกอินด้วยบัญชี GitHub** โดย:

- เบราว์เซอร์ **ไม่เคยถือ token เลย** — token ถูกเข้ารหัสเก็บใน cookie แบบ `HttpOnly` ที่ JavaScript อ่านไม่ได้
- Worker เป็นคนคุยกับ GitHub แทน และ **ล็อกไว้ที่ repo เดียว + แก้ได้แค่ `games.js` กับ `announcement.js`** (แม้ session หลุดก็แก้ workflow หรือโค้ดเว็บไม่ได้)
- อนุญาตเฉพาะ GitHub username ที่กำหนดไว้ (`ALLOWED_LOGINS`)
- session หมดอายุเองใน 8 ชั่วโมง

> ⚠️ **ถ้าไม่ตั้งค่าอะไรเลย หน้า admin ยังใช้ token แบบเดิมได้เหมือนเดิม** — ตัวนี้เป็นทางเลือกเสริม ไม่ได้บังคับ

---

## สิ่งที่ต้องมี

- บัญชี **Cloudflare** (ฟรี — ไม่ต้องผูกบัตร สำหรับ Workers free plan)
- Node.js บนเครื่องที่จะ deploy (ใช้ `npx` เรียก wrangler ได้เลย ไม่ต้องติดตั้งถาวร)

เวลาที่ใช้ประมาณ **10–15 นาที** ทำครั้งเดียว

---

## ขั้นที่ 1 — สร้าง GitHub OAuth App

1. เปิด <https://github.com/settings/developers> → แท็บ **OAuth Apps** → กด **New OAuth App**
2. กรอก:
   | ช่อง | ใส่ว่า |
   |---|---|
   | Application name | `allgamespnp admin` |
   | Homepage URL | `https://kennvbvb.github.io/allgamespnp/` |
   | Authorization callback URL | `https://allgamespnp-admin.ชื่อบัญชีของคุณ.workers.dev/auth/callback` |
3. กด **Register application**
4. คัดลอก **Client ID** เก็บไว้
5. กด **Generate a new client secret** → คัดลอก **Client secret** เก็บไว้ (โชว์ครั้งเดียว!)

> ยังไม่รู้ URL ของ worker? ทำขั้นที่ 2 ให้จบก่อน (จะได้ URL มา) แล้วกลับมาแก้ callback URL ตรงนี้

---

## ขั้นที่ 2 — deploy Worker

เปิด Terminal ที่โฟลเดอร์ `worker/` ของโปรเจกต์นี้ แล้วรัน:

```bash
cd worker

# ล็อกอิน Cloudflare (จะเปิดเบราว์เซอร์ให้กดอนุญาต)
npx wrangler login

# deploy — จะได้ URL กลับมา เช่น https://allgamespnp-admin.xxx.workers.dev
npx wrangler deploy
```

**จด URL ที่ได้ไว้** แล้วกลับไปแก้ *Authorization callback URL* ในขั้นที่ 1 ให้เป็น `<URL ที่ได้>/auth/callback`

---

## ขั้นที่ 3 — ใส่ค่าความลับ

รันทีละคำสั่ง (จะถามค่าให้พิมพ์/วาง):

```bash
npx wrangler secret put GITHUB_CLIENT_ID        # วาง Client ID จากขั้นที่ 1
npx wrangler secret put GITHUB_CLIENT_SECRET    # วาง Client secret จากขั้นที่ 1
npx wrangler secret put SESSION_SECRET          # วางข้อความสุ่มยาวๆ (ดูวิธีสร้างด้านล่าง)
```

วิธีสร้าง `SESSION_SECRET` แบบสุ่ม:

```bash
openssl rand -base64 32
```

ค่าอื่นที่ไม่เป็นความลับ ตั้งไว้ใน `wrangler.toml` แล้ว — แก้ได้ถ้าต้องการ:

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `SITE_ORIGIN` | `https://kennvbvb.github.io` | เว็บที่อนุญาตให้เรียก (กัน CSRF) |
| `SITE_ADMIN_URL` | `.../allgamespnp/admin.html` | หน้าที่จะส่งกลับหลังล็อกอิน |
| `REPO_OWNER` / `REPO_NAME` | `kennvbvb` / `allgamespnp` | repo เดียวที่ worker แก้ได้ |
| `ALLOWED_LOGINS` | `kennvbvb` | GitHub username ที่อนุญาต (หลายคนคั่นด้วย `,`) |

แก้ `wrangler.toml` แล้วต้อง `npx wrangler deploy` อีกครั้ง

---

## ขั้นที่ 4 — บอกหน้า admin ว่าใช้ระบบล็อกอิน

1. เปิดหน้า **จัดการเกม** (`admin.html`)
2. กาง **⚙️ ตั้งค่าขั้นสูง**
3. ช่อง **"ที่อยู่ระบบล็อกอิน (Cloudflare Worker)"** → วาง URL ของ worker
4. ช่องวาง token จะหายไป เปลี่ยนเป็นปุ่ม **🔐 เข้าสู่ระบบด้วย GitHub** — กดแล้วใช้งานได้เลย

เสร็จแล้ว ครั้งต่อไปเปิดหน้า admin ก็กดล็อกอินปุ่มเดียว ไม่ต้องหา token อีก

---

## ถ้ามีปัญหา

| อาการ | สาเหตุที่พบบ่อย |
|---|---|
| `ล็อกอินไม่สำเร็จ — บัญชีนี้ไม่อยู่ในรายชื่อที่อนุญาต` | `ALLOWED_LOGINS` ยังไม่มี username ของคุณ → แก้ `wrangler.toml` แล้ว deploy ใหม่ |
| `แลกรหัสกับ GitHub ไม่สำเร็จ` | `GITHUB_CLIENT_SECRET` ผิด หรือยังไม่ได้ตั้ง |
| กดล็อกอินแล้ว GitHub ฟ้อง `redirect_uri mismatch` | callback URL ใน OAuth App ไม่ตรงกับ `<worker URL>/auth/callback` |
| ล็อกอินผ่าน แต่บันทึกไม่ได้ | ยังไม่ได้ deploy ทับหลังแก้ `wrangler.toml` หรือ `REPO_OWNER`/`REPO_NAME` ผิด |
| อยากเลิกใช้ | ลบ URL ในช่อง "ที่อยู่ระบบล็อกอิน" ออก → กลับไปใช้ token แบบเดิมทันที |

ดูปัญหาแบบละเอียด: `npx wrangler tail` (ดู log สดของ worker)

---

## หมายเหตุด้านความปลอดภัย

- cookie ตั้งเป็น `SameSite=None` เพราะหน้าเว็บ (`github.io`) กับ worker (`workers.dev`) อยู่ต่าง site จึงจำเป็น — ชดเชยด้วยการ **ตรวจ `Origin` ทุก request ที่เปลี่ยนข้อมูล**
- `scope` ที่ขอจาก GitHub คือ `public_repo` (พอสำหรับ commit ไฟล์ใน repo สาธารณะ) แต่ worker บังคับให้เขียนได้แค่ repo และไฟล์ที่กำหนดไว้เท่านั้น
- ถ้าอยากให้ CSP เข้มขึ้น: แก้ `connect-src` ใน `admin.html` จาก `https://*.workers.dev` เป็น URL worker ของคุณตรงๆ

---

## เส้นทางที่ worker เปิดให้ใช้

| เส้นทาง | หน้าที่ | ต้องล็อกอิน | ตรวจ Origin |
|---|---|---|---|
| `GET /auth/login` | พาไปหน้าอนุญาตของ GitHub | – | – |
| `GET /auth/callback` | แลกรหัสเป็น session แล้วส่งกลับหน้า admin | – | – |
| `POST /auth/logout` | ล้าง session | – | ✓ |
| `GET /api/me` | บอกว่าใครล็อกอินอยู่ | ✓ | – |
| `GET /api/file` | อ่านไฟล์ (`ref` = branch หรือ sha ของ commit เก่า) | ✓ | ✓ |
| `GET /api/history` | รายชื่อ commit ล่าสุดของไฟล์ (ใช้กับ "ประวัติการแก้ไข") | ✓ | ✓ |
| `POST /api/commit` | เขียนไฟล์กลับขึ้น repo | ✓ | ✓ |

ทุกเส้นทางที่แตะไฟล์จำกัดไว้เฉพาะ `games.js` และ `announcement.js` เท่านั้น (ตัวแปร `ALLOWED_PATHS` ใน `index.js`)
`/api/history` ส่งกลับเฉพาะ `sha` / เวลา / ชื่อผู้แก้ / ข้อความ commit — ไม่ส่งข้อมูลดิบจาก GitHub ต่อ (เช่น อีเมลผู้แก้)
