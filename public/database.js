const mongoose = require('mongoose');




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

// PendingTag Schema
const pendingTagSchema = new mongoose.Schema({
    tag_name: { type: String, required: true, unique: true },
    requested_by: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    requested_at: { type: Date, default: Date.now }
});
const PendingTag = mongoose.model('PendingTag', pendingTagSchema);

module.exports = { Album, Image, PendingTag };