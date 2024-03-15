import express, { response} from "express";
import mysql from 'mysql'
import cors from 'cors'
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import expressUploader from "express-fileupload";
import fetch from "node-fetch";


const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(expressUploader());
app.use(cors(
    {
        origin: ["http://localhost:3000", "http://localhost:3001"],
        methods: ["POST, GET, PUT, DELETE"],
        credentials: true
    }
))

const db = mysql.createConnection({
    host: "localhost",
    port: 1008,
    user: "root",
    password: "",
    database: "web_sport"
});

db.connect((err) => {
    if (err) {
      console.error("Error connecting to MySQL:", err);
      return;
    }
    console.log("Connected to MySQL database");
  });

//login admin
function verifyToken(req, res, next) {
    // Get the token from the cookie or wherever it's stored
    const token = req.cookies.token;
  
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  
    // Verify and decode the token
    jwt.verify(token, 'jwtSecretKey', (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: 'Invalid token' });
      }
  
      // The user's ID is stored in the token payload
      req.id = decoded.id; // Assuming "id" is the key in the payload
  
      // Continue processing the request
      next();
    });
  }
  
app.post('/', (req, res) => {
    const sql = "SELECT * FROM users WHERE email = ? AND password = ? AND admin = 1";
    db.query(sql, [req.body.email, req.body.password], (err, data)=>{
        if (err) {
            return res.json({ Message: 'Database error' });
          }
          if (data.length > 0) {
                    const userName = data[0].userName;
                    const id = data[0].id;
                    const token = jwt.sign({id}, "jwtSecretKey", { expiresIn: '1d' });
                    res.cookie('token', token);
                    return res.json({ Status: "Success", id});
          } else {
            return res.json({ Message: "Wrong Email or Password"});
          }
    })
})

//forgot-password
function saveResetToken(email, token, callback) {
    const sql = 'UPDATE users SET reset_token = ? WHERE email = ?';
  
    // Execute the SQL query
    db.query(sql, [token, email], (error, results) => {
      if (error) {
        // Handle database query error
        return callback(error);
      }
  
      if (results.affectedRows === 0) {
        // No user found with the specified email
        return callback(new Error('User not found'));
      }
  
      // Password reset token saved successfully
      callback(null);
    });
  }
app.post('/forgot-password', (req, res) => {
    const { email } = req.body;
    const sqlEmail = 'SELECT * FROM users WHERE email = ? AND admin = 1';
    db.query(sqlEmail, email, (err, data)=>{
        if (err) {
            return res.json({ Message: 'Database error' });
          }
          if (data.length > 0) {
            const resetToken = crypto.randomBytes(20).toString('hex');
            const sqlToken = 'UPDATE users SET reset_token = ? WHERE email = ?';
            db.query(sqlToken, [resetToken, req.body.email])
            const transporter = nodemailer.createTransport({
                service: 'sangnnm.sec@gmail.com',
                auth: {
                  user: 'sangnnm.sec@gmail.com',
                  pass: 'hryndsvpuxlctdfs',
                },
              });
            
              const resetLink = `http://localhost:3000/reset-password/${resetToken}`;
              const mailOptions = {
                from: 'sangnnm.sec@gmail.com',
                to: email,
                subject: 'Password Reset',
                text: `Click the following link to reset your password: ${resetLink}`,
              };
            
              transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                  console.error('Error sending email:', error);
                  return res.status(500).json({ Message: 'Internal Server Error' });
                }
                console.log('Password reset email sent:', info.response);
                res.json({ Message: 'Password Reset Email Sent' });
              });
          } else {
            return res.json({ Message: "Email Does Not Exist" });
          }
        });
    });



