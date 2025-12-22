import Attendance from '../models/Attendance.js';
import Student from '../models/Student.js';

/**
 * Helper: Generates a UTC date range for a single day.
 * Ensures that time-of-day differences don't interfere with date matching.
 */
const getDayRange = (dateString) => {
  const date = new Date(dateString);
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
};

/* =========================================================
   GET STUDENTS WITH ATTENDANCE STATUS
   Handles: Specific Class/Section OR "All"
   Route: GET /api/admin/attendance/by-class
========================================================= */
export const getAttendanceByClass = async (req, res) => {
  try {
    const { className, section, date } = req.query;

    console.log(`🔍 [REQUEST] Fetching: Class="${className}", Section="${section}", Date="${date}"`);

    // 1. Mandatory Validation (Section is optional to support "All Sections")
    if (!className || !date) {
      return res.status(400).json({ message: "Class and Date are required." });
    }

    const { start, end } = getDayRange(date);

    // 2. Build flexible Attendance Search Query
    const attendanceQuery = {
      date: { $gte: start, $lte: end }
    };

    // Filter by className unless "all" is selected
    if (className !== 'all') {
      attendanceQuery.className = className;
    }

    // Filter by section if provided and not "all"
    if (section && section !== 'all' && section.trim() !== "") {
      attendanceQuery.section = section;
    }

    // 3. Find attendance records
    const attendanceRecords = await Attendance.find(attendanceQuery).lean();

    console.log(`✅ [DB RESULT] Found ${attendanceRecords.length} attendance marks.`);

    /**
     * Note: The Frontend now handles the merging with the Student list locally.
     * We return the raw attendance records for the frontend to map via studentId.
     */
    res.status(200).json(attendanceRecords);

  } catch (error) {
    console.error("❌ [SERVER ERROR] Fetch Attendance Failed:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/* =========================================================
   MARK ATTENDANCE (BULK UPSERT)
   Handles multiple students at once. Updates if exists, inserts if new.
   Route: POST /api/admin/attendance/mark
========================================================= */
export const markAttendance = async (req, res) => {
  try {
    const { date, className, section, attendance } = req.body;

    if (!date || !attendance || !Array.isArray(attendance)) {
      return res.status(400).json({ message: "Invalid payload. Attendance array required." });
    }

    const attendanceDate = new Date(date);
    attendanceDate.setUTCHours(0, 0, 0, 0);

    // Prepare Bulk Operations using updateOne with upsert: true
    const bulkOps = attendance.map((record) => ({
      updateOne: {
        filter: { 
          studentId: record.studentId, 
          date: attendanceDate 
        },
        update: {
          $set: {
            studentId: record.studentId,
            date: attendanceDate,
            // Fallback to top-level class/section if not provided per-student
            className: record.className || className,
            section: record.section || section,
            sessions: {
              morning: record.morning,
              afternoon: record.afternoon
            },
            markedBy: req.user._id,
            markedRole: req.user.role || 'admin'
          }
        },
        upsert: true
      }
    }));

    if (bulkOps.length > 0) {
      const result = await Attendance.bulkWrite(bulkOps);
      console.log(`✅ [BULK SAVE] Upserted ${result.upsertedCount}, Updated ${result.modifiedCount}`);
    }

    res.status(200).json({ message: "Attendance saved successfully." });

  } catch (error) {
    console.error("❌ [SERVER ERROR] Mark Attendance Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/* =========================================================
   GET ATTENDANCE SUMMARY
   Calculates stats for Specific Section OR "All Sections"
   Route: GET /api/admin/attendance/summary
========================================================= */
export const getAttendanceSummary = async (req, res) => {
  try {
    const { className, section, date } = req.query;

    if (!className || !date) {
      return res.status(400).json({ message: "Class and Date are required." });
    }

    const { start, end } = getDayRange(date);

    // 1. Build Dynamic Student Query for correct count (matches Students page logic)
    const studentQuery = { status: { $ne: "deleted" } };
    
    if (className !== 'all') {
      // Handles both "10" and "10th Class" formats using Regex if necessary
      const classRegex = new RegExp(`^${className}`, 'i');
      
      if (section && section !== 'all' && section.trim() !== "") {
        // Specific section: LKG-A
        studentQuery.$or = [
          { className: className, section: section },
          { class: className, section: section },
          { className: `${className}-${section}` }
        ];
      } else {
        // Class-wide: All sections (LKG-A, LKG-B, etc.)
        studentQuery.$or = [
          { className: classRegex },
          { class: classRegex },
          { className: new RegExp(`^${className}-`, 'i') }
        ];
      }
    }

    const totalStudents = await Student.countDocuments(studentQuery);

    if (totalStudents === 0) {
      return res.status(200).json({
        totalStudents: 0, present: 0, halfDay: 0, absent: 0, attendancePercentage: 0
      });
    }

    // 2. Build Attendance Match Stage for Aggregation
    const matchStage = { date: { $gte: start, $lte: end } };
    if (className !== 'all') matchStage.className = className;
    if (section && section !== 'all' && section.trim() !== "") matchStage.section = section;

    // 3. Aggregate Attendance Metrics
    const stats = await Attendance.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          fullDayPresent: {
            $sum: { 
              $cond: [{ $and: [{ $eq: ["$sessions.morning", true] }, { $eq: ["$sessions.afternoon", true] }] }, 1, 0] 
            }
          },
          halfDayPresent: {
            $sum: {
              $cond: [
                { 
                  $or: [
                    { $and: [{ $eq: ["$sessions.morning", true] }, { $eq: ["$sessions.afternoon", false] }] },
                    { $and: [{ $eq: ["$sessions.morning", false] }, { $eq: ["$sessions.afternoon", true] }] }
                  ]
                }, 1, 0
              ]
            }
          }
        }
      }
    ]);

    const data = stats[0] || { fullDayPresent: 0, halfDayPresent: 0 };
    
    // 4. Final Stat Calculations
    const absent = Math.max(0, totalStudents - (data.fullDayPresent + data.halfDayPresent));
    // Weighting: Full day = 1, Half day = 0.5
    const score = data.fullDayPresent + (data.halfDayPresent * 0.5);
    const percentage = ((score / totalStudents) * 100).toFixed(1);

    res.status(200).json({
      totalStudents,
      present: data.fullDayPresent,
      halfDay: data.halfDayPresent,
      absent,
      attendancePercentage: Number(percentage)
    });

  } catch (error) {
    console.error("❌ [SERVER ERROR] Summary Error:", error);
    res.status(500).json({ message: "Failed to fetch summary." });
  }
};