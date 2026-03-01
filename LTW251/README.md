# Lowland Coffee - PHP MVC Web Application

**Bài tập lớn: Lập trình web (HK1 2025-2026)**

Khung ứng dụng web bán cà phê sử dụng mô hình MVC (Model-View-Controller) thuần PHP không sử dụng framework.
Các module chính gồm: Trang chủ, Giới thiệu, Thực đơn (sản phẩm), Tin tức, FAQ, Liên hệ và khu vực Quản trị Admin.

## 👥 Thành viên nhóm

| STT | Tên                 | MSSV    |
| --- | ------------------- | ------- |
| 1   | Hồ Anh Dũng         | 2310543 |
| 2   | Lê Thành Nghĩa      | 2312264 |
| 3   | Vũ Trọng Nghĩa      | 2312291 |
| 4   | Nguyễn Mai Huy Phát | 2312589 |

---

## 1. Yêu cầu môi trường

### Cách 1: Sử dụng Docker (✅ Khuyến nghị)

- Docker Desktop (Windows/Mac) hoặc Docker Engine (Linux)
- Không cần cài MySQL hay PHP riêng lẻ

### Cách 2: Chạy trực tiếp (Local)

- PHP 8.2 trở lên
- MySQL Server 8.0 trở lên
- Hệ điều hành: Windows (PowerShell) hoặc Linux/Mac (Bash)

---

## 2. Cài đặt & Chạy ứng dụng

### 🐳 Phương pháp 1: Docker (Recommended)

#### a) Chuẩn bị

Đảm bảo bạn đã cài Docker Desktop và đang ở thư mục project:

```powershell
cd C:\Users\HAD\Desktop\php-mvc-starter
```

#### b) Khởi động containers

```powershell
docker compose up -d
```

**Chờ khoảng 10-15 giây** để database khởi tạo xong. Kiểm tra trạng thái:

```powershell
docker compose ps
```

Khi thấy:

```
✔ Container lowland_db   Healthy
✔ Container lowland_app  Running
```

→ **Setup hoàn thành!** ✅

#### c) Truy cập ứng dụng

Mở trình duyệt và truy cập:

- 🌐 **Trang chủ:** http://localhost:9999
- 📊 **Admin:** http://localhost:9999/?r=admin/index
- 💬 **FAQ:** http://localhost:9999/?r=faq/list
- 📧 **Liên hệ:** http://localhost:9999/?r=site/contact

#### d) Dừng containers

```powershell
# Dừng nhưng giữ dữ liệu
docker compose down

# Dừng và xóa tất cả (bao gồm database)
docker compose down -v
```

#### e) Xem logs

```powershell
# Xem logs real-time
docker compose logs -f

# Xem 20 dòng log cuối
docker compose logs --tail 20
```

---

### 💻 Phương pháp 2: Chạy trực tiếp (Local)

#### a) Khởi tạo database

1. Đảm bảo MySQL server đang chạy trên `127.0.0.1:3306`

2. Sửa file `config/config.php` nếu cần:

   ```php
   define('DB_HOST', '127.0.0.1');
   define('DB_NAME', 'lowland_coffee');
   define('DB_USER', 'web251');
   define('DB_PASS', 'Webhk251!');
   ```

3. Chạy script khởi tạo database:
   ```powershell
   cd C:\Users\HAD\Desktop\php-mvc-starter
   .\setup_db.bat
   ```

#### b) Chạy PHP built-in server

```powershell
php -S localhost:9999 -t public
```

#### c) Truy cập ứng dụng

Mở trình duyệt tại: http://localhost:9999

---

## 3. Các routes chính

### 🌐 Trang công khai (Public)

| Trang               | URL                          |
| ------------------- | ---------------------------- |
| Trang chủ           | `/` hoặc `/?r=home/index`    |
| Giới thiệu          | `/?r=page/about`             |
| Thực đơn (Sản phẩm) | `/?r=product/list`           |
| Chi tiết sản phẩm   | `/?r=product/detail&id={id}` |
| Tin tức / Blog      | `/?r=post/list`              |
| Chi tiết bài viết   | `/?r=post/detail&id={id}`    |
| FAQ (Hỏi đáp)       | `/?r=faq/list`               |
| Liên hệ             | `/?r=site/contact`           |
| Giỏ hàng            | `/?r=cart/index`             |

### 🔐 Xác thực (Authentication)

