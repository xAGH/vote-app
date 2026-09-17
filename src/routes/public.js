'use strict';

const express = require('express');
const router = express.Router();

const { getDb } = require('../db');

router.get('/', (req, res) => {
  const projects = getDb()
    .prepare('SELECT stand_number, name FROM projects WHERE is_active = 1 ORDER BY stand_number')
    .all();
  res.render('home', { title: 'Inicio', projects });
});

module.exports = router;
