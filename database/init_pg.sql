-- PostgreSQL schema + seed for Render Postgres (or any PG 14+)
-- From repo root (with DATABASE_URL or psql): psql "$DATABASE_URL" -f database/init_pg.sql

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(120) NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'vendor', 'user'))
);

CREATE TABLE vendors (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(120) NOT NULL,
  category VARCHAR(80),
  contact_details TEXT
);

CREATE TABLE memberships (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  duration VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL
);

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  location VARCHAR(100) NOT NULL
);

CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  date DATE NOT NULL
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  vendor_id INT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  image_url VARCHAR(500),
  status VARCHAR(40) NOT NULL DEFAULT 'active'
);

CREATE TABLE cart_items (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  CONSTRAINT uq_cart_user_product UNIQUE (user_id, product_id)
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grand_total DECIMAL(12, 2) NOT NULL,
  fulfillment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  customer_name VARCHAR(120),
  customer_email VARCHAR(120),
  customer_phone VARCHAR(40),
  customer_address TEXT,
  customer_city VARCHAR(80),
  customer_state VARCHAR(80),
  customer_pin VARCHAR(20),
  payment_method VARCHAR(40),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL
);

CREATE TABLE item_requests (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor_id INT REFERENCES vendors(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE guest_list (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL
);

INSERT INTO users (username, email, password, role) VALUES
('admin', 'admin@example.com', '$2a$10$Ypck7s964bsJjMtgnjHh9uOLvPo4dWk9bXlJ/yh5p7ij/hBkYCWCO', 'admin'),
('user', 'user@example.com', '$2a$10$3oIRmyi7FbRccBkjRo1DpuKtt9HMY5YKG3hmlCNje7AX8j7TMEmhi', 'user'),
('jsmith', 'jsmith@example.com', '$2a$10$3oIRmyi7FbRccBkjRo1DpuKtt9HMY5YKG3hmlCNje7AX8j7TMEmhi', 'user'),
('vendor1', 'vendor@example.com', '$2a$10$wOVyPFPcxUyYAl/cBlHl.uTPdizJ3QUUvGjsbHBGOhjbfFzyHfRuu', 'vendor');

INSERT INTO vendors (user_id, business_name, category, contact_details) VALUES
(4, 'Demo Catering Co', 'Catering', 'Call 555-0101 or email vendor@example.com');

INSERT INTO products (vendor_id, name, price, image_url, status) VALUES
(1, 'Coffee Service', 150.00, '/img/placeholder-product.svg', 'active'),
(1, 'Lunch Buffet', 450.00, '/img/placeholder-product.svg', 'active');

INSERT INTO memberships (user_id, duration, start_date, end_date, status) VALUES
(2, '6 months', '2025-10-01', '2026-04-01', 'active'),
(3, '1 year', '2024-06-15', '2025-06-15', 'expired');

INSERT INTO events (name, date, location) VALUES
('Annual Gala', '2026-05-20', 'Grand Hall Downtown'),
('Tech Meetup', '2026-04-12', 'Room 3B City Library'),
('Charity Run', '2026-06-01', 'Riverside Park');

INSERT INTO transactions (user_id, event_id, date) VALUES
(2, 1, '2026-03-01'),
(2, 2, '2026-03-15');
