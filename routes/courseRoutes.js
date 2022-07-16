const express = require('express');
const courseController = require('../controllers/courseController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect);

router.get('/', courseController.getAllCourses);

router.use(authController.restrictTo('admin'));
router.route('/').post(courseController.createCourse);

router
  .route('/:courseName')
  .get(courseController.getCourse)
  .patch(courseController.updateCourse)
  .delete(courseController.deleteCourse);

module.exports = router;
