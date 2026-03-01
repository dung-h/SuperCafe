## 🔒 Mapping: Bảo mật & SEO trong Project

---

## 1. CSRF Token Protection (Bảo vệ CSRF)

### Nơi xử lý:
- **File chính:** `app/Controllers/BaseController.php`
  - Method: `csrfToken()` - Tạo token
  - Method: `verifyCsrfFromPost()` - Kiểm tra token từ POST
  - Method: `verifyCsrfFromGet()` - Kiểm tra token từ GET

### Nơi sử dụng CSRF:
1. **Login/Register:**
   - Controller: `app/Controllers/AuthController.php`
   - View: `app/Views/auth/login.php` (line 22)
   - View: `app/Views/auth/register.php` (line 22)

2. **Quản trị Admin:**
   - Controller: `app/Controllers/AdminPageController.php` (line 19, 101)
   - Controller: `app/Controllers/AdminController.php` (line 194)
   - Controller: `app/Controllers/AdminUserController.php`
   - View: `app/Views/admin/users.php` (line 70)
   - View: `app/Views/admin/page_edit.php`

3. **Form người dùng:**
   - View: `app/Views/user/profile.php` (line 30)
   - View: `app/Views/user/change_password.php` (line 11)
   - View: `app/Views/cart/checkout.php` (line 11)
   - View: `app/Views/post/detail.php` (line 35) - Cho bình luận

### Cách kiểm tra:
```php
// Trong view - thêm hidden input
<input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">

// Trong controller - kiểm tra
if (!$this->verifyCsrfFromPost()) return;
```

---

## 2. SQL Injection Prevention (PDO Prepared Statements)

### Nơi xử lý:
- **File chính:** `app/Models/DB.php`
  - Sử dụng PDO (PHP Data Objects) cho kết nối
  - Tất cả query đều dùng Prepared Statements với `?` placeholders

### Ví dụ cách sử dụng:
```php
// Đúng - AN TOÀN ✅
$stmt = $pdo->prepare('SELECT * FROM users WHERE email=?');
$stmt->execute([$email]);

// SAI - KHÔNG AN TOÀN ❌
$sql = "SELECT * FROM users WHERE email='$email'";
```

### Các file Controller sử dụng:
- `app/Controllers/AuthController.php` - Xác thực người dùng
- `app/Controllers/ProductController.php` - Lấy sản phẩm
- `app/Controllers/AdminUserController.php` - Quản lý user
- `app/Controllers/AdminProductController.php` - Quản lý sản phẩm
- **TẤT CẢ** các Admin Controller

---

## 3. Input Validation (Kiểm tra dữ liệu)

### Client-side Validation (JavaScript)
- HTML5 attributes: `required`, `type="email"`, `minlength`, `maxlength`
- Ví dụ: `app/Views/auth/register.php`, `app/Views/auth/login.php`

### Server-side Validation (PHP)
- **Xác thực Email:**
  ```php
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
      $error = "Email không hợp lệ";
  }
  ```

- **Xác thực Password:**
  ```php
  if (strlen($password) < 6) {
      $error = "Password phải ít nhất 6 ký tự";
  }
  ```

- **Xác thực Dữ liệu Form:**
  Tất cả Controller đều dùng `trim()`, `htmlspecialchars()` khi lấy dữ liệu

### File chứa validation:
- `app/Controllers/AuthController.php` (Register/Login)
- `app/Controllers/UserController.php` (Profile, Change password)
- `app/Controllers/AdminProductController.php` (Thêm/sửa sản phẩm)
- `app/Controllers/AdminPostController.php` (Thêm/sửa bài viết)

---

## 4. Password Hashing (Mã hoá mật khẩu)

### Nơi xử lý:
- **File chính:** `app/Controllers/AuthController.php`
  - Line 43: `$hash = password_hash($password, PASSWORD_DEFAULT);`

- **File chính:** `app/Controllers/UserController.php`
  - Line 96: `password_verify($current, $user['password_hash'])`
  - Line 104: `$hash = password_hash($password, PASSWORD_DEFAULT);`

- **File chính:** `app/Controllers/AdminUserController.php`
  - Line 96: Thay đổi mật khẩu người dùng

### Cách sử dụng:
```php
// Khi đăng ký - hash password
$hash = password_hash($password, PASSWORD_DEFAULT);
$pdo->prepare('INSERT INTO users (password_hash) VALUES (?)')
    ->execute([$hash]);

// Khi đăng nhập - verify password
if (!password_verify($password, $user['password_hash'])) {
    $error = "Sai mật khẩu";
}
```

### Database:
- Bảng: `users`
- Cột: `password_hash` (LONGTEXT)
- Mẫu: `$2y$10$...` (bcrypt hash)

---

## 5. XSS Prevention (Escape Output)

### Nơi xử lý:
Hàm `htmlspecialchars()` được sử dụng **ở tất cả các view** để escape output

### Cách sử dụng:
```php
// Đúng - AN TOÀN ✅
<?= htmlspecialchars($user['name'], ENT_QUOTES, 'UTF-8') ?>

// SAI - KHÔNG AN TOÀN ❌
<?= $user['name'] ?>
```

### Các file View có escaping:
- `app/Views/home/index.php` (line 26, 29, 30, 61, 66, 69)
- `app/Views/page/about.php` (line 18, 21, 25, 38, 39, 55, 56, 62, 64, 83, 84, 90, 92)
- `app/Views/user/profile.php` (line 10, 17, 30, 37, 45, 54)
- `app/Views/site/contact.php` (line 9, 18, 27, 48)
- `app/Views/product/list.php` (line 10, 26, 28)
- `app/Views/layouts/base.php` (line 6)
- `app/Views/layouts/admin.php` (line 6, 154, 170)
- `app/Views/admin/product_edit.php` (line 55)
- **Tất cả các view khác...**

