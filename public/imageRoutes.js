const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const { Image } = require('./database');
const router = express.Router();

// ดึงรูปภาพทั้งหมด
router.get('/images', async (req, res) => {
    try {
        const { sortBy } = req.query;
        let sortOption = { uploaded_at: -1 };
        if (sortBy === 'downloads') sortOption = { downloads: -1 };
        else if (sortBy === 'views') sortOption = { views: -1 };

        const images = await Image.aggregate([
            { $lookup: { from: 'albums', localField: 'album_id', foreignField: '_id', as: 'album' } },
            { $unwind: { path: '$album', preserveNullAndEmptyArrays: true } },
            { $match: { 'album._id': { $exists: true } } },
            { $project: { _id: 1, title: 1, thumbnail: 1, photographer: 1, tags: 1, album_name: '$album.album_name', album_id: '$album._id', category: '$album.category', uploaded_at: 1, views: 1, downloads: 1 } },
            { $sort: sortOption }
        ]);
        res.json(images);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ดึงรูปภาพในอัลบั้ม
router.get('/album/:id/images', async (req, res) => {
    try {
        const albumId = req.params.id;
        const { sortBy } = req.query;
        let sortOption = { uploaded_at: -1 };
        if (sortBy === 'downloads') sortOption = { downloads: -1 };
        else if (sortBy === 'views') sortOption = { views: -1 };

        const images = await Image.aggregate([
            { $match: { album_id: new mongoose.Types.ObjectId(albumId) } },
            { $lookup: { from: 'albums', localField: 'album_id', foreignField: '_id', as: 'album' } },
            { $unwind: { path: '$album', preserveNullAndEmptyArrays: true } },
            { $match: { 'album._id': new mongoose.Types.ObjectId(albumId) } },
            { $project: { _id: 1, title: 1, thumbnail: 1, photographer: 1, tags: 1, album_name: '$album.album_name', album_id: '$album._id', category: '$album.category', uploaded_at: 1, views: 1, downloads: 1 } },
            { $sort: sortOption }
        ]);
        res.json(images);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ดึงรูปภาพตามช่างภาพ
router.get('/photographer/:name/images', async (req, res) => {
    try {
        const photographerName = req.params.name;
        const { sortBy } = req.query;
        let sortOption = { uploaded_at: -1 };
        if (sortBy === 'downloads') sortOption = { downloads: -1 };
        else if (sortBy === 'views') sortOption = { views: -1 };

        const images = await Image.aggregate([
            { $match: { photographer: photographerName } },
            { $lookup: { from: 'albums', localField: 'album_id', foreignField: '_id', as: 'album' } },
            { $unwind: { path: '$album', preserveNullAndEmptyArrays: true } },
            { $match: { 'album._id': { $exists: true } } },
            { $project: { _id: 1, title: 1, thumbnail: 1, photographer: 1, tags: 1, album_name: '$album.album_name', album_id: '$album._id', category: '$album.category', uploaded_at: 1, views: 1, downloads: 1 } },
            { $sort: sortOption }
        ]);
        res.json(images);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ดึง thumbnail
router.get('/image/:id/thumbnail', async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image || !image.thumbnail?.path) {
            return res.status(404).json({ error: 'Image or thumbnail not found' });
        }
        res.sendFile(path.join(__dirname, image.thumbnail.path));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ดึง fullsize
router.get('/image/:id/fullsize', async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image || !image.fullsize?.path) {
            return res.status(404).json({ error: 'Image or fullsize not found' });
        }
        image.views += 1;
        await image.save();
        res.sendFile(path.join(__dirname, image.fullsize.path));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ดาวน์โหลดรูปภาพ
router.get('/image/:id/download', async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image || !image.fullsize?.path) {
            return res.status(404).json({ error: 'Image or fullsize not found' });
        }
        image.downloads += 1;
        await image.save();
        res.download(path.join(__dirname, image.fullsize.path), image.title);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;