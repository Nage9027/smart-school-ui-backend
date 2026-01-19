import mongoose from 'mongoose';

const fuelLogSchema = new mongoose.Schema(
  {
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    fuelType: {
      type: String,
      enum: ['petrol', 'diesel', 'cng', 'electric'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCost: {
      type: Number,
      required: true,
    },
    odometerReading: {
      type: Number,
      required: true,
    },
    previousReading: {
      type: Number,
      required: true,
    },
    distanceCovered: {
      type: Number,
    },
    fuelEfficiency: {
      type: Number,
    },
    fuelingStation: {
      type: String,
      required: true,
    },
    receiptNo: {
      type: String,
    },
    receiptImage: {
      type: String,
    },
    notes: {
      type: String,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate distance covered and fuel efficiency before saving
fuelLogSchema.pre('save', function (next) {
  this.distanceCovered = this.odometerReading - this.previousReading;
  if (this.quantity > 0) {
    this.fuelEfficiency = this.distanceCovered / this.quantity;
  }
  next();
});

// Query middleware to exclude deleted documents
fuelLogSchema.pre(/^find/, function (next) {
  if (this._conditions.isDeleted !== true) {
    this.where({ isDeleted: { $ne: true } });
  }
  next();
});

export default mongoose.model('FuelLog', fuelLogSchema);