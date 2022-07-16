/* eslint-disable node/no-unsupported-features/es-syntax */
const Course = require('../models/courseModel');
const User = require('../models/userModel');
const Lecture = require('../models/lectureModel');
const Section = require('../models/sectionModel');
const factory = require('./handlerFactory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getCourse = catchAsync(async (req, res, next) => {
  const course = await Course.findOne({ courseName: req.params.courseName });

  if (!course) {
    return next(new AppError('No course found with that Name', 404));
  }

  res.status(200).json({
    status: 'success',
    course
  });
});

exports.updateCourse = catchAsync(async (req, res, next) => {
  const course = await Course.findOneAndUpdate(
    { courseName: req.params.courseName },
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  if (!course) {
    return next(new AppError('No course found with that Name', 404));
  }

  res.status(200).json({
    status: 'success',
    course
  });
});

exports.deleteCourse = catchAsync(async (req, res, next) => {
  const course = await Course.findOneAndDelete({
    courseName: req.params.courseName
  });

  const users = await User.find();
  users.forEach(async user => {
    const courseName = user.courses.find(el => el === course.courseName);
    user.courses.pull(courseName);
    await user.save({ validateBeforeSave: false });
  });

  const lectures = await Lecture.find();
  lectures.forEach(async lecture => {
    if (lecture.course === course.courseName) {
      await Lecture.deleteOne(lecture);
    }
  });

  const sections = await Section.find();
  sections.forEach(async section => {
    if (section.course === course.courseName) {
      await Section.deleteOne(section);
    }
  });

  if (!course) {
    return next(new AppError('No course found with that Name', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.getAllCourses = factory.getAll(Course);
exports.createCourse = factory.createOne(Course);
