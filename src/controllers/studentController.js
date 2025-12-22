import Student from "../models/Student.js";

/**
 * CREATE STUDENT (Single Insert)
 * @desc    Create a single new student record.
 * @route   POST /api/admin/students
 */
export const createStudent = async (req, res) => {
  // 1. Log req.body for verification (for debugging purposes, can be removed later)
  console.log('--- Incoming Single Request Body ---');
  console.log(req.body);
  console.log('-----------------------------');
  
  // Basic check for single object insert
  if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      message: 'Invalid request body. Expected a single Student JSON object.',
    });
  }

  try {
    // 2. Check for duplicate admission number (excluding deleted students)
    const exists = await Student.findOne({
      admissionNumber: req.body.admissionNumber,
      status: { $ne: "deleted" }
    });

    if (exists) {
      return res.status(400).json({
        message: `Admission number '${req.body.admissionNumber}' already exists.`
      });
    }

    // 3. Create the student document
    const student = await Student.create({
      ...req.body,
      status: "active",
      createdBy: req.user.id // Assuming req.user is populated by the protect middleware
    });

    res.status(201).json({
      success: true,
      message: "Student created successfully",
      student
    });
  } catch (error) {
    // 4. Handle Mongoose Validation and Duplicate Key Errors (Improved Error Handling)
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        message: 'Student validation failed.',
        errors: messages,
      });
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue).join(', ');
      return res.status(400).json({
        message: `Duplicate field value: '${field}' must be unique.`,
      });
    }
    
    // Generic Server Error
    console.error('Error creating student:', error);
    res.status(500).json({ 
        message: "Server error during student creation.", 
        error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
};


/**
 * CREATE BULK STUDENTS
 * @desc    Insert multiple student documents using Mongoose.insertMany().
 * @route   POST /api/admin/students/bulk
 */
export const createBulkStudents = async (req, res) => {
  const studentsToInsert = req.body;

  // 1. Array Validation
  if (!Array.isArray(studentsToInsert) || studentsToInsert.length === 0) {
    return res.status(400).json({
      message: 'Invalid request body. Expected a non-empty array of student objects for bulk insert.',
    });
  }
  
  // Log only the count for large payloads
  console.log(`--- Bulk Insert: Received ${studentsToInsert.length} documents ---`);

  // Inject required default/context fields into each document before insertion
  const documentsWithDefaults = studentsToInsert.map(doc => ({
      ...doc,
      status: "active",
      createdBy: req.user.id // Assuming req.user is populated
  }));

  try {
    // 2. Perform Bulk Insert
    // Use { ordered: false } to try inserting all documents and report all errors,
    // or { ordered: true } to stop at the first error (default). Using true here 
    // for predictable error handling, matching the previous suggestion.
    const insertedStudents = await Student.insertMany(documentsWithDefaults, { ordered: true });

    // 3. Success Response
    res.status(201).json({
      success: true,
      message: `${insertedStudents.length} student records created successfully in bulk.`,
      count: insertedStudents.length,
      data: insertedStudents.map(student => ({
        _id: student._id,
        admissionNumber: student.admissionNumber
      })),
    });
  } catch (error) {
    // 4. Handle Mongoose/MongoDB BulkWriteError (Validation/Duplicate)
    
    if (error.name === 'BulkWriteError' || error.code === 11000) {
      let errorMessage = 'Bulk insert failed due to a database write error (e.g., duplicate key).';
      
      // Attempt to extract specific error details for better feedback
      if (error.writeErrors && error.writeErrors.length > 0) {
          const firstError = error.writeErrors[0];
          if (firstError.code === 11000) {
             errorMessage = `Duplicate error found at document index ${firstError.index}. Admission Number may already exist.`;
          } else if (firstError.errmsg && firstError.errmsg.includes('validation failed')) {
             errorMessage = `Validation failed at document index ${firstError.index}. Check required fields.`;
          }
      } else if (error.message.includes('validation failed')) {
        // Fallback for cases where Mongoose wraps validation error in a less descriptive way
        errorMessage = 'Bulk insert failed due to Mongoose validation error.';
      }
      
      return res.status(400).json({
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : 'A database write error occurred.',
      });
    }
    
    // Generic Server Error
    console.error('Error in createBulkStudents:', error);
    res.status(500).json({
      message: 'Internal Server Error during bulk student insertion.',
    });
  }
};


/**
 * GET ALL STUDENTS (exclude deleted)
 * @route   GET /api/admin/students
 */
export const getStudents = async (req, res) => {
  try {
    const students = await Student.find({
      status: { $ne: "deleted" }
    }).sort({ createdAt: -1 });

    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET STUDENT BY ID
 * @route   GET /api/admin/students/:id
 */
export const getStudentById = async (req, res) => {
  try {
    const student = await Student.findOne({
      _id: req.params.id,
      status: { $ne: "deleted" }
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET BY ADMISSION NUMBER
 * @route   GET /api/admin/students/by-admission/:admissionNumber
 */
export const getByAdmissionNumber = async (req, res) => {
  try {
    const student = await Student.findOne({
      admissionNumber: req.params.admissionNumber,
      status: { $ne: "deleted" }
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * UPDATE STUDENT
 * @route   PUT /api/admin/students/:id
 */
export const updateStudent = async (req, res) => {
  // Prevent updating the status through the general update route
  const updateData = { ...req.body };
  delete updateData.status; 
  
  try {
    // Find one and update by ID, ensuring it's not deleted.
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: "deleted" } },
      updateData,
      { new: true, runValidators: true } // Run validators on update
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({
      message: "Student updated successfully",
      student
    });
  } catch (error) {
    // Improved error handling for validation on update
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        message: 'Update validation failed.',
        errors: messages,
      });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * UPDATE STATUS (active / inactive)
 * @route   PUT /api/admin/students/:id/status
 */
export const updateStudentStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        message: "Status must be 'active' or 'inactive'"
      });
    }

    // Use findOneAndUpdate to ensure status is not "deleted" before updating
    const student = await Student.findOneAndUpdate(
        { _id: req.params.id, status: { $ne: "deleted" } },
        { status },
        { new: true }
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found or already deleted" });
    }

    res.json({
      message: "Student status updated successfully",
      student
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * SOFT DELETE STUDENT
 * @route   DELETE /api/admin/students/:id
 */
export const softDeleteStudent = async (req, res) => {
  try {
    // Only soft delete if the status is not already "deleted"
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: "deleted" } },
      { status: "deleted" },
      { new: true }
    );

    if (!student) {
        // Return 404 if not found or already deleted
      return res.status(404).json({ message: "Student not found or already deleted" });
    }

    res.json({
      message: "Student deleted successfully (soft-deleted)"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};