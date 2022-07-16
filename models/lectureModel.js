const mongoose = require('mongoose');

const lectureSchema = new mongoose.Schema({
  name: String,
  course: String,
  date: {
    type: Date,
    default: Date.now()
  },
  attendance: [
    {
      studentName: String,
      studentId: String
    }
  ]
});

const Lecture = mongoose.model('Lecture', lectureSchema);

module.exports = Lecture;
