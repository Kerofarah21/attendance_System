/* eslint-disable node/no-unsupported-features/es-builtins */
/* eslint-disable no-plusplus */
/* eslint-disable node/no-unsupported-features/es-syntax */
const faceapi = require('@vladmandic/face-api');
const canvas = require('canvas');

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const path = require('path');
const AppError = require('../utils/appError');
const Section = require('../models/sectionModel');
const catchAsync = require('../utils/catchAsync');
const User = require('../models/userModel');
const Course = require('../models/courseModel');

exports.takeSectionAttendance = catchAsync(async (req, res, next) => {
  const users = await User.find();
  const course = await Course.findOne({ courseName: req.params.courseName });
  const section = await Section.findOne({ name: req.params.sectionName });
  if (!course || !section) {
    return next(new AppError('Invalid course name or section name', 404));
  }

  // Create Labels
  const labeledDescriptors = [];
  await Promise.all(
    users.map(async user => {
      const courseName = user.courses.find(el => el === req.params.courseName);
      if (courseName && user.role === 'student' && user.descriptions) {
        const userDescriptions = [];
        user.descriptions.forEach(des => {
          userDescriptions.push(new Float32Array(Object.values(des)));
        });
        labeledDescriptors.push(
          new faceapi.LabeledFaceDescriptors(user.name, userDescriptions)
        );
      }
    })
  );

  if (labeledDescriptors.length === 0) {
    return next(
      new AppError('There are no students enrolled in this course', 404)
    );
  }

  // Load Models
  const modelPath = path.join(__dirname, '../public/faceModels');
  await Promise.all([
    faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath),
    faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
    faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath)
  ]);

  // Detection
  // const result = await cloudinary.uploader.upload(req.file.path);
  const canvasImage = await canvas.loadImage(req.body.url);
  const image = faceapi.createCanvasFromMedia(canvasImage);
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

  const attendedUser = section.attendance.find(
    student => name === student.studentName
  );
  if (attendedUser) {
    return next(
      new AppError('This student is already marked as attended', 404)
    );
  }

  const user = await User.findOne({ name: name });
  section.attendance.addToSet({
    studentName: user.name,
    studentId: user.userId
  });
  await section.save();

  res.status(200).json({
    status: 'success',
    section
  });
});

exports.createSection = catchAsync(async (req, res, next) => {
  const course = await Course.findOne({ courseName: req.body.course });
  if (!course) {
    return next(new AppError('No course found with that Name', 404));
  }

  const currentUser = req.user;
  const courseName = currentUser.courses.find(el => el === course.courseName);
  if (!courseName) {
    return next(new AppError('You are not enrolled in this course', 404));
  }

  const len = course.sections.length;
  const sectionName = `Section ${len + 1}`;
  course.sections.addToSet(sectionName);
  await course.save({ validateBeforeSave: false });

  req.body.name = sectionName;
  const section = await Section.create(req.body);
  res.status(200).json({
    status: 'success',
    data: {
      section
    }
  });
});

exports.getAllSections = catchAsync(async (req, res, next) => {
  const sections = await Section.find();
  const course = await Course.findOne({ courseName: req.params.courseName });

  const neededSections = [];
  sections.forEach(section => {
    if (section.course === course.courseName) {
      neededSections.push(section);
    }
  });

  if (!course) {
    return next(new AppError('No course found with this name', 404));
  }

  res.status(200).json({
    status: 'success',
    sections: neededSections
  });
});

exports.getSection = catchAsync(async (req, res, next) => {
  const section = await Section.findOne({
    course: req.params.courseName,
    name: req.params.sectionName
  });

  if (!section) {
    return next(new AppError('No section found with that Name', 404));
  }

  res.status(200).json({
    status: 'success',
    section
  });
});

exports.deleteSection = catchAsync(async (req, res, next) => {
  const section = await Section.findOneAndDelete({
    course: req.params.courseName,
    name: req.params.sectionName
  });

  const course = await Course.findOne({ courseName: req.params.courseName });
  course.sections.pull(section.name);
  await course.save();

  if (!section) {
    return next(new AppError('No section found with that Name', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});
