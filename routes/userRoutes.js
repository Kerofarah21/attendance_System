const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/login', authController.login);
router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);

// Protect all routes after this middleware
router.use(authController.protect);

router.get('/courses', userController.getEnrolledCourses);

router.post(
  '/enrollMe',
  authController.restrictTo('student', 'professor', 'TA'),
  userController.enrollMe
);
router.post(
  '/unenrollMe',
  authController.restrictTo('student', 'professor', 'TA'),
  userController.unenrollMe
);

router.patch('/updateMyPassword', authController.updatePassword);
router.get('/me', userController.getMe, userController.getUser);
router.patch('/updateMe', userController.updateMe);

router.post(
  '/uploadAttendanceImages',
  authController.restrictTo('student'),
  userController.uploadAttendanceImages
);

router.use(authController.restrictTo('admin'));

router
  .route('/')
  .get(userController.getAllUsers)
  .post(userController.createUser);
router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

router.post('/enrollUser', userController.enrollUser);
router.post('/unenrollUser', userController.unenrollUser);

module.exports = router;
