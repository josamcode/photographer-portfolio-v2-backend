const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Photo = require('../models/Photo');
const Collection = require('../models/Collection');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueName + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get photos by collection (public)
router.get('/collection/:collectionId', async (req, res) => {
  try {
    const photos = await Photo.find({
      collectionName: req.params.collectionId,
      isPublished: true
    })
      .sort({ sortOrder: 1, createdAt: -1 })
      .populate('collectionName', 'name');

    res.json(photos);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all photos (admin)
router.get('/admin', auth, async (req, res) => {
  try {
    const photos = await Photo.find()
      .sort({ createdAt: -1 })
      .populate('collectionName', 'name');

    res.json(photos);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload photo
router.post('/upload', auth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const photoData = {
      title: req.body.title || req.file.originalname,
      description: req.body.description || '',
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      collectionName: req.body.collection,
      tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
      camera: req.body.camera || '',
      lens: req.body.lens || '',
      settings: {
        aperture: req.body.aperture || '',
        shutter: req.body.shutter || '',
        iso: req.body.iso || '',
        focalLength: req.body.focalLength || ''
      }
    };

    const photo = new Photo(photoData);
    await photo.save();

    // Update collection cover image if not set
    const collection = await Collection.findById(req.body.collection);
    if (collection && !collection.coverImage) {
      collection.coverImage = req.file.filename;
      await collection.save();
    }

    res.status(201).json(photo);
  } catch (error) {
    // Delete uploaded file if database save fails
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ message: error.message });
  }
});

// Update photo
router.put('/:id', auth, async (req, res) => {
  try {
    const photo = await Photo.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('collectionName', 'name');

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    res.json(photo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete photo
router.delete('/:id', auth, async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Delete file from filesystem
    const filePath = path.join(__dirname, '../uploads/', photo.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await Photo.findByIdAndDelete(req.params.id);
    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;