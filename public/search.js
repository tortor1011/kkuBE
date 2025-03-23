const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();

// สร้างโฟลเดอร์ uploads ถ้ายังไม่มี
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// มีการกำหนดให้ Express เสิร์ฟไฟล์ static จากโฟลเดอร์ /public
app.use(express.static('public'));

app.use(cors());
// เพิ่ม limit สำหรับ body parser
app.use(express.json({ limit: '2gb' }));
app.use(express.urlencoded({ limit: '2gb', extended: true }));

// ตั้งค่า timeout ของ Express (10 นาที = 600,000 ms)
app.use((req, res, next) => {
    req.setTimeout(600000); // 10 นาที
    res.setTimeout(600000); // 10 นาที
    next();
});

// ตั้งค่า Multer ให้เก็บไฟล์ในระบบไฟล์
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 * 1024 } // เพิ่ม limit เป็น 2GB
}).fields([
    { name: 'album_cover', maxCount: 1 },
    { name: 'images', maxCount: 100 }
]);

const uploadImagesOnly = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 * 1024 } // เพิ่ม limit เป็น 2GB
}).array('images', 100);

// เสิร์ฟไฟล์จากโฟลเดอร์ uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// เปลี่ยนชื่อฐานข้อมูลตามที่คุณต้องการ (เช่น mydatabase)
mongoose.connect('mongodb://localhost:27017/kkustockphoto', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Album Schema
const albumSchema = new mongoose.Schema({
    album_name: { type: String, required: true, unique: true },
    album_cover: { path: String, contentType: String },
    category: [{
        type: String,
        enum: [
            'ภาพวิวและพื้นที่ส่วนกลาง',
            'ภาพสิ่งอำนวยความสะดวก และการใช้ชีวิตใน มข.',
            'ภาพการเรียนการสอน',
            'ภาพการวิจัยและนวัตกรรม',
            'ภาพเทรนด์ ภาพ ดิจิทัล',
            'ภาพผู้บริหาร มข.',
            'ภาพศิลปวัฒนธรรมและศิลปสร้างสรรค์',
            'ภาพกิจกรรมลงชุมชน (CSV)',
            'ภาพนานาชาติ',
            'ภาพปริญญาบัตร และรัฐพิธีสำคัญ',
            'ภาพมุมสูง ต่างๆ',
            'ภาพวิทยาศาสตร์-และวิทยาศาสตร์สุขภาพ',
            'โลโก้ 60 ปี มข. จากศูนย์ศิลปวัฒนธรรม มข.',
            'กีฬา',
            'คอนเสิร์ต-การแสดง'
        ]
    }],
    created_at: { type: Date, default: Date.now }
});
const Album = mongoose.model('Album', albumSchema);

// Image Schema
const imageSchema = new mongoose.Schema({
    title: { type: String, required: true },
    thumbnail: { path: String, contentType: String },
    fullsize: { path: String, contentType: String },
    photographer: { type: String, required: true },
    tags: [{ type: String }],
    album_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Album', required: true },
    uploaded_at: { type: Date, default: Date.now },
    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 }
});

imageSchema.index({ tags: 1 });
imageSchema.index({ photographer: 1 });
imageSchema.index({ album_id: 1 });
imageSchema.index({ views: -1 });
imageSchema.index({ downloads: -1 });
imageSchema.index({ uploaded_at: -1 });

const Image = mongoose.model('Image', imageSchema);

// PendingTag Schema (สำหรับแท็กที่รอการอนุมัติ)
const pendingTagSchema = new mongoose.Schema({
    tag_name: { type: String, required: true, unique: true },
    requested_by: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    requested_at: { type: Date, default: Date.now }
});
const PendingTag = mongoose.model('PendingTag', pendingTagSchema);

