const express = require('express');
const { Image, Album, PendingTag } = require('./database');
const router = express.Router();

// ดึงรายการแท็ก
router.get('/tags', async (req, res) => {
    try {
        const tags = await Image.distinct('tags');
        res.json(tags);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ดึงรายการช่างภาพ
router.get('/photographers', async (req, res) => {
    try {
        const photographers = await Image.distinct('photographer');
        res.json(photographers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ขอเพิ่มแท็กใหม่
router.post('/request-tag', async (req, res) => {
    try {
        const { tag_name, requested_by } = req.body;
        if (!tag_name || !requested_by) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const existingTag = await PendingTag.findOne({ tag_name });
        if (!existingTag) {
            const newTag = new PendingTag({ tag_name, requested_by, status: 'approved' });
            await newTag.save();
        }
        res.status(201).json({ message: 'Tag added successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// กำหนดแท็กให้รูปภาพทั้งหมดในอัลบั้ม
router.post('/album/:id/tags', async (req, res) => {
    try {
        const { tags } = req.body;
        if (!tags || !Array.isArray(tags)) {
            return res.status(400).json({ error: 'Tags must be an array' });
        }

        const filteredTags = tags.filter(tag => tag && tag.trim() !== '');
        const album = await Album.findById(req.params.id);
        if (!album) return res.status(404).json({ error: 'Album not found' });

        const result = await Image.updateMany(
            { album_id: album._id },
            { $set: { tags: filteredTags } }
        );
        res.json({ message: `Tags updated for ${result.modifiedCount} images` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ดึงอัลบั้มที่มีแท็กที่ระบุ
router.get('/tag/:tag/albums', async (req, res) => {
    try {
        const tag = req.params.tag;
        const albums = await Image.aggregate([
            { $match: { tags: { $in: [tag] } } },
            { $group: { _id: '$album_id', image_count: { $sum: 1 } } },
            { $lookup: { from: 'albums', localField: '_id', foreignField: '_id', as: 'album' } },
            { $unwind: '$album' },
            { $project: { _id: '$album._id', album_name: '$album.album_name', album_cover: '$album.album_cover', category: '$album.category', image_count: 1, created_at: '$album.created_at' } },
            { $sort: { created_at: -1 } }
        ]);
        res.json(albums);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ค้นหาคำที่ใกล้เคียง
router.get('/search', async (req, res) => {
    try {
        const { query, sortBy } = req.query;
        if (!query) return res.status(400).json({ error: 'Query required' });

        let sortOption = { uploaded_at: -1 };
        if (sortBy === 'downloads') sortOption = { downloads: -1 };
        else if (sortBy === 'views') sortOption = { views: -1 };

        const albums = await Album.find({
            $or: [
                { album_name: { $regex: query, $options: 'i' } },
                { category: { $regex: query, $options: 'i' } }
            ]
        });

        const images = await Image.aggregate([
            { $lookup: { from: 'albums', localField: 'album_id', foreignField: '_id', as: 'album' } },
            { $unwind: { path: '$album', preserveNullAndEmptyArrays: true } },
            { $match: {
                $or: [
                    { title: { $regex: query, $options: 'i' } },
                    { tags: { $regex: query, $options: 'i' } },
                    { photographer: { $regex: query, $options: 'i' } },
                    { 'album.album_name': { $regex: query, $options: 'i' } },
                    { 'album.category': { $regex: query, $options: 'i' } }
                ]
            } },
            { $project: { _id: 1, title: 1, thumbnail: 1, photographer: 1, tags: 1, album_name: '$album.album_name', album_id: '$album._id', category: '$album.category', uploaded_at: 1, views: 1, downloads: 1 } },
            { $sort: sortOption }
        ]);

        res.json({ albums, images });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;