const multer = require('multer');
const path = require('path');

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
    limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB
}).fields([
    { name: 'album_cover', maxCount: 1 },
    { name: 'images', maxCount: 100 }
]);

const uploadImagesOnly = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB
}).array('images', 100);

