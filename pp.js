const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const app = express();
const port = 3000;
const cors = require('cors');

app.use(cors());

// MongoDB URI (เปลี่ยนตาม server ของคุณ)
const uri = 'mongodb://localhost:27017/kkustockphoto'; // เปลี่ยนเป็น URI ของ MongoDB ของคุณ
const client = new MongoClient(uri);

// เชื่อมต่อ MongoDB
client.connect().then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('Failed to connect to MongoDB', err);
});

// ใช้ express.json() เพื่อรับ JSON
app.use(express.json());

// เสิร์ฟไฟล์ HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint สำหรับบันทึกข้อมูลการดาวน์โหลด
app.post('/api/download-record', async (req, res) => {
  const { user_id, image_id, purposes, downloaded_at } = req.body;
  try {
    const database = client.db('your_database_name'); // เปลี่ยนเป็นชื่อ database ของคุณ
    const collection = database.collection('download_records');
    await collection.insertOne({
      user_id,
      image_id,
      purposes, // เก็บเป็น array
      downloaded_at: new Date(downloaded_at)
    });
    res.status(200).send('บันทึกสำเร็จ');
  } catch (error) {
    console.error(error);
    res.status(500).send('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
  }
});

// API endpoint สำหรับดาวน์โหลดรูปภาพ
app.get('/download/image/:imageId', (req, res) => {
  const imageId = req.params.imageId;
  // สมมติว่ารูปภาพเก็บอยู่ในโฟลเดอร์ 'images'
  res.sendFile(path.join(__dirname, 'images', `${imageId}.jpg`));
});

// เริ่ม server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