| Trang                | URL                 |
| -------------------- | ------------------- |
| Đăng ký              | `/?r=auth/register` |
| Đăng nhập            | `/?r=auth/login`    |
| Tài khoản người dùng | `/?r=user/profile`  |

### 👨‍💼 Khu vực Quản trị (Admin Panel)

| Chức năng                      | URL                         |
| ------------------------------ | --------------------------- |
| Dashboard                      | `/?r=admin/index`           |
| Quản lý người dùng             | `/?r=adminuser/list`        |
| Quản lý sản phẩm               | `/?r=adminproduct/list`     |
| Quản lý đơn hàng               | `/?r=adminorder/list`       |
| Quản lý bài viết               | `/?r=adminpost/list`        |
| Quản lý bình luận              | `/?r=admincomment/list`     |
| Quản lý FAQ                    | `/?r=adminfaq/list`         |
| Quản lý FAQ - Câu hỏi từ khách | `/?r=adminFaqQuestion/list` |
| Quản lý trang giới thiệu       | `/?r=adminpage/editAbout`   |
| Quản lý liên hệ                | `/?r=admin/contacts`        |

---

## 4. Tài khoản mẫu

Sau khi setup xong, hệ thống tạo sẵn các tài khoản để test:

### Admin (Quản trị viên)

```
Email:  admin@example.com
Mật khẩu: 123456
Vai trò: Admin (có toàn bộ quyền quản lý)
```

### Tạo tài khoản khách hàng mới

1. Truy cập: `/?r=auth/register`
2. Nhập thông tin: Họ tên, Số điện thoại, Email, Mật khẩu
3. Sau khi đăng ký, bạn sẽ được tự động đăng nhập với vai trò `user`

---

## 5. Cấu trúc thư mục

```
php-mvc-starter/
├── app/
│   ├── Controllers/          # Các controller xử lý logic (PHP)
│   │   ├── BaseController.php
│   │   ├── HomeController.php
│   │   ├── AuthController.php
│   │   ├── ProductController.php
│   │   ├── PostController.php
│   │   ├── FaqController.php
│   │   ├── AdminController.php
│   │   └── ...
│   ├── Models/               # Các model xử lý database
│   │   └── DB.php           # Kết nối database PDO
│   └── Views/                # Các view template HTML
│       ├── layouts/          # Template chung
│       ├── home/
│       ├── product/
│       ├── post/
│       ├── admin/
│       └── ...
├── config/
│   └── config.php           # Cấu hình ứng dụng (database, timezone, etc)
├── public/
│   ├── index.php            # Entry point chính (Front Controller)
│   ├── assets/              # CSS, JS, hình ảnh
│   │   ├── main.css
│   │   └── images/
│   └── uploads/             # Thư mục lưu file upload
│       ├── avatars/
│       ├── pages/
│       └── products/
├── docker-compose.yml       # Cấu hình Docker
├── Dockerfile               # Image PHP + Apache
├── schema.sql              # Script khởi tạo database
├── setup_db.bat            # Script setup database (Local)
└── README.md               # Hướng dẫn này
```

---

## 6. Công nghệ sử dụng

### Backend

- **PHP 8.2** - Ngôn ngữ lập trình phía server
- **MySQL 8.0** - Cơ sở dữ liệu quan hệ
- **PDO** - Kết nối database an toàn chống SQL Injection
- **MVC Architecture** - Mô hình kiến trúc (viết từ đầu, không dùng framework)

### Frontend

- **HTML5** - Cấu trúc nội dung
- **CSS3** - Styling & Responsive Design
- **Bootstrap 5** - Framework CSS (trang công khai)
- **Tabler Admin** - Dashboard template (trang quản trị)
- **JavaScript** - Tương tác & validation (client-side)
- **Font Awesome & Bootstrap Icons** - Icon libraries

### DevOps

- **Docker** - Container hoá ứng dụng
- **Docker Compose** - Quản lý multi-container
- **Apache 2.4** - Web server
- **Git** - Quản lý phiên bản mã nguồn

---

## 7. Các tính năng chính

### 🌐 Trang công khai

✅ **Trang chủ** - Hero banner, sản phẩm nổi bật, tin tức mới  
✅ **Giới thiệu** - Nội dung động từ database  
✅ **Thực đơn** - Danh sách sản phẩm, tìm kiếm, filter  
✅ **Chi tiết sản phẩm** - Thông tin chi tiết + giỏ hàng  
✅ **Tin tức / Blog** - Danh sách bài viết, tìm kiếm  
✅ **FAQ** - Hỏi đáp, người dùng có thể đặt câu hỏi  
✅ **Liên hệ** - Form gửi liên hệ, admin có thể phản hồi qua email