// API: ดึงรายการแท็กที่ใช้ได้
app.get('/tags', async (req, res) => {
    try {
        const tags = await Image.distinct('tags');
        res.json(tags);
    } catch (error) {
        console.error('Error in /tags:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ดึงรายการช่างภาพทั้งหมด
app.get('/photographers', async (req, res) => {
    try {
        const photographers = await Image.distinct('photographer');
        res.json(photographers);
    } catch (error) {
        console.error('Error in /photographers:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: สร้างอัลบั้มและอัปโหลดรูปภาพ
app.post('/create-and-upload', (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File size exceeds 2GB limit' });
            }
            console.error('Upload error:', err);
            return res.status(500).json({ error: err.message });
        }

        try {
            const { album_name, photographer } = req.body;
            if (!album_name || !photographer || !req.files['images'] || req.files['images'].length === 0) {
                return res.status(400).json({ error: 'Missing required fields (album_name, photographer, images)' });
            }

            let album = await Album.findOne({ album_name });
            if (!album) {
                album = new Album({
                    album_name,
                    album_cover: req.files['album_cover'] ? {
                        path: req.files['album_cover'][0].path,
                        contentType: req.files['album_cover'][0].mimetype
                    } : undefined
                });
                await album.save();
                console.log(`Created new album: ${album_name}`);
            } else if (!album.album_cover && req.files['album_cover']) {
                album.album_cover = {
                    path: req.files['album_cover'][0].path,
                    contentType: req.files['album_cover'][0].mimetype
                };
                await album.save();
                console.log(`Updated album cover for: ${album_name}`);
            }

            const images = req.files['images'].map((file) => {
                return new Image({
                    title: path.basename(file.originalname),
                    thumbnail: { path: file.path, contentType: file.mimetype },
                    fullsize: { path: file.path, contentType: file.mimetype },
                    photographer,
                    tags: [],
                    album_id: album._id
                });
            });

            await Image.insertMany(images);
            console.log(`Uploaded ${images.length} images to album ${album.album_name}`);
            res.status(201).json({ message: `${images.length} images uploaded to album ${album.album_name}`, album_id: album._id });
        } catch (error) {
            console.error('Error in /create-and-upload:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

// API: อัปโหลดรูปภาพไปยังอัลบั้มที่มีอยู่
app.post('/upload-to-album/:id', (req, res) => {
    uploadImagesOnly(req, res, async (err) => {
        if (err) {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File size exceeds 2GB limit' });
            }
            console.error('Upload error:', err);
            return res.status(500).json({ error: err.message });
        }

        try {
            const albumId = req.params.id;
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'Missing required field (images)' });
            }

            const album = await Album.findById(albumId);
            if (!album) {
                return res.status(404).json({ error: 'Album not found' });
            }

            const existingImage = await Image.findOne({ album_id: albumId });
            if (!existingImage) {
                return res.status(400).json({ error: 'No images found in this album. Please upload images with photographer information first.' });
            }
            const photographer = existingImage.photographer;

            const images = req.files.map((file) => {
                return new Image({
                    title: path.basename(file.originalname),
                    thumbnail: { path: file.path, contentType: file.mimetype },
                    fullsize: { path: file.path, contentType: file.mimetype },
                    photographer,
                    tags: [],
                    album_id: album._id
                });
            });

            await Image.insertMany(images);
            console.log(`Uploaded ${images.length} images to album ${album.album_name}`);
            res.status(201).json({ message: `${images.length} images uploaded to album ${album.album_name}` });
        } catch (error) {
            console.error('Error in /upload-to-album:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

// API: กำหนดหมวดหมู่ให้อัลบั้ม
app.post('/album/:id/category', async (req, res) => {
    try {
        const { category } = req.body;
        if (!category || !Array.isArray(category)) {
            return res.status(400).json({ error: 'Category must be an array' });
        }

        const album = await Album.findById(req.params.id);
        if (!album) {
            return res.status(404).json({ error: 'Album not found' });
        }

        album.category = category;
        await album.save();

        res.json({ message: `Category updated for album ${album.album_name}` });
    } catch (error) {
        console.error('Error in /album/:id/category:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: กำหนดแท็กให้รูปภาพทั้งหมดในอัลบั้ม
app.post('/album/:id/tags', async (req, res) => {
    try {
        const { tags } = req.body;
        if (!tags || !Array.isArray(tags)) {
            return res.status(400).json({ error: 'Tags must be an array' });
        }

        const filteredTags = tags.filter(tag => tag && tag.trim() !== '');

        const album = await Album.findById(req.params.id);
        if (!album) {
            return res.status(404).json({ error: 'Album not found' });
        }

        const result = await Image.updateMany(
            { album_id: album._id },
            { $set: { tags: filteredTags } }
        );

        res.json({ message: `Tags updated for ${result.modifiedCount} images in album ${album.album_name}` });
    } catch (error) {
        console.error('Error in /album/:id/tags:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ขอเพิ่มแท็กใหม่
app.post('/request-tag', async (req, res) => {
    try {
        const { tag_name, requested_by } = req.body;
        if (!tag_name || !requested_by) {
            return res.status(400).json({ error: 'Missing required fields (tag_name, requested_by)' });
        }

        const existingTag = await PendingTag.findOne({ tag_name });
        if (!existingTag) {
            const newTag = new PendingTag({ tag_name, requested_by, status: 'approved' });
            await newTag.save();
        }

        res.status(201).json({ message: 'Tag added successfully' });
    } catch (error) {
        console.error('Error in /request-tag:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ดึงอัลบั้มที่มีรูปภาพที่มีแท็กที่ระบุ
app.get('/tag/:tag/albums', async (req, res) => {
    try {
        const tag = req.params.tag;

        const albums = await Image.aggregate([
            {
                $match: {
                    tags: { $in: [tag] } // หารูปภาพที่มีแท็กที่ระบุ
                }
            },
            {
                $group: {
                    _id: '$album_id', // กลุ่มตาม album_id
                    image_count: { $sum: 1 } // นับจำนวนรูปภาพในแต่ละอัลบั้ม
                }
            },
            {
                $lookup: {
                    from: 'albums',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'album'
                }
            },
            {
                $unwind: '$album'
            },
            {
                $project: {
                    _id: '$album._id',
                    album_name: '$album.album_name',
                    album_cover: '$album.album_cover',
                    category: '$album.category',
                    image_count: 1,
                    created_at: '$album.created_at'
                }
            },
            { $sort: { created_at: -1 } }
        ]);

        res.json(albums);
    } catch (error) {
        console.error('Error in /tag/:tag/albums:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ดึงรูปภาพโดยตรง (thumbnail)
app.get('/image/:id/thumbnail', async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image || !image.thumbnail || !image.thumbnail.path) {
            return res.status(404).json({ error: 'Image or thumbnail not found' });
        }

        res.sendFile(path.join(__dirname, image.thumbnail.path));
    } catch (error) {
        console.error('Error in /image/:id/thumbnail:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ดึงรูปภาพขนาดเต็ม (fullsize)
app.get('/image/:id/fullsize', async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image || !image.fullsize || !image.fullsize.path) {
            return res.status(404).json({ error: 'Image or fullsize not found' });
        }

        image.views += 1;
        await image.save();

        res.sendFile(path.join(__dirname, image.fullsize.path));
    } catch (error) {
        console.error('Error in /image/:id/fullsize:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ดาวน์โหลดรูปภาพ
app.get('/image/:id/download', async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image || !image.fullsize || !image.fullsize.path) {
            return res.status(404).json({ error: 'Image or fullsize not found' });
        }

        image.downloads += 1;
        await image.save();

        res.download(path.join(__dirname, image.fullsize.path), `${image.title}`);
    } catch (error) {
        console.error('Error in /image/:id/download:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ดึง album cover
app.get('/album/:id/cover', async (req, res) => {
    try {
        const album = await Album.findById(req.params.id);
        if (!album || !album.album_cover || !album.album_cover.path) {
            return res.status(404).json({ error: 'Album or cover not found' });
        }

        res.sendFile(path.join(__dirname, album.album_cover.path));
    } catch (error) {
        console.error('Error in /album/:id/cover:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ดึงรายการอัลบั้มทั้งหมด
app.get('/albums', async (req, res) => {
    try {
        const albums = await Album.aggregate([
            {
                $lookup: {
                    from: 'images',
                    localField: '_id',
                    foreignField: 'album_id',
                    as: 'images'
                }
            },
            {
                $project: {
                    _id: 1,
                    album_name: 1,
                    album_cover: 1,
                    category: 1,
                    image_count: { $size: '$images' },
                    created_at: 1
                }
            },
            { $sort: { created_at: -1 } }
        ]);
        res.json(albums);
    } catch (error) {
        console.error('Error in /albums:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ดึงรูปภาพทั้งหมด (รองรับการเรียงลำดับ)
app.get('/images', async (req, res) => {
    try {
        const { sortBy } = req.query;
        let sortOption = { uploaded_at: -1 };

        if (sortBy === 'downloads') {
            sortOption = { downloads: -1 };
        } else if (sortBy === 'views') {
            sortOption = { views: -1 };
        }

        const images = await Image.aggregate([
            {
                $lookup: {
                    from: 'albums',
                    localField: 'album_id',
                    foreignField: '_id',
                    as: 'album'
                }
            },
            {
                $unwind: {
                    path: '$album',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $match: {
                    'album._id': { $exists: true }
                }
            },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    thumbnail: 1,
                    photographer: 1,
                    tags: 1,
                    album_name: { $ifNull: ['$album.album_name', null] },
                    album_id: '$album._id',
                    category: { $ifNull: ['$album.category', []] },
                    uploaded_at: 1,
                    views: 1,
                    downloads: 1
                }
            },
            { $sort: sortOption }
        ]);
        res.json(images);
    } catch (error) {
        console.error('Error in /images:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ดึงรูปภาพในอัลบั้มที่ระบุ
app.get('/album/:id/images', async (req, res) => {
    try {
        const albumId = req.params.id;
        const { sortBy } = req.query;
        let sortOption = { uploaded_at: -1 };

        if (sortBy === 'downloads') {
            sortOption = { downloads: -1 };
        } else if (sortBy === 'views') {
            sortOption = { views: -1 };
        }

        const images = await Image.aggregate([
            {
                $match: {
                    album_id: new mongoose.Types.ObjectId(albumId)
                }
            },
            {
                $lookup: {
                    from: 'albums',
                    localField: 'album_id',
                    foreignField: '_id',
                    as: 'album'
                }
            },
            {
                $unwind: {
                    path: '$album',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $match: {
                    'album._id': new mongoose.Types.ObjectId(albumId)
                }
            },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    thumbnail: 1,
                    photographer: 1,
                    tags: 1,
                    album_name: { $ifNull: ['$album.album_name', null] },
                    album_id: '$album._id',
                    category: { $ifNull: ['$album.category', []] },
                    uploaded_at: 1,
                    views: 1,
                    downloads: 1
                }
            },
            { $sort: sortOption }
        ]);
        res.json(images);
    } catch (error) {
        console.error('Error in /album/:id/images:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ดึงรูปภาพตามช่างภาพ
app.get('/photographer/:name/images', async (req, res) => {
    try {
        const photographerName = req.params.name;
        const { sortBy } = req.query;
        let sortOption = { uploaded_at: -1 };

        if (sortBy === 'downloads') {
            sortOption = { downloads: -1 };
        } else if (sortBy === 'views') {
            sortOption = { views: -1 };
        }

        const images = await Image.aggregate([
            {
                $match: {
                    photographer: photographerName
                }
            },
            {
                $lookup: {
                    from: 'albums',
                    localField: 'album_id',
                    foreignField: '_id',
                    as: 'album'
                }
            },
            {
                $unwind: {
                    path: '$album',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $match: {
                    'album._id': { $exists: true }
                }
            },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    thumbnail: 1,
                    photographer: 1,
                    tags: 1,
                    album_name: { $ifNull: ['$album.album_name', null] },
                    album_id: '$album._id',
                    category: { $ifNull: ['$album.category', []] },
                    uploaded_at: 1,
                    views: 1,
                    downloads: 1
                }
            },
            { $sort: sortOption }
        ]);
        res.json(images);
    } catch (error) {
        console.error('Error in /photographer/:name/images:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ค้นหาคำที่ใกล้เคียงจาก Tags, Album, Category
app.get('/search', async (req, res) => {
    try {
        const { query, sortBy } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        let sortOption = { uploaded_at: -1 };
        if (sortBy === 'downloads') {
            sortOption = { downloads: -1 };
        } else if (sortBy === 'views') {
            sortOption = { views: -1 };
        }

        const albums = await Album.find({
            $or: [
                { album_name: { $regex: query, $options: 'i' } },
                { category: { $regex: query, $options: 'i' } }
            ]
        });

        const images = await Image.aggregate([
            {
                $lookup: {
                    from: 'albums',
                    localField: 'album_id',
                    foreignField: '_id',
                    as: 'album'
                }
            },
            {
                $unwind: {
                    path: '$album',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $match: {
                    $or: [
                        { title: { $regex: query, $options: 'i' } },
                        { tags: { $regex: query, $options: 'i' } },
                        { photographer: { $regex: query, $options: 'i' } },
                        { 'album.album_name': { $regex: query, $options: 'i' } },
                        { 'album.category': { $regex: query, $options: 'i' } }
                    ]
                }
            },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    thumbnail: 1,
                    photographer: 1,
                    tags: 1,
                    album_name: { $ifNull: ['$album.album_name', null] },
                    album_id: '$album._id',
                    category: { $ifNull: ['$album.category', []] },
                    uploaded_at: 1,
                    views: 1,
                    downloads: 1
                }
            },
            { $sort: sortOption }
        ]);

        res.json({ albums, images });
    } catch (error) {
        console.error('Error in /search:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));