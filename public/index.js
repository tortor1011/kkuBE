// (เอาไว้เปิดทุกAPIนะไอ้ครวย)
const express = require('express');
const app = express();

const server = require('./server');
const multer = require('./multerConfig');
const albumRoutes = require('./albumRoutes');
const imageRoutes = require('./imageRoutes');
const tagSearchRoutes = require('./tagSearchRoutes');


app.use('/', albumRoutes);
// app.use('/', server);

app.use('/', imageRoutes);
app.use('/', tagSearchRoutes);
app.use('/uploads', express.static('uploads'));
// imageRoutes.use('/uploads', express.static('uploads'));
// tagSearchRoutes.use('/uploads', express.static('uploads'));