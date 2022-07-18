/* eslint-disable node/no-unsupported-features/es-syntax */
const faceapi = require('@vladmandic/face-api');
const canvas = require('canvas');

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const path = require('path');
const User = require('../models/userModel');
const Course = require('../models/courseModel');
const Lecture = require('../models/lectureModel');
const Section = require('../models/sectionModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');
const Email = require('../utils/email');

exports.uploadAttendanceImages = catchAsync(async (req, res, next) => {
  const currentUser = req.user;
  currentUser.attendanceImages.addToSet(req.body.url1);
  currentUser.attendanceImages.addToSet(req.body.url2);
  currentUser.attendanceImages.addToSet(req.body.url3);

  // Load Models
  const modelPath = path.join(__dirname, '../public/faceModels');
  await Promise.all([
    faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath),
    faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
    faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath)
  ]);

  const descriptions = [];
  await Promise.all(
    currentUser.attendanceImages.map(async img => {
      const canvasImage = await canvas.loadImage(img);
      const image = faceapi.createCanvasFromMedia(canvasImage);
      const detection = await faceapi
        .detectSingleFace(image)
        .withFaceLandmarks()
        .withFaceDescriptor();

      descriptions.push(detection.descriptor);
    })
  );

  currentUser.descriptions = descriptions;
  await currentUser.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    user: currentUser
  });
});

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.getEnrolledCourses = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: 'success',
    courses: req.user.courses
  });
});

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user Posts password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword.',
        400
      )
    );
  }

  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'email', 'phone');
  if (req.body.url) filteredBody.photo = req.body.url;

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

exports.createUser = catchAsync(async (req, res, next) => {
  const newUser = await User.create(req.body);

  const url = `${req.protocol}://${req.get('host')}/me`;
  await new Email(newUser, url).sendWelcome();

  res.status(201).json({
    status: 'success',
    data: {
      user: {
        photo: newUser.photo,
        attendanceImages: newUser.attendanceImages,
        courses: newUser.courses,
        userId: newUser.userId,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role
      }
    }
  });
});

exports.enrollMe = catchAsync(async (req, res, next) => {
  const course = await Course.findOne({ courseName: req.body.courseName });
  if (!course) {
    return next(new AppError('No course found with that Name', 404));
  }

  const updatedUser = req.user;
  updatedUser.courses.addToSet(course.courseName);
  await updatedUser.save({ validateBeforeSave: false });

  if (updatedUser.role === 'student') {
    course.students.addToSet(updatedUser.userId);
  } else if (updatedUser.role === 'professor') {
    course.professors.addToSet(updatedUser.userId);
  } else if (updatedUser.role === 'TA') {
    course.TAs.addToSet(updatedUser.userId);
  }
  await course.save();

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        courses: updatedUser.courses,
        userId: updatedUser.userId,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role
      }
    }
  });
});

exports.unenrollMe = catchAsync(async (req, res, next) => {
  const updatedUser = req.user;

  const courseName = updatedUser.courses.find(el => el === req.body.courseName);
  if (!courseName) {
    return next(new AppError('You are not enrolled to this Course', 404));
  }

  const course = await Course.findOne({ courseName: req.body.courseName });

  updatedUser.courses.pull(course.courseName);
  await updatedUser.save({ validateBeforeSave: false });

  if (updatedUser.role === 'student') {
    course.students.pull(updatedUser.userId);
  } else if (updatedUser.role === 'professor') {
    course.professors.pull(updatedUser.userId);
  } else if (updatedUser.role === 'TA') {
    course.TAs.pull(updatedUser.userId);
  }
  await course.save();

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        courses: updatedUser.courses,
        userId: updatedUser.userId,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role
      }
    }
  });
});

exports.enrollUser = catchAsync(async (req, res, next) => {
  const course = await Course.findOne({ courseName: req.body.courseName });
  if (!course) {
    return next(new AppError('No course found with that Name', 404));
  }

  const user = await User.findOne({ userId: req.body.userId });
  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  user.courses.addToSet(course.courseName);
  await user.save({ validateBeforeSave: false });

  if (user.role === 'student') {
    course.students.addToSet(user.userId);
  } else if (user.role === 'professor') {
    course.professors.addToSet(user.userId);
  } else if (user.role === 'TA') {
    course.TAs.addToSet(user.userId);
  }
  await course.save();

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        courses: user.courses,
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    }
  });
});

exports.unenrollUser = catchAsync(async (req, res, next) => {
  const course = await Course.findOne({ courseName: req.body.courseName });
  if (!course) {
    return next(new AppError('No course found with that Name', 404));
  }

  const user = await User.findOne({ userId: req.body.userId });
  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  if (!course.courseName) {
    return next(new AppError('You are not enrolled to this Course', 404));
  }

  user.courses.pull(course.courseName);
  await user.save({ validateBeforeSave: false });

  if (user.role === 'student') {
    course.students.pull(user.userId);
  } else if (user.role === 'professor') {
    course.professors.pull(user.userId);
  } else if (user.role === 'TA') {
    course.TAs.pull(user.userId);
  }
  await course.save();

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        courses: user.courses,
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    }
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ userId: req.params.id });

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        photo: user.photo,
        attendanceImages: user.attendanceImages,
        courses: user.courses,
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    }
  });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  const user = await User.findOneAndUpdate(
    { userId: req.params.id },
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        photo: user.photo,
        attendanceImages: user.attendanceImages,
        courses: user.courses,
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    }
  });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findOneAndDelete({ userId: req.params.id });

  const courses = await Course.find();
  courses.forEach(async course => {
    if (user.role === 'student') {
      course.students.pull(user.userId);
    } else if (user.role === 'professor') {
      course.professors.pull(user.userId);
    } else if (user.role === 'TA') {
      course.TAs.pull(user.userId);
    }
    await course.save();
  });

  const lectures = await Lecture.find();
  lectures.forEach(async lecture => {
    const student = lecture.attendance.find(el => el.studentId === user.userId);
    lecture.attendance.pull(student);
    await lecture.save();
  });

  const sections = await Section.find();
  sections.forEach(async section => {
    const student = section.attendance.find(el => el.studentId === user.userId);
    section.attendance.pull(student);
    await section.save();
  });

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.getAllUsers = factory.getAll(User);
