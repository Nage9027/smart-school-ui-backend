import Joi from "joi";

// Payment validation schema
const paymentSchema = Joi.object({
  admissionNumber: Joi.string().required(),
  studentId: Joi.string().required(),
  paymentDate: Joi.date().optional(),
  paymentMethod: Joi.string()
    .valid("cash", "cheque", "bank_transfer", "upi", "card", "online")
    .required(),
  referenceNo: Joi.string().optional().allow(""),
  transactionId: Joi.string().optional().allow(""),
  bankName: Joi.string().optional().allow(""),
  chequeNo: Joi.string().optional().allow(""),
  chequeDate: Joi.date().optional(),
  utrNo: Joi.string().optional().allow(""),
  upiId: Joi.string().optional().allow(""),
  amount: Joi.number().positive().required(),
  discount: Joi.number().min(0).optional(),
  discountReason: Joi.string().optional().allow(""),
  lateFee: Joi.number().min(0).optional(),
  lateFeeReason: Joi.string().optional().allow(""),
  netAmount: Joi.number().positive().required(),
  description: Joi.string().optional().allow(""),
  feesPaid: Joi.array().optional(),
  sendReceipt: Joi.boolean().optional(),
  sendSMS: Joi.boolean().optional(),
  sendEmail: Joi.boolean().optional(),
});

// Search validation schema
const searchSchema = Joi.object({
  query: Joi.string().min(2).required(),
});

export const validatePayment = (req, res, next) => {
  const { error } = paymentSchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }
  
  next();
};

export const validateSearch = (req, res, next) => {
  const { error } = searchSchema.validate(req.query, { abortEarly: false });
  
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }
  
  next();
};

export default {
  validatePayment,
  validateSearch,
};