//reset-password
app.post('/reset-password', (req, res) => {
    const { resetToken, newPassword } = req.body;
    const checkTokenQuery = 'SELECT * FROM users WHERE reset_token = ?';
    db.query(checkTokenQuery, [resetToken], (err, results) => {
      if (err) {
        return res.status(500).json({ Message: 'Database Error' });
      }
  
      if (results.length === 0) {
        return res.status(404).json({ Message: 'Invalid Reset Token' });
      }
  
    const userId = results[0].id;
    const updatePasswordQuery = 'UPDATE users SET password = ?, reset_token = NULL WHERE id = ?';
    db.query(updatePasswordQuery, [newPassword, userId], (err) => {
        if (err) {
          return res.status(500).json({ Message: 'Database Error' });
        }
  
        res.json({ Message: 'Password Reset Successful' });
      });
    });
  });



// main-layout
app.get('/admin', verifyToken, (req, res) => {
    const id = req.id;
    
    // Query the database to fetch user data
    const sql = 'SELECT * FROM users WHERE id = ?';
    db.query(sql, [id], (err, data) => {
      if (err) {
        return res.status(500).json({ Message: 'Database Error' });
      }
  
      if (data.length > 0) {
        const userName = data[0].userName;
      const email = data[0].email;
      return res.json({Status: 'Success',userName, email}); 
      } else {
        return res.status(404).json({ Message: 'User Not Found' });
      }
  
    });
  });



//logout
app.get('/logout', (req, res) => {
    res.clearCookie('token');
    return res.json({Status: "Success"});
})



//brands insert
app.post('/brand', (req, res) => {
    const { brandName } = req.body;
    const sqlBrand = 'INSERT INTO brands (brandName) VALUES (?)';
    db.query(sqlBrand, [brandName], (error, results) => {
      if (error) {
        console.error('Error creating brand:', error);
        return res.status(500).json({ Message: 'Database Error' });
      }
      res.json({ Message: 'Brand Created Successfully', brandId: results.insertId });
    });
  });



