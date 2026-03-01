SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

CREATE DATABASE IF NOT EXISTS lowland_coffee;
USE lowland_coffee;

-- Database đã được tạo tự động bởi Docker với tên từ MYSQL_DATABASE HOẶC THỦ CÔNG VỚI XAMPP
-- USE lowland_coffee;

-- =========================================================
-- 1. USERS
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE,
  email VARCHAR(191) UNIQUE NOT NULL,
  phone VARCHAR(11) NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role ENUM('guest','user','admin') DEFAULT 'user',
  avatar_path VARCHAR(255) DEFAULT NULL,
  is_blocked TINYINT(1) DEFAULT 0,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed admin (phone bắt buộc)
INSERT IGNORE INTO users (username, email, phone, password, full_name, role) VALUES
('admin',
 'admin@example.com',
 '0123456789',
 '$2y$12$ANpbWiT9uz66E4mRvdw7d.xAI91ssBVJ94gFMc/f0P8.JyBvYqOYa',
 'Quản trị viên',
 'admin');

-- =========================================================
-- 2. CONTACTS
-- =========================================================
CREATE TABLE IF NOT EXISTS contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(191) NOT NULL,
  message TEXT NOT NULL,
  is_resolved TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 2c. FAQ QUESTIONS (Câu hỏi từ người dùng)
-- =========================================================
CREATE TABLE IF NOT EXISTS faq_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT 'Tên người hỏi',
  email VARCHAR(191) NOT NULL COMMENT 'Email người hỏi',
  question TEXT NOT NULL COMMENT 'Nội dung câu hỏi',
  is_resolved TINYINT(1) DEFAULT 0 COMMENT 'Đã xử lý chưa',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 2b. CONTACT SETTINGS (thong tin cua quan)
-- =========================================================
CREATE TABLE IF NOT EXISTS contact_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  address VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(191) NOT NULL,
  opening_hours VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO contact_settings (id, address, phone, email, opening_hours) VALUES
(1,
 '123 Nguyễn Huệ, Q.1, TP.HCM',
 '028 3822 1234',
 'info@lowlandcoffee.com',
 'Thứ 2 - Chủ nhật: 7:00 - 22:00');

