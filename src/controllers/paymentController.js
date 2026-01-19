const StudentFee = require('../models/StudentFee');
const Student = require('../models/Student');
const { generateReceiptNumber } = require('../utils/helpers');

class PaymentController {
  // Get student fee details
  async getStudentFeeDetails(req, res) {
    try {
      const { admissionNumber, studentId } = req.query;
      
      let query = {};
      if (admissionNumber) {
        query.admissionNumber = admissionNumber;
      } else if (studentId) {
        query.studentId = studentId;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Please provide admission number or student ID'
        });
      }

      const studentFee = await StudentFee.findOne(query)
        .populate('studentId', 'firstName lastName')
        .populate('feeStructureId');

      if (!studentFee) {
        return res.status(404).json({
          success: false,
          message: 'No fee record found for this student'
        });
      }

      res.json({
        success: true,
        data: studentFee
      });
    } catch (error) {
      console.error('Error fetching student fee details:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // Record a payment
  async recordPayment(req, res) {
    try {
      const { studentFeeId, amount, paymentMethod, discountAmount = 0, lateFeeAmount = 0, description = '' } = req.body;

      if (!studentFeeId || !amount || !paymentMethod) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      // Find student fee record
      const studentFee = await StudentFee.findById(studentFeeId);
      if (!studentFee) {
        return res.status(404).json({
          success: false,
          message: 'Student fee record not found'
        });
      }

      // Generate receipt number
      const receiptNumber = generateReceiptNumber();

      // Create payment record
      const payment = {
        receiptNumber,
        amount: parseFloat(amount),
        paymentDate: new Date(),
        paymentMethod,
        status: 'completed'
      };

      // Add payment method details
      if (paymentMethod === 'cheque') {
        payment.chequeNumber = req.body.chequeNumber;
        payment.bankName = req.body.bankName;
      } else if (paymentMethod === 'online' || paymentMethod === 'card' || paymentMethod === 'bank_transfer') {
        payment.transactionId = req.body.transactionId;
        payment.bankName = req.body.bankName;
      }

      // Update student fee
      studentFee.payments.push(payment);
      studentFee.discountAmount += parseFloat(discountAmount);
      studentFee.lateFeeAmount += parseFloat(lateFeeAmount);

      // Add to payment history
      studentFee.paymentHistory.push({
        date: new Date(),
        amount: parseFloat(amount),
        description,
        receiptNumber
      });

      // Update fee items status based on payment
      await this.updateFeeItemsStatus(studentFee, amount);

      await studentFee.save();

      // Send receipt if requested
      if (req.body.sendReceipt) {
        await this.sendReceipt(studentFee, payment, req.body);
      }

      // Send SMS notification if requested
      if (req.body.sendSMS) {
        await this.sendPaymentNotification(studentFee, payment, 'sms');
      }

      // Send Email notification if requested
      if (req.body.sendEmail) {
        await this.sendPaymentNotification(studentFee, payment, 'email');
      }

      res.json({
        success: true,
        message: 'Payment recorded successfully',
        data: {
          receiptNumber,
          payment,
          studentFee: {
            totalPaid: studentFee.totalPaid,
            totalDue: studentFee.totalDue,
            status: studentFee.status
          }
        }
      });

    } catch (error) {
      console.error('Error recording payment:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // Update fee items status based on payment
  async updateFeeItemsStatus(studentFee, amountPaid) {
    let remainingAmount = amountPaid;
    
    // Sort fee items by due date (earliest first)
    studentFee.feeItems.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    for (const item of studentFee.feeItems) {
      if (item.paid) continue;

      const amountDue = item.amount - item.amountPaid;
      
      if (remainingAmount >= amountDue) {
        item.amountPaid += amountDue;
        item.paid = true;
        item.paymentDate = new Date();
        remainingAmount -= amountDue;
      } else {
        item.amountPaid += remainingAmount;
        if (item.amountPaid >= item.amount) {
          item.paid = true;
          item.paymentDate = new Date();
        }
        remainingAmount = 0;
        break;
      }
    }

    // If there's remaining amount after paying all items, apply to next installment
    if (remainingAmount > 0) {
      studentFee.advanceAmount = (studentFee.advanceAmount || 0) + remainingAmount;
    }
  }

  // Send receipt
  async sendReceipt(studentFee, payment, details) {
    try {
      // Get student details
      const student = await Student.findById(studentFee.studentId);
      
      // Generate PDF receipt
      // You can use libraries like pdfkit or puppeteer here
      console.log(`Receipt generated for ${student.firstName} ${student.lastName}`);
      console.log(`Receipt Number: ${payment.receiptNumber}`);
      console.log(`Amount: ₹${payment.amount}`);
      
      // Send email with receipt attachment
      if (details.sendEmail && student.parents?.father?.email) {
        await this.sendEmailReceipt(student, payment, studentFee);
      }
      
    } catch (error) {
      console.error('Error sending receipt:', error);
    }
  }

  // Send payment notification
  async sendPaymentNotification(studentFee, payment, type) {
    try {
      const student = await Student.findById(studentFee.studentId);
      const parentPhone = student.parents?.father?.phone;
      const parentEmail = student.parents?.father?.email;

      if (type === 'sms' && parentPhone) {
        // Use SMS service API here
        console.log(`SMS sent to ${parentPhone} for payment of ₹${payment.amount}`);
      } else if (type === 'email' && parentEmail) {
        // Send email
        console.log(`Email sent to ${parentEmail} for payment of ₹${payment.amount}`);
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  // Get payment history for a student
  async getPaymentHistory(req, res) {
    try {
      const { studentFeeId } = req.params;
      
      const studentFee = await StudentFee.findById(studentFeeId)
        .select('paymentHistory payments studentId admissionNumber')
        .populate('studentId', 'firstName lastName');

      if (!studentFee) {
        return res.status(404).json({
          success: false,
          message: 'Student fee record not found'
        });
      }

      res.json({
        success: true,
        data: {
          student: studentFee.studentId,
          admissionNumber: studentFee.admissionNumber,
          payments: studentFee.payments,
          paymentHistory: studentFee.paymentHistory
        }
      });
    } catch (error) {
      console.error('Error fetching payment history:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // Generate fee report
  async generateFeeReport(req, res) {
    try {
      const { className, section, academicYear, status } = req.query;
      
      const query = {};
      if (className) query.className = className;
      if (section) query.section = section;
      if (academicYear) query.academicYear = academicYear;
      if (status) query.status = status;

      const fees = await StudentFee.find(query)
        .populate('studentId', 'firstName lastName admissionNumber')
        .populate('feeStructureId')
        .sort({ className: 1, section: 1 });

      const report = {
        totalStudents: fees.length,
        totalFeeAmount: fees.reduce((sum, fee) => sum + fee.totalFeeAmount, 0),
        totalPaid: fees.reduce((sum, fee) => sum + fee.totalPaid, 0),
        totalDue: fees.reduce((sum, fee) => sum + fee.totalDue, 0),
        students: fees.map(fee => ({
          admissionNumber: fee.admissionNumber,
          studentName: fee.studentId ? `${fee.studentId.firstName} ${fee.studentId.lastName}` : 'N/A',
          className: fee.className,
          section: fee.section,
          totalFee: fee.totalFeeAmount,
          totalPaid: fee.totalPaid,
          totalDue: fee.totalDue,
          status: fee.status,
          lastPayment: fee.payments.length > 0 ? fee.payments[fee.payments.length - 1] : null
        }))
      };

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error generating fee report:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
}

module.exports = new PaymentController();