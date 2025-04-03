const express = require('express');
const path = require('path');
const { Album, Image } = require('./database');
const { upload, uploadImagesOnly } = require('./multerConfig');
const router = express.Router();

// สร้างอัลบั้มและอัปโหลดรูปภาพ
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

// // อัปโหลดรูปภาพไปยังอัลบั้มที่มีอยู่
// router.post('/upload-to-album/:id', uploadImagesOnly, async (req, res) => {
//     try {
//         const albumId = req.params.id;
//         if (!req.files || req.files.length === 0) {
//             return res.status(400).json({ error: 'Missing images' });
//         }

//         const album = await Album.findById(albumId);
//         if (!album) return res.status(404).json({ error: 'Album not found' });

//         const existingImage = await Image.findOne({ album_id: albumId });
//         if (!existingImage) return res.status(400).json({ error: 'No photographer info' });

//         const images = req.files.map(file => new Image({
//             title: path.basename(file.originalname),
//             thumbnail: { path: file.path, contentType: file.mimetype },
//             fullsize: { path: file.path, contentType: file.mimetype },
//             photographer: existingImage.photographer,
//             tags: [],
//             album_id: album._id
//         }));

//         await Image.insertMany(images);
//         res.status(201).json({ message: `${images.length} images uploaded` });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// // กำหนดหมวดหมู่ให้อัลบั้ม
// router.post('/album/:id/category', async (req, res) => {
//     try {
//         const { category } = req.body;
//         if (!category || !Array.isArray(category)) {
//             return res.status(400).json({ error: 'Category must be an array' });
//         }

//         const album = await Album.findById(req.params.id);
//         if (!album) return res.status(404).json({ error: 'Album not found' });

//         album.category = category;
//         await album.save();
//         res.json({ message: `Category updated for ${album.album_name}` });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// // ดึงรายการอัลบั้มทั้งหมด
// router.get('/albums', async (req, res) => {
//     try {
//         const albums = await Album.aggregate([
//             { $lookup: { from: 'images', localField: '_id', foreignField: 'album_id', as: 'images' } },
//             { $project: { _id: 1, album_name: 1, album_cover: 1, category: 1, image_count: { $size: '$images' }, created_at: 1 } },
//             { $sort: { created_at: -1 } }
//         ]);
//         res.json(albums);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// // ดึง album cover
// router.get('/album/:id/cover', async (req, res) => {
//     try {
//         const album = await Album.findById(req.params.id);
//         if (!album || !album.album_cover?.path) {
//             return res.status(404).json({ error: 'Album or cover not found' });
//         }
//         res.sendFile(path.join(__dirname, album.album_cover.path));
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

module.exports = router;    