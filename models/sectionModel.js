const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
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

const Section = mongoose.model('Section', sectionSchema);

module.exports = Section;
