const express = require('express');
const Collection = require('../models/Collection');
const Photo = require('../models/Photo');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all collections (public)
router.get('/', async (req, res) => {
  try {
    const collections = await Collection.find({ isPublished: true })
      .sort({ sortOrder: 1, createdAt: -1 });
    res.json(collections);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all collections (admin)
router.get('/admin', auth, async (req, res) => {
  try {
    const collections = await Collection.find()
      .sort({ sortOrder: 1, createdAt: -1 });
    res.json(collections);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create collection
router.post('/', auth, async (req, res) => {
  try {
    const collection = new Collection(req.body);
    await collection.save();
    res.status(201).json(collection);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update collection
router.put('/:id', auth, async (req, res) => {
  try {
    const collection = await Collection.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }
    res.json(collection);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete collection
router.delete('/:id', auth, async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    // Delete all photos in this collection
    await Photo.deleteMany({ collection: req.params.id });
    
    await Collection.findByIdAndDelete(req.params.id);
    res.json({ message: 'Collection and associated photos deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;