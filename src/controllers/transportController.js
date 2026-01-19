// controllers/transportController.js - COMPLETE FIXED VERSION
import mongoose from 'mongoose';
import Vehicle from '../models/Vehicle.js';
import Driver from '../models/Driver.js';
import Route from '../models/Route.js';
import Maintenance from '../models/Maintenance.js';
import FuelLog from '../models/FuelLog.js';
import Cleaner from '../models/Cleaner.js';

// =================== FIXED ASYNC ERROR HANDLER ===================
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// =================== ERROR HANDLER ===================
const handleError = (res, error, customMessage = null) => {
  console.error('Error:', error);
  
  let statusCode = 500;
  let message = customMessage || 'Internal server error';
  
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(error.errors).map(err => err.message).join(', ');
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ID format: ${error.value}`;
  } else if (error.code === 11000) {
    statusCode = 400;
    message = 'Duplicate key error. This record already exists.';
  }
  
  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

// =================== VEHICLE CONTROLLERS ===================

export const getAllVehicles = asyncHandler(async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const query = {};
    if (status && status !== 'all') query.status = status;
    if (search) {
      query.$or = [
        { vehicleNo: { $regex: search, $options: 'i' } },
        { registrationNo: { $regex: search, $options: 'i' } },
        { make: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const sortOptions = { [sortBy]: sortDirection };

    const vehicles = await Vehicle.find(query)
      .populate('currentDriver', 'firstName lastName phone email avatar employeeId')
      .populate('currentRoute', 'routeNo name zone')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Vehicle.countDocuments(query);

    res.json({
      success: true,
      count: vehicles.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      data: vehicles
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const getVehicleById = asyncHandler(async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id)
      .populate('currentDriver', 'firstName lastName phone email avatar employeeId')
      .populate('currentRoute', 'routeNo name zone');

    if (!vehicle) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vehicle not found' 
      });
    }

    res.json({ success: true, data: vehicle });
  } catch (error) {
    handleError(res, error);
  }
});

export const createVehicle = asyncHandler(async (req, res) => {
  try {
    const vehicleData = req.body;

    // Basic validation
    if (!vehicleData.vehicleNo || !vehicleData.registrationNo) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle number and registration number are required'
      });
    }

    // Check if vehicle number already exists
    const existingVehicleNo = await Vehicle.findOne({ vehicleNo: vehicleData.vehicleNo });
    if (existingVehicleNo) {
      return res.status(400).json({
        success: false,
        message: `Vehicle number "${vehicleData.vehicleNo}" already exists`
      });
    }

    // Check if registration number already exists
    const existingRegistration = await Vehicle.findOne({ registrationNo: vehicleData.registrationNo });
    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: `Registration number "${vehicleData.registrationNo}" already exists`
      });
    }

    // Set default status if not provided
    if (!vehicleData.status) {
      vehicleData.status = 'active';
    }

    // Set default fuel level if not provided
    if (!vehicleData.currentFuel && vehicleData.currentFuel !== 0) {
      vehicleData.currentFuel = 100;
    }

    const vehicle = new Vehicle(vehicleData);
    await vehicle.save();

    // Socket.io emit if available
    const io = req.app.get('io');
    if (io) {
      io.emit('vehicle-added', vehicle);
    }

    res.status(201).json({
      success: true,
      message: 'Vehicle created successfully',
      data: vehicle
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const updateVehicle = asyncHandler(async (req, res) => {
  try {
    const vehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('currentDriver').populate('currentRoute');

    if (!vehicle) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vehicle not found' 
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('vehicle-updated', vehicle);
    }

    res.json({ 
      success: true, 
      message: 'Vehicle updated successfully', 
      data: vehicle 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const updateVehicleLocation = asyncHandler(async (req, res) => {
  try {
    const { lat, lng, address, speed } = req.body;
    const vehicleId = req.params.id;

    if (!lat || !lng) {
      return res.status(400).json({ 
        success: false, 
        message: 'Latitude and longitude are required' 
      });
    }

    const vehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      {
        currentLocation: { 
          lat: parseFloat(lat), 
          lng: parseFloat(lng), 
          address, 
          updatedAt: new Date() 
        },
        ...(speed && { speed: parseFloat(speed) })
      },
      { new: true }
    ).select('vehicleNo registrationNo currentLocation status currentFuel');

    if (!vehicle) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vehicle not found' 
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`vehicle-${vehicleId}`).emit('location-update', {
        vehicleId,
        vehicleNo: vehicle.vehicleNo,
        location: { lat: parseFloat(lat), lng: parseFloat(lng), address },
        speed: speed || 0,
        timestamp: new Date()
      });
      io.emit('vehicle-location-update', {
        vehicleId,
        vehicleNo: vehicle.vehicleNo,
        location: { lat: parseFloat(lat), lng: parseFloat(lng), address },
        status: vehicle.status,
        timestamp: new Date()
      });
    }

    res.json({ 
      success: true, 
      message: 'Location updated successfully', 
      data: vehicle.currentLocation 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const updateFuelLevel = asyncHandler(async (req, res) => {
  try {
    const { fuelLevel } = req.body;
    const vehicleId = req.params.id;

    if (fuelLevel === undefined || fuelLevel === null) {
      return res.status(400).json({ 
        success: false, 
        message: 'Fuel level is required' 
      });
    }

    const fuelLevelNum = parseFloat(fuelLevel);
    if (isNaN(fuelLevelNum) || fuelLevelNum < 0 || fuelLevelNum > 100) {
      return res.status(400).json({ 
        success: false, 
        message: 'Fuel level must be a number between 0 and 100' 
      });
    }

    const vehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      { currentFuel: fuelLevelNum },
      { new: true }
    ).select('vehicleNo currentFuel registrationNo');

    if (!vehicle) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vehicle not found' 
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`vehicle-${vehicleId}`).emit('fuel-update', {
        vehicleId,
        vehicleNo: vehicle.vehicleNo,
        fuelLevel: fuelLevelNum,
        timestamp: new Date()
      });
    }

    res.json({ 
      success: true, 
      message: 'Fuel level updated successfully', 
      data: { currentFuel: vehicle.currentFuel } 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const assignDriver = asyncHandler(async (req, res) => {
  try {
    const { driverId } = req.body;
    const vehicleId = req.params.id;

    if (!driverId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Driver ID is required' 
      });
    }

    // Validate driver ID format
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid driver ID format' 
      });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ 
        success: false, 
        message: 'Driver not found' 
      });
    }

    // Check if driver is already assigned to another vehicle
    const existingAssignment = await Vehicle.findOne({
      currentDriver: driverId,
      _id: { $ne: vehicleId }
    });
    
    if (existingAssignment) {
      return res.status(400).json({ 
        success: false, 
        message: `Driver is already assigned to vehicle: ${existingAssignment.vehicleNo}` 
      });
    }

    const vehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      { currentDriver: driverId },
      { new: true }
    ).populate('currentDriver', 'firstName lastName phone email employeeId');

    if (!vehicle) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vehicle not found' 
      });
    }

    // Update driver's assigned vehicle
    await Driver.findByIdAndUpdate(driverId, { 
      assignedVehicle: vehicleId,
      status: 'active'
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('driver-assigned', {
        vehicleId,
        driverId,
        driverName: `${driver.firstName} ${driver.lastName}`,
        vehicleNo: vehicle.vehicleNo,
        timestamp: new Date()
      });
    }

    res.json({ 
      success: true, 
      message: 'Driver assigned successfully', 
      data: vehicle 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const unassignDriver = asyncHandler(async (req, res) => {
  try {
    const vehicleId = req.params.id;

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vehicle not found' 
      });
    }

    if (!vehicle.currentDriver) {
      return res.status(400).json({ 
        success: false, 
        message: 'No driver is currently assigned to this vehicle' 
      });
    }

    const driverId = vehicle.currentDriver;

    // Remove driver from vehicle
    vehicle.currentDriver = null;
    await vehicle.save();

    // Remove vehicle from driver
    await Driver.findByIdAndUpdate(driverId, { 
      $unset: { assignedVehicle: "" }
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('driver-unassigned', {
        vehicleId,
        driverId,
        vehicleNo: vehicle.vehicleNo,
        timestamp: new Date()
      });
    }

    res.json({ 
      success: true, 
      message: 'Driver unassigned successfully' 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const getVehicleStats = asyncHandler(async (req, res) => {
  try {
    const totalVehicles = await Vehicle.countDocuments();
    const activeVehicles = await Vehicle.countDocuments({ status: 'active' });
    const maintenanceVehicles = await Vehicle.countDocuments({ status: 'maintenance' });
    const onRouteVehicles = await Vehicle.countDocuments({ status: 'on-route' });
    const inactiveVehicles = await Vehicle.countDocuments({ status: 'inactive' });

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const dueForService = await Vehicle.countDocuments({
      nextService: { $lte: nextWeek, $gte: new Date() }
    });

    const lowFuelVehicles = await Vehicle.countDocuments({ currentFuel: { $lt: 20 } });
    const expiredInsurance = await Vehicle.countDocuments({ insuranceExpiry: { $lt: new Date() } });

    const statusDistribution = [
      { status: 'active', count: activeVehicles, color: '#10B981' },
      { status: 'maintenance', count: maintenanceVehicles, color: '#F59E0B' },
      { status: 'on-route', count: onRouteVehicles, color: '#3B82F6' },
      { status: 'inactive', count: inactiveVehicles, color: '#6B7280' }
    ];

    // Get vehicle types distribution
    const vehicleTypes = await Vehicle.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalVehicles,
        activeVehicles,
        maintenanceVehicles,
        onRouteVehicles,
        inactiveVehicles,
        dueForService,
        lowFuelVehicles,
        expiredInsurance,
        statusDistribution,
        vehicleTypes
      }
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const deleteVehicle = asyncHandler(async (req, res) => {
  try {
    const vehicle = await Vehicle.findByIdAndDelete(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vehicle not found' 
      });
    }

    // Unassign driver if assigned
    if (vehicle.currentDriver) {
      await Driver.findByIdAndUpdate(vehicle.currentDriver, { 
        $unset: { assignedVehicle: "" } 
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('vehicle-deleted', req.params.id);
    }

    res.json({ 
      success: true, 
      message: 'Vehicle deleted successfully' 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const getVehicleByNumber = asyncHandler(async (req, res) => {
  try {
    const { vehicleNo } = req.params;
    const vehicle = await Vehicle.findOne({ vehicleNo })
      .populate('currentDriver', 'firstName lastName phone email employeeId')
      .populate('currentRoute', 'routeNo name zone');

    if (!vehicle) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vehicle not found' 
      });
    }

    res.json({ success: true, data: vehicle });
  } catch (error) {
    handleError(res, error);
  }
});

export const getVehiclesByStatus = asyncHandler(async (req, res) => {
  try {
    const { status } = req.params;
    const validStatuses = ['active', 'inactive', 'maintenance', 'on-route'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const vehicles = await Vehicle.find({ status })
      .populate('currentDriver', 'firstName lastName phone employeeId')
      .populate('currentRoute', 'routeNo name')
      .sort({ vehicleNo: 1 });

    res.json({ 
      success: true, 
      count: vehicles.length, 
      data: vehicles 
    });
  } catch (error) {
    handleError(res, error);
  }
});

// =================== DRIVER CONTROLLERS ===================

export const getAllDrivers = asyncHandler(async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;

    const query = {};
    if (status && status !== 'all') query.status = status;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { licenseNo: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const drivers = await Driver.find(query)
      .populate('assignedVehicle', 'vehicleNo model capacity registrationNo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Driver.countDocuments(query);

    res.json({
      success: true,
      count: drivers.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      data: drivers
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const getDriverById = asyncHandler(async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id)
      .populate('assignedVehicle', 'vehicleNo make model capacity registrationNo');

    if (!driver) {
      return res.status(404).json({ 
        success: false, 
        message: 'Driver not found' 
      });
    }

    res.json({ success: true, data: driver });
  } catch (error) {
    handleError(res, error);
  }
});

export const createDriver = asyncHandler(async (req, res) => {
  try {
    const driverData = req.body;

    // Basic validation
    if (!driverData.firstName || !driverData.lastName || !driverData.phone) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, and phone are required'
      });
    }

    // Check for duplicate phone
    if (driverData.phone) {
      const existingPhone = await Driver.findOne({ phone: driverData.phone });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'Driver with this phone number already exists'
        });
      }
    }

    // Check for duplicate email
    if (driverData.email) {
      const existingEmail = await Driver.findOne({ email: driverData.email });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Driver with this email already exists'
        });
      }
    }

    // Check for duplicate license
    if (driverData.licenseNo) {
      const existingLicense = await Driver.findOne({ licenseNo: driverData.licenseNo });
      if (existingLicense) {
        return res.status(400).json({
          success: false,
          message: 'Driver with this license number already exists'
        });
      }
    }

    // Generate employee ID if not provided
    if (!driverData.employeeId) {
      const count = await Driver.countDocuments();
      driverData.employeeId = `DRV${(count + 1).toString().padStart(4, '0')}`;
    }

    // Set default status if not provided
    if (!driverData.status) {
      driverData.status = 'active';
    }

    const driver = new Driver(driverData);
    await driver.save();

    res.status(201).json({ 
      success: true, 
      message: 'Driver created successfully', 
      data: driver 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const updateDriver = asyncHandler(async (req, res) => {
  try {
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('assignedVehicle');

    if (!driver) {
      return res.status(404).json({ 
        success: false, 
        message: 'Driver not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Driver updated successfully', 
      data: driver 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const deleteDriver = asyncHandler(async (req, res) => {
  try {
    const driver = await Driver.findByIdAndDelete(req.params.id);
    
    if (!driver) {
      return res.status(404).json({ 
        success: false, 
        message: 'Driver not found' 
      });
    }

    // If driver was assigned to a vehicle, unassign it
    if (driver.assignedVehicle) {
      await Vehicle.findByIdAndUpdate(driver.assignedVehicle, {
        $unset: { currentDriver: "" }
      });
    }

    res.json({ 
      success: true, 
      message: 'Driver deleted successfully' 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const getDriverStats = asyncHandler(async (req, res) => {
  try {
    const totalDrivers = await Driver.countDocuments();
    const activeDrivers = await Driver.countDocuments({ status: 'active' });
    const driversOnLeave = await Driver.countDocuments({ status: 'on-leave' });
    const driversWithVehicle = await Driver.countDocuments({ assignedVehicle: { $ne: null } });

    // Get drivers by license type
    const licenseDistribution = await Driver.aggregate([
      {
        $group: {
          _id: '$licenseType',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalDrivers,
        activeDrivers,
        driversOnLeave,
        driversWithVehicle,
        driversWithoutVehicle: totalDrivers - driversWithVehicle,
        licenseDistribution
      }
    });
  } catch (error) {
    handleError(res, error);
  }
});

// =================== ROUTE CONTROLLERS ===================

export const getAllRoutes = asyncHandler(async (req, res) => {
  try {
    const { zone, status, search, page = 1, limit = 10 } = req.query;

    const query = {};
    if (zone && zone !== 'all') query.zone = zone;
    if (status && status !== 'all') query.status = status;
    if (search) {
      query.$or = [
        { routeNo: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { startPoint: { $regex: search, $options: 'i' } },
        { endPoint: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const routes = await Route.find(query)
      .populate('assignedVehicle', 'vehicleNo model capacity currentFuel registrationNo')
      .populate('assignedDriver', 'firstName lastName phone employeeId')
      .sort({ routeNo: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Route.countDocuments(query);

    res.json({
      success: true,
      count: routes.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      data: routes
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const getRouteById = asyncHandler(async (req, res) => {
  try {
    const route = await Route.findById(req.params.id)
      .populate('assignedVehicle')
      .populate('assignedDriver');

    if (!route) {
      return res.status(404).json({ 
        success: false, 
        message: 'Route not found' 
      });
    }

    res.json({ success: true, data: route });
  } catch (error) {
    handleError(res, error);
  }
});

export const createRoute = asyncHandler(async (req, res) => {
  try {
    const routeData = req.body;

    // Basic validation
    if (!routeData.routeNo || !routeData.name) {
      return res.status(400).json({
        success: false,
        message: 'Route number and name are required'
      });
    }

    // Check if route number already exists
    const existingRoute = await Route.findOne({ routeNo: routeData.routeNo });
    if (existingRoute) {
      return res.status(400).json({ 
        success: false, 
        message: 'Route number already exists' 
      });
    }

    // Set default status if not provided
    if (!routeData.status) {
      routeData.status = 'active';
    }

    const route = new Route(routeData);
    await route.save();

    res.status(201).json({ 
      success: true, 
      message: 'Route created successfully', 
      data: route 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const updateRoute = asyncHandler(async (req, res) => {
  try {
    const route = await Route.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('assignedVehicle').populate('assignedDriver');

    if (!route) {
      return res.status(404).json({ 
        success: false, 
        message: 'Route not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Route updated successfully', 
      data: route 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const deleteRoute = asyncHandler(async (req, res) => {
  try {
    const route = await Route.findByIdAndDelete(req.params.id);
    
    if (!route) {
      return res.status(404).json({ 
        success: false, 
        message: 'Route not found' 
      });
    }

    // If route was assigned to a vehicle, unassign it
    if (route.assignedVehicle) {
      await Vehicle.findByIdAndUpdate(route.assignedVehicle, {
        $unset: { currentRoute: "" }
      });
    }

    res.json({ 
      success: true, 
      message: 'Route deleted successfully' 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const getRouteStats = asyncHandler(async (req, res) => {
  try {
    const totalRoutes = await Route.countDocuments();
    const activeRoutes = await Route.countDocuments({ status: 'active' });
    const routesWithVehicle = await Route.countDocuments({ assignedVehicle: { $ne: null } });
    const routesWithDriver = await Route.countDocuments({ assignedDriver: { $ne: null } });

    // Get routes by zone
    const zoneDistribution = await Route.aggregate([
      {
        $group: {
          _id: '$zone',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Calculate total capacity and occupied
    const routes = await Route.find({ assignedVehicle: { $ne: null } })
      .populate('assignedVehicle', 'capacity');
    
    let totalCapacity = 0;
    let totalOccupied = 0;

    routes.forEach(route => {
      if (route.assignedVehicle && route.assignedVehicle.capacity) {
        totalCapacity += route.assignedVehicle.capacity;
        totalOccupied += route.monthlyStudents || 0;
      }
    });

    const overallEfficiency = totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0;

    // Get most efficient routes (top 5)
    const efficientRoutes = await Route.find({ assignedVehicle: { $ne: null } })
      .populate('assignedVehicle', 'capacity vehicleNo')
      .sort({ efficiency: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        totalRoutes,
        activeRoutes,
        routesWithVehicle,
        routesWithDriver,
        totalCapacity,
        totalOccupied,
        overallEfficiency: overallEfficiency.toFixed(2),
        zoneDistribution,
        efficientRoutes
      }
    });
  } catch (error) {
    handleError(res, error);
  }
});

// =================== MAINTENANCE CONTROLLERS (FIXED) ===================

export const getAllMaintenance = asyncHandler(async (req, res) => {
  try {
    const { status, priority, vehicle, startDate, endDate, page = 1, limit = 10 } = req.query;

    const query = {};
    if (status && status !== 'all') query.status = status;
    if (priority && priority !== 'all') query.priority = priority;
    if (vehicle && vehicle !== 'all') {
      // Validate if vehicle ID is valid
      if (mongoose.Types.ObjectId.isValid(vehicle)) {
        query.vehicle = vehicle;
      }
    }

    // Date range filter
    if (startDate || endDate) {
      query.scheduledDate = {};
      if (startDate) {
        query.scheduledDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.scheduledDate.$lte = new Date(endDate);
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const maintenance = await Maintenance.find(query)
      .populate('vehicle', 'vehicleNo make model registrationNo')
      .populate('driver', 'firstName lastName employeeId')
      .sort({ scheduledDate: 1, priority: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Maintenance.countDocuments(query);

    res.json({
      success: true,
      count: maintenance.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      data: maintenance
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const getMaintenanceById = asyncHandler(async (req, res) => {
  try {
    const maintenance = await Maintenance.findById(req.params.id)
      .populate('vehicle', 'vehicleNo make model registrationNo currentFuel')
      .populate('driver', 'firstName lastName phone employeeId');

    if (!maintenance) {
      return res.status(404).json({ 
        success: false, 
        message: 'Maintenance record not found' 
      });
    }

    res.json({ success: true, data: maintenance });
  } catch (error) {
    handleError(res, error);
  }
});

export const createMaintenance = asyncHandler(async (req, res) => {
  try {
    const maintenanceData = req.body;
    console.log('Creating maintenance with data:', maintenanceData);

    // Basic validation
    if (!maintenanceData.vehicle) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle is required'
      });
    }

    if (!maintenanceData.issueDescription) {
      return res.status(400).json({
        success: false,
        message: 'Issue description is required'
      });
    }

    // Validate vehicle ID
    if (!mongoose.Types.ObjectId.isValid(maintenanceData.vehicle)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle ID format'
      });
    }

    // Check if vehicle exists
    const vehicle = await Vehicle.findById(maintenanceData.vehicle);
    if (!vehicle) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vehicle not found' 
      });
    }

    // Validate driver ID if provided
    if (maintenanceData.driver) {
      if (!mongoose.Types.ObjectId.isValid(maintenanceData.driver)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid driver ID format'
        });
      }
      const driver = await Driver.findById(maintenanceData.driver);
      if (!driver) {
        return res.status(404).json({ 
          success: false, 
          message: 'Driver not found' 
        });
      }
    }

    // Generate maintenance ID
    const count = await Maintenance.countDocuments();
    const maintenanceId = `MT${Date.now().toString().slice(-6)}${(count + 1).toString().padStart(3, '0')}`;

    // Create maintenance record
    const maintenance = new Maintenance({
      maintenanceId,
      vehicle: maintenanceData.vehicle,
      driver: maintenanceData.driver || null,
      issueDescription: maintenanceData.issueDescription,
      priority: maintenanceData.priority || 'medium',
      status: maintenanceData.status || 'pending',
      estimatedCost: maintenanceData.estimatedCost || 0,
      scheduledDate: maintenanceData.scheduledDate || new Date(),
      reportedBy: maintenanceData.reportedBy || 'System',
      notes: maintenanceData.notes || '',
      reportedDate: new Date()
    });

    await maintenance.save();

    // If maintenance is in-progress, update vehicle status
    if (maintenanceData.status === 'in-progress') {
      await Vehicle.findByIdAndUpdate(maintenanceData.vehicle, { 
        status: 'maintenance' 
      });
    }

    // Populate the response
    const populatedMaintenance = await Maintenance.findById(maintenance._id)
      .populate('vehicle', 'vehicleNo make model registrationNo')
      .populate('driver', 'firstName lastName');

    const io = req.app.get('io');
    if (io) {
      io.emit('maintenance-created', populatedMaintenance);
    }

    res.status(201).json({ 
      success: true, 
      message: 'Maintenance record created successfully', 
      data: populatedMaintenance 
    });
  } catch (error) {
    console.error('Error creating maintenance:', error);
    handleError(res, error, 'Error creating maintenance record');
  }
});

export const updateMaintenance = asyncHandler(async (req, res) => {
  try {
    const maintenance = await Maintenance.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
    .populate('vehicle', 'vehicleNo make model registrationNo')
    .populate('driver', 'firstName lastName employeeId');

    if (!maintenance) {
      return res.status(404).json({ 
        success: false, 
        message: 'Maintenance record not found' 
      });
    }

    // If status changed to completed, update vehicle
    if (req.body.status === 'completed' && maintenance.vehicle) {
      await Vehicle.findByIdAndUpdate(maintenance.vehicle._id, {
        status: 'active',
        lastService: new Date(),
        nextService: new Date(new Date().setMonth(new Date().getMonth() + 6)) // Next service in 6 months
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('maintenance-updated', maintenance);
    }

    res.json({ 
      success: true, 
      message: 'Maintenance updated successfully', 
      data: maintenance 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const updateMaintenanceStatus = asyncHandler(async (req, res) => {
  try {
    const { status, actualCost, completionDate, notes } = req.body;
    const maintenanceId = req.params.id;

    if (!status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status is required' 
      });
    }

    const validStatuses = ['pending', 'in-progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const updateData = { status };
    if (actualCost !== undefined) updateData.actualCost = actualCost;
    if (completionDate) updateData.completionDate = new Date(completionDate);
    if (notes) updateData.notes = notes;

    // If completing, set completion date if not provided
    if (status === 'completed' && !completionDate) {
      updateData.completionDate = new Date();
    }

    const maintenance = await Maintenance.findByIdAndUpdate(
      maintenanceId,
      updateData,
      { new: true }
    ).populate('vehicle', 'vehicleNo make model registrationNo');

    if (!maintenance) {
      return res.status(404).json({ 
        success: false, 
        message: 'Maintenance record not found' 
      });
    }

    // Update vehicle status based on maintenance status
    if (maintenance.vehicle) {
      if (status === 'in-progress') {
        await Vehicle.findByIdAndUpdate(maintenance.vehicle._id, { status: 'maintenance' });
      } else if (status === 'completed') {
        await Vehicle.findByIdAndUpdate(maintenance.vehicle._id, {
          status: 'active',
          lastService: new Date(),
          nextService: new Date(new Date().setMonth(new Date().getMonth() + 6))
        });
      } else if (status === 'cancelled') {
        await Vehicle.findByIdAndUpdate(maintenance.vehicle._id, { status: 'active' });
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('maintenance-updated', maintenance);
    }

    res.json({ 
      success: true, 
      message: 'Maintenance status updated successfully', 
      data: maintenance 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const deleteMaintenance = asyncHandler(async (req, res) => {
  try {
    const maintenance = await Maintenance.findByIdAndDelete(req.params.id);
    
    if (!maintenance) {
      return res.status(404).json({ 
        success: false, 
        message: 'Maintenance record not found' 
      });
    }

    // If maintenance was in progress, update vehicle status back to active
    if (maintenance.status === 'in-progress' && maintenance.vehicle) {
      await Vehicle.findByIdAndUpdate(maintenance.vehicle, { status: 'active' });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('maintenance-deleted', req.params.id);
    }

    res.json({ 
      success: true, 
      message: 'Maintenance record deleted successfully' 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const getMaintenanceStats = asyncHandler(async (req, res) => {
  try {
    const totalMaintenance = await Maintenance.countDocuments();
    const pendingMaintenance = await Maintenance.countDocuments({ status: 'pending' });
    const inProgressMaintenance = await Maintenance.countDocuments({ status: 'in-progress' });
    const completedMaintenance = await Maintenance.countDocuments({ status: 'completed' });
    const cancelledMaintenance = await Maintenance.countDocuments({ status: 'cancelled' });

    // Calculate monthly cost
    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const currentMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    
    const monthlyCost = await Maintenance.aggregate([
      {
        $match: {
          status: 'completed',
          completionDate: { $gte: currentMonthStart, $lte: currentMonthEnd }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$actualCost' }
        }
      }
    ]);

    // Get priority distribution
    const priorityDistribution = await Maintenance.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalMaintenance,
        pendingMaintenance,
        inProgressMaintenance,
        completedMaintenance,
        cancelledMaintenance,
        monthlyCost: monthlyCost[0]?.total || 0,
        statusDistribution: [
          { status: 'pending', count: pendingMaintenance, color: '#F59E0B' },
          { status: 'in-progress', count: inProgressMaintenance, color: '#3B82F6' },
          { status: 'completed', count: completedMaintenance, color: '#10B981' },
          { status: 'cancelled', count: cancelledMaintenance, color: '#6B7280' }
        ],
        priorityDistribution
      }
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const getMaintenanceByVehicle = asyncHandler(async (req, res) => {
  try {
    const { vehicleId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid vehicle ID format' 
      });
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vehicle not found' 
      });
    }

    const maintenance = await Maintenance.find({ vehicle: vehicleId })
      .populate('vehicle', 'vehicleNo make model registrationNo')
      .populate('driver', 'firstName lastName employeeId')
      .sort({ scheduledDate: -1 });

    res.json({ 
      success: true, 
      count: maintenance.length, 
      data: maintenance 
    });
  } catch (error) {
    handleError(res, error);
  }
});

// =================== FUEL LOG CONTROLLERS (FIXED) ===================

export const getAllFuelLogs = asyncHandler(async (req, res) => {
  try {
    const { vehicle, driver, startDate, endDate, page = 1, limit = 10 } = req.query;

    const query = {};
    
    // Vehicle filter
    if (vehicle && vehicle !== 'all') {
      if (mongoose.Types.ObjectId.isValid(vehicle)) {
        query.vehicle = vehicle;
      }
    }
    
    // Driver filter
    if (driver && driver !== 'all') {
      if (mongoose.Types.ObjectId.isValid(driver)) {
        query.driver = driver;
      }
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const fuelLogs = await FuelLog.find(query)
      .populate('vehicle', 'vehicleNo make model registrationNo currentFuel')
      .populate('driver', 'firstName lastName employeeId')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await FuelLog.countDocuments(query);

    res.json({
      success: true,
      count: fuelLogs.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      data: fuelLogs
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const getFuelLogById = asyncHandler(async (req, res) => {
  try {
    const fuelLog = await FuelLog.findById(req.params.id)
      .populate('vehicle', 'vehicleNo make model registrationNo')
      .populate('driver', 'firstName lastName employeeId');

    if (!fuelLog) {
      return res.status(404).json({ 
        success: false, 
        message: 'Fuel log not found' 
      });
    }

    res.json({ success: true, data: fuelLog });
  } catch (error) {
    handleError(res, error);
  }
});

export const createFuelLog = asyncHandler(async (req, res) => {
  try {
    const fuelLogData = req.body;
    console.log('Creating fuel log with data:', fuelLogData);

    // Basic validation
    if (!fuelLogData.vehicle) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle is required'
      });
    }

    if (!fuelLogData.quantity || fuelLogData.quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid fuel quantity is required'
      });
    }

    if (!fuelLogData.rate || fuelLogData.rate <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid fuel rate is required'
      });
    }

    // Validate vehicle ID
    if (!mongoose.Types.ObjectId.isValid(fuelLogData.vehicle)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle ID format'
      });
    }

    // Check if vehicle exists
    const vehicle = await Vehicle.findById(fuelLogData.vehicle);
    if (!vehicle) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vehicle not found' 
      });
    }

    // Validate driver ID if provided
    if (fuelLogData.driver) {
      if (!mongoose.Types.ObjectId.isValid(fuelLogData.driver)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid driver ID format'
        });
      }
      const driver = await Driver.findById(fuelLogData.driver);
      if (!driver) {
        return res.status(404).json({ 
          success: false, 
          message: 'Driver not found' 
        });
      }
    }

    // Calculate total cost if not provided
    const totalCost = fuelLogData.totalCost || (fuelLogData.quantity * fuelLogData.rate);

    // Create fuel log
    const fuelLog = new FuelLog({
      vehicle: fuelLogData.vehicle,
      driver: fuelLogData.driver || null,
      quantity: fuelLogData.quantity,
      rate: fuelLogData.rate,
      totalCost: totalCost,
      odometerReading: fuelLogData.odometerReading || 0,
      fuelType: fuelLogData.fuelType || 'diesel',
      stationName: fuelLogData.stationName || '',
      date: fuelLogData.date || new Date(),
      notes: fuelLogData.notes || ''
    });

    await fuelLog.save();

    // Update vehicle's fuel level
    const newFuelLevel = Math.min(100, vehicle.currentFuel + fuelLogData.quantity);
    await Vehicle.findByIdAndUpdate(fuelLogData.vehicle, { 
      currentFuel: newFuelLevel 
    });

    // Populate the response
    const populatedFuelLog = await FuelLog.findById(fuelLog._id)
      .populate('vehicle', 'vehicleNo make model registrationNo')
      .populate('driver', 'firstName lastName');

    const io = req.app.get('io');
    if (io) {
      io.emit('fuel-log-created', populatedFuelLog);
      io.to(`vehicle-${fuelLogData.vehicle}`).emit('fuel-level-updated', {
        vehicleId: fuelLogData.vehicle,
        fuelLevel: newFuelLevel,
        timestamp: new Date()
      });
    }

    res.status(201).json({ 
      success: true, 
      message: 'Fuel log created successfully', 
      data: populatedFuelLog 
    });
  } catch (error) {
    console.error('Error creating fuel log:', error);
    handleError(res, error, 'Error creating fuel log');
  }
});

export const updateFuelLog = asyncHandler(async (req, res) => {
  try {
    const fuelLog = await FuelLog.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
    .populate('vehicle', 'vehicleNo make model registrationNo')
    .populate('driver', 'firstName lastName employeeId');

    if (!fuelLog) {
      return res.status(404).json({ 
        success: false, 
        message: 'Fuel log not found' 
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('fuel-log-updated', fuelLog);
    }

    res.json({ 
      success: true, 
      message: 'Fuel log updated successfully', 
      data: fuelLog 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const deleteFuelLog = asyncHandler(async (req, res) => {
  try {
    const fuelLog = await FuelLog.findByIdAndDelete(req.params.id);
    
    if (!fuelLog) {
      return res.status(404).json({ 
        success: false, 
        message: 'Fuel log not found' 
      });
    }

    // Adjust vehicle's fuel level if needed
    // Note: This might need more complex logic based on your requirements

    const io = req.app.get('io');
    if (io) {
      io.emit('fuel-log-deleted', req.params.id);
    }

    res.json({ 
      success: true, 
      message: 'Fuel log deleted successfully' 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const getFuelStats = asyncHandler(async (req, res) => {
  try {
    const { period = 'monthly', startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else {
      // Default to current month
      const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const currentMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
      dateFilter.date = { $gte: currentMonthStart, $lte: currentMonthEnd };
    }

    // Calculate total fuel stats
    const totalStats = await FuelLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: '$quantity' },
          totalCost: { $sum: '$totalCost' },
          avgRate: { $avg: '$rate' }
        }
      }
    ]);

    // Get fuel consumption by vehicle
    const vehicleStats = await FuelLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$vehicle',
          totalQuantity: { $sum: '$quantity' },
          totalCost: { $sum: '$totalCost' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalCost: -1 } },
      { $limit: 10 }
    ]);

    // Populate vehicle details
    for (let stat of vehicleStats) {
      const vehicle = await Vehicle.findById(stat._id).select('vehicleNo make model');
      stat.vehicle = vehicle;
    }

    res.json({
      success: true,
      data: {
        period,
        totalQuantity: totalStats[0]?.totalQuantity || 0,
        totalCost: totalStats[0]?.totalCost || 0,
        avgRate: totalStats[0]?.avgRate || 0,
        avgEfficiency: 0, // You'll need to calculate based on odometer readings
        vehicleStats
      }
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const getFuelLogsByVehicle = asyncHandler(async (req, res) => {
  try {
    const { vehicleId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid vehicle ID format' 
      });
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vehicle not found' 
      });
    }

    const fuelLogs = await FuelLog.find({ vehicle: vehicleId })
      .populate('vehicle', 'vehicleNo make model registrationNo')
      .populate('driver', 'firstName lastName employeeId')
      .sort({ date: -1 });

    res.json({ 
      success: true, 
      count: fuelLogs.length, 
      data: fuelLogs 
    });
  } catch (error) {
    handleError(res, error);
  }
});

// =================== CLEANER CONTROLLERS ===================

export const getAllCleaners = asyncHandler(async (req, res) => {
  try {
    const { status, shift, page = 1, limit = 10 } = req.query;

    const query = {};
    if (status && status !== 'all') query.status = status;
    if (shift && shift !== 'all') query.shift = shift;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const cleaners = await Cleaner.find(query)
      .populate('assignedVehicles', 'vehicleNo make model registrationNo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Cleaner.countDocuments(query);

    res.json({
      success: true,
      count: cleaners.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      data: cleaners
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const getCleanerById = asyncHandler(async (req, res) => {
  try {
    const cleaner = await Cleaner.findById(req.params.id)
      .populate('assignedVehicles', 'vehicleNo make model capacity registrationNo');

    if (!cleaner) {
      return res.status(404).json({ 
        success: false, 
        message: 'Cleaner not found' 
      });
    }

    res.json({ success: true, data: cleaner });
  } catch (error) {
    handleError(res, error);
  }
});

export const createCleaner = asyncHandler(async (req, res) => {
  try {
    const cleanerData = req.body;

    // Basic validation
    if (!cleanerData.firstName || !cleanerData.lastName || !cleanerData.phone) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, and phone are required'
      });
    }

    // Check for duplicate phone
    if (cleanerData.phone) {
      const existingPhone = await Cleaner.findOne({ phone: cleanerData.phone });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'Cleaner with this phone number already exists'
        });
      }
    }

    // Generate employee ID if not provided
    if (!cleanerData.employeeId) {
      const count = await Cleaner.countDocuments();
      cleanerData.employeeId = `CLN${(count + 1).toString().padStart(4, '0')}`;
    }

    // Set default status if not provided
    if (!cleanerData.status) {
      cleanerData.status = 'active';
    }

    const cleaner = new Cleaner(cleanerData);
    await cleaner.save();

    res.status(201).json({ 
      success: true, 
      message: 'Cleaner created successfully', 
      data: cleaner 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const updateCleaner = asyncHandler(async (req, res) => {
  try {
    const cleaner = await Cleaner.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('assignedVehicles');

    if (!cleaner) {
      return res.status(404).json({ 
        success: false, 
        message: 'Cleaner not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Cleaner updated successfully', 
      data: cleaner 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const deleteCleaner = asyncHandler(async (req, res) => {
  try {
    const cleaner = await Cleaner.findByIdAndDelete(req.params.id);
    
    if (!cleaner) {
      return res.status(404).json({ 
        success: false, 
        message: 'Cleaner not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Cleaner deleted successfully' 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const assignCleanerToVehicle = asyncHandler(async (req, res) => {
  try {
    const { cleanerId, vehicleId } = req.body;

    if (!cleanerId || !vehicleId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cleaner ID and Vehicle ID are required' 
      });
    }

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(cleanerId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid cleaner ID format' 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid vehicle ID format' 
      });
    }

    const cleaner = await Cleaner.findById(cleanerId);
    if (!cleaner) {
      return res.status(404).json({ 
        success: false, 
        message: 'Cleaner not found' 
      });
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vehicle not found' 
      });
    }

    // Check if already assigned
    if (!cleaner.assignedVehicles.includes(vehicleId)) {
      cleaner.assignedVehicles.push(vehicleId);
      await cleaner.save();
    }

    // Populate the response
    const updatedCleaner = await Cleaner.findById(cleanerId)
      .populate('assignedVehicles', 'vehicleNo make model registrationNo');

    res.json({ 
      success: true, 
      message: 'Cleaner assigned to vehicle successfully', 
      data: updatedCleaner 
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const removeCleanerFromVehicle = asyncHandler(async (req, res) => {
  try {
    const { cleanerId, vehicleId } = req.body;

    if (!cleanerId || !vehicleId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cleaner ID and Vehicle ID are required' 
      });
    }

    const cleaner = await Cleaner.findById(cleanerId);
    if (!cleaner) {
      return res.status(404).json({ 
        success: false, 
        message: 'Cleaner not found' 
      });
    }

    // Remove vehicle from cleaner's assigned vehicles
    cleaner.assignedVehicles = cleaner.assignedVehicles.filter(
      id => id.toString() !== vehicleId
    );
    
    await cleaner.save();

    // Populate the response
    const updatedCleaner = await Cleaner.findById(cleanerId)
      .populate('assignedVehicles', 'vehicleNo make model registrationNo');

    res.json({ 
      success: true, 
      message: 'Cleaner removed from vehicle successfully', 
      data: updatedCleaner 
    });
  } catch (error) {
    handleError(res, error);
  }
});

// =================== DASHBOARD STATISTICS ===================

export const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    // Vehicle stats
    const totalVehicles = await Vehicle.countDocuments();
    const activeVehicles = await Vehicle.countDocuments({ status: 'active' });
    const onRouteVehicles = await Vehicle.countDocuments({ status: 'on-route' });
    const maintenanceVehicles = await Vehicle.countDocuments({ status: 'maintenance' });
    const lowFuelVehicles = await Vehicle.countDocuments({ currentFuel: { $lt: 20 } });
    
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const dueForService = await Vehicle.countDocuments({
      nextService: { $lte: nextWeek, $gte: new Date() }
    });
    
    // Driver stats
    const totalDrivers = await Driver.countDocuments();
    const activeDrivers = await Driver.countDocuments({ status: 'active' });
    const driversOnLeave = await Driver.countDocuments({ status: 'on-leave' });
    
    // Route stats
    const activeRoutes = await Route.countDocuments({ status: 'active' });
    
    // Maintenance stats
    const pendingMaintenance = await Maintenance.countDocuments({ status: 'pending' });
    const highPriorityMaintenance = await Maintenance.countDocuments({ 
      status: { $in: ['pending', 'in-progress'] },
      priority: 'high' 
    });
    
    // Fuel stats (current month)
    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const currentMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    
    const monthlyFuelStats = await FuelLog.aggregate([
      {
        $match: {
          date: { $gte: currentMonthStart, $lte: currentMonthEnd }
        }
      },
      {
        $group: {
          _id: null,
          monthlyCost: { $sum: '$totalCost' },
          monthlyConsumption: { $sum: '$quantity' }
        }
      }
    ]);

    // Recent activities
    const recentMaintenance = await Maintenance.find()
      .populate('vehicle', 'vehicleNo')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentFuelLogs = await FuelLog.find()
      .populate('vehicle', 'vehicleNo')
      .populate('driver', 'firstName lastName')
      .sort({ date: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        vehicles: {
          total: totalVehicles,
          active: activeVehicles,
          onRoute: onRouteVehicles,
          maintenance: maintenanceVehicles,
          lowFuel: lowFuelVehicles,
          dueForService: dueForService
        },
        drivers: {
          total: totalDrivers,
          active: activeDrivers,
          onLeave: driversOnLeave,
          available: totalDrivers - driversOnLeave
        },
        routes: { 
          active: activeRoutes,
          total: await Route.countDocuments()
        },
        maintenance: {
          pending: pendingMaintenance,
          highPriority: highPriorityMaintenance,
          inProgress: await Maintenance.countDocuments({ status: 'in-progress' })
        },
        fuel: {
          monthlyCost: monthlyFuelStats[0]?.monthlyCost || 0,
          monthlyConsumption: monthlyFuelStats[0]?.monthlyConsumption || 0,
          avgPrice: monthlyFuelStats[0]?.monthlyCost / (monthlyFuelStats[0]?.monthlyConsumption || 1)
        },
        recentActivities: {
          maintenance: recentMaintenance,
          fuelLogs: recentFuelLogs
        }
      }
    });
  } catch (error) {
    handleError(res, error);
  }
});

// =================== REPORT GENERATION ===================

export const generateReport = asyncHandler(async (req, res) => {
  try {
    const { type, format = 'json', startDate, endDate, filters = {} } = req.body;
    
    if (!type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Report type is required' 
      });
    }

    let reportData;
    let fileName = '';

    // Apply date filter if provided
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    switch (type) {
      case 'vehicles':
        fileName = `vehicles-report-${Date.now()}`;
        reportData = await Vehicle.find(filters)
          .populate('currentDriver', 'firstName lastName employeeId phone')
          .populate('currentRoute', 'routeNo name zone')
          .sort({ vehicleNo: 1 });
        break;
        
      case 'drivers':
        fileName = `drivers-report-${Date.now()}`;
        reportData = await Driver.find(filters)
          .populate('assignedVehicle', 'vehicleNo make model registrationNo')
          .sort({ employeeId: 1 });
        break;
        
      case 'maintenance':
        fileName = `maintenance-report-${Date.now()}`;
        reportData = await Maintenance.find({ ...dateFilter, ...filters })
          .populate('vehicle', 'vehicleNo make model registrationNo')
          .populate('driver', 'firstName lastName employeeId')
          .sort({ scheduledDate: -1 });
        break;
        
      case 'fuel':
        fileName = `fuel-report-${Date.now()}`;
        reportData = await FuelLog.find({ ...dateFilter, ...filters })
          .populate('vehicle', 'vehicleNo make model registrationNo')
          .populate('driver', 'firstName lastName employeeId')
          .sort({ date: -1 });
        break;
        
      case 'routes':
        fileName = `routes-report-${Date.now()}`;
        reportData = await Route.find(filters)
          .populate('assignedVehicle', 'vehicleNo make model')
          .populate('assignedDriver', 'firstName lastName')
          .sort({ routeNo: 1 });
        break;
        
      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid report type. Must be: vehicles, drivers, maintenance, fuel, or routes' 
        });
    }

    // Generate report in requested format
    if (format === 'csv') {
      // Convert to CSV (simplified version)
      let csv = '';
      if (reportData.length > 0) {
        const headers = Object.keys(reportData[0].toObject()).join(',');
        csv += headers + '\n';
        
        reportData.forEach(item => {
          const values = Object.values(item.toObject()).map(val => 
            typeof val === 'object' ? JSON.stringify(val) : val
          ).join(',');
          csv += values + '\n';
        });
      }
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}.csv`);
      return res.send(csv);
    } else {
      // Default JSON format
      res.json({
        success: true,
        message: 'Report generated successfully',
        data: {
          type,
          format,
          generatedAt: new Date(),
          records: reportData.length,
          fileName: `${fileName}.${format}`,
          data: reportData
        }
      });
    }
  } catch (error) {
    handleError(res, error);
  }
});

