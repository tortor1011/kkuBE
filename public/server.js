const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();

// สร้างโฟลเดอร์ uploads ถ้ายังไม่มี
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// ตั้งค่า Express
app.use(express.static('public'));
app.use(cors());
app.use(express.json({ limit: '2gb' }));
app.use(express.urlencoded({ limit: '2gb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ตั้งค่า timeout (10 นาที)
app.use((req, res, next) => {
    req.setTimeout(600000);
    res.setTimeout(600000);
    next();
});

app.listen(3000, () => console.log('Server running on port 3000'));

module.exports = app;