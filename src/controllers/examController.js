// backend/controllers/examController.js

import Exam from "../models/Exam.js";
import Submission from "../models/Submission.js";
import Student from "../models/Student.js";

/*
 |------------------------------------------------------------
 | Helper – normalize class name (extract number only)
 |------------------------------------------------------------
*/
function normalizeClassName(value = "") {
  const match = value.toString().match(/\d+/);
  return match ? match[0] : value.toString().trim();
}

/*
 |------------------------------------------------------------
 | CREATE EXAM (Teacher)
 |------------------------------------------------------------
*/
export const createExam = async (req, res) => {
  try {
    console.log('Creating exam with data:', req.body);
    
    const normalizedClass = normalizeClassName(req.body.className);

    const examData = {
      ...req.body,
      className: normalizedClass,
      section: req.body.section || '',
      createdBy: req.user._id,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: req.body.status || 'draft',
    };

    const exam = await Exam.create(examData);
    
    console.log('Exam created successfully:', exam._id);

    return res.status(201).json({
      success: true,
      message: "Exam created successfully",
      data: exam
    });

  } catch (error) {
    console.error("❌ createExam error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Error creating exam",
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/*
 |------------------------------------------------------------
 | TEACHER – LIST EXAMS
 |------------------------------------------------------------
*/
export const getExams = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role?.toLowerCase() === "teacher") {
      filter.createdBy = req.user._id;
    }

    const exams = await Exam.find(filter).sort({ createdAt: -1 });

    return res.json({
      success: true,
      message: "Exams fetched successfully",
      data: exams
    });

  } catch (error) {
    console.error("getExams error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching exams"
    });
  }
};

/*
 |------------------------------------------------------------
 | STUDENT — GET MY EXAMS
 |------------------------------------------------------------
*/
export const getMyExams = async (req, res) => {
  try {
    if (req.user.role?.toLowerCase() !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can access this endpoint"
      });
    }

    // find student via userId or linkedId
    const student =
      await Student.findOne({ userId: req.user._id }) ||
      await Student.findById(req.user.linkedId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found"
      });
    }

    // read class + section from multiple possible schema structures
    const rawClass =
      student.class?.className ||
      student.assignedClass?.className ||
      student.className ||
      "";

    const section =
      student.class?.section ||
      student.assignedClass?.section ||
      student.section ||
      req.user.section ||
      "";

    // normalize class
    const className = normalizeClassName(rawClass);

    if (!className || !section) {
      return res.status(400).json({
        success: false,
        message: "Student class/section missing"
      });
    }

    // find exams matching class & section
    const exams = await Exam.find({
      status: { $in: ["scheduled", "ongoing", "completed"] },
      $or: [
        { className, section },
        {
          classTargets: {
            $elemMatch: {
              className,
              sections: section
            }
          }
        }
      ]
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Exams fetched successfully",
      data: exams
    });

  } catch (error) {
    console.error("getMyExams error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching exams"
    });
  }
};

/*
 |------------------------------------------------------------
 | GET SINGLE EXAM
 |------------------------------------------------------------
*/
export const getExamById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const exam = await Exam.findById(id);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    return res.json({
      success: true,
      message: "Exam fetched successfully",
      data: exam
    });

  } catch (error) {
    console.error("getExamById error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching exam"
    });
  }
};

/*
 |------------------------------------------------------------
 | UPDATE EXAM
 |------------------------------------------------------------
*/
export const updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    
    const exam = await Exam.findByIdAndUpdate(
      id,
      {
        ...req.body,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    return res.json({
      success: true,
      message: "Exam updated successfully",
      data: exam
    });

  } catch (error) {
    console.error("updateExam error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error updating exam"
    });
  }
};

/*
 |------------------------------------------------------------
 | DELETE EXAM
 |------------------------------------------------------------
*/
export const deleteExam = async (req, res) => {
  try {
    const { id } = req.params;
    
    const exam = await Exam.findByIdAndDelete(id);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    return res.json({
      success: true,
      message: "Exam deleted successfully",
      data: exam
    });

  } catch (error) {
    console.error("deleteExam error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error deleting exam"
    });
  }
};

/*
 |------------------------------------------------------------
 | UPDATE EXAM STATUS
 |------------------------------------------------------------
*/
export const updateExamStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const exam = await Exam.findByIdAndUpdate(
      id,
      {
        status,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    return res.json({
      success: true,
      message: "Exam status updated successfully",
      data: exam
    });

  } catch (error) {
    console.error("updateExamStatus error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error updating exam status"
    });
  }
};

/*
 |------------------------------------------------------------
 | SUBMIT EXAM
 |------------------------------------------------------------
*/
export const submitExam = async (req, res) => {
  try {
    const { examId } = req.params;

    const submission = await Submission.create({
      exam: examId,
      student: req.user._id,
      answers: req.body.answers,
      submittedAt: new Date()
    });

    return res.json({
      success: true,
      message: "Exam submitted successfully",
      data: submission
    });

  } catch (error) {
    console.error("submitExam error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not submit exam"
    });
  }
};

/*
 |------------------------------------------------------------
 | EVALUATE EXAM (Auto-evaluate MCQ)
 |------------------------------------------------------------
*/
export const evaluateExam = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    const submissions = await Submission.find({ exam: examId });

    // Auto-evaluate each submission
    for (let submission of submissions) {
      let totalMarks = 0;
      
      // If exam has questions array
      if (exam.questions && Array.isArray(exam.questions)) {
        exam.questions.forEach(question => {
          const answer = submission.answers.find(
            ans => ans.questionId === question._id.toString()
          );
          
          if (answer && answer.answer === question.correctAnswer) {
            totalMarks += question.marks || 0;
          }
        });
      }
      
      // Update submission
      submission.totalMarksObtained = totalMarks;
      submission.status = "evaluated";
      submission.evaluatedAt = new Date();
      await submission.save();
    }

    return res.json({
      success: true,
      message: "Exam evaluated successfully",
      data: {
        evaluatedCount: submissions.length
      }
    });

  } catch (error) {
    console.error("evaluateExam error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not evaluate exam"
    });
  }
};

