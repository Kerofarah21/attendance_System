const express = require('express');
const lectureController = require('../controllers/lectureController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect);

router.get('/:courseName', lectureController.getAllLectures);

router.use(authController.restrictTo('professor'));

router.post('/', lectureController.createLecture);
router.post(
  '/:courseName/:lectureName/takeLectureAttendance',
  lectureController.takeLectureAttendance
);

router
  .route('/:courseName/:lectureName')
  .get(lectureController.getLecture)
  .delete(lectureController.deleteLecture);

module.exports = router;