//brands display
app.get('/brand', (req, res) => {
    const sqlAll = `
  SELECT b.id AS id, b.brandName, COUNT(p.id) AS items
  FROM brands AS b
  LEFT JOIN products AS p ON b.id = p.brand_id
  GROUP BY b.id, b.brandName;
`;
    db.query(sqlAll, (err, results) => {
      if (err) {
        console.error('Error fetching brands:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      res.json(results);
    });
  });



//brand edit
app.get('/brand/:idBrand', (req, res) => {
    const { idBrand } = req.params;
    const sql = 'SELECT brandName FROM brands WHERE id = ?';
    db.query(sql, [idBrand], (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
          const brandName = data[0].brandName;
          return res.json({Status: 'Success', brandName}); 
    })
})
app.put('/brand/:idBrand', (req, res) => {
    const { idBrand } = req.params;
    const { brandName } = req.body;
    const sqlEdit = 'UPDATE brands SET brandName = ? WHERE id = ?';
    db.query(sqlEdit, [brandName, idBrand], (err, data)=>{
        if (err) {
            console.error('Error fetching brands:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
          return res.json({Status: 'Success', brandName}); 
    })
  });



//brand delete
app.delete('/brand/:idBrand', (req, res) => {
    const { idBrand } = req.params;
    const sqlEdit = 'DELETE FROM brands WHERE id = ?';
    db.query(sqlEdit, [idBrand], (err, data)=>{
        if (err) {
            console.error('Error fetching brands:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
          return res.json({Status: 'Success'}); 
    })
  });



//sports insert
app.post('/sport', (req, res) => {
    const { sportName } = req.body;
    const sql = 'INSERT INTO sports (sportName) VALUES (?)';
    db.query(sql, [sportName], (error, results) => {
      if (error) {
        console.error('Error creating sport:', error);
        return res.status(500).json({ Message: 'Database Error' });
      }
      res.json({ Message: 'Sport Created Successfully', sportId: results.insertId });
    });
  });



//sports display
app.get('/sport', (req, res) => {
    const sql = `
  SELECT s.id AS id, s.sportName, COUNT(p.id) AS items
  FROM sports AS s
  LEFT JOIN products AS p ON s.id = p.sport_id
  GROUP BY s.id, s.sportName;
`;
    db.query(sql, (err, results) => {
      if (err) {
        console.error('Error fetching brands:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      res.json(results);
    });
  });



//sport edit
app.get('/sport/:idSport', (req, res) => {
    const { idSport } = req.params;
    const sql = 'SELECT sportName FROM sports WHERE id = ?';
    db.query(sql, [idSport], (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
          const sportName = data[0].sportName;
          return res.json({Status: 'Success', sportName}); 
    })
})
app.put('/sport/:idSport', (req, res) => {
    const { idSport } = req.params;
    const { sportName } = req.body;
    const sqlEdit = 'UPDATE sports SET sportName = ? WHERE id = ?';
    db.query(sqlEdit, [sportName, idSport], (err, data)=>{
        if (err) {
            console.error('Error fetching sports:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
          return res.json({Status: 'Success', sportName}); 
    })
  });



//sport delete
app.delete('/sport/:idSport', (req, res) => {
    const { idSport } = req.params;
    const sqlEdit = 'DELETE FROM sports WHERE id = ?';
    db.query(sqlEdit, [idSport], (err, data)=>{
        if (err) {
            console.error('Error fetching sports:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
          return res.json({Status: 'Success'}); 
    })
  });



//category create
  app.get('/category1', (req, res) => {
    const sql = 'SELECT id, title FROM categories'
    db.query(sql, (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
        res.json(data); 
    })
  })
  app.post('/category', (req, res) => {
    const { title, description, parent_id } = req.body;
    const sql = 'INSERT INTO categories (title, description, parent_id) VALUES (?, ?, ?)';
    db.query(sql, [title, description, parent_id], (error, results) => {
      if (error) {
        console.error('Error creating category:', error);
        return res.status(500).json({ Message: 'Database Error' });
      }
      res.json({ Message: 'Category Created Successfully', categoryId: results.insertId });
    });
  });



//category display
  app.get('/category', (req, res) => {
    const sql = `
    SELECT
    c1.id AS categoryID,
    c1.title AS categoryTitle,
    COALESCE(c2.title, 'No Parent') AS parentCategoryName,
    COUNT(p.id) AS items
FROM
    categories AS c1
LEFT JOIN
    products AS p ON c1.id = p.category_id
LEFT JOIN
    categories AS c2 ON c1.parent_id = c2.id
GROUP BY
    c1.id, c1.title, c2.title;
  `;
    db.query(sql, (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      res.json(results);
    });
  });

//category delete
app.delete('/category/:categoryId', (req, res) => {
    const { categoryId } = req.params;
    const sqlEdit = 'DELETE FROM categories WHERE id = ?';
    db.query(sqlEdit, [categoryId], (err, data)=>{
        if (err) {
            console.error('Error fetching category:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
          return res.json({Status: 'Success'}); 
    })
  });

//category edit
app.get('/category/:idCategory', (req, res) => {
    const { idCategory } = req.params;
    const sql = `
    SELECT
    c1.id AS categoryID,
    c1.title AS categoryTitle,
    c1.description AS categoryDescription,
    c2.title AS parentCategoryName
FROM
    categories AS c1
LEFT JOIN
    categories AS c2 ON c1.parent_id = c2.id
WHERE 
    c1.id = ?
  `;
    db.query(sql, [idCategory], (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
          const categoryTitle = data[0].categoryTitle;
          const categoryDescription = data[0].categoryDescription;
          const parentCategoryName = data[0].parentCategoryName;
          return res.json({categoryTitle, categoryDescription, parentCategoryName}); 
    })
})
app.put('/category/:idCategory', (req, res) => {
    const { idCategory } = req.params;
    const { title, description, parent_id } = req.body;
    const sqlEdit = 'UPDATE categories SET title = ?, description = ?, parent_id = ? WHERE id = ?;';
    db.query(sqlEdit, [title, description, parent_id, idCategory], (err, data)=>{
        if (err) {
            console.error('Error fetching sports:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
          return res.json({Status: 'Success', data});
    })
  });


//category delete
app.delete('/category/:idCategory', (req, res) => {
    const { idCategory } = req.params;
    const sqlEdit = 'DELETE FROM sports WHERE id = ?';
    db.query(sqlEdit, [idCategory], (err, data)=>{
        if (err) {
            console.error('Error fetching category:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
          return res.json({Status: 'Success'}); 
    })
  });


//product create
app.get('/brand1', (req, res) => {
    const sqlBrandName = 'SELECT id, brandName FROM brands'
    db.query(sqlBrandName, (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
        res.json(data); 
    })
  })

  app.get('/sport1', (req, res) => {
    const sql= 'SELECT id, sportName FROM sports'
    db.query(sql, (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
        res.json(data); 
    })
  })

  app.post('/product', (req, res) => {
    const { name, SKU, description, quantity, price, discount, category_id, brand_id, sport_id, features} = req.body;
    const sql = 'INSERT INTO products (name, SKU, description, quantity, price, discount, category_id, brand_id, sport_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const featureQuery = 'INSERT INTO product_features (product_id, feature_name) VALUES ?';
    db.query(sql, [name, SKU, description, quantity, price, discount, category_id, brand_id, sport_id], (error, data) => {
      if (error) {
        console.log(error);
        return res.status(500).json({ Message: 'Database Error' });
      }
      const productId = data.insertId;
      const featureData = features
      .filter((feature) => feature.feature_name !== null) // Filter out elements with null feature_name
      .map((feature) => [productId, feature.feature_name]);
      if (featureData.length === 0) {
        // If 'features' is null or empty, return a response without inserting anything.
        return res.json({ productId: productId });
      } else {
        db.query(featureQuery, [featureData], (err) => {
          if (err) {
            console.error('Error inserting features:', err);
            return res.status(500).json({ Message: 'Database Error' });
          }
        
          return res.json({ productId: productId });
        });
      }
    })
})

app.post('/upload', (req, res) => {
    const {images} = req.files;
    const sql = 'INSERT INTO product_gallery (product_id, productImage) VALUES (?, ?)'
    const sqlID = 'SELECT MAX(id) AS last_id FROM products'
    fetch("https://www.filestackapi.com/api/store/S3?key=AJmEEe9SJT16AJoXJkj5uz", {
    method: 'POST',
    headers: {'Content-Type': 'image/png'},
    body: images.data
}).then((r)=>r.json())
.then((r)=>{
        const productImage = r.url;
        db.query(sqlID, (err, data) => {
            const product_id = data[0].last_id;
            db.query(sql, [product_id, productImage], (err, data) => {
            if(err) {
                console.log(err);
                return res.json({Message: "Database Error"})
            } 
            return res.json({Message: "Add Image Success"})
        });
    })
        
})
})
//user display
app.get('/user_admin', (req, res) => {
    const sql = `
    SELECT
    u.id AS id,
    u.userName AS userName,
    u.email AS email,
    u.phone AS phone,
    COALESCE(u.userImage, 'https://cdn.filestackcontent.com/uJqPzDJJRDqGY3TuYPIA') AS image,
    u.address AS address,
    DATE_FORMAT(u.created_at, '%d-%m-%Y') AS date,
    COUNT(o.user_id) AS order_count,
    SUM(o.total_price) AS total_order_amount
FROM
    users AS u
LEFT JOIN
    orders AS o ON u.id = o.user_id
GROUP BY
    u.id, u.userName, u.email, u.phone, u.userImage, u.address;
  `;
  db.query(sql, (err, results) => {
    if (err) {
        console.log(err)
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    res.json(results);
  });
})
app.put('/setAdmin/:id', (req, res) => {
    const { id } = req.params
    const sql = 'UPDATE users SET admin = 1 WHERE id = ?'
    db.query(sql,  [id],(err, data) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ Message: 'Database Error' });
          }
            return res.json(data);
    })
})
app.delete('/user_admin/:id', (req, res) => {
    const { id } = req.params;
    const sqlEdit = 'DELETE FROM users WHERE id = ?';
    db.query(sqlEdit, [id], (err, data) => {
        if (err) {
            console.error('Error fetching sports:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
          return res.json({Status: 'Success'}); 
    })
  });

//product display
app.get('/product', (req, res) => {
    const sql = `
    SELECT
    p.id AS product_id,
    p.name AS productName,
    p.SKU AS SKU,
    p.quantity AS quantity,
    p.discount AS discount,
    c.title AS category,
    b.brandName AS brand,
    s.sportName AS sport,
    COALESCE(
        (
            SELECT productImage
            FROM product_gallery
            WHERE product_id = p.id
            ORDER BY id ASC
            LIMIT 1
        ),
        'https://cdn.filestackcontent.com/uJqPzDJJRDqGY3TuYPIA'
    ) AS productImage
FROM
    products AS p
LEFT JOIN
    categories AS c ON c.id = p.category_id
LEFT JOIN
    brands AS b ON b.id = p.brand_id
LEFT JOIN
    sports AS s ON s.id = p.sport_id
  `;
  db.query(sql, (err, results) => {
    if (err) {
        console.log(err)
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    res.json(results);
  });
})


//product create
app.get('/product/:idProduct', (req, res) => {
    const { idProduct } = req.params;
    const sql = `
    SELECT * FROM products WHERE id = ?
  `;
  db.query(sql, [idProduct], (err, data) => {
    if (err) {
        console.log(err)
        return res.status(500).json({ error: 'Internal Server Error' });
      }  
      const productName = data[0].name;
      const SKU = data[0].SKU;
      const description = data[0].description;
      const quantity = data[0].quantity;
      const price = data[0].price;
      const discount = data[0].discount;
      const category = data[0].category_id;
      const brand = data[0].brand_id;
      const sport = data[0].sport_id;
      return res.json({productName, SKU, description, quantity, price, discount, sport, category, brand}); 
})
})
app.get('/features/:idProduct', (req, res) => {
    const { idProduct } = req.params;
    const sql = 'SELECT id, feature_name FROM product_features WHERE product_id = ?'
    db.query(sql, [idProduct], (err, data) => {
        if (err) {
            console.log(err)
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
        return res.json(data)
    })
})
app.get('/images/:idProduct', (req, res) => {
    const { idProduct } = req.params;
    const sql = 'SELECT id, productImage FROM product_gallery WHERE product_id = ?'
    db.query(sql, [idProduct], (err, data) => {
        if (err) {
            console.log(err)
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
        return res.json(data)
    })
})

app.put('/product/:idProduct', (req, res) => {
    const { idProduct } = req.params;
    const { name, SKU, description, quantity, price, discount, category_id, brand_id, sport_id} = req.body;
    const sqlEdit = ' UPDATE products SET name = ?, SKU = ?, description = ?, quantity = ?, price = ?, discount = ?, category_id = ?, brand_id = ?, sport_id = ? WHERE id = ?'
    db.query(sqlEdit, [name, SKU, description, quantity, price, discount, category_id, brand_id, sport_id, idProduct], (err) => {
        if (err) {
            console.log(err);
            console.error('Error inserting features:', err);
            return res.status(500).json({ Message: 'Database Error' });
        } return res.json({Message: "Success"})
    });
  });
app.post('/feature/:idProduct', (req, res) => {
    const { idProduct } = req.params;
    const { features } = req.body;
    const featureQuery = 'INSERT INTO product_features (product_id, feature_name) VALUES ?';
    const featureData = features
      .filter((feature) => feature.feature_name !== null) // Filter out elements with null feature_name
      .map((feature) => [idProduct, feature.feature_name]);
      if (featureData.length === 0) {
        // If 'features' is null or empty, return a response without inserting anything.
        return res.json({ productId: idProduct });
      } else {
        db.query(featureQuery, [featureData], (err) => {
          if (err) {
            console.error('Error inserting features:', err);
            return res.status(500).json({ Message: 'Database Error' });
          }
        
          return res.json({ productId: idProduct });
        });
      }
})

app.delete('/feature/:idFeature', (req, res) => {
    const { idFeature } = req.params;
    const sqlEdit = 'DELETE FROM product_features WHERE id = ?';
    db.query(sqlEdit, [idFeature], (err, data) => {
        if (err) {
            console.error('Error fetching sports:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
          return res.json({Status: 'Success'}); 
    })
  });

app.delete('/images/:idImage', (req, res) => {
    const { idImage } = req.params;
    const sqlEdit = 'DELETE FROM product_gallery WHERE id = ?';
    db.query(sqlEdit, [idImage], (err, data)=>{
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
          return res.json({Status: 'Success'}); 
    })
  })

app.post('/upload/:productId', (req, res) => {
    const {productId} = req.params;
    const {images} = req.files;
    const sql = 'INSERT INTO product_gallery (product_id, productImage) VALUES (?, ?)'
    fetch("https://www.filestackapi.com/api/store/S3?key=AJmEEe9SJT16AJoXJkj5uz", {
    method: 'POST',
    headers: {'Content-Type': 'image/png'},
    body: images.data
}).then((r)=>r.json())
.then((r)=>{
        const productImage = r.url;
            db.query(sql, [productId, productImage], (err, data) => {
            if(err) {
                console.log(err);
                return res.json({Message: "Database Error"})
            } 
            return res.json({Message: "Add Image Success"})
    })
})
})

//product delete
app.delete('/product/:productId', (req, res) => {
    const { productId } = req.params;
    const sql = 'DELETE FROM products WHERE id = ?';
    db.query(sql, [productId], (err, data)=>{
        if (err) {
            console.error('Error fetching sports:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
          return res.json({Status: 'Success'}); 
    })
  })


//location create
app.post('/location', (req, res) => {
    const { name, address, latitude, longitude, quantity, price, description, sport_id} = req.body;
    const sql = 'INSERT INTO locations (name,  address, latitude, longitude, price, quantity, description, sport_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(sql, [name, address, latitude, longitude, quantity, price, description, sport_id], (error, data) => {
      if (error) {
        console.log(error);
        return res.status(500).json({ Message: 'Database Error' });
      }
        return res.json(data);
    })
})
app.post('/uploadImage', (req, res) => {
    const {images} = req.files;
    const sql = 'INSERT INTO location_gallery (location_id, locationImage) VALUES (?, ?)'
    const sqlID = 'SELECT MAX(id) AS last_id FROM locations'
    fetch("https://www.filestackapi.com/api/store/S3?key=AJmEEe9SJT16AJoXJkj5uz", {
    method: 'POST',
    headers: {'Content-Type': 'image/png'},
    body: images.data
}).then((r)=>r.json())
.then((r)=>{
        const locationImage = r.url;
        db.query(sqlID, (err, data) => {
            const location_id= data[0].last_id;
            db.query(sql, [location_id, locationImage], (err, data) => {
            if(err) {
                console.log(err);
                return res.json({Message: "Database Error"})
            } 
            return res.json({Message: "Add Image Success"})
        });
    })
        
})
})


//location display
app.get('/location', (req, res) => {
    const sql = `
    SELECT
    l.id AS location_id,
    l.name AS locationName,
    l.address AS address,
    s.sportName AS sport
FROM
    locations AS l
LEFT JOIN
    sports AS s ON l.sport_id = s.id
  `;
  db.query(sql, (err, results) => {
    if (err) {
        console.log(err)
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    res.json(results);
  });
})



//location edit
app.get('/location/:locationId', (req, res) => {
    const { locationId } = req.params;
    const sql = `
    SELECT * FROM locations WHERE id = ?
  `;
  db.query(sql, [locationId], (err, data) => {
    if (err) {
        console.log(err)
        return res.status(500).json({ error: 'Internal Server Error' });
      }  
      const locationName = data[0].name;
      const address = data[0].address;
      const description = data[0].description;
      const quantity = data[0].quantity;
      const price = data[0].price;
      const sport = data[0].sport_id;
      return res.json({locationName, description, quantity, price, sport, address}); 
})
})
app.get('/uploadImages/:locationId', (req, res) => {
    const { locationId } = req.params;
    const sql = 'SELECT id, locationImage FROM location_gallery WHERE location_id = ?'
    db.query(sql, [locationId], (err, data) => {
        if (err) {
            console.log(err)
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
        return res.json(data)
    })
})
app.delete('/uploadImages/:idImage', (req, res) => {
    const { idImage } = req.params;
    const sqlEdit = 'DELETE FROM location_gallery WHERE id = ?';
    db.query(sqlEdit, [idImage], (err, data)=>{
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
          return res.json({Status: 'Success'}); 
    })
  })
  app.put('/location/:locationId', (req, res) => {
    const { locationId } = req.params;
    const { name, address, latitude, longitude, quantity, price, description, sport_id} = req.body;
    const sqlEdit = `UPDATE locations SET name = ?, address = COALESCE(?, address), latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude), price = ?, quantity = ?, description = ?, sport_id = ? WHERE id = ?`
    db.query(sqlEdit, [name, address, latitude, longitude, quantity, price, description, sport_id, locationId], (err) => {
        if (err) {
            console.log(err);
            console.error('Error inserting features:', err);
            return res.status(500).json({ Message: 'Database Error' });
        } return res.json({Message: "Success"})
    });
  });
  app.post('/uploadImages/:locationId', (req, res) => {
    const {locationId} = req.params;
    const {images} = req.files;
    const sql = 'INSERT INTO location_gallery (location_id, locationImage) VALUES (?, ?)'
    fetch("https://www.filestackapi.com/api/store/S3?key=AJmEEe9SJT16AJoXJkj5uz", {
    method: 'POST',
    headers: {'Content-Type': 'image/png'},
    body: images.data
}).then((r)=>r.json())
.then((r)=>{
        const locationImage = r.url;
            db.query(sql, [locationId, locationImage], (err, data) => {
            if(err) {
                console.log(err);
                return res.json({Message: "Database Error"})
            } 
            return res.json({Message: "Add Image Success"})
    })
})
})

//location delete
app.delete('/location/:locationId', (req, res) => {
    const { locationId } = req.params;
    const sql = 'DELETE FROM locations WHERE id = ?';
    db.query(sql, [locationId], (err, data)=>{
        if (err) {
            console.error('Error fetching sports:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
          }  
          return res.json({Status: 'Success'}); 
    })
  })

//coupon create
app.post('/coupon', (req, res) => {
    const {code, type, value, usage_limit, status} = req.body;
    const sql = 'INSERT INTO coupons (code, type, value, usage_limit, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.query(sql, [code, type, value, usage_limit, status], (error, data) => {
      if (error) {
        console.log(error);
        return res.status(500).json({ Message: 'Database Error' });
      }
        return res.json(data);
    })
})


//coupon display
app.get('/coupon', (req, res) => {
    const sql = 'SELECT * FROM coupons'
    db.query(sql, (err, data) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ Message: 'Database Error' });
          }
            return res.json(data);
    })
})
app.put('/couponEna/:idCoupon', (req, res) => {
    const { idCoupon } = req.params
    const sql = 'UPDATE coupons SET status = "Enable" WHERE id = ?'
    db.query(sql,  [idCoupon],(err, data) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ Message: 'Database Error' });
          }
            return res.json(data);
    })
})
app.put('/couponDis/:idCoupon', (req, res) => {
    const { idCoupon } = req.params
    const sql = 'UPDATE coupons SET status = "Disable" WHERE id = ?'
    db.query(sql,  [idCoupon],(err, data) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ Message: 'Database Error' });
          }
            return res.json(data);
    })
})





//User Login
app.post('/login', (req, res) => {
    const sql = "SELECT * FROM users WHERE email = ? AND password = ?";
    db.query(sql, [req.body.email, req.body.password], (err, data)=>{
        if (err) {
            return res.json({ Message: 'Database error' });
          }
          if (data.length > 0) {
                    const userName = data[0].userName;
                    const id = data[0].id;
                    const token = jwt.sign({id}, "jwtSecretKey", { expiresIn: '1d' });
                    res.cookie('token', token);
                    return res.json({ Status: "Success", id});
          } else {
            return res.json({ Message: "Wrong Email or Password"});
          }
    })
})
app.get('/', verifyToken, (req, res) => {
    const id = req.id;
    
    // Query the database to fetch user data
    const sql = 'SELECT * FROM users WHERE id = ?';
    db.query(sql, [id], (err, data) => {
      if (err) {
        return res.status(500).json({ Message: 'Database Error' });
      }
  
      if (data.length > 0) {
        const userName = data[0].userName;
      const email = data[0].email;
      const phone = data[0]. phone;
      const address = data[0].address;
      const image = data[0].userImage;
      return res.json({data: data, userName: userName, email: email, phone: phone, address: address, image: image}); 
      } else {
        return res.status(404).json({ Message: 'User Not Found' });
      }
  
    });
  });



//sign up
app.post('/signup', (req, res) => {
    const {userName, email, userImage, phone, password, address} = req.body;
    const sql = 'INSERT INTO users (userName, email, userImage, phone, password, address) VALUES (?, ?, ?, ?, ?, ?)';
    const sqlEmail = 'SELECT * FROM users WHERE email = ?';
    db.query(sqlEmail, email, (err, results)=>{
        if (err) {
            return res.json({ Message: 'Database error' });
          }
          if (results.length > 0) {
            return res.json({ Message: "Email Exist. Please Enter Another Email" });
          } else {
            db.query(sql, [userName, email, userImage, phone, password, address], (err, data)=>{
                if (err) {
                    return res.json({ Message: 'Database error' });
                  }
                  const id = data.insertId;
                  const token = jwt.sign({id}, "jwtSecretKey", { expiresIn: '1d' });
                  res.cookie('token', token);
                return res.json({Status: 'Success'})  
            })
          }
        });
    })
//user-info
app.put('/info', verifyToken, (req, res) => {
    const id = req.id;
    const {userName, phone, address} = req.body;
    const sql = 'UPDATE users SET userName = ?, phone = ?, address = ? WHERE id = ?';
    db.query(sql, [userName, phone, address, id], (err, data)=>{
                if (err) {
                    console.log(err)
                    return res.json({ Message: 'Database error' });
                  }
                return res.json({Status: 'Success'})  
            })
    })
app.post('/userImage', verifyToken, (req,res) => {
    const id = req.id;
    const {image} = req.files;
    const sql = 'UPDATE users SET userImage = ? WHERE id =?'
    fetch("https://www.filestackapi.com/api/store/S3?key=AJmEEe9SJT16AJoXJkj5uz", {
    method: 'POST',
    headers: {'Content-Type': 'image/png'},
    body: image.data
}).then((r)=>r.json())
.then((r)=>{
        const userImage = r.url;
            db.query(sql, [userImage, id], (err, data) => {
            if(err) {
                console.log(err);
                return res.json({Message: "Database Error"})
            } 
            return res.json({Message: "Add Image Success", userImage: userImage, id: id})
    })
})
}) 
app.get('/newProduct', (req, res) => {
    const sql = 'SELECT * FROM products ORDER BY created_at DESC LIMIT 8'
    db.query(sql, (err, data) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ Message: 'Database Error' });
          }
            return res.json(data);
    })
})

//get new product
app.listen(8081, () => {
        console.log("Running");
})