import express from 'express';
const router = express.Router();

import controller from '../controllers/indexController.js';


/* GET home page. */
router.get('/', controller.index);

export default router;