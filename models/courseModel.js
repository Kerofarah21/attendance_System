const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  courseId: {
    type: String,
    required: [true, 'Course ID is required'],
    unique: true
  },
  courseName: {
    type: String,
    required: [true, 'A course name is required'],
    unique: true,
    trim: true,
    maxlength: [70, 'A course name must have less than or equal 70 characters']
  },
  students: [String],
  professors: [String],
  TAs: [String],
  lectures: [String],
  sections: [String]
});

const Course = mongoose.model('Course', courseSchema);

module.exports = Course;