// =================== TEST DATA ENDPOINTS ===================

export const getTestIds = asyncHandler(async (req, res) => {
  try {
    // Get first vehicle
    const vehicle = await Vehicle.findOne({}).select('_id vehicleNo registrationNo');
    
    // Get first driver
    const driver = await Driver.findOne({}).select('_id firstName lastName employeeId');
    
    if (!vehicle) {
      return res.status(400).json({
        success: false,
        message: 'No vehicles found. Please create a vehicle first.'
      });
    }

    res.json({
      success: true,
      message: 'Copy these IDs for testing:',
      ids: {
        vehicleId: vehicle._id,
        vehicleNo: vehicle.vehicleNo,
        registrationNo: vehicle.registrationNo,
        driverId: driver?._id || 'No driver found',
        driverName: driver ? `${driver.firstName} ${driver.lastName}` : 'N/A',
        driverEmployeeId: driver?.employeeId || 'N/A'
      },
      exampleRequests: {
        createMaintenance: {
          method: 'POST',
          url: '/api/transport/maintenance',
          body: {
            vehicle: vehicle._id,
            issueDescription: "Engine maintenance",
            priority: "medium",
            estimatedCost: 5000
          }
        },
        createFuelLog: {
          method: 'POST',
          url: '/api/transport/fuel-logs',
          body: {
            vehicle: vehicle._id,
            driver: driver?._id,
            quantity: 50,
            rate: 90,
            odometerReading: 15000
          }
        }
      }
    });
  } catch (error) {
    handleError(res, error);
  }
});