### 🔐 Xác thực & Tài khoản

✅ **Đăng ký** - Tạo tài khoản khách hàng mới  
✅ **Đăng nhập** - Đăng nhập bằng email/password  
✅ **Hồ sơ người dùng** - Xem/sửa thông tin cá nhân, đổi mật khẩu, upload avatar  
✅ **Phân quyền** - Phân biệt Admin, User, Guest

### 🛒 Giỏ hàng & Đơn hàng

✅ **Giỏ hàng** - Thêm/xóa sản phẩm, tính giá  
✅ **Checkout** - Form thanh toán  
✅ **Lịch sử đơn hàng** - Xem các đơn đã mua

### 👨‍💼 Khu vực Quản trị (Admin Panel)

✅ **Dashboard** - Thống kê số liệu (sản phẩm, đơn hàng, liên hệ, FAQ)  
✅ **Quản lý người dùng** - CRUD user, reset password  
✅ **Quản lý sản phẩm** - Thêm/sửa/xóa sản phẩm, upload ảnh  
✅ **Quản lý đơn hàng** - Xem chi tiết, cập nhật trạng thái  
✅ **Quản lý bài viết** - CRUD tin tức, SEO meta tags  
✅ **Quản lý bình luận** - Duyệt/xóa bình luận  
✅ **Quản lý FAQ** - Thêm/sửa/xóa câu hỏi & trả lời  
✅ **Quản lý liên hệ** - Xem liên hệ, phản hồi qua email  
✅ **Quản lý nội dung tĩnh** - Sửa thông tin giới thiệu, địa chỉ, số điện thoại

---

## 8. Bảo mật

✅ **CSRF Token** - Bảo vệ form chống tấn công CSRF  
✅ **SQL Injection Prevention** - Sử dụng Prepared Statements (PDO)  
✅ **Input Validation** - Kiểm tra dữ liệu client-side (JS) & server-side (PHP)  
✅ **Password Hashing** - Mã hóa password bằng `password_hash()`  
✅ **XSS Prevention** - Escape output với `htmlspecialchars()`  
✅ **Session Management** - Quản lý session an toàn

---

## 9. SEO

✅ **Meta Tags** - Title, Description, Keywords cho từng trang  
✅ **Semantic HTML** - Sử dụng tag HTML5 ngữ nghĩa (`<header>`, `<article>`, `<footer>`)  
✅ **Mobile Responsive** - Tối ưu cho mobile devices  
✅ **Page Speed** - Tối ưu hình ảnh, lazy loading

---

## 10. Troubleshooting

### Docker issues

**Lỗi: Port 9999 đã được sử dụng**

```powershell
# Kiểm tra process chiếm port
netstat -ano | findstr :9999

# Thay đổi port trong docker-compose.yml
# "9999:80" → "8888:80"
```

**Lỗi: Container không khởi động**

```powershell
# Xem chi tiết logs
docker compose logs -f lowland_db
docker compose logs -f lowland_app

# Rebuild containers
docker compose down -v
docker compose up --build
```

**Lỗi kết nối database**

```powershell
# Chờ database khởi tạo xong (15-20 giây)
# Hoặc restart containers
docker compose restart
```

### Local setup issues

**Lỗi: MySQL connection refused**

- Kiểm tra MySQL service có chạy: `mysql -u root`
- Cập nhật credentials trong `config/config.php`

**Lỗi: setup_db.bat không chạy được**

```powershell
# Cấp quyền chạy script
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Chạy lại
.\setup_db.bat
```

---

## 11. Liên hệ & Hỗ trợ

Nếu gặp vấn đề, vui lòng liên hệ:

- **Hồ Anh Dũng** (2310543)
- **Lê Thành Nghĩa** (2312264)
- **Vũ Trọng Nghĩa** (2312291)
- **Nguyễn Mai Huy Phát** (2312589)

## Bot Integration Routes (Milestone)

- POST `/?r=site/chatbot` (web widget proxy to OpenClaw)
- POST `/?r=botBridge/catalogList`
- POST `/?r=botBridge/catalogGet`
- POST `/?r=botBridge/orderCreate`
- POST `/?r=botBridge/orderGet`
- POST `/?r=botBridge/faqAnswer`

Bridge endpoints require header: `x-api-key: <BOT_BRIDGE_API_KEY>`.
