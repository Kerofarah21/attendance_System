/* eslint-disable no-plusplus */
/* eslint-disable node/no-unsupported-features/es-syntax */
const tf = require('@tensorflow/tfjs-node');
const faceapi = require('@vladmandic/face-api');
const canvas = require('canvas');

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const path = require('path');
const multer = require('multer');
const AppError = require('../utils/appError');
const Lecture = require('../models/lectureModel');
const catchAsync = require('../utils/catchAsync');
const User = require('../models/userModel');
const Course = require('../models/courseModel');

const multerStorage = multer.memoryStorage();
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};
const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter
});
exports.uploadImage = upload.single('test');

exports.takeLectureAttendance = catchAsync(async (req, res, next) => {
  // Load Models
  const modelPath = path.join(__dirname, '../public/faceModels');
  await Promise.all([
    faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath),
    faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
    faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath)
  ]);

  const labeledDescriptors = [];

  const users = await User.find();
  const course = await Course.findOne({ courseName: req.params.courseName });
  const lecture = await Lecture.findOne({ name: req.params.lectureName });
  if (!course || !lecture) {
    return next(new AppError('Invalid course name or lecture name', 404));
  }

  // Create Labels
  await Promise.all(
    users.map(async user => {
      const descriptions = [];
      const courseName = user.courses.find(el => el === req.params.courseName);
      if (courseName && user.role === 'student') {
        user.attendanceImages.forEach(async img => {
          const decoded = tf.node.decodeImage(img);
          const casted = decoded.toFloat();
          const image = casted.expandDims(0);
          decoded.dispose();
          casted.dispose();

          const detections = await faceapi
            .detectSingleFace(image)
            .withFaceLandmarks()
            .withFaceDescriptor();

          descriptions.push(detections.descriptor);
        });
        labeledDescriptors.push(
          new faceapi.LabeledFaceDescriptors(user.name, descriptions)
        );
      }
    })
  );

  if (labeledDescriptors.length === 0) {
    return next(
      new AppError('There are no students enrolled in this course', 404)
    );
  }

  const decoded = tf.node.decodeImage(req.file.buffer);
  const casted = decoded.toFloat();
  const image = casted.expandDims(0);
  decoded.dispose();
  casted.dispose();
  const detections = await faceapi
    .detectSingleFace(image)
    .withFaceLandmarks()
    .withFaceDescriptor();

  // Recognition
  const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
  const bestMatch = faceMatcher.findBestMatch(detections.descriptor);
  const bestMatchLabel = bestMatch.toString().split(' ');
  let name = '';
  for (let i = 0; i < bestMatchLabel.length - 1; i++) {
    if (i === bestMatchLabel.length - 2) {
      name += `${bestMatchLabel[i]}`;
    } else {
      name += `${bestMatchLabel[i]} `;
    }
  }

  if (name === 'unknown') {
    return next(
      new AppError('This student is not enrolled in this course', 404)
    );
  }

  const attendedUser = lecture.attendance.find(
    student => name === student.studentName
  );
  if (attendedUser) {
    return next(
      new AppError('This student is already marked as attended', 404)
    );
  }

  const user = await User.findOne({ name: name });
  lecture.attendance.addToSet({
    studentName: user.name,
    studentId: user.userId
  });
  await lecture.save();

  res.status(200).json({
    status: 'success',
    lecture
  });
});

exports.createLecture = catchAsync(async (req, res, next) => {
  const course = await Course.findOne({ courseName: req.body.course });
  if (!course) {
    return next(new AppError('No course found with that Name', 404));
  }

  const currentUser = req.user;
  const courseName = currentUser.courses.find(el => el === course.courseName);
  if (!courseName) {
    return next(new AppError('You are not enrolled in this course', 404));
  }

  const len = course.lectures.length;
  const lectureName = `Lecture ${len + 1}`;
  course.lectures.addToSet(lectureName);
  await course.save({ validateBeforeSave: false });

  req.body.name = lectureName;
  const lecture = await Lecture.create(req.body);
  res.status(200).json({
    status: 'success',
    lecture
  });
});

exports.getAllLectures = catchAsync(async (req, res, next) => {
  const lectures = await Lecture.find();
  const course = await Course.findOne({ courseName: req.params.courseName });

  const neededLectures = [];
  lectures.forEach(lecture => {
    if (lecture.course === course.courseName) {
      neededLectures.push(lecture);
    }
  });

  if (!course) {
    return next(new AppError('No course found with this name', 404));
  }

  res.status(200).json({
    status: 'success',
    lectures: neededLectures
  });
});

exports.getLecture = catchAsync(async (req, res, next) => {
  const lecture = await Lecture.findOne({
    course: req.params.courseName,
    name: req.params.lectureName
  });

  if (!lecture) {
    return next(new AppError('No lecture found with that Name', 404));
  }

  res.status(200).json({
    status: 'success',
    lecture
  });
});

exports.deleteLecture = catchAsync(async (req, res, next) => {
  const lecture = await Lecture.findOneAndDelete({
    course: req.params.courseName,
    name: req.params.lectureName
  });

  const course = await Course.findOne({ courseName: req.params.courseName });
  course.lectures.pull(lecture.name);
  await course.save();

  if (!lecture) {
    return next(new AppError('No lecture found with that Name', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});