export const createTestData = asyncHandler(async (req, res) => {
  try {
    console.log('Creating test data...');
    
    // Get existing vehicle
    const vehicles = await Vehicle.find({});
    const vehicleId = vehicles[0]?._id;
    
    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'No vehicles found. Please create a vehicle first.'
      });
    }
    
    // Get existing driver
    const drivers = await Driver.find({});
    const driverId = drivers[0]?._id;
    
    // Create maintenance record
    const maintenance = new Maintenance({
      vehicle: vehicleId,
      driver: driverId,
      maintenanceId: `MT${Date.now().toString().slice(-6)}001`,
      issueDescription: 'Test maintenance - Engine oil change',
      priority: 'medium',
      status: 'pending',
      estimatedCost: 5000,
      scheduledDate: new Date(),
      reportedBy: 'Test System'
    });
    
    await maintenance.save();
    
    // Create fuel log
    const fuelLog = new FuelLog({
      vehicle: vehicleId,
      driver: driverId,
      quantity: 50,
      rate: 90,
      totalCost: 4500,
      odometerReading: 15000,
      fuelType: 'diesel',
      stationName: 'BP Petrol Station',
      date: new Date()
    });
    
    await fuelLog.save();
    
    // Update vehicle fuel level
    await Vehicle.findByIdAndUpdate(vehicleId, { 
      $inc: { currentFuel: 50 } 
    });

    res.json({
      success: true,
      message: 'Test data created successfully',
      data: {
        maintenance,
        fuelLog
      }
    });
    
  } catch (error) {
    console.error('Error creating test data:', error);
    handleError(res, error);
  }
});

// =================== HEALTH CHECK ===================

export const healthCheck = asyncHandler(async (req, res) => {
  try {
    // Check database connections
    const [vehiclesCount, driversCount, routesCount] = await Promise.all([
      Vehicle.countDocuments(),
      Driver.countDocuments(),
      Route.countDocuments()
    ]);

    res.status(200).json({
      success: true,
      message: "Transport module is running",
      timestamp: new Date().toISOString(),
      database: {
        vehicles: vehiclesCount,
        drivers: driversCount,
        routes: routesCount,
        status: "connected"
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Transport module health check failed",
      error: error.message
    });
  }
});