-- =========================================================
-- 3. PAGES (giữ nguyên từ schema cũ)
-- =========================================================
CREATE TABLE IF NOT EXISTS pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(191) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  content MEDIUMTEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 3b. PAGE_SECTIONS (quản lý sections của từng page - mỗi section 1 ảnh)
-- =========================================================
CREATE TABLE IF NOT EXISTS page_sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  page_slug VARCHAR(191) NOT NULL,
  section_type VARCHAR(50) NOT NULL COMMENT 'hero, card, value, etc.',
  title VARCHAR(255),
  content TEXT,
  image_path VARCHAR(255) COMMENT 'Đường dẫn ảnh chính của section',
  position INT DEFAULT 0 COMMENT 'Thứ tự hiển thị',
  is_active TINYINT(1) DEFAULT 1 COMMENT '1=hiển thị, 0=ẩn',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (page_slug) REFERENCES pages(slug) ON DELETE CASCADE,
  INDEX idx_page_position (page_slug, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 4. CATEGORIES (mới)
-- =========================================================
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,              -- ví dụ: Cà phê, Trà sữa, Yogurt, Bánh nướng...
  slug VARCHAR(110) UNIQUE NOT NULL,       -- dùng để SEO, ví dụ: ca-phe, tra-sua
  icon VARCHAR(255) DEFAULT NULL,          -- optional: icon hoặc hình ảnh đại diện
  sort_order INT DEFAULT 0,                -- sắp xếp thứ tự hiển thị
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 5. PRODUCTS (schema mới: có category_id + image)
-- =========================================================
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category_id INT NULL,
  slug VARCHAR(210) UNIQUE,
  sku VARCHAR(64) UNIQUE,
  price DECIMAL(12,2) DEFAULT 0,
  stock_qty INT NOT NULL DEFAULT 999,
  short_desc VARCHAR(255),
  image VARCHAR(255) NOT NULL DEFAULT '/assets/images/noimage.svg',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 6. POSTS (bỏ author, thêm image với default)
-- =========================================================
CREATE TABLE IF NOT EXISTS posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(210) UNIQUE,
  excerpt VARCHAR(255),
  content MEDIUMTEXT,
  author VARCHAR(100) DEFAULT NULL,
  image VARCHAR(255) NOT NULL DEFAULT '/assets/images/noimage.svg',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 7. FAQS
-- =========================================================
CREATE TABLE IF NOT EXISTS faqs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question VARCHAR(255) NOT NULL,
  answer MEDIUMTEXT NOT NULL,
  position INT DEFAULT 0,
  is_public TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 8. COMMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT,
  author_name VARCHAR(100),
  content TEXT NOT NULL,
  is_approved TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 8. ORDERS + ORDER_ITEMS (mới)
-- =========================================================
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL, -- Null nếu khách mua không cần đăng nhập
  customer_name VARCHAR(100) NOT NULL,
  customer_email VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_address VARCHAR(255) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('pending', 'processing', 'completed', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  price DECIMAL(12,2) NOT NULL, -- Lưu giá tại thời điểm mua (đề phòng giá gốc đổi)
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bot_orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(32) NOT NULL UNIQUE,
  order_id INT NULL,
  chat_user_id VARCHAR(100) NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_address VARCHAR(255) NOT NULL,
  items_json MEDIUMTEXT NOT NULL,
  subtotal_vnd INT NOT NULL,
  shipping_vnd INT NOT NULL DEFAULT 0,
  total_vnd INT NOT NULL,
  payment_method ENUM('bank_transfer', 'cod') NOT NULL DEFAULT 'bank_transfer',
  payment_ref VARCHAR(191) NULL,
  note TEXT NULL,
  status ENUM('new', 'awaiting_payment', 'payment_review', 'paid', 'shipping', 'completed', 'cancelled') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bot_orders_chat_user_id (chat_user_id),
  INDEX idx_bot_orders_order_id (order_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 9. SEED DATA
-- =========================================================

-- 9.1. Categories
INSERT IGNORE INTO categories (name, slug, sort_order) VALUES 
('Cà phê', 'ca-phe', 1),
('Trà Trái Cây', 'tra-trai-cay', 2),
('Trà Sữa', 'tra-sua', 3),
('Đá Xay', 'da-xay', 4),
('Yogurt', 'yogurt', 5),
('Nước Ép', 'nuoc-ep', 6),
('Topping', 'topping', 7);

-- 9.2. Products (Lowland Coffee menu)

-- Cà phê (Category ID: 1)
INSERT IGNORE INTO products (name, category_id, slug, price, short_desc, description, image) VALUES 
('Cà phê Bạc Xỉu', 1, 'bac-xiu', 40000, 'Sự tỉnh táo ngọt ngào cho bạn.', 'Vị cà phê đậm đà kết hợp cùng sữa đặc béo thơm và sữa tươi mát lạnh, mang đến một ly bạc xỉu vừa đủ tỉnh táo. Dù là buổi sáng cần chút năng lượng, hay một chiều ngồi chill ngắm phố, bạc xỉu luôn là “người bạn” đồng hành lý tưởng.', '/assets/images/products/bac-xiu.jpg'),
('Americano', 1, 'americano', 35000, 'Cà phê nguyên chất, đậm đà và tinh tế.', 'Tại Lowland Coffee, Americano không chỉ là một món uống - mà là tuyên ngôn của lối sống giản dị, sâu lắng nhưng đầy nội lực. Hương thơm nhẹ nhàng, hậu vị kéo dài, và cảm giác ấm áp lan tỏa trong từng hơi thở.', '/assets/images/products/americano.jpg'),
('Cafe Cốt Dừa', 1, 'cafe-cot-dua', 58000, 'Hương vị quyện giữa cà phê đậm đà và béo ngậy của dừa.', 'Sự hoà quyện tinh tế giữa cà phê đậm đà và vị béo ngậy, thơm lừng của cốt dừa, như ôm trọn mùa hè trong lòng bàn tay. Một lựa chọn tuyệt vời cho những ai yêu thích sự phá cách trong hương vị cà phê truyền thống.', '/assets/images/products/cafe-cot-dua.jpg'),
('Cafe Đen', 1, 'cafe-den', 35000, 'Cà phê đen đậm chất Việt Nam.', 'Hương vị cà phê rang xay thượng hạng từ Đaklak, mang đến vị đắng đậm đà, mạnh mẽ giúp bạn tỉnh táo ngay tức thì. Thức uống dành cho những tín đồ yêu thích vị cà phê nguyên bản.', '/assets/images/products/cafe-den.jpg'),
('Cafe Sữa', 1, 'cafe-sua', 38000, 'Sự kết hợp hoàn hảo giữa cà phê đậm đà và sữa ngọt béo.', 'Vẫn giữ trọn vẹn tinh thần nguyên bản của cà phê phin, Cà Phê Sữa tại Lowland Coffee mang đến sự cân bằng hoàn hảo giữa độ đắng nhẹ của cà phê và sự ngọt ngào, mượt mà của sữa. Lựa chọn lý tưởng để thư giãn giữa nhịp sống hối hả.', '/assets/images/products/cafe-sua.jpg'),
('Cafe Muối', 1, 'cafe-muoi', 45000, 'Vị mặn mòi lạ miệng quyện cùng vị đắng cà phê.', 'Sự kết hợp độc đáo giữa lớp kem muối mằn mặn, béo ngậy và hương vị cà phê đậm đà. Một trải nghiệm vị giác thú vị, vừa lạ vừa quen, đánh thức mọi giác quan.', '/assets/images/products/cafe-muoi.jpg'),
('Phindi Hạnh Nhân', 1, 'phindi-hanh-nhan', 45000, 'Cà phê phin kết hợp hạnh nhân thơm bùi.', 'Sự phá cách hiện đại từ cà phê phin truyền thống kết hợp với hương thơm bùi béo của hạnh nhân, mang lại trải nghiệm mới lạ và đầy năng lượng.', '/assets/images/products/phindi-hanh-nhan.jpg');

-- Trà Trái Cây (Category ID: 2)
INSERT IGNORE INTO products (name, category_id, slug, price, short_desc, description, image) VALUES 
('Trà Lài Hạt Đác', 2, 'tra-lai-hat-dac', 55000, 'Topping 100% handmade: Hạt Đác.', 'Lowland Coffee tự hào với topping 100% handmade: Hạt Đác. Kết hợp với nền trà lài thơm ngát, món uống này hứa hẹn mang lại cảm giác thanh mát, giòn dai sần sật vui miệng, chắc chắn sẽ làm bạn ưng ý ngay lần đầu trải nghiệm.', '/assets/images/products/tra-lai-hat-dac.jpg'),
('Trà Đào Cam Sả', 2, 'tra-dao-cam-sa', 60000, 'Thanh mát, giải nhiệt với hương đào cam sả.', 'Vị ngọt thanh của đào, chua dịu của cam kết hợp cùng hương thơm nồng ấm của sả tạo nên thức uống giải nhiệt tuyệt vời, giúp thư giãn tinh thần hiệu quả.', '/assets/images/products/tra-dao-cam-sa.jpg'),
('Trà Lài Đác Dâu', 2, 'tra-lai-dac-dau', 55000, 'Trà lài kết hợp đác dâu ngọt ngào.', 'Sự hòa quyện giữa trà lài thanh khiết và mứt dâu tây ngọt ngào cùng hạt đác rim dẻo thơm. Một thức uống màu sắc bắt mắt và hương vị tươi trẻ.', '/assets/images/products/tra-lai-dac-dau.jpg'),
('Trà Lài Đác Thơm', 2, 'tra-lai-dac-thom', 60000, 'Hương vị nhiệt đới từ thơm và trà lài.', 'Hạt đác rim thơm (dứa) chua ngọt tự nhiên kết hợp với trà lài, mang đến hương vị nhiệt đới sảng khoái, đánh tan cơn khát ngày hè.', '/assets/images/products/tra-lai-dac-thom.jpg'),
('Trà Lài Mãng Cầu', 2, 'tra-lai-mang-cau', 55000, 'Vị chua ngọt đặc trưng của mãng cầu.', 'Trà lài thơm nhẹ kết hợp với mứt mãng cầu chua ngọt, tạo nên thức uống giàu vitamin và kích thích vị giác.', '/assets/images/products/tra-lai-mang-cau.jpg'),
('Trà Lài Vải', 2, 'tra-lai-vai', 55000, 'Hương vải thiều thơm lừng.', 'Vị ngọt ngào của trái vải hòa quyện cùng vị chát nhẹ của trà lài, mang đến cảm giác thanh tao và dịu mát.', '/assets/images/products/tra-lai-vai.jpg'),
('Trà Olong Bưởi', 2, 'tra-olong-buoi', 55000, 'Trà Olong kết hợp tép bưởi hồng.', 'Nền trà Olong đậm đà kết hợp với tép bưởi hồng mọng nước, tạo nên vị chua thanh, ngọt dịu và hương thơm quyến rũ.', '/assets/images/products/tra-olong-buoi.jpg'),
('Trà Sen Vàng', 2, 'tra-sen-vang', 55000, 'Thanh lọc cơ thể với trà sen.', 'Hương vị thanh tao của trà sen kết hợp với hạt sen bùi bùi và kem sữa (hoặc macchiato) béo ngậy, tạo nên thức uống vừa truyền thống vừa hiện đại.', '/assets/images/products/tra-sen-vang.jpg'),
('Trà Gừng Nóng', 2, 'tra-gung-nong', 40000, 'Ấm áp, tốt cho sức khỏe.', 'Thức uống truyền thống giúp làm ấm cơ thể, giải cảm và thư giãn với vị cay nồng đặc trưng của gừng tươi.', '/assets/images/products/tra-gung-nong.jpg');

-- Trà Sữa (Category ID: 3)
INSERT IGNORE INTO products (name, category_id, slug, price, short_desc, description, image) VALUES 
('Trà Sữa Bamos', 3, 'tra-sua-bamos', 50000, 'Ngọt béo, thơm sánh từ công thức độc quyền.', 'Ngọt béo, thơm sánh từ công thức kết hợp các dòng Trà độc quyền Bamos và sữa tươi. Một ly trà sữa đậm đà, đánh thức vị giác của bạn ngay từ ngụm đầu tiên.', '/assets/images/products/tra-sua-bamos.jpg'),
('Trà Sữa Ô Long Đà Lạt', 3, 'tra-sua-o-long-da-lat', 50000, 'Hương vị Ô Long cao nguyên.', 'Sử dụng trà Ô Long từ Đà Lạt, kết hợp với sữa tạo nên vị trà đậm, hương thơm nồng nàn đặc trưng của vùng cao nguyên.', '/assets/images/products/tra-sua-o-long-da-lat.jpg'),
('Trà Sữa Ô Long Nhài', 3, 'tra-sua-o-long-nhai', 50000, 'Sự kết hợp giữa Ô Long và hoa nhài.', 'Hương hoa nhài thoang thoảng quyện trong vị trà Ô Long đậm đà và sữa béo, tạo nên ly trà sữa thanh thoát, không gây ngán.', '/assets/images/products/tra-sua-o-long-nhai.jpg'),
('Sữa Tươi Trân Châu Đường Đen', 3, 'sua-tuoi-tran-chau-duong-den', 50000, 'Béo ngậy sữa tươi, đậm đà đường đen.', 'Sữa tươi thanh trùng mát lạnh kết hợp với trân châu đường đen nấu dẻo, ngọt lịm. Một món uống "quốc dân" được yêu thích bởi sự hòa quyện hoàn hảo.', '/assets/images/products/sua-tuoi-tran-chau.jpg'),
('Trà Olong Sữa', 3, 'tra-olong-sua', 50000, 'Vị trà Olong đậm đà.', 'Dành cho những ai thích vị trà đậm hơn vị sữa. Trà Olong được ủ kỹ lưỡng để lấy hết tinh túy, pha chế cùng lượng sữa vừa đủ để tôn lên vị trà.', '/assets/images/products/tra-olong-sua.jpg'),
('Hồng Trà Sữa', 3, 'hong-tra-sua', 50000, 'Trà sữa truyền thống.', 'Hương vị trà sữa cổ điển với nền hồng trà thơm nồng, màu nâu đỏ đẹp mắt, vị ngọt béo hài hòa.', '/assets/images/products/hong-tra-sua.jpg');

-- Đá Xay (Category ID: 4)
INSERT IGNORE INTO products (name, category_id, slug, price, short_desc, description, image) VALUES 
('Cafe Cốt Dừa Freeze', 4, 'cafe-cot-dua-freeze', 58000, 'Phiên bản đá xay của cafe cốt dừa.', 'Mát lạnh sảng khoái với cafe cốt dừa được xay nhuyễn cùng đá. Vị béo của dừa và đắng của cafe được hòa quyện trong từng lớp tuyết mịn.', '/assets/images/products/cafe-cot-dua-freeze.jpg'),
('Cafe Freeze', 4, 'cafe-freeze', 58000, 'Cà phê đá xay mát lạnh.', 'Cà phê đá xay đậm đà, phủ bên trên là lớp kem tươi béo ngậy (nếu có), giúp bạn tỉnh táo và giải nhiệt tức thì.', '/assets/images/products/cafe-freeze.jpg'),
('Cookies & Cream', 4, 'cookies-cream', 58000, 'Đá xay bánh quy kem.', 'Sự kết hợp kinh điển giữa bánh quy Oreo và sữa, xay nhuyễn tạo nên thức uống ngọt ngào, thơm béo, được giới trẻ cực kỳ yêu thích.', '/assets/images/products/cookies-cream.jpg'),
('Freeze Sô Cô La', 4, 'freeze-so-co-la', 58000, 'Socola đá xay đậm vị.', 'Hương vị Socola nguyên chất được xay cùng đá, mang lại vị đắng nhẹ, ngọt hậu và cảm giác mát lạnh tan chảy trong miệng.', '/assets/images/products/freeze-so-co-la.jpg'),
('Freeze Trà Xanh', 4, 'freeze-tra-xanh', 58000, 'Matcha đá xay thanh mát.', 'Sử dụng bột Matcha chất lượng cao, xay cùng sữa và đá. Vị chát nhẹ đặc trưng của trà xanh quyện cùng vị ngọt béo của sữa.', '/assets/images/products/freeze-tra-xanh.jpg'),
('Freeze Việt Quất', 4, 'freeze-viet-quat', 58000, 'Việt quất đá xay chua ngọt.', 'Mứt việt quất chua ngọt kết hợp với đá xay và sữa chua hoặc kem, tạo nên màu tím bắt mắt và hương vị trái cây tươi mát.', '/assets/images/products/freeze-viet-quat.jpg');

-- Yogurt (Category ID: 5)
INSERT IGNORE INTO products (name, category_id, slug, price, short_desc, description, image) VALUES 
('Yogurt Đác Dâu', 5, 'yogurt-dac-dau', 55000, 'Sữa chua hạt đác rim dâu.', 'Sữa chua lên men tự nhiên tốt cho tiêu hóa, ăn kèm với hạt đác rim dâu tây dẻo thơm. Món tráng miệng healthy và ngon miệng.', '/assets/images/products/yogurt-dac-dau.jpg'),
('Yogurt Đác Thơm', 5, 'yogurt-dac-thom', 55000, 'Sữa chua hạt đác rim thơm.', 'Vị chua dịu của sữa chua kết hợp hoàn hảo với vị chua ngọt của hạt đác rim thơm (dứa), tạo cảm giác thanh mát.', '/assets/images/products/yogurt-dac-thom.jpg'),
('Yogurt Việt Quất', 5, 'yogurt-viet-quat', 55000, 'Sữa chua sốt việt quất.', 'Sữa chua mịn màng hòa quyện cùng sốt việt quất đậm đà, bổ sung vitamin và khoáng chất cho cơ thể.', '/assets/images/products/yogurt-viet-quat.jpg');

-- Nước Ép (Category ID: 6)
INSERT IGNORE INTO products (name, category_id, slug, price, short_desc, description, image) VALUES 
('Ép Cam', 6, 'ep-cam', 50000, 'Nước ép cam tươi nguyên chất.', 'Cung cấp Vitamin C dồi dào từ những quả cam tươi mọng nước, giúp tăng cường sức đề kháng và giải khát hiệu quả.', '/assets/images/products/ep-cam.jpg'),
('Ép Thơm', 6, 'ep-thom', 50000, 'Nước ép thơm (dứa) tươi.', 'Hương vị chua ngọt tự nhiên của trái thơm tươi, hỗ trợ tiêu hóa và làm đẹp da.', '/assets/images/products/ep-thom.jpg'),
('Ép Bưởi', 6, 'ep-buoi', 50000, 'Nước ép bưởi giảm cân, đẹp da.', 'Vị chua thanh đặc trưng của bưởi, là thức uống yêu thích của chị em phụ nữ nhờ công dụng đẹp dáng, sáng da.', '/assets/images/products/ep-buoi.jpg'),
('Ép Lựu Đỏ', 6, 'ep-luu-do', 50000, 'Nước ép lựu đỏ giàu chất chống oxy hóa.', 'Màu đỏ bắt mắt, vị ngọt thanh mát, nước ép lựu đỏ là "thần dược" cho làn da và sức khỏe.', '/assets/images/products/ep-luu-do.jpg'),
('Dừa Tươi', 6, 'dua-tuoi', 40000, 'Dừa tươi nguyên trái.', 'Nước dừa tươi ngọt mát tự nhiên, giải nhiệt tức thì, bù khoáng cho cơ thể.', '/assets/images/products/dua-tuoi.jpg');

-- Topping (Category ID: 7)
INSERT IGNORE INTO products (name, category_id, slug, price, short_desc, description, image) VALUES 
('Trân Châu Đen', 7, 'tran-chau-den', 15000, 'Topping trân châu dai ngon.', 'Trân châu đen nấu đường nâu dẻo dai, topping không thể thiếu cho các món trà sữa.', '/assets/images/products/tran-chau-den.jpg'),
('Trân Châu Trắng', 7, 'tran-chau-trang', 15000, 'Topping trân châu giòn sần sật.', 'Trân châu trắng giòn, vị ngọt nhẹ, tăng thêm sự thú vị khi thưởng thức đồ uống.', '/assets/images/products/tran-chau-trang.jpg'),
('Đác Dâu', 7, 'dac-dau', 20000, 'Hạt đác rim dâu.', 'Hạt đác rim cùng mứt dâu tây, vị chua ngọt dẻo thơm.', '/assets/images/products/topping-dac-dau.jpg'),
('Đác Thơm', 7, 'dac-thom', 20000, 'Hạt đác rim thơm.', 'Hạt đác rim cùng thơm (dứa), màu vàng đẹp mắt, vị chua ngọt.', '/assets/images/products/topping-dac-thom.jpg'),
('Vải Trái', 7, 'vai-trai', 20000, 'Vải ngâm đóng hộp.', 'Trái vải tươi ngâm, ngọt lịm, mọng nước.', '/assets/images/products/topping-vai.jpg'),
('Kem Tuyết', 7, 'kem-tuyet', 15000, 'Kem tươi whipping cream.', 'Lớp kem béo ngậy phủ lên trên các món đá xay.', '/assets/images/products/kem-tuyet.jpg');

-- 9.3. FAQs (câu hỏi mặc định)
INSERT IGNORE INTO faqs (question, answer, position, is_public) VALUES
('Lowland Coffee mở cửa vào thời gian nào?',
'Quán mở cửa mỗi ngày từ 7:00 đến 22:00. Các khung giờ cao điểm thường là buổi sáng 7:00 - 9:00 và buổi tối 19:00 - 21:00. Nếu đi vào cuối tuần, bạn nên đặt bàn trước để có chỗ ngồi ưng ý.',
0, 1),
('Quán có chỗ gửi xe máy và ô tô không?',
'Lowland Coffee có bãi giữ xe máy miễn phí trước cửa quán. Với ô tô, bạn có thể gửi tại các bãi xe công cộng gần đó (cách quán khoảng 3-5 phút đi bộ). Nhân viên sẽ luôn sẵn sàng hướng dẫn nếu bạn cần.',
1, 1),
('Quán có wifi và ổ cắm điện để làm việc không?',
'Toàn bộ khu vực quán đều phủ wifi tốc độ cao, mật khẩu được in sẵn trên menu. Hầu hết các bàn đều có ổ cắm điện, phù hợp cho việc học tập và làm việc với laptop trong nhiều giờ.',
2, 1),
('Tôi có thể đặt hàng online hoặc mang đi như thế nào?',
'Bạn có thể gọi trực tiếp số hotline trên website hoặc đặt qua mục Giỏ hàng của hệ thống. Sau khi xác nhận đơn, barista sẽ pha chế trong vòng 10-15 phút, bạn có thể chọn giao hàng hoặc tới quán nhận đồ mang đi.',
3, 1),
('Quán chấp nhận những hình thức thanh toán nào?',
'Lowland Coffee chấp nhận tiền mặt, chuyển khoản ngân hàng và các ví điện tử phổ biến như Momo, ZaloPay, ShopeePay. Hóa đơn điện tử sẽ được gửi qua email nếu bạn yêu cầu.',
4, 1);

-- 9.4. Pages seed
INSERT IGNORE INTO pages (slug, title, content) VALUES
('about', 'Giới thiệu', 'Lowland Coffee là quán cà phê ấm cúng giữa lòng Sài Gòn, được sinh ra từ tình yêu với những tách cà phê phin Việt Nam và mong muốn tạo nên một không gian chậm lại giữa nhịp sống vội vã, nơi cũng có thể làm việc, đọc sách lẫn gặp gỡ bạn bè.');

-- 9.5. Page Sections seed (About page)
INSERT IGNORE INTO page_sections (page_slug, section_type, title, content, image_path, position) VALUES
-- Hero section
('about', 'hero', 'Giới thiệu', 'Lowland Coffee là quán cafe ấm cúng giữa lòng Sài Gòn, nơi bạn có thể thưởng thức cà phê rang xay tại chỗ và những chiếc bánh ngọt tươi mới mỗi ngày trong không gian yên bình.', '/assets/images/hero-about.png', 0),

-- Story cards
('about', 'card', 'Câu chuyện', 'Lowland Coffee được sinh ra từ tình yêu dành cho những tách cà phê phin Việt Nam và mong muốn tạo nên một không gian chậm lại giữa nhịp sống vội vã.', '', 1),
('about', 'card', 'Tầm nhìn', 'Trở thành điểm hẹn quen thuộc của những người yêu cà phê, nơi mỗi người có thể làm việc, trò chuyện và tìm lại sự cân bằng.', '', 2),
('about', 'card', 'Sứ mệnh', 'Mang đến trải nghiệm cafe chất lượng với nguyên liệu được chọn lọc, dịch vụ chân thành và không gian ấm áp cho từng vị khách.', '', 3),

-- Core values
('about', 'value', 'Hạt chọn lọc', 'Sử dụng hạt Arabica và Robusta từ các vùng trồng uy tín, rang mới thường xuyên để giữ trọn hương thơm.', '', 4),
('about', 'value', 'Không gian ấm cúng', 'Thiết kế thân thiện, yên tĩnh, phù hợp cho cả làm việc, đọc sách lẫn gặp gỡ bạn bè.', '', 5),
('about', 'value', 'Dịch vụ chân thành', 'Đội ngũ barista và nhân viên luôn sẵn sàng lắng nghe và hỗ trợ từng vị khách.', '', 6);

-- 9.6. Posts (blog Lowland)

INSERT IGNORE INTO posts (title, slug, excerpt, content, image) VALUES 
(
'Top 7 Quán cà phê mở 24/24 ở Sài Gòn', 
'top-7-quan-ca-phe-mo-24-24-o-sai-gon', 
'Top 7 Quán Cà Phê mở 24/24 Gần Đây Tuyệt Vời Với Cà Phê Boardgame và Cà Phê Acoustic.',
'Sài Gòn, một thành phố không ngủ, luôn hối hả và nhộn nhịp suốt cả ngày lẫn đêm. Giữa guồng quay công việc và học tập, nhu cầu tìm kiếm những không gian thư giãn, làm việc lý tưởng mở cửa 24 giờ ngày càng trở nên phổ biến.

Lowland Coffee nổi lên như một thương hiệu quán cà phê 24/7 đáp ứng trọn vẹn những tiêu chí này, hứa hẹn mang đến một điểm đến lý tưởng cho những ai muốn tận hưởng không gian cà phê đa năng.

**Tại sao Quán cà phê mở 24/24 được ưa chuộng?**
Nhu cầu tìm kiếm “quán cà phê 24/24 gần đây” xuất phát từ nhiều lý do khác nhau. Một trong những động lực chính là nhu cầu làm việc và học tập vào ban đêm của sinh viên và freelancer.

**Lowland Coffee: Điểm Đến Lý Tưởng Cho Mọi Thời Điểm**
Lowland Coffee tự hào là một thương hiệu quán cà phê mở 24/24, mang đến trải nghiệm cà phê, làm việc và thư giãn tuyệt vời cho mọi khách hàng.
- **Thỏa Sức Vui Vẻ Với Cà Phê Boardgame:** Lowland Coffee mang đến một thế giới boardgame đa dạng, sẵn sàng đáp ứng mọi sở thích và nhu cầu giải trí của khách hàng.
- **Đắm Chìm Trong Âm Nhạc Acoustic:** Bên cạnh boardgame, Lowland Coffee còn mang đến cho khách hàng những trải nghiệm âm nhạc acoustic đầy cảm xúc vào các dịp cuối tuần.

**Hệ thống chi nhánh Lowland Coffee:**
- Lowland Kim Sơn - Quận 7
- Lowland Đường số 65 - Quận 7
- Lowland Ngô Tất Tố - Quận Bình Thạnh
- Lowland Trần Não - Quận 2
- Lowland Linh Trung -Thủ Đức
- Lowland Lã Xuân Oai - Thủ Đức
- Lowland Dương Quảng Hàm - Gò Vấp',
'/assets/images/posts/top-7-quan-ca-phe-mo-24-24-o-sai-gon.jpg'
),
(
'Lowland Coffee Linh Trung - Quán Cà Phê Mở Xuyên Đêm Núp Hẻm', 
'lowland-coffee-linh-trung', 
'Lowland Coffee Linh Trung, quán cà phê mở 24/7 view đẹp, không gian yên tĩnh học bài.',
'**1. Giới thiệu chung về Lowland Coffee Linh Trung, Thủ Đức**
Lowland Coffee là chuỗi quán cà phê mở xuyên đêm, được yêu thích nhờ không gian đẹp, menu đa dạng và các hoạt động giải trí hấp dẫn. Chi nhánh Lowland Coffee Linh Trung tọa lạc gần Khu Làng Đại Học Thủ Đức, là một điểm đến lý tưởng dành cho sinh viên.
- Địa chỉ: Linh Trung, Thủ Đức, TP.HCM.
- Giờ mở cửa: 24/7 (Mở xuyên đêm, không phụ thu qua đêm).
- Giá Menu: 32.000 VNĐ - 60.000 VNĐ.

**2. Đặc điểm nổi bật**
- **Không gian sân vườn rộng rãi, phòng lạnh yên tĩnh:** Sân vườn xanh mát giúp thư giãn, phòng lạnh đầy đủ tiện nghi, wifi cực mạnh thích hợp để học tập và làm việc.
- **Menu đa dạng, giá cả hợp lý:** Cà phê rang xay nguyên chất, Trà sữa Bamos, Yogurt tươi... với mức giá sinh viên.
- **Hoạt động giải trí:** Acoustic Night miễn phí, Tarot Reading, Board Games & Tô Tượng.

**3. Kết luận**
Lowland Coffee Linh Trung không chỉ là quán cà phê mở xuyên đêm, mà còn là điểm đến lý tưởng cho sinh viên và người đi làm. Hãy ghé ngay để trải nghiệm!',
'/assets/images/posts/lowland-coffee-linh-trung.jpg'
),
(
'Quán cà phê Gò Vấp mở 24/7 - Lowland Coffee', 
'quan-ca-phe-go-vap-mo-24-7', 
'Quán cà phê Gò Vấp mở 24/7 vừa học tập vừa giải trí, không gian rộng rãi.',
'**Quán cà phê Gò Vấp mở cửa 24h?**
Bạn đang tìm kiếm quán cà phê gần bạn ở Gò Vấp lại còn mở cửa xuyên đêm thì Lowland Coffee chắc chắn sẽ là lựa chọn hoàn hảo!
Không gian sân vườn kết hợp máy lạnh, decor trẻ trung, hiện đại. Bàn học và ổ điện khắp nơi, lý tưởng cho sinh viên và freelancer. Góc “Instagrammable” tha hồ check-in sống ảo.

**Địa chỉ chi nhánh Gò Vấp:** 496/38 Dương Quảng Hàm, P.6, Q. Gò Vấp, TP.HCM.

**Acoustic - Tarot - Boardgame Miễn Phí Mỗi Tuần**
Lowland không chỉ là quán cà phê đẹp ở Gò Vấp, mà còn là nơi để bạn:
- Thư giãn cuối tuần với đêm nhạc Acoustic mộc mạc.
- Trải nghiệm xem Tarot cùng reader chuyên nghiệp.
- Tham gia boardgame cùng bạn bè.

**Quán cà phê Gò Vấp tổ chức sự kiện miễn phí**
Lowland hỗ trợ không gian tổ chức sự kiện miễn phí với đầy đủ thiết bị (loa, mic, máy chiếu…).

**Kết Luận**
Nếu bạn đang cần một quán cà phê ở Gò Vấp yên tĩnh để học bài, một nơi tụ họp bạn bè cuối tuần hay tổ chức event - Lowland Coffee chính là nơi lý tưởng dành cho bạn.',
'/assets/images/posts/quan-ca-phe-go-vap-mo-24-7.jpg'
),
(
'Cafe tổ chức sự kiện ở Bình Thạnh',
'cafe-to-chuc-su-kien-binh-thanh',
'Không gian miễn phí dành cho cá nhân, câu lạc bộ, doanh nghiệp.',
'Lowland Coffee Bình Thạnh hỗ trợ không gian tổ chức sự kiện miễn phí cho các nhóm sinh viên, CLB và doanh nghiệp. Với không gian rộng rãi, trang thiết bị âm thanh, ánh sáng cơ bản đầy đủ, đây là địa điểm lý tưởng cho các buổi workshop, họp mặt, sinh nhật.
Địa chỉ: 69 Ngô Tất Tố, Phường 19, Bình Thạnh.',
'/assets/images/posts/cafe-to-chuc-su-kien-binh-thanh.jpg'
),
(
'Quán cafe cho thuê phòng offline tại Thủ Đức',
'quan-cafe-cho-thue-phong-offline-thu-duc',
'Miễn phí không gian và thiết bị tại Lowland Coffee Thủ Đức.',
'Tìm quán cafe cho thuê phòng offline tại Thủ Đức? Lowland Coffee miễn phí không gian và thiết bị cơ bản cho các nhóm tổ chức sự kiện phi lợi nhuận hoặc offline fanclub.
Chi nhánh Thủ Đức có không gian sân thượng thoáng mát và phòng lạnh sức chứa lớn, view Landmark 81 cực chill.',
'/assets/images/posts/quan-cafe-cho-thue-phong-offline-thu-duc.jpg'
);

UPDATE products
SET sku = CONCAT('WEB-P', id)
WHERE sku IS NULL OR sku = '';