/*
 |------------------------------------------------------------
 | GET EXAM SUBMISSIONS
 |------------------------------------------------------------
*/
export const getSubmissions = async (req, res) => {
  try {
    const { examId } = req.params;
    
    const submissions = await Submission.find({ exam: examId })
      .populate('student', 'name email rollNumber')
      .sort({ submittedAt: -1 });

    return res.json({
      success: true,
      message: "Submissions fetched successfully",
      data: submissions
    });

  } catch (error) {
    console.error("getSubmissions error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching submissions"
    });
  }
};

/*
 |------------------------------------------------------------
 | GET MY SUBMISSIONS (Student)
 |------------------------------------------------------------
*/
export const getMySubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({ student: req.user._id })
      .populate('exam', 'name subject className section')
      .sort({ submittedAt: -1 });

    return res.json({
      success: true,
      message: "Your submissions fetched successfully",
      data: submissions
    });

  } catch (error) {
    console.error("getMySubmissions error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching your submissions"
    });
  }
};

/*
 |------------------------------------------------------------
 | GET SUBMISSION BY ID
 |------------------------------------------------------------
*/
export const getSubmissionById = async (req, res) => {
  try {
    const { submissionId } = req.params;
    
    const submission = await Submission.findById(submissionId)
      .populate('exam', 'name subject className section questions')
      .populate('student', 'name email rollNumber');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found"
      });
    }

    return res.json({
      success: true,
      message: "Submission fetched successfully",
      data: submission
    });

  } catch (error) {
    console.error("getSubmissionById error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching submission"
    });
  }
};

/*
 |------------------------------------------------------------
 | GET EXAM ANALYTICS
 |------------------------------------------------------------
*/
export const getExamAnalytics = async (req, res) => {
  try {
    const { examId } = req.params;
    
    const exam = await Exam.findById(examId);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    const submissions = await Submission.find({ exam: examId });
    
    // Calculate basic analytics
    const totalStudents = submissions.length;
    const evaluatedSubmissions = submissions.filter(s => s.status === 'evaluated').length;
    
    let totalMarks = 0;
    let highestScore = 0;
    let lowestScore = Infinity;
    
    submissions.forEach(sub => {
      if (sub.totalMarksObtained !== undefined) {
        totalMarks += sub.totalMarksObtained;
        highestScore = Math.max(highestScore, sub.totalMarksObtained);
        lowestScore = Math.min(lowestScore, sub.totalMarksObtained);
      }
    });
    
    const averageScore = totalStudents > 0 ? totalMarks / totalStudents : 0;

    const analytics = {
      examInfo: {
        name: exam.name,
        subject: exam.subject,
        totalMarks: exam.totalMarks || 100,
        className: exam.className,
        section: exam.section
      },
      submissionStats: {
        totalStudents,
        submitted: totalStudents,
        evaluated: evaluatedSubmissions,
        pendingEvaluation: totalStudents - evaluatedSubmissions
      },
      performanceStats: {
        averageScore: Math.round(averageScore * 100) / 100,
        highestScore: highestScore === -Infinity ? 0 : highestScore,
        lowestScore: lowestScore === Infinity ? 0 : lowestScore,
        passPercentage: 0 // You can calculate this based on pass marks
      }
    };

    return res.json({
      success: true,
      message: "Exam analytics fetched successfully",
      data: analytics
    });

  } catch (error) {
    console.error("getExamAnalytics error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching exam analytics"
    });
  }
};

/*
 |------------------------------------------------------------
 | GET CLASS PERFORMANCE
 |------------------------------------------------------------
*/
export const getClassPerformance = async (req, res) => {
  try {
    const { className, section } = req.params;
    
    const exams = await Exam.find({ className, section, status: 'completed' });
    
    const performanceData = await Promise.all(
      exams.map(async (exam) => {
        const submissions = await Submission.find({ exam: exam._id });
        
        let totalScore = 0;
        let highestScore = 0;
        let lowestScore = Infinity;
        
        submissions.forEach(sub => {
          if (sub.totalMarksObtained !== undefined) {
            totalScore += sub.totalMarksObtained;
            highestScore = Math.max(highestScore, sub.totalMarksObtained);
            lowestScore = Math.min(lowestScore, sub.totalMarksObtained);
          }
        });
        
        const averageScore = submissions.length > 0 ? totalScore / submissions.length : 0;
        
        return {
          examId: exam._id,
          examName: exam.name,
          subject: exam.subject,
          totalStudents: submissions.length,
          averageScore: Math.round(averageScore * 100) / 100,
          highestScore: highestScore === -Infinity ? 0 : highestScore,
          lowestScore: lowestScore === Infinity ? 0 : lowestScore
        };
      })
    );

    return res.json({
      success: true,
      message: "Class performance fetched successfully",
      data: performanceData
    });

  } catch (error) {
    console.error("getClassPerformance error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching class performance"
    });
  }
};

/*
 |------------------------------------------------------------
 | PUBLISH RESULTS
 |------------------------------------------------------------
*/
export const publishResults = async (req, res) => {
  try {
    const { examId } = req.params;
    
    const exam = await Exam.findByIdAndUpdate(
      examId,
      {
        resultsPublished: true,
        resultsPublishedAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    return res.json({
      success: true,
      message: "Results published successfully",
      data: exam
    });

  } catch (error) {
    console.error("publishResults error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error publishing results"
    });
  }
};