const express = require('express');
const sectionController = require('../controllers/sectionController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect);

router.get('/:courseName', sectionController.getAllSections);

router.use(authController.restrictTo('TA'));

router.post('/', sectionController.createSection);
router.post(
  '/:courseName/:sectionName/takeSectionAttendance',
  sectionController.takeSectionAttendance
);

router
  .route('/:courseName/:sectionName')
  .get(sectionController.getSection)
  .delete(sectionController.deleteSection);

module.exports = router;
