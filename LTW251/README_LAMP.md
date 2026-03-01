# BÀI TẬP LỚN LỚN - LOWLAND COFFEE
(Dự án PHP thuần + MySQL – MVC đơn giản)

## Công nghệ sử dụng
- PHP 8.x (thuần, không framework)
- MySQL / MariaDB
- Apache2
- HTML5, CSS3, Bootstrap 5 (tuỳ dự án)
- JavaScript thuần / jQuery

## Yêu cầu hệ thống
- Ubuntu 20.04 / 22.04 / 24.04 (hoặc bất kỳ Linux nào có LAMP)
- Apache2
- MySQL hoặc MariaDB
- PHP ≥ 8.0 + các extension phổ biến (mysqli, pdo_mysql, gd, mbstring, curl...)

## Hướng dẫn cài đặt và chạy dự án trên Ubuntu (LAMP)

### Bước 1: Cài đặt LAMP (nếu chưa có)
```bash
sudo apt update
sudo apt install apache2 mysql-server php libapache2-mod-php php-mysql php-mbstring php-xml php-gd php-curl unzip -y
sudo systemctl enable apache2 mysql
sudo systemctl start apache2 mysql
```
### Bước 2: Copy dự án vào máy
```bash
sudo cp -r /đường/dẫn/đến/thư/mục/bài/nộp /var/www/html/btlweb
# Hoặc đổi tên tuỳ ý
sudo chown -R www-data:www-data /var/www/html/btlweb -R
```
### Bước 3: Tạo Virtual Host (khuyến khích – chuyên nghiệp & bảo mật)
```bash
sudo nano /etc/apache2/sites-available/btlweb.conf
```
Nội dung file:
```apache
<VirtualHost *:80>
    ServerName btlweb.test
    DocumentRoot /var/www/html/btlweb/public

    <Directory /var/www/html/btlweb/public>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/btlweb-error.log
    CustomLog ${APACHE_LOG_DIR}/btlweb-access.log combined
</VirtualHost>
```
Kích họạt:
```bash
sudo a2ensite btlweb.conf
sudo a2enmod rewrite
sudo systemctl reload apache2
```
Thêm vào file hosts:
```bash
echo "127.0.0.1   btlweb.test" | sudo tee -a /etc/hosts
```

### Bước 4: Tạo database và import dữ liệu

```bash
sudo mysql -u root -p
```
Trong MySQL:
```sql
CREATE DATABASE lowland_coffee CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'web251'@'localhost' IDENTIFIED BY 'Webhk251!';
GRANT ALL PRIVILEGES ON lowland_coffee.* TO 'web251'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```
Import schema:
```bash
mysql -u btluser -p btlweb < /var/www/html/btlweb/schema.sql
# Mật khẩu: Webhk251!
```

### Bước 5: Cấu hình kết nối database
Sửa file `config/config.php` (hoặc `.env` nếu có):
```php
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'lowland_coffee');
define('DB_USER', 'web251');
define('DB_PASS', 'Webhk251!');
define('BASE_URL', 'http://btlweb.test');
```
### Bước 6: Phân quyền thư mục upload & log
```bash
sudo chmod 775 -R /var/www/html/btlweb/uploads
sudo chmod 775 -R /var/www/html/btlweb/public/assets
sudo chown www-data:www-data -R /var/www/html/btlweb/uploads
```
### Bước 7: Truy cập website
Mở trình duyệt và vào một trong hai địa chỉ sau:
- Khuyến khích: `http://btlweb.test`
- Nếu không tạo Virtual Host: `http://localhost/btlweb/public`

### Lưu ý quan trọng
- Dự án được thiết kế chỉ để thư mục `public` là DocumentRoot → bảo mật cao, không lộ source code.
- Tắt mạng Internet vẫn chạy bình thường (100% offline).
- Không cần Composer, không cần Node.js (trừ khi bạn thêm).