---

## 6. Session Management (Quản lý Session)

### Nơi xử lý:
- **File chính:** `app/Controllers/BaseController.php`
  - Method: `requireAdmin()` - Kiểm tra quyền admin
  - Method: `requireLogin()` - Kiểm tra đã login

- **File chính:** `public/index.php`
  - Khởi tạo session: `session_start();`

### Cách sử dụng:
```php
// Kiểm tra có phải admin không
public function someAdminAction() {
    $this->requireAdmin();
    // ... code chỉ admin mới chạy
}

// Kiểm tra đã đăng nhập chưa
public function userOnlyAction() {
    $this->requireLogin();
    // ... code chỉ user đã login mới chạy
}
```

### Các controller sử dụng:
- Tất cả `AdminXxxController` - Kiểm tra admin access
- `UserController.php` - Kiểm tra user access
- `CartController.php` - Kiểm tra login

---

## 7. Meta Tags & SEO (Tối ưu tìm kiếm)

### Title Tags:
Mỗi page có title riêng được truyền từ Controller:
```php
// Controller
return $this->render('view', $data, 'Tiêu đề trang');

// View - app/Views/layouts/base.php
<title><?= htmlspecialchars($title ?? 'Lowland Coffee', ENT_QUOTES, 'UTF-8') ?></title>
```

### Ví dụ Title Tags:
- Trang chủ: "Lowland Coffee - Quán cafe Sài Gòn"
- Admin Dashboard: "Bảng điều khiển Admin"
- Sản phẩm: "Chi tiết sản phẩm - {Tên sản phẩm}"
- Bài viết: "{Tiêu đề bài viết}"

### Các file có title:
- `app/Controllers/HomeController.php`
- `app/Controllers/PageController.php`
- `app/Controllers/ProductController.php`
- `app/Controllers/PostController.php`
- `app/Controllers/AdminController.php`
- **Tất cả các Controller khác...**

### Description & Keywords:
- Hiện tại được lưu trong database (sản phẩm, bài viết)
- Cần thêm meta tags vào view để SEO tốt hơn

Cải tiến cần làm:
```php
<!-- Thêm vào base.php -->
<meta name="description" content="<?= htmlspecialchars($description ?? 'Lowland Coffee - Cà phê đặc biệt từ vùng đất thấp Việt Nam', ENT_QUOTES, 'UTF-8') ?>">
<meta name="keywords" content="<?= htmlspecialchars($keywords ?? 'cà phê, coffee, Lowland', ENT_QUOTES, 'UTF-8') ?>">
```

---

## 8. Semantic HTML (Cấu trúc HTML5)

### Layout chính:
- `app/Views/layouts/base.php`
  - `<header>` - Navigation
  - `<main>` - Content chính
  - `<footer>` - Footer

- `app/Views/layouts/admin.php`
  - `<header>` - Admin navbar
  - `<main>` - Admin content
  - `<footer>` - Admin footer

### Semantic tags dùng:
```html
<header> - Navigation
<nav> - Menu chính
<main> - Nội dung chính
<article> - Bài viết (post)
<section> - Section content
<aside> - Sidebar (nếu có)
<footer> - Footer
```

### Ví dụ tại:
- `app/Views/post/detail.php` - `<article>` tag cho bài viết
- `app/Views/home/index.php` - `<section>` tags
- `app/Views/product/list.php` - Danh sách sản phẩm
- `app/Views/layouts/base.php` - Layout chính

---

## 9. Mobile Responsive Design (Responsive)

### Framework CSS:
- **Bootstrap 5** - Trang công khai
  - Grid system: `container`, `row`, `col-md-4`, `col-lg-6`
  - Responsive utilities: `d-none`, `d-md-block`

- **Tabler Admin Template** - Admin panel
  - Responsive admin dashboard

### Meta Viewport:
```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```
Có ở tất cả layout: `base.php`, `admin.php`

### CSS Responsive:
- `public/assets/main.css` - Custom responsive styles
- Breakpoints Bootstrap: 576px, 768px, 992px, 1200px, 1400px

### Testing Responsive:
- Chrome DevTools (F12) → Toggle device toolbar
- Test trên: Mobile (375px), Tablet (768px), Desktop (1920px)

---

## 10. Image Optimization & Lazy Loading

### Image Upload:
- **Nơi xử lý:** `app/Controllers/AdminProductController.php`, `AdminPageController.php`
- Upload lên thư mục: `/public/uploads/`
- Lưu đường dẫn trong database

### Lazy Loading:
Chưa implement (cần thêm)
- Thêm `loading="lazy"` vào img tags
- Hoặc dùng JavaScript library

---

## 📋 Summary

| Tính năng | Vị trí | Status |
|-----------|--------|--------|
| CSRF Token | `BaseController.php`, tất cả forms | ✅ Implemented |
| SQL Injection | `DB.php` + Prepared Statements | ✅ Implemented |
| Input Validation | Tất cả Controllers | ✅ Implemented |
| Password Hashing | `AuthController.php`, `UserController.php` | ✅ Implemented |
| XSS Prevention | Tất cả Views | ✅ Implemented |
| Session Management | `BaseController.php`, `public/index.php` | ✅ Implemented |
| Title Tags | Tất cả Controllers | ✅ Implemented |
| Meta Description | Cần thêm | 🟡 Partial |
| Semantic HTML | Layouts + Views | ✅ Implemented |
| Mobile Responsive | Bootstrap 5 + Tabler | ✅ Implemented |
| Image Upload | Admin Controllers | ✅ Implemented |
| Lazy Loading | - | 🔴 Not implemented |

---

Generated: 2025-12-08
