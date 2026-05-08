// models/Vehicle.js - COMPLETE CLEAN VERSION (NO MIDDLEWARE)
import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
  // Basic Information
  vehicleNo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  registrationNo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  make: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  year: {
    type: Number,
    required: true,
    min: 2000,
    max: new Date().getFullYear() + 1
  },
  color: {
    type: String,
    trim: true
  },
  
  // Specifications
  type: {
    type: String,
    enum: ['bus', 'van', 'car', 'minibus', 'coaster', 'other'],
    default: 'bus'
  },
  capacity: {
    type: Number,
    required: true,
    min: 1
  },
  fuelType: {
    type: String,
    enum: ['petrol', 'diesel', 'cng', 'electric', 'hybrid'],
    default: 'diesel'
  },
  transmission: {
    type: String,
    enum: ['manual', 'automatic'],
    default: 'manual'
  },
  
  // Status & Tracking
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'on-route', 'reserved'],
    default: 'active'
  },
  currentLocation: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 },
    address: { type: String, default: '' },
    updatedAt: { type: Date }
  },
  currentFuel: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  speed: {
    type: Number,
    default: 0
  },
  mileage: {
    type: Number,
    default: 0
  },
  
  // Assignments
  currentDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  currentRoute: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route'
  },
  
  // Maintenance Information
  lastService: {
    type: Date,
    default: Date.now
  },
  nextService: {
    type: Date,
    default: () => new Date(new Date().setMonth(new Date().getMonth() + 1))
  },
  serviceInterval: {
    type: Number, // in kilometers
    default: 5000
  },
  
  // Documentation
  insuranceProvider: {
    type: String,
    trim: true
  },
  insuranceExpiry: {
    type: Date
  },
  fitnessExpiry: {
    type: Date
  },
  permitExpiry: {
    type: Date
  },
  
  // Additional Information
  features: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    trim: true
  },
  
  // Tracking
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better performance
vehicleSchema.index({ vehicleNo: 1, registrationNo: 1 });
vehicleSchema.index({ status: 1 });
vehicleSchema.index({ currentDriver: 1 });
vehicleSchema.index({ currentRoute: 1 });
vehicleSchema.index({ nextService: 1 });
vehicleSchema.index({ insuranceExpiry: 1 });

// ===== NO MIDDLEWARE - REMOVED ALL pre() hooks =====

// Virtual for vehicle age
vehicleSchema.virtual('age').get(function() {
  return new Date().getFullYear() - this.year;
});

// Virtual for insurance status
vehicleSchema.virtual('insuranceStatus').get(function() {
  if (!this.insuranceExpiry) return 'unknown';
  const today = new Date();
  const diffTime = this.insuranceExpiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'expiring-soon';
  return 'valid';
});

// Virtual for service status
vehicleSchema.virtual('serviceStatus').get(function() {
  if (!this.nextService) return 'unknown';
  const today = new Date();
  const diffTime = this.nextService - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 7) return 'due-soon';
  return 'scheduled';
});

// Method to update location
vehicleSchema.methods.updateLocation = function(lat, lng, address, speed) {
  this.currentLocation = {
    lat,
    lng,
    address: address || '',
    updatedAt: new Date()
  };
  if (speed !== undefined) {
    this.speed = speed;
  }
  return this.save();
};

// Method to update fuel level
vehicleSchema.methods.updateFuel = function(fuelLevel) {
  if (fuelLevel < 0 || fuelLevel > 100) {
    throw new Error('Fuel level must be between 0 and 100');
  }
  this.currentFuel = fuelLevel;
  return this.save();
};

// Method to assign driver
vehicleSchema.methods.assignDriver = async function(driverId) {
  const Driver = mongoose.model('Driver');
  
  // Check if driver exists
  const driver = await Driver.findById(driverId);
  if (!driver) {
    throw new Error('Driver not found');
  }
  
  // Check if driver is already assigned to another vehicle
  const existingAssignment = await mongoose.model('Vehicle').findOne({
    currentDriver: driverId,
    _id: { $ne: this._id }
  });
  
  if (existingAssignment) {
    throw new Error('Driver is already assigned to another vehicle');
  }
  
  // Remove current driver assignment if exists
  if (this.currentDriver) {
    await Driver.findByIdAndUpdate(this.currentDriver, {
      $unset: { assignedVehicle: '' }
    });
  }
  
  // Assign new driver
  this.currentDriver = driverId;
  await this.save();
  
  // Update driver's assigned vehicle
  await Driver.findByIdAndUpdate(driverId, {
    assignedVehicle: this._id
  });
  
  return this;
};

// Method to unassign driver
vehicleSchema.methods.unassignDriver = async function() {
  if (!this.currentDriver) {
    return this;
  }
  
  const Driver = mongoose.model('Driver');
  await Driver.findByIdAndUpdate(this.currentDriver, {
    $unset: { assignedVehicle: '' }
  });
  
  this.currentDriver = null;
  return this.save();
};

// Static method to get vehicles by status
vehicleSchema.statics.getByStatus = function(status) {
  return this.find({ status }).populate('currentDriver').populate('currentRoute');
};

// Static method to get vehicles due for service
vehicleSchema.statics.getDueForService = function(daysThreshold = 7) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysThreshold);
  
  return this.find({
    nextService: { $lte: targetDate, $gte: new Date() }
  }).populate('currentDriver');
};

// Static method to get low fuel vehicles
vehicleSchema.statics.getLowFuel = function(threshold = 20) {
  return this.find({
    currentFuel: { $lt: threshold }
  }).populate('currentDriver');
};

// Set JSON transformation
vehicleSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret.createdAt;
    delete ret.updatedAt;
    return ret;
  }
});

// Set Object transformation
vehicleSchema.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

export default Vehicle;