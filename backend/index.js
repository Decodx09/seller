const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const app = express();
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "root",
  database: "shop",
  port: 3306,
});

// Login validation middleware
const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

// Registration validation middleware
const registerValidation = [
  body('name').trim().isLength({ min: 2, max: 50 }),
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/)
    .withMessage('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character')
];

app.post("/create", (req, res) => {
  const sql = "INSERT INTO products (name, price, description) VALUES (?, ?, ?)";
  const values = [req.body.name, req.body.price, req.body.description];
  db.query(sql, values, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.get("/products", (req, res) => {
  const sql = "SELECT * FROM products";
  db.query(sql, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.delete("/products/:id", (req, res) => {
  const sql = "DELETE FROM products WHERE id = ?";
  const id = req.params.id;
  db.query(sql, [id], (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.put("/products/:id", (req, res) => {
  const sql = "UPDATE products SET ? WHERE id = ?";
  const id = req.params.id;
  const values = [req.body.name, req.body.price, req.body.description];
  db.query(sql, [values, id], (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.post("/login", loginValidation, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    
    // First, get user by email
    const sql = "SELECT * FROM users WHERE email = ?";
    db.query(sql, [email], async (err, data) => {
      if (err) return res.status(500).json({ error: "Database error" });
      
      if (data.length === 0) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const user = data[0];
      
      // Compare password hash
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Don't send password in response
      delete user.password;
      
      // Here you might want to generate a JWT token
      return res.json({
        message: "Login successful",
        user
      });
    });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/register", registerValidation, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    // Check if email already exists
    const checkEmailSql = "SELECT id FROM users WHERE email = ?";
    db.query(checkEmailSql, [email], async (err, result) => {
      if (err) return res.status(500).json({ error: "Database error" });
      
      if (result.length > 0) {
        return res.status(400).json({ error: "Email already registered" });
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Insert new user
      const insertSql = "INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, 'user', NOW())";
      db.query(insertSql, [name, email, hashedPassword], (err, data) => {
        if (err) return res.status(500).json({ error: "Failed to register user" });

        return res.status(201).json({
          message: "Registration successful",
          userId: data.insertId
        });
      });
    });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/categories", (req, res) => {
  const sql = "INSERT INTO categories (name, description) VALUES (?, ?)";
  const values = [req.body.name, req.body.description];
  db.query(sql, values, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.get("/categories", (req, res) => {
  const sql = "SELECT * FROM categories";
  db.query(sql, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.get("/products/category/:categoryId", (req, res) => {
  const sql = "SELECT * FROM products WHERE category_id = ?";
  db.query(sql, [req.params.categoryId], (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.get("/products/search", (req, res) => {
  const searchTerm = `%${req.query.term}%`;
  const sql = "SELECT * FROM products WHERE name LIKE ? OR description LIKE ?";
  db.query(sql, [searchTerm, searchTerm], (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.post("/cart", (req, res) => {
  const sql = "INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)";
  const values = [req.body.userId, req.body.productId, req.body.quantity];
  db.query(sql, values, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.get("/cart/:userId", (req, res) => {
  const sql = `
    SELECT ci.*, p.name, p.price, p.description 
    FROM cart_items ci 
    JOIN products p ON ci.product_id = p.id 
    WHERE ci.user_id = ?
  `;
  db.query(sql, [req.params.userId], (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.delete("/cart/:userId/:productId", (req, res) => {
  const sql = "DELETE FROM cart_items WHERE user_id = ? AND product_id = ?";
  db.query(sql, [req.params.userId, req.params.productId], (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.post("/orders", (req, res) => {
  const orderSql = "INSERT INTO orders (user_id, total_amount, shipping_address) VALUES (?, ?, ?)";
  const orderValues = [req.body.userId, req.body.totalAmount, req.body.shippingAddress];
  
  db.query(orderSql, orderValues, (err, orderResult) => {
    if (err) return res.json(err);
    
    const orderId = orderResult.insertId;
    const orderItemsSql = "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ?";
    const orderItemsValues = req.body.items.map(item => [
      orderId, item.productId, item.quantity, item.price
    ]);

    db.query(orderItemsSql, [orderItemsValues], (err, itemsResult) => {
      if (err) return res.json(err);
      return res.json({ orderId, message: "Order placed successfully" });
    });
  });
});

app.get("/orders/:userId", (req, res) => {
  const sql = `
    SELECT o.*, oi.product_id, oi.quantity, oi.price, p.name
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE o.user_id = ?
  `;
  db.query(sql, [req.params.userId], (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.get("/users/:userId", (req, res) => {
  const sql = "SELECT id, name, email FROM users WHERE id = ?";
  db.query(sql, [req.params.userId], (err, data) => {
    if (err) return res.json(err);
    return res.json(data[0]);
  });
});

app.put("/users/:userId", (req, res) => {
  const sql = "UPDATE users SET name = ?, email = ? WHERE id = ?";
  const values = [req.body.name, req.body.email, req.params.userId];
  db.query(sql, values, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

const isAdmin = (req, res, next) => {
  const sql = "SELECT role FROM users WHERE id = ?";
  db.query(sql, [req.body.userId], (err, result) => {
    if (err) return res.status(500).json(err);
    if (!result[0] || result[0].role !== 'admin') {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    }
    next();
  });
};

app.get("/admin/dashboard", isAdmin, (req, res) => {
  const stats = {};
  
  // Get total sales
  db.query("SELECT SUM(total_amount) as total_sales FROM orders", (err, sales) => {
    if (err) return res.json(err);
    stats.totalSales = sales[0].total_sales;
    
    // Get total orders
    db.query("SELECT COUNT(*) as total_orders FROM orders", (err, orders) => {
      if (err) return res.json(err);
      stats.totalOrders = orders[0].total_orders;
      
      // Get total users
      db.query("SELECT COUNT(*) as total_users FROM users", (err, users) => {
        if (err) return res.json(err);
        stats.totalUsers = users[0].total_users;
        
        // Get low stock products (less than 10)
        db.query("SELECT COUNT(*) as low_stock FROM products WHERE stock < 10", (err, stock) => {
          if (err) return res.json(err);
          stats.lowStockProducts = stock[0].low_stock;
          
          res.json(stats);
        });
      });
    });
  });
});

app.get("/admin/orders", isAdmin, (req, res) => {
  const sql = `
    SELECT o.*, u.name as customer_name, u.email as customer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC
  `;
  db.query(sql, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.put("/admin/orders/:orderId", isAdmin, (req, res) => {
  const sql = "UPDATE orders SET status = ? WHERE id = ?";
  db.query(sql, [req.body.status, req.params.orderId], (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

// User Management
app.get("/admin/users", isAdmin, (req, res) => {
  const sql = "SELECT id, name, email, role, created_at FROM users";
  db.query(sql, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.put("/admin/users/:userId", isAdmin, (req, res) => {
  const sql = "UPDATE users SET role = ? WHERE id = ?";
  db.query(sql, [req.body.role, req.params.userId], (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.get("/admin/products", isAdmin, (req, res) => {
  const sql = `
    SELECT p.*, c.name as category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id
  `;
  db.query(sql, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.put("/admin/products/:id/stock", isAdmin, (req, res) => {
  const sql = "UPDATE products SET stock = ? WHERE id = ?";
  db.query(sql, [req.body.stock, req.params.id], (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.get("/admin/reports/sales", isAdmin, (req, res) => {
  const { start_date, end_date } = req.query;
  const sql = `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as orders,
      SUM(total_amount) as revenue
    FROM orders
    WHERE created_at BETWEEN ? AND ?
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `;
  db.query(sql, [start_date, end_date], (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.get("/admin/reports/top-products", isAdmin, (req, res) => {
  const sql = `
    SELECT 
      p.id,
      p.name,
      SUM(oi.quantity) as total_sold,
      SUM(oi.quantity * oi.price) as revenue
    FROM products p
    JOIN order_items oi ON p.id = oi.product_id
    GROUP BY p.id
    ORDER BY total_sold DESC
    LIMIT 10
  `;
  db.query(sql, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.get("/admin/reports/customer-analytics", isAdmin, (req, res) => {
  const sql = `
    SELECT 
      u.id,
      u.name,
      COUNT(DISTINCT o.id) as total_orders,
      SUM(o.total_amount) as total_spent
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    GROUP BY u.id
    ORDER BY total_spent DESC
  `;
  db.query(sql, